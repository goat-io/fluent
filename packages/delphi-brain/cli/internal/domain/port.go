package domain

// --- Driven ports (outbound) ---

// RepoRepository persists and queries repository records.
type RepoRepository interface {
	Upsert(repo Repo) error
	UpsertBatch(repos []Repo) (int, error)
	List(filter RepoFilter) ([]RepoSummary, error)
	Get(name string) (*Repo, error)
	Update(name, field, value string) error
	GetURL(name string) (string, error)
	SetCloned(name, localPath string) error
	ListNames(filter RepoFilter) ([]string, error)
}

// ServiceRepository persists and queries service records.
type ServiceRepository interface {
	Upsert(svc Service) error
	List(filter ServiceFilter) ([]ServiceSummary, error)
	Get(name string) (*Service, error)
	ListByRepo(repoName string) ([]ServiceSummary, error)
}

// ProtocolRepository persists and queries protocol records.
type ProtocolRepository interface {
	Upsert(proto Protocol) error
	List() ([]ProtocolSummary, error)
}

// TagRepository persists and queries tags.
type TagRepository interface {
	Add(entityType, entityName, tag string) error
	ListByEntity(entityType, entityName string) ([]string, error)
}

// DocumentRepository persists and queries indexed documents.
type DocumentRepository interface {
	InitSchema() error
	GetHashes() (map[string]string, error)
	Upsert(doc Document, body string) error
	List(filter DocumentFilter) ([]DocumentMeta, error)
	Get(path string) (*DocumentMeta, error)
	Search(query string, limit int) ([]SearchResult, error)
	Stats() (*DocumentStats, error)
	Domains() ([]DomainCount, error)
	Delete(path string) error
	AllPaths() ([]string, error)
	Count() (int, error)
	Facets() (map[string]map[string]int, error)
	SetLinks(src string, dsts []string) error
	Backlinks(dst string) ([]DocumentMeta, error)
	Related(path string, limit int) ([]DocumentMeta, error)
}

// RAGRepository persists chunks + embeddings for semantic search.
type RAGRepository interface {
	InitSchema() error
	Replace(path, contentHash string, chunks []RAGChunk) error
	Hash(path string) (string, error)
	Delete(path string) error
	Search(query []float32, k int) ([]RAGHit, error)
	Stats() (chunks, docs int, err error)
}

// Embedder turns text into a vector. Implemented by the Ollama adapter;
// returning (nil, nil) for empty text is allowed.
type Embedder interface {
	Embed(text string) ([]float32, error)      // document chunk
	EmbedQuery(text string) ([]float32, error) // user query (asymmetric prefix)
	Available() bool
}

// QueryRunner executes raw SQL against the database.
type QueryRunner interface {
	Select(query string) (cols []string, rows [][]string, err error)
	Exec(query string) (int64, error)
	BrainStats() (*BrainStats, error)
}

// CostRepository persists and queries cost-attribution time series.
type CostRepository interface {
	UpsertEntry(e CostEntry) error
	UpsertEntries(es []CostEntry) (int, error)
	ListEntries(f CostFilter) ([]CostEntry, error)
	RollupByEntity(kind, name, from, to string) (CostRollup, error)
	RollupByField(field, value, from, to string) (CostRollup, error)
	UpsertUnallocated(u CostUnallocated) error
	ListUnallocated(from, to string) ([]CostUnallocated, error)
	UpsertSource(s CostSource) error
	ListSources() ([]CostSource, error)
	UpsertBudget(b CostBudget) error
	GetBudget(kind, name, period string) (*CostBudget, error)
}

// GitHubClient interacts with the GitHub API/CLI.
type GitHubClient interface {
	ListRepos(org string) ([]Repo, error)
	CloneRepo(url, dest string) error
	// UpdateRepo fetches latest from origin and resets to HEAD for a shallow clone.
	UpdateRepo(dest string) error
	// FetchRepoSpec reads .brain.yml from a repo via the GitHub API (no clone needed).
	// Returns nil, nil if the file doesn't exist.
	FetchRepoSpec(org, repoName string) (*RepoSpec, error)
}
