// Phase D — local RAG service. Wraps chunking + embedding + KNN over the
// SQLite RAG store. Designed to keep working when Ollama is offline (just
// degrades to "no semantic search"; nothing else breaks).
package app

import (
	"strings"

	"github.com/goat-io/delphi-brain/cli/internal/domain"
)

type RAGService struct {
	store    domain.RAGRepository
	embedder domain.Embedder
}

func NewRAGService(store domain.RAGRepository, embedder domain.Embedder) *RAGService {
	return &RAGService{store: store, embedder: embedder}
}

// Available reports whether the embedder backend is reachable.
func (s *RAGService) Available() bool { return s.embedder != nil && s.embedder.Available() }

// Ingest chunks `body`, embeds each chunk, and replaces the doc's stored
// chunks. Skips when the content_hash hasn't changed since the last index
// (keyed by md5 the indexer already computes — caller passes it in).
// Returns (chunksWritten, error). chunksWritten == 0 with nil error means
// "skipped" (cache hit or Ollama down).
func (s *RAGService) Ingest(path, contentHash, body string) (int, error) {
	if !s.Available() {
		return 0, nil
	}
	if existing, _ := s.store.Hash(path); existing == contentHash && contentHash != "" {
		return 0, nil
	}
	chunks := splitMarkdown(body)
	if len(chunks) == 0 {
		// Body became empty — wipe anything we had stored.
		s.store.Delete(path)
		return 0, nil
	}
	enriched := make([]domain.RAGChunk, 0, len(chunks))
	for _, txt := range chunks {
		vec, err := s.embedder.Embed(txt)
		if err != nil {
			return len(enriched), err
		}
		if len(vec) == 0 {
			continue
		}
		enriched = append(enriched, domain.RAGChunk{Text: txt, Embedding: vec})
	}
	if err := s.store.Replace(path, contentHash, enriched); err != nil {
		return len(enriched), err
	}
	return len(enriched), nil
}

// Query embeds `text` and returns top-k chunks by cosine similarity.
func (s *RAGService) Query(text string, k int) ([]domain.RAGHit, error) {
	if !s.Available() {
		return []domain.RAGHit{}, nil
	}
	vec, err := s.embedder.EmbedQuery(text)
	if err != nil {
		return nil, err
	}
	if len(vec) == 0 {
		return []domain.RAGHit{}, nil
	}
	return s.store.Search(vec, k)
}

func (s *RAGService) Delete(path string) error      { return s.store.Delete(path) }
func (s *RAGService) Stats() (int, int, error)      { return s.store.Stats() }

// ── Chunker ────────────────────────────────────────────────────────────
// Simple paragraph-aware splitter with overlap. Targets ~600 chars per chunk
// (≈150 tokens for nomic-embed-text), 100 char overlap so the boundary doesn't
// split a sentence's context. Strips frontmatter (already removed by
// ParseFrontmatter upstream), code-fence noise stays — embedding model handles
// it fine and code mentions are useful retrieval anchors.

const (
	targetChunk = 800
	overlap     = 100
)

func splitMarkdown(body string) []string {
	body = strings.TrimSpace(body)
	if body == "" {
		return nil
	}
	// Coarse split on blank lines so headings + paragraphs stay together.
	paras := strings.Split(body, "\n\n")
	var chunks []string
	var buf strings.Builder
	flush := func() {
		s := strings.TrimSpace(buf.String())
		if s != "" {
			chunks = append(chunks, s)
		}
		buf.Reset()
	}
	for _, p := range paras {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		if buf.Len()+len(p)+2 > targetChunk && buf.Len() > 0 {
			flush()
			// Overlap: carry the tail of the previous chunk as context for the next.
			if len(chunks) > 0 {
				prev := chunks[len(chunks)-1]
				if len(prev) > overlap {
					buf.WriteString(prev[len(prev)-overlap:])
					buf.WriteString("\n\n")
				}
			}
		}
		buf.WriteString(p)
		buf.WriteString("\n\n")
		// A single huge paragraph: hard-split inside by char count.
		if buf.Len() > targetChunk*2 {
			s := strings.TrimSpace(buf.String())
			for len(s) > targetChunk {
				chunks = append(chunks, s[:targetChunk])
				s = s[targetChunk-overlap:]
			}
			buf.Reset()
			if s != "" {
				buf.WriteString(s)
			}
		}
	}
	flush()
	return chunks
}
