package sqlite

import (
	"database/sql"
	"strings"

	"github.com/goat-io/delphi-brain/cli/internal/domain"
)

type DocumentRepository struct {
	db *sql.DB
}

func NewDocumentRepository(db *sql.DB) *DocumentRepository {
	return &DocumentRepository{db: db}
}

func (r *DocumentRepository) InitSchema() error {
	schema := `
	CREATE TABLE IF NOT EXISTS documents (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		path TEXT UNIQUE NOT NULL,
		name TEXT DEFAULT '',
		description TEXT DEFAULT '',
		domain TEXT DEFAULT '',
		owner TEXT DEFAULT '',
		status TEXT DEFAULT '',
		repo_url TEXT DEFAULT '',
		last_updated TEXT DEFAULT '',
		content_hash TEXT DEFAULT '',
		is_catalog INTEGER DEFAULT 0,
		system TEXT DEFAULT '',
		tags TEXT DEFAULT '',     -- comma-joined; queryable with LIKE
		audience TEXT DEFAULT '',
		indexed_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
		path, name, description, content, tokenize='porter'
	);

	CREATE TABLE IF NOT EXISTS document_links (
		src TEXT NOT NULL,
		dst TEXT NOT NULL,
		PRIMARY KEY (src, dst)
	);
	CREATE INDEX IF NOT EXISTS idx_doclinks_dst ON document_links(dst);
	`
	_, err := r.db.Exec(schema)
	if err != nil {
		return err
	}
	// Best-effort migration of existing dbs (predates the system/tags/audience
	// columns + document_links table). Errors ignored when columns already exist.
	for _, alter := range []string{
		`ALTER TABLE documents ADD COLUMN system TEXT DEFAULT ''`,
		`ALTER TABLE documents ADD COLUMN tags TEXT DEFAULT ''`,
		`ALTER TABLE documents ADD COLUMN audience TEXT DEFAULT ''`,
	} {
		r.db.Exec(alter)
	}
	return nil
}

func (r *DocumentRepository) GetHashes() (map[string]string, error) {
	rows, err := r.db.Query("SELECT path, content_hash FROM documents")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	hashes := make(map[string]string)
	for rows.Next() {
		var p, h string
		rows.Scan(&p, &h)
		hashes[p] = h
	}
	return hashes, nil
}

func (r *DocumentRepository) Upsert(doc domain.Document, body string) error {
	isCatalog := 0
	if doc.IsCatalog {
		isCatalog = 1
	}

	tagsCSV := strings.Join(doc.Tags, ",")
	audienceCSV := strings.Join(doc.Audience, ",")

	_, err := r.db.Exec(
		`INSERT INTO documents (path, name, description, domain, owner, status, repo_url, last_updated, content_hash, is_catalog, system, tags, audience, indexed_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
		ON CONFLICT(path) DO UPDATE SET
			name=excluded.name, description=excluded.description, domain=excluded.domain,
			owner=excluded.owner, status=excluded.status, repo_url=excluded.repo_url,
			last_updated=excluded.last_updated, content_hash=excluded.content_hash,
			is_catalog=excluded.is_catalog, system=excluded.system, tags=excluded.tags,
			audience=excluded.audience, indexed_at=CURRENT_TIMESTAMP`,
		doc.Path, doc.Name, doc.Description, doc.Domain, doc.Owner,
		doc.Status, doc.RepoURL, doc.LastUpdated, doc.ContentHash, isCatalog,
		doc.System, tagsCSV, audienceCSV)
	if err != nil {
		return err
	}

	// Update FTS (delete+re-insert since fts5 doesn't support ON CONFLICT)
	r.db.Exec("DELETE FROM documents_fts WHERE path = ?", doc.Path)
	r.db.Exec("INSERT INTO documents_fts (path, name, description, content) VALUES (?, ?, ?, ?)",
		doc.Path, doc.Name, doc.Description, body)

	return nil
}

func (r *DocumentRepository) List(filter domain.DocumentFilter) ([]domain.DocumentMeta, error) {
	cols := "path, name, description, domain, owner, status, repo_url, last_updated, is_catalog, system, tags, audience"
	var query string
	var args []interface{}
	var conds []string

	if filter.Query != "" {
		query = `SELECT d.` + strings.ReplaceAll(cols, ", ", ", d.") + `
			FROM documents d
			JOIN documents_fts f ON d.path = f.path
			WHERE documents_fts MATCH ?`
		args = append(args, filter.Query)
	} else {
		query = `SELECT ` + cols + ` FROM documents WHERE 1=1`
	}

	addCond := func(col, val string) {
		if val == "" { return }
		conds = append(conds, col+" = ?")
		args = append(args, val)
	}
	addCond("domain", filter.Domain)
	addCond("system", filter.System)
	addCond("owner", filter.Owner)
	addCond("status", filter.Status)
	if filter.Tag != "" {
		// CSV-stored field — match the tag as a comma-bounded substring.
		conds = append(conds, "(',' || tags || ',') LIKE ?")
		args = append(args, "%,"+filter.Tag+",%")
	}
	if filter.Audience != "" {
		conds = append(conds, "(',' || audience || ',') LIKE ?")
		args = append(args, "%,"+filter.Audience+",%")
	}
	if filter.Catalog {
		conds = append(conds, "is_catalog = 1")
	}
	for _, c := range conds {
		query += " AND " + c
	}
	query += " ORDER BY path"

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []domain.DocumentMeta
	for rows.Next() {
		var d domain.DocumentMeta
		var isCatalog int
		var tagsCSV, audienceCSV string
		if err := rows.Scan(&d.Path, &d.Name, &d.Description, &d.Domain, &d.Owner, &d.Status, &d.RepoURL, &d.LastUpdated, &isCatalog, &d.System, &tagsCSV, &audienceCSV); err != nil {
			continue
		}
		d.IsCatalog = isCatalog == 1
		if tagsCSV != "" { d.Tags = strings.Split(tagsCSV, ",") }
		if audienceCSV != "" { d.Audience = strings.Split(audienceCSV, ",") }
		result = append(result, d)
	}
	return result, nil
}

// Facets returns value→count distributions across the corpus for the fields
// the Documents browser surfaces as filter dropdowns. Multi-valued fields
// (tags, audience) are split before counting.
func (r *DocumentRepository) Facets() (map[string]map[string]int, error) {
	out := map[string]map[string]int{
		"owner": {}, "status": {}, "system": {}, "domain": {},
		"tags": {}, "audience": {},
	}
	scalar := func(field string) {
		rows, err := r.db.Query(`SELECT ` + field + `, COUNT(*) FROM documents WHERE ` + field + ` != '' GROUP BY ` + field)
		if err != nil { return }
		defer rows.Close()
		for rows.Next() {
			var v string; var n int
			rows.Scan(&v, &n)
			out[field][v] = n
		}
	}
	multi := func(field string) {
		rows, err := r.db.Query(`SELECT ` + field + ` FROM documents WHERE ` + field + ` != ''`)
		if err != nil { return }
		defer rows.Close()
		for rows.Next() {
			var csv string
			rows.Scan(&csv)
			for _, t := range strings.Split(csv, ",") {
				t = strings.TrimSpace(t)
				if t != "" { out[field][t]++ }
			}
		}
	}
	scalar("owner")
	scalar("status")
	scalar("system")
	scalar("domain")
	multi("tags")
	multi("audience")
	return out, nil
}

func (r *DocumentRepository) Get(path string) (*domain.DocumentMeta, error) {
	var d domain.DocumentMeta
	var isCatalog int
	var tagsCSV, audienceCSV string
	err := r.db.QueryRow(
		"SELECT path, name, description, domain, owner, status, repo_url, last_updated, is_catalog, system, tags, audience FROM documents WHERE path = ?",
		path).Scan(&d.Path, &d.Name, &d.Description, &d.Domain, &d.Owner, &d.Status, &d.RepoURL, &d.LastUpdated, &isCatalog, &d.System, &tagsCSV, &audienceCSV)
	if err != nil {
		return nil, err
	}
	d.IsCatalog = isCatalog == 1
	if tagsCSV != "" { d.Tags = strings.Split(tagsCSV, ",") }
	if audienceCSV != "" { d.Audience = strings.Split(audienceCSV, ",") }
	return &d, nil
}

func (r *DocumentRepository) Search(query string, limit int) ([]domain.SearchResult, error) {
	rows, err := r.db.Query(`
		SELECT f.path, d.name, snippet(documents_fts, 3, '<b>', '</b>', '...', 32) as snippet, d.domain
		FROM documents_fts f
		JOIN documents d ON d.path = f.path
		WHERE documents_fts MATCH ?
		ORDER BY rank
		LIMIT ?`, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []domain.SearchResult
	for rows.Next() {
		var r domain.SearchResult
		if err := rows.Scan(&r.Path, &r.Name, &r.Snippet, &r.Domain); err != nil {
			continue
		}
		results = append(results, r)
	}
	return results, nil
}

func (r *DocumentRepository) Stats() (*domain.DocumentStats, error) {
	stats := &domain.DocumentStats{Domains: make(map[string]int)}

	r.db.QueryRow("SELECT COUNT(*) FROM documents").Scan(&stats.TotalDocs)
	r.db.QueryRow("SELECT COUNT(*) FROM documents WHERE is_catalog = 1").Scan(&stats.CatalogEntries)

	rows, err := r.db.Query("SELECT domain, COUNT(*) FROM documents WHERE domain != '' GROUP BY domain ORDER BY COUNT(*) DESC")
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var d string
			var cnt int
			rows.Scan(&d, &cnt)
			stats.Domains[d] = cnt
		}
	}

	return stats, nil
}

func (r *DocumentRepository) Domains() ([]domain.DomainCount, error) {
	rows, err := r.db.Query("SELECT domain, COUNT(*) as cnt FROM documents WHERE domain != '' GROUP BY domain ORDER BY cnt DESC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []domain.DomainCount
	for rows.Next() {
		var d domain.DomainCount
		rows.Scan(&d.Domain, &d.Count)
		result = append(result, d)
	}
	return result, nil
}

func (r *DocumentRepository) Delete(path string) error {
	r.db.Exec("DELETE FROM documents WHERE path = ?", path)
	r.db.Exec("DELETE FROM documents_fts WHERE path = ?", path)
	return nil
}

func (r *DocumentRepository) AllPaths() ([]string, error) {
	rows, err := r.db.Query("SELECT path FROM documents")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var paths []string
	for rows.Next() {
		var p string
		rows.Scan(&p)
		paths = append(paths, p)
	}
	return paths, nil
}

func (r *DocumentRepository) Count() (int, error) {
	var count int
	err := r.db.QueryRow("SELECT COUNT(*) FROM documents").Scan(&count)
	return count, err
}

// SetLinks replaces this doc's outbound links. Called from the indexer after
// scanning each markdown file for [text](relative-path) refs.
func (r *DocumentRepository) SetLinks(src string, dsts []string) error {
	tx, err := r.db.Begin()
	if err != nil { return err }
	defer tx.Rollback()
	if _, err := tx.Exec("DELETE FROM document_links WHERE src = ?", src); err != nil {
		return err
	}
	stmt, err := tx.Prepare("INSERT OR IGNORE INTO document_links (src, dst) VALUES (?, ?)")
	if err != nil { return err }
	defer stmt.Close()
	for _, d := range dsts {
		if d == "" || d == src { continue }
		stmt.Exec(src, d)
	}
	return tx.Commit()
}

// Backlinks returns paths that link TO `dst`, joined with doc metadata.
func (r *DocumentRepository) Backlinks(dst string) ([]domain.DocumentMeta, error) {
	rows, err := r.db.Query(`
		SELECT d.path, d.name, d.description, d.domain, d.owner, d.status, d.repo_url, d.last_updated, d.is_catalog, d.system
		FROM document_links l
		JOIN documents d ON d.path = l.src
		WHERE l.dst = ?
		ORDER BY d.path`, dst)
	if err != nil { return nil, err }
	defer rows.Close()
	var out []domain.DocumentMeta
	for rows.Next() {
		var d domain.DocumentMeta
		var isCatalog int
		if err := rows.Scan(&d.Path, &d.Name, &d.Description, &d.Domain, &d.Owner, &d.Status, &d.RepoURL, &d.LastUpdated, &isCatalog, &d.System); err != nil { continue }
		d.IsCatalog = isCatalog == 1
		out = append(out, d)
	}
	return out, nil
}

// Related ranks docs by signal strength to `path`:
//   1. Direct outbound link (this doc → other) — score 3
//   2. Backlink (other → this doc)            — score 3
//   3. Same `system` value                    — score 2
//   4. Tag overlap (per shared tag)           — score 1 per tag
// Returns top N sorted by score desc.
func (r *DocumentRepository) Related(path string, limit int) ([]domain.DocumentMeta, error) {
	src, err := r.Get(path)
	if err != nil { return nil, err }
	scores := map[string]int{}

	// Outbound + backlinks
	for _, q := range []string{
		"SELECT dst FROM document_links WHERE src = ?",
		"SELECT src FROM document_links WHERE dst = ?",
	} {
		rows, _ := r.db.Query(q, path)
		for rows.Next() {
			var p string
			rows.Scan(&p)
			if p != path { scores[p] += 3 }
		}
		rows.Close()
	}
	// Same system
	if src.System != "" {
		rows, _ := r.db.Query("SELECT path FROM documents WHERE system = ? AND path != ?", src.System, path)
		for rows.Next() {
			var p string
			rows.Scan(&p)
			scores[p] += 2
		}
		rows.Close()
	}
	// Tag overlap
	for _, t := range src.Tags {
		if t == "" { continue }
		rows, _ := r.db.Query(`SELECT path FROM documents WHERE (',' || tags || ',') LIKE ? AND path != ?`, "%,"+t+",%", path)
		for rows.Next() {
			var p string
			rows.Scan(&p)
			scores[p] += 1
		}
		rows.Close()
	}
	// Sort + load metadata
	type kv struct { path string; score int }
	ranked := make([]kv, 0, len(scores))
	for p, s := range scores { ranked = append(ranked, kv{p, s}) }
	for i := 1; i < len(ranked); i++ {
		for j := i; j > 0 && ranked[j].score > ranked[j-1].score; j-- {
			ranked[j], ranked[j-1] = ranked[j-1], ranked[j]
		}
	}
	if limit > 0 && len(ranked) > limit { ranked = ranked[:limit] }
	out := make([]domain.DocumentMeta, 0, len(ranked))
	for _, r2 := range ranked {
		if m, err := r.Get(r2.path); err == nil {
			out = append(out, *m)
		}
	}
	return out, nil
}
