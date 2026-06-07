package domain

import "strings"

// --- Entities ---

type Repo struct {
	Name          string
	GitHubURL     string
	Domain        string
	Description   string
	Status        string
	Language      string
	Team          string
	System        string
	Lifecycle     string
	DependsOn     string // JSON array
	ProvidesAPIs  string // JSON array
	ConsumesAPIs  string // JSON array
	Tags          string // JSON array
	Links         string // JSON array of {title, url}
	Collaborators string // JSON array of {name, role, github, email}
	Deployment    string // JSON object {cloud, compute, region, ...}
	Observability string // JSON object {logging, metrics, ...}
	Security      string // JSON object {findings, ...}
	Cloned        bool
	LocalPath     string
	CreatedAt     string
	UpdatedAt     string
}

type RepoSummary struct {
	Name     string
	Domain   string
	Status   string
	Language string
	Cloned   bool
}

type RepoFilter struct {
	Domain     string
	Status     string
	ClonedOnly bool
	ExcludeArchived bool
}

type Service struct {
	Name         string
	RepoName     string
	Type         string
	Hosting      string
	Port         string
	Protocol     string
	Dependencies string
	Description  string
	Status       string
	Notes        string
}

type ServiceSummary struct {
	Name    string
	Repo    string
	Type    string
	Hosting string
	Status  string
}

type ServiceFilter struct {
	Type   string
	Status string
}

type Protocol struct {
	Name        string
	Type        string
	Transport   string
	Port        string
	Encryption  string
	AuthMethod  string
	UsedBy      string
	Description string
	Notes       string
}

type ProtocolSummary struct {
	Name       string
	Type       string
	Transport  string
	Port       string
	Encryption string
	UsedBy     string
}

type Document struct {
	Path        string
	Name        string
	Description string
	Domain      string
	Owner       string
	Status      string
	RepoURL     string
	LastUpdated string
	ContentHash string
	IsCatalog   bool
	System      string   // optional: id of a kind:system entry the doc belongs to
	Tags        []string // optional: free-form kebab-case keywords
	Audience    []string // optional: agent | engineer | product | leadership | ops
}

type DocumentMeta struct {
	Path        string
	Name        string
	Description string
	Domain      string
	Owner       string
	Status      string
	RepoURL     string
	LastUpdated string
	IsCatalog   bool
	System      string
	Tags        []string
	Audience    []string
}

type DocumentFilter struct {
	Domain   string
	Catalog  bool
	Query    string
	System   string
	Tag      string
	Audience string
	Owner    string
	Status   string
}

type SearchResult struct {
	Path    string
	Name    string
	Snippet string
	Domain  string
}

type DomainCount struct {
	Domain string
	Count  int
}

type BrainStats struct {
	TotalRepos    int
	ClonedRepos   int
	ReposByStatus []StatusCount
	ReposByDomain []DomainCount
	ServiceCount  int
	ProtocolCount int
	TagCount      int
}

type StatusCount struct {
	Status string
	Count  int
}

// --- Cost (Phase 5 of PROPOSAL_GENERIC_TREE.md §4.7) ---

// CostEntry — one billing-period spend value attributed to a catalog entity.
type CostEntry struct {
	ID              int64
	EntityKind      string  // repo | service | infra | external | product | system | …
	EntityName      string
	PeriodStart     string  // ISO 8601 (daily granularity)
	PeriodEnd       string
	Amount          float64
	AccountCurrency string  // EUR / USD / …
	AmountEUR       float64 // normalized for cross-account aggregation
	Account         string  // 'aws:prod-eu-north-1', 'gcp:acme-prod'
	Source          string  // 'aws-ce' | 'aws-cur' | 'gcp-billing-export' | 'csv' | …
	SourceRunID     string
	Metadata        string  // JSON
	IngestedAt      string
}

// CostUnallocated — spend that couldn't be attributed to a catalog entry.
type CostUnallocated struct {
	ID              int64
	PeriodStart     string
	PeriodEnd       string
	Amount          float64
	AccountCurrency string
	AmountEUR       float64
	Account         string
	Reason          string  // 'missing-brain:catalog-entry' | 'unknown-tag-value' | …
	ResourceID      string
	Source          string
	SourceRunID     string
	Metadata        string
	IngestedAt      string
}

// CostSource — discovery-job heartbeat.
type CostSource struct {
	Source     string
	Account    string
	LastRunAt  string
	LastPeriod string
	Status     string // ok | partial | failed
	Error      string
}

// CostBudget — per-entity budget for current vs budget reporting.
type CostBudget struct {
	EntityKind string
	EntityName string
	Period     string // monthly | quarterly
	AmountEUR  float64
	WarnAtPct  int
	SetBy      string
}

// CostFilter — query knobs for cost reads.
type CostFilter struct {
	EntityKind string // optional
	EntityName string // optional
	System     string // optional — joined via stitcher entity table at API layer
	Team       string // optional — same
	Account    string // optional
	From       string // ISO date inclusive
	To         string // ISO date inclusive
	Source     string // optional
}

// CostRollup — sum/min/max in a single response.
type CostRollup struct {
	TotalEUR    float64
	EntryCount  int
	PeriodStart string
	PeriodEnd   string
	ByAccount   []struct {
		Account   string
		AmountEUR float64
	}
}

type DocumentStats struct {
	TotalDocs      int
	CatalogEntries int
	Domains        map[string]int
}

type IndexResult struct {
	Total   int
	Catalog int
	Skipped int
	Removed int
}

// RepoSpec is the contents of a catalog-info.json catalog entry (or legacy
// .brain/spec.json in a repo). Teams own this file — Brain reads it as the
// source of truth.
//
// Same struct serves all four catalog kinds (repo / service / infra / external).
// Kind-specific fields are tagged omitempty so unused fields stay out of JSON.
type RepoSpec struct {
	// Core identity (every kind)
	Name        string `json:"name"`
	Kind        string `json:"kind,omitempty"` // repo | service | infra | external
	Description string `json:"description"`

	// Common classification
	System string `json:"system,omitempty"`
	Layer  string `json:"layer,omitempty"` // device | edge | domain | platform | data | cross-cutting

	// kind=repo only
	Domain    string `json:"domain,omitempty"`
	Type      string `json:"type,omitempty"`
	Lifecycle string `json:"lifecycle,omitempty"`
	Team      string `json:"team,omitempty"`

	// kind=service / kind=infra / kind=external — typed per-kind fields
	Version           string   `json:"version,omitempty"`
	DeployedBy        []string `json:"deployedBy,omitempty"`
	RunsOn            string   `json:"runsOn,omitempty"`
	Vendor            string   `json:"vendor,omitempty"`
	Category          string   `json:"category,omitempty"`
	Provider          string   `json:"provider,omitempty"`
	Service           string   `json:"service,omitempty"`
	Managed           bool     `json:"managed,omitempty"`
	Region            string   `json:"region,omitempty"`
	IntegrationMethod string   `json:"integrationMethod,omitempty"`
	ContractType      string   `json:"contractType,omitempty"`

	// People
	Collaborators []SpecCollaborator `json:"collaborators,omitempty"`

	// Relationships
	DependsOn    []Dependency `json:"dependsOn,omitempty"`
	ProvidesAPIs []string     `json:"providesApis,omitempty"`
	ConsumesAPIs []string     `json:"consumesApis,omitempty"`
	ConsumedBy   []string     `json:"consumedBy,omitempty"`

	// Discovery
	Tags  []string   `json:"tags,omitempty"`
	Links []SpecLink `json:"links,omitempty"`

	// Operations
	Deployment    *SpecDeployment    `json:"deployment,omitempty"`
	Observability *SpecObservability `json:"observability,omitempty"`
	Security      *SpecSecurity      `json:"security,omitempty"`
}

// Dependency is a single outbound edge from a catalog entry.
type Dependency struct {
	Target   string `json:"target"`
	Kind     string `json:"kind"` // repo | service | infra | external
	Protocol string `json:"protocol,omitempty"`
	Port     int    `json:"port,omitempty"`
	Purpose  string `json:"purpose,omitempty"`
	Instance string `json:"instance,omitempty"`
}

// SystemManifest is the contents of a kind:system catalog entry's catalog-info.json.
// Aggregates catalog entries that share the same `system` value and drives the
// C4 Level 1 system-context view.
type SystemManifest struct {
	ID             string             `json:"id"`
	Name           string             `json:"name"`
	Description    string             `json:"description"`
	Layer          string             `json:"layer"`
	OwnerTeam      string             `json:"owner_team"`
	Boundary       string             `json:"boundary"`
	C4Kind         string             `json:"c4_kind"`
	ExternalActors []string           `json:"external_actors,omitempty"`
	EntryPoints    []SystemEntryPoint `json:"entry_points,omitempty"`
}

type SystemEntryPoint struct {
	Kind      string `json:"kind"`
	Protocol  string `json:"protocol,omitempty"`
	Port      int    `json:"port,omitempty"`
	Purpose   string `json:"purpose,omitempty"`
	ExposedBy string `json:"exposedBy,omitempty"`
}

type SpecCollaborator struct {
	Name   string `json:"name"`
	Role   string `json:"role"`   // owner, maintainer, contributor
	GitHub string `json:"github"`
	Email  string `json:"email,omitempty"`
}

type SpecLink struct {
	Title string `json:"title"`
	URL   string `json:"url"`
}

type SpecDeployment struct {
	Cloud        string   `json:"cloud"`
	Compute      string   `json:"compute"`
	Region       string   `json:"region,omitempty"`
	Environments []string `json:"environments,omitempty"`
	CICD         string   `json:"cicd,omitempty"`
	DeployMethod string   `json:"deployMethod,omitempty"`
}

type SpecObservability struct {
	Logging        string `json:"logging,omitempty"`
	Metrics        string `json:"metrics,omitempty"`
	ErrorTracking  string `json:"errorTracking,omitempty"`
	Alerting       string `json:"alerting,omitempty"`
	HealthEndpoint string `json:"healthEndpoint,omitempty"`
}

type SpecSecurity struct {
	Findings               []SpecSecurityFinding `json:"findings,omitempty"`
	HasHardcodedSecrets    bool                  `json:"hasHardcodedSecrets,omitempty"`
	HasMissingAuth         bool                  `json:"hasMissingAuth,omitempty"`
	HasLockFile            bool                  `json:"hasLockFile,omitempty"`
	TLSVerificationDisabled bool                 `json:"tlsVerificationDisabled,omitempty"`
}

type SpecSecurityFinding struct {
	Severity       string `json:"severity"`
	Finding        string `json:"finding"`
	Location       string `json:"location"`
	Recommendation string `json:"recommendation"`
}

// --- Domain logic ---

// AllowedRepoUpdateFields returns the set of fields that can be updated on a repo.
var AllowedRepoUpdateFields = map[string]bool{
	"domain": true, "status": true, "language": true, "team": true, "description": true,
	"system": true, "lifecycle": true, "depends_on": true, "provides_apis": true,
	"consumes_apis": true, "tags": true, "links": true, "collaborators": true,
	"deployment": true, "observability": true, "security": true,
}

// ParseFrontmatter extracts YAML frontmatter key-value pairs from markdown content.
// Returns the frontmatter map and the body (content after frontmatter).
func ParseFrontmatter(content string) (map[string]string, string) {
	fm := make(map[string]string)
	body := content

	trimmed := strings.TrimSpace(content)
	if !strings.HasPrefix(trimmed, "---") {
		return fm, content
	}

	rest := trimmed[3:]
	idx := strings.Index(rest, "\n---")
	if idx < 0 {
		return fm, content
	}

	fmBlock := rest[:idx]
	afterClose := rest[idx+4:]
	body = strings.TrimLeft(afterClose, "\r\n")

	for _, line := range strings.Split(fmBlock, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		colonIdx := strings.Index(line, ":")
		if colonIdx < 0 {
			continue
		}
		key := strings.TrimSpace(line[:colonIdx])
		value := strings.TrimSpace(line[colonIdx+1:])
		value = strings.Trim(value, `"'`)
		fm[key] = value
	}

	return fm, body
}

// ── Phase D: local RAG ────────────────────────────────────────────────

// RAGChunk is one ingested chunk + its vector. Stored 1:N per source doc.
type RAGChunk struct {
	Text      string
	Embedding []float32
}

// RAGHit is one search result returned by KNN over the chunk corpus.
type RAGHit struct {
	Path       string  `json:"path"`
	ChunkIndex int     `json:"chunk_index"`
	Text       string  `json:"text"`
	Score      float32 `json:"score"`
}

// ParseList parses a YAML inline list ("[a, b, c]") into a string slice.
// Returns the input unchanged (single-element slice) when not a list. Empty
// string or empty list yields nil. Used for `tags`, `audience`, etc.
func ParseList(value string) []string {
	v := strings.TrimSpace(value)
	if v == "" {
		return nil
	}
	if strings.HasPrefix(v, "[") && strings.HasSuffix(v, "]") {
		v = strings.TrimSuffix(strings.TrimPrefix(v, "["), "]")
	}
	parts := strings.Split(v, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		p = strings.Trim(p, `"'`)
		if p != "" {
			out = append(out, strings.ToLower(p))
		}
	}
	if len(out) == 0 {
		return nil
	}
	return out
}
