// Phase D — local RAG storage. Chunks + embeddings live in SQLite as plain
// rows; vectors are float32 BLOBs (768-dim for nomic-embed-text). KNN is a
// linear scan in Go memory — at ~5k chunks × 768 dims (~15 MB), cosine over
// the lot is sub-millisecond. When the corpus exceeds 100k vectors, swap
// the search loop for sqlite-vec without touching schema or callers.
package sqlite

import (
	"database/sql"
	"encoding/binary"
	"math"
	"sort"

	"github.com/goat-io/delphi-brain/cli/internal/domain"
)

type RAGRepository struct {
	db *sql.DB
}

func NewRAGRepository(db *sql.DB) *RAGRepository {
	return &RAGRepository{db: db}
}

func (r *RAGRepository) InitSchema() error {
	_, err := r.db.Exec(`
	CREATE TABLE IF NOT EXISTS rag_chunks (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		path TEXT NOT NULL,
		idx INTEGER NOT NULL,
		text TEXT NOT NULL,
		embedding BLOB NOT NULL,
		dim INTEGER NOT NULL,
		content_hash TEXT DEFAULT '',
		UNIQUE (path, idx)
	);
	CREATE INDEX IF NOT EXISTS idx_rag_chunks_path ON rag_chunks(path);
	`)
	return err
}

// Replace wipes any existing chunks for `path` and inserts the new set in a
// single transaction. Indexer calls this after a doc's content hash changes.
func (r *RAGRepository) Replace(path, contentHash string, chunks []domain.RAGChunk) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.Exec("DELETE FROM rag_chunks WHERE path = ?", path); err != nil {
		return err
	}
	stmt, err := tx.Prepare("INSERT INTO rag_chunks (path, idx, text, embedding, dim, content_hash) VALUES (?, ?, ?, ?, ?, ?)")
	if err != nil {
		return err
	}
	defer stmt.Close()
	for i, ch := range chunks {
		blob := encodeVec(ch.Embedding)
		if _, err := stmt.Exec(path, i, ch.Text, blob, len(ch.Embedding), contentHash); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// Hash returns the stored content_hash for path (or empty if not indexed).
func (r *RAGRepository) Hash(path string) (string, error) {
	var h string
	err := r.db.QueryRow("SELECT content_hash FROM rag_chunks WHERE path = ? LIMIT 1", path).Scan(&h)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return h, err
}

// Delete removes all chunks for the given path.
func (r *RAGRepository) Delete(path string) error {
	_, err := r.db.Exec("DELETE FROM rag_chunks WHERE path = ?", path)
	return err
}

// Search loads every chunk into memory, computes cosine vs `query`, returns
// the top-k highest. Linear time — fine for tens of thousands of chunks.
func (r *RAGRepository) Search(query []float32, k int) ([]domain.RAGHit, error) {
	if k <= 0 {
		k = 10
	}
	rows, err := r.db.Query("SELECT path, idx, text, embedding FROM rag_chunks")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	qNorm := norm(query)
	type scored struct {
		hit   domain.RAGHit
		score float32
	}
	var heap []scored
	for rows.Next() {
		var path, text string
		var idx int
		var blob []byte
		if err := rows.Scan(&path, &idx, &text, &blob); err != nil {
			continue
		}
		vec := decodeVec(blob)
		if len(vec) != len(query) {
			continue
		}
		s := cosine(query, vec, qNorm)
		heap = append(heap, scored{
			hit: domain.RAGHit{Path: path, ChunkIndex: idx, Text: text, Score: s},
			score: s,
		})
	}
	sort.Slice(heap, func(i, j int) bool { return heap[i].score > heap[j].score })
	if len(heap) > k {
		heap = heap[:k]
	}
	out := make([]domain.RAGHit, len(heap))
	for i, x := range heap {
		out[i] = x.hit
	}
	return out, nil
}

// Stats returns chunk count + indexed-doc count.
func (r *RAGRepository) Stats() (chunks, docs int, err error) {
	r.db.QueryRow("SELECT COUNT(*) FROM rag_chunks").Scan(&chunks)
	r.db.QueryRow("SELECT COUNT(DISTINCT path) FROM rag_chunks").Scan(&docs)
	return chunks, docs, nil
}

// ── Vector encoding ────────────────────────────────────────────────────
// Float32 little-endian, packed end-to-end. 768-dim → 3 KB per chunk.

func encodeVec(v []float32) []byte {
	buf := make([]byte, 4*len(v))
	for i, f := range v {
		binary.LittleEndian.PutUint32(buf[i*4:], math.Float32bits(f))
	}
	return buf
}

func decodeVec(b []byte) []float32 {
	if len(b)%4 != 0 {
		return nil
	}
	out := make([]float32, len(b)/4)
	for i := range out {
		out[i] = math.Float32frombits(binary.LittleEndian.Uint32(b[i*4:]))
	}
	return out
}

func norm(v []float32) float32 {
	var s float32
	for _, f := range v {
		s += f * f
	}
	return float32(math.Sqrt(float64(s)))
}

// cosine assumes the second arg has been pre-normed by the caller via norm().
// Pass the query's pre-computed norm to avoid recomputing it for every chunk.
func cosine(a, b []float32, aNorm float32) float32 {
	var dot, bNorm float32
	for i := range a {
		dot += a[i] * b[i]
		bNorm += b[i] * b[i]
	}
	denom := aNorm * float32(math.Sqrt(float64(bNorm)))
	if denom == 0 {
		return 0
	}
	return dot / denom
}
