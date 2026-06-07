package httpapi

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"

	"github.com/goat-io/delphi-brain/cli/internal/app"
	"github.com/goat-io/delphi-brain/cli/internal/domain"
)

// Server is the HTTP driving adapter.
type Server struct {
	app  *app.App
	root string
	port string
}

func NewServer(a *app.App, root, port string) *Server {
	return &Server{app: a, root: root, port: port}
}

// Start initializes the document schema, auto-indexes if needed, and starts listening.
func (s *Server) Start() error {
	if err := s.app.Documents.InitSchema(); err != nil {
		return fmt.Errorf("schema error: %w", err)
	}

	// Auto-index if DB is empty
	count, _ := s.app.Documents.Count()
	if count == 0 {
		fmt.Println("No documents indexed, running initial index...")
		s.app.Documents.Index(s.root)
	}

	f := fiber.New(fiber.Config{
		DisableStartupMessage: false,
	})

	f.Use(cors.New(cors.Config{
		AllowOriginsFunc: func(origin string) bool {
			return strings.HasPrefix(origin, "http://localhost:") ||
				strings.HasPrefix(origin, "http://127.0.0.1:") ||
				origin == "http://localhost" ||
				origin == "http://127.0.0.1"
		},
		AllowMethods: "GET,POST",
		AllowHeaders: "Content-Type",
	}))

	f.Get("/api/documents", s.handleListDocuments)
	f.Get("/api/documents/facets", s.handleDocumentsFacets)
	f.Get("/api/documents/backlinks", s.handleDocumentsBacklinks)
	f.Get("/api/documents/related", s.handleDocumentsRelated)
	f.Get("/api/rag/query", s.handleRAGQuery)
	f.Get("/api/rag/stats", s.handleRAGStats)
	f.Get("/api/documents/*", s.handleGetDocument)
	f.Get("/api/catalog", s.handleListCatalog)
	f.Get("/api/catalog/:domain/:name", s.handleGetCatalogEntry)
	f.Get("/api/repos", s.handleListRepos)
	f.Get("/api/repos/:name", s.handleGetRepo)
	f.Get("/api/search", s.handleSearch)
	f.Get("/api/search/hybrid", s.handleSearchHybrid)
	f.Get("/api/stats", s.handleStats)
	f.Get("/api/domains", s.handleDomains)
	f.Get("/api/config", s.handleConfig)

	// Dashboard stats
	f.Get("/api/dashboard", s.handleDashboard)

	// Architecture visualization data
	f.Get("/api/architecture", s.handleArchitectureAll)
	f.Get("/api/architecture/graph", s.handleArchitectureGraph)
	f.Get("/api/architecture/systems", s.handleArchitectureSystems)
	f.Get("/api/architecture/:section", s.handleArchitectureSection)

	// Universal entity API (Phase 6 stitcher) — kind-agnostic name lookup with
	// outbound + inbound edges. Backs the `EntityDrawer` per PROPOSAL_GENERIC_TREE.md §8.4.
	f.Post("/api/catalog/reindex", s.handleCatalogReindex)
	f.Get("/api/catalog/stats", s.handleCatalogStats)
	f.Get("/api/catalog/graph", s.handleCatalogGraph)
	f.Get("/api/entity/:name", s.handleGetEntity)
	f.Get("/api/entity/:name/expand", s.handleExpandEntity)
	f.Get("/api/entity/:name/contributors", s.handleEntityContributors)

	// Universal diagram payload (Phase 8 of PROPOSAL_GENERIC_TREE.md §8)
	f.Get("/api/diagrams/:view", s.handleDiagram)

	// Schema-as-runtime (Phase 1 of brain-llm-wiki-evolution-plan.md §3.2).
	// The frontend reads schemas at runtime so new kinds appear in the UI
	// without React/Go code changes. Cache key per kind = the schema file's
	// mtime (§8 Q12 — "cache forever, mtime-busts").
	f.Get("/api/schema", s.handleSchemaList)
	f.Get("/api/schema/:kind", s.handleSchemaGet)
	f.Get("/api/schema/:kind/examples", s.handleSchemaExamples)

	// Instance structure manifest — sidebar sections + Documents categories.
	// Frontend reads this to render the chrome generically.
	f.Get("/api/structure", s.handleStructure)

	// UnifiedView (Phase 9) — single endpoint family per (lens, mode). Backend
	// computes everything; the renderer is a dumb painter.
	f.Get("/api/scope/lenses", s.handleScopeLenses)
	f.Get("/api/scope/:lens/facets", s.handleScopeFacets)
	f.Get("/api/scope/:lens/table", s.handleScopeTable)
	f.Get("/api/scope/:lens/dashboard", s.handleScopeDashboard)
	f.Get("/api/scope/:lens/graph", s.handleScopeGraph)

	// Cost attribution (Phase 5 of PROPOSAL_GENERIC_TREE.md §4.7)
	f.Get("/api/cost/sources", s.handleCostSources)
	f.Get("/api/cost/unallocated", s.handleCostUnallocated)
	f.Get("/api/cost/by-system/:system", s.handleCostBySystem)
	f.Get("/api/cost/by-team/:team", s.handleCostByTeam)
	f.Get("/api/cost/budgets/:kind/:name", s.handleCostBudget)
	f.Get("/api/cost/:kind/:name", s.handleCostByEntity)
	f.Post("/api/cost/refresh", s.handleCostRefresh)

	// Chat — SSE streaming via Ollama
	f.Post("/api/chat", s.handleChat)

	fmt.Printf("Starting server on :%s (repo root: %s)\n", s.port, s.root)
	return f.Listen(":" + s.port)
}

func (s *Server) handleListDocuments(c *fiber.Ctx) error {
	filter := domain.DocumentFilter{
		Domain:   c.Query("domain"),
		Catalog:  c.Query("catalog") == "true",
		Query:    c.Query("q"),
		System:   c.Query("system"),
		Tag:      c.Query("tag"),
		Audience: c.Query("audience"),
		Owner:    c.Query("owner"),
		Status:   c.Query("status"),
	}

	docs, err := s.app.Documents.List(filter)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	if docs == nil {
		docs = []domain.DocumentMeta{}
	}
	return c.JSON(docs)
}

func (s *Server) handleGetDocument(c *fiber.Ctx) error {
	docPath := c.Params("*")
	docPath, _ = url.PathUnescape(docPath)

	meta, err := s.app.Documents.Get(docPath)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "document not found"})
	}

	content, err := os.ReadFile(filepath.Join(s.root, docPath))
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "file not found on disk"})
	}

	return c.JSON(fiber.Map{
		"metadata": meta,
		"content":  string(content),
	})
}

func (s *Server) handleListCatalog(c *fiber.Ctx) error {
	filter := domain.DocumentFilter{
		Domain:  c.Query("domain"),
		Catalog: true,
		Query:   c.Query("q"),
	}

	docs, err := s.app.Documents.List(filter)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	if docs == nil {
		docs = []domain.DocumentMeta{}
	}
	return c.JSON(docs)
}

func (s *Server) handleGetCatalogEntry(c *fiber.Ctx) error {
	d := c.Params("domain")
	name := c.Params("name")

	// Catalog is now flat-by-kind: catalog/<kind>/<name>/README.md.
	// `:domain` is treated as a kind hint; if the entry is not in that bucket
	// we scan every top-level kind folder for a match.
	patterns := []string{
		"catalog/" + d + "/" + name + "/README.md",
		"catalog/" + d + "/" + name + ".md",
		"catalog/" + d + "/" + name,
	}
	if kindDirs, err := os.ReadDir(filepath.Join(s.root, domain.CatalogDir())); err == nil {
		for _, kd := range kindDirs {
			if !kd.IsDir() || kd.Name() == d {
				continue
			}
			patterns = append(patterns,
				"catalog/"+kd.Name()+"/"+name+"/README.md",
				"catalog/"+kd.Name()+"/"+name+".md",
				"catalog/"+kd.Name()+"/"+name,
			)
		}
	}

	for _, docPath := range patterns {
		fullPath := filepath.Join(s.root, docPath)
		content, err := os.ReadFile(fullPath)
		if err != nil {
			continue
		}

		// Try indexed metadata, fall back to parsing frontmatter from file
		meta, metaErr := s.app.Documents.Get(docPath)
		if metaErr != nil {
			fm, _ := domain.ParseFrontmatter(string(content))
			meta = &domain.DocumentMeta{
				Path:        docPath,
				Name:        fm["name"],
				Description: fm["description"],
				Domain:      fm["domain"],
				Owner:       fm["owner"],
				Status:      fm["status"],
				RepoURL:     fm["repo"],
				LastUpdated: fm["last-updated"],
				IsCatalog:   true,
			}
		}

		result := fiber.Map{
			"metadata": meta,
			"content":  string(content),
		}

		// catalog-info.json and openapi.json sit next to the README we just
		// loaded — derive the entry folder from `docPath`, NOT from the
		// request `:domain` param (which is only a hint and may not match
		// the real kind bucket).
		entryDir := filepath.Dir(filepath.Join(s.root, docPath))
		if specData, err := os.ReadFile(filepath.Join(entryDir, "catalog-info.json")); err == nil {
			var spec interface{}
			if err := json.Unmarshal(specData, &spec); err == nil {
				result["spec"] = spec
			}
		}
		if apiData, err := os.ReadFile(filepath.Join(entryDir, "openapi.json")); err == nil {
			var api interface{}
			if err := json.Unmarshal(apiData, &api); err == nil {
				result["openapi"] = api
			}
		}

		return c.JSON(result)
	}

	return c.Status(404).JSON(fiber.Map{"error": "catalog entry not found"})
}

// handleGetRepo returns the full repo record from the DB with all JSON fields parsed,
// plus catalog-info.json and openapi.json from the catalog folder if they exist.
func (s *Server) handleGetRepo(c *fiber.Ctx) error {
	name := c.Params("name")

	repo, tags, svcs, err := s.app.Repos.Get(name)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "repo not found"})
	}

	// Build response with parsed JSON fields
	result := fiber.Map{
		"name":        repo.Name,
		"url":         repo.GitHubURL,
		"domain":      repo.Domain,
		"description": repo.Description,
		"status":      repo.Status,
		"language":    repo.Language,
		"team":        repo.Team,
		"system":      repo.System,
		"lifecycle":   repo.Lifecycle,
		"cloned":      repo.Cloned,
		"localPath":   repo.LocalPath,
		"createdAt":   repo.CreatedAt,
		"updatedAt":   repo.UpdatedAt,
		"dbTags":      tags,
		"services":    svcs,
	}

	// Parse JSON string fields into proper JSON objects for the response
	jsonFields := map[string]string{
		"dependsOn":     repo.DependsOn,
		"providesApis":  repo.ProvidesAPIs,
		"consumesApis":  repo.ConsumesAPIs,
		"tags":          repo.Tags,
		"links":         repo.Links,
		"collaborators": repo.Collaborators,
		"deployment":    repo.Deployment,
		"observability": repo.Observability,
		"security":      repo.Security,
	}
	for key, raw := range jsonFields {
		if raw != "" {
			var parsed interface{}
			if err := json.Unmarshal([]byte(raw), &parsed); err == nil {
				result[key] = parsed
			}
		}
	}

	// Try to read catalog-info.json and openapi.json from catalog folder
	if repo.Domain != "" && repo.Domain != "unknown" {
		catalogDir := filepath.Join(s.root, "catalog", repo.Domain, repo.Name)

		if data, err := os.ReadFile(filepath.Join(catalogDir, "catalog-info.json")); err == nil {
			var spec interface{}
			if err := json.Unmarshal(data, &spec); err == nil {
				result["spec"] = spec
			}
		}

		if data, err := os.ReadFile(filepath.Join(catalogDir, "openapi.json")); err == nil {
			var api interface{}
			if err := json.Unmarshal(data, &api); err == nil {
				result["openapi"] = api
			}
		}
	}

	return c.JSON(result)
}

func (s *Server) handleSearch(c *fiber.Ctx) error {
	q := c.Query("q")
	if q == "" {
		return c.Status(400).JSON(fiber.Map{"error": "q parameter required"})
	}

	limit := 50
	if l := c.Query("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 {
			limit = n
		}
	}

	// Auto-append wildcard for prefix matching (so "al" matches "alarm")
	searchQ := q
	if len(searchQ) > 0 && searchQ[len(searchQ)-1] != '*' && searchQ[len(searchQ)-1] != '"' {
		searchQ = searchQ + "*"
	}

	results, err := s.app.Documents.Search(searchQ, limit)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	if results == nil {
		results = []domain.SearchResult{}
	}
	return c.JSON(results)
}

// handleStructure serves the company instance's structure manifest from
// <BRAIN_CATALOG_DIR>/_structure.json. Frontend uses it to render the
// sidebar + Documents categories generically. Returns 200 with `{}` if the
// file is missing — Brain works without a structure file (frontend falls
// back to local config).
func (s *Server) handleStructure(c *fiber.Ctx) error {
	p := filepath.Join(s.root, domain.CatalogDir(), "_structure.json")
	raw, err := os.ReadFile(p)
	if err != nil {
		c.Set("Content-Type", "application/json")
		return c.SendString("{}")
	}
	if !json.Valid(raw) {
		return c.Status(500).JSON(fiber.Map{"error": "invalid JSON in _structure.json"})
	}
	c.Set("Content-Type", "application/json")
	return c.Send(raw)
}

// handleDocumentsFacets returns value→count distributions for the fields the
// Documents browser exposes as filter dropdowns. Frontend renders whatever
// keys are present — no hardcoded vocabulary.
func (s *Server) handleDocumentsFacets(c *fiber.Ctx) error {
	facets, err := s.app.Documents.Facets()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(facets)
}

// handleDocumentsBacklinks: docs that link to ?path=X.
func (s *Server) handleDocumentsBacklinks(c *fiber.Ctx) error {
	path := c.Query("path")
	if path == "" { return c.Status(400).JSON(fiber.Map{"error": "path required"}) }
	docs, err := s.app.Documents.Backlinks(path)
	if err != nil { return c.Status(500).JSON(fiber.Map{"error": err.Error()}) }
	if docs == nil { docs = []domain.DocumentMeta{} }
	return c.JSON(docs)
}

// handleDocumentsRelated: ranked neighbours by link/system/tag overlap.
func (s *Server) handleDocumentsRelated(c *fiber.Ctx) error {
	path := c.Query("path")
	if path == "" { return c.Status(400).JSON(fiber.Map{"error": "path required"}) }
	docs, err := s.app.Documents.Related(path, 10)
	if err != nil { return c.Status(500).JSON(fiber.Map{"error": err.Error()}) }
	if docs == nil { docs = []domain.DocumentMeta{} }
	return c.JSON(docs)
}

// handleSearchHybrid blends FTS5 keyword search with RAG semantic search using
// Reciprocal Rank Fusion. Returns one ranked list keyed by document path, so
// the frontend doesn't need to know about two backends. Falls back to FTS-only
// when RAG/Ollama is unavailable — clients can always rely on a non-empty
// response shape.
//
// Result shape (per item):
//   Path, Name, Snippet, Domain — same as /api/search
//   Source                       — "fts" | "rag" | "both"
//   Score                        — fused RRF score (higher = better)
func (s *Server) handleSearchHybrid(c *fiber.Ctx) error {
	q := strings.TrimSpace(c.Query("q"))
	if q == "" {
		return c.Status(400).JSON(fiber.Map{"error": "q parameter required"})
	}
	k := c.QueryInt("k", 20)
	if k <= 0 || k > 100 {
		k = 20
	}

	// FTS5 query shaping:
	//   - already-quoted phrase → leave as is
	//   - multi-word unquoted ("North Star") → wrap in quotes for phrase match,
	//     so we don't get `North AND Star*` which lights up unrelated docs
	//     containing 'eu-north-1' + 'starts'
	//   - single token → append '*' for prefix matching ("al" → "alarm")
	ftsQ := q
	if !strings.Contains(ftsQ, "\"") {
		if strings.Contains(strings.TrimSpace(ftsQ), " ") {
			ftsQ = "\"" + strings.TrimSpace(ftsQ) + "\""
		} else if !strings.HasSuffix(ftsQ, "*") {
			ftsQ = ftsQ + "*"
		}
	}
	ftsHits, ftsErr := s.app.Documents.Search(ftsQ, k*2)
	if ftsErr != nil {
		ftsHits = nil
	}

	// RAG: only if embedder is up. Aggregate chunk hits to the best-ranked
	// chunk per path so one doc doesn't dominate by appearing in many chunks.
	var ragBestByPath map[string]int // path -> rank (1-based) of best chunk
	var ragSnippetByPath map[string]string
	ragAvailable := false
	if s.app.RAG != nil && s.app.RAG.Available() {
		ragAvailable = true
		hits, err := s.app.RAG.Query(q, k*4)
		if err == nil {
			ragBestByPath = make(map[string]int, len(hits))
			ragSnippetByPath = make(map[string]string, len(hits))
			pathRank := 0
			seen := make(map[string]struct{})
			for _, h := range hits {
				if _, ok := seen[h.Path]; ok {
					continue
				}
				seen[h.Path] = struct{}{}
				pathRank++
				ragBestByPath[h.Path] = pathRank
				snip := h.Text
				if len(snip) > 220 {
					snip = snip[:220] + "…"
				}
				ragSnippetByPath[h.Path] = snip
			}
		}
	}

	// Reciprocal Rank Fusion. The constant 60 is the textbook RRF value.
	const rrfK = 60.0
	type fused struct {
		Path    string  `json:"Path"`
		Name    string  `json:"Name"`
		Snippet string  `json:"Snippet"`
		Domain  string  `json:"Domain"`
		Source  string  `json:"Source"`
		Score   float64 `json:"Score"`
	}
	byPath := make(map[string]*fused)

	for i, r := range ftsHits {
		f := &fused{Path: r.Path, Name: r.Name, Snippet: r.Snippet, Domain: r.Domain, Source: "fts"}
		f.Score = 1.0 / (rrfK + float64(i+1))
		byPath[r.Path] = f
	}
	for path, rank := range ragBestByPath {
		add := 1.0 / (rrfK + float64(rank))
		if f, ok := byPath[path]; ok {
			f.Score += add
			f.Source = "both"
			if f.Snippet == "" {
				f.Snippet = ragSnippetByPath[path]
			}
		} else {
			byPath[path] = &fused{
				Path:    path,
				Name:    "",
				Snippet: ragSnippetByPath[path],
				Source:  "rag",
				Score:   add,
			}
		}
	}

	out := make([]*fused, 0, len(byPath))
	for _, f := range byPath {
		out = append(out, f)
	}
	// Sort by score desc.
	for i := 1; i < len(out); i++ {
		for j := i; j > 0 && out[j].Score > out[j-1].Score; j-- {
			out[j], out[j-1] = out[j-1], out[j]
		}
	}
	if len(out) > k {
		out = out[:k]
	}
	return c.JSON(fiber.Map{"rag_available": ragAvailable, "hits": out})
}

// handleRAGQuery: semantic search over chunked + embedded markdown corpus.
// Returns top-k chunks with cosine score. Ollama-required; returns empty
// list with `available: false` when Ollama is unreachable.
func (s *Server) handleRAGQuery(c *fiber.Ctx) error {
	if !s.app.RAG.Available() {
		return c.JSON(fiber.Map{"available": false, "hits": []domain.RAGHit{}})
	}
	q := c.Query("q")
	k := c.QueryInt("k", 10)
	hits, err := s.app.RAG.Query(q, k)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"available": true, "hits": hits})
}

func (s *Server) handleRAGStats(c *fiber.Ctx) error {
	chunks, docs, _ := s.app.RAG.Stats()
	return c.JSON(fiber.Map{
		"available": s.app.RAG.Available(),
		"chunks":    chunks,
		"documents": docs,
	})
}

func (s *Server) handleStats(c *fiber.Ctx) error {
	stats, err := s.app.Documents.Stats()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{
		"documents":       stats.TotalDocs,
		"catalog_entries": stats.CatalogEntries,
		"domains":         stats.Domains,
	})
}

// handleConfig serves the instance config (brain.config.json) so the frontend
// can de-hardcode company identity (name, branding, source links, assistant
// name). This is the seam that keeps the React UI company-agnostic.
func (s *Server) handleConfig(c *fiber.Ctx) error {
	cfg := domain.LoadConfig()
	return c.JSON(fiber.Map{
		"org": fiber.Map{
			"name":           cfg.Org.Name,
			"description":    cfg.Org.Description,
			"sourceBaseUrl":  cfg.Org.SourceBaseURL,
			"catalogRepoUrl": cfg.Org.CatalogRepoURL,
		},
		"branding": fiber.Map{
			"shortName": cfg.Branding.ShortName,
			"tagline":   cfg.Branding.Tagline,
			"logoUrl":   cfg.Branding.LogoURL,
			"palette":   cfg.Branding.Palette,
		},
		"chat": fiber.Map{
			"assistantName": cfg.Chat.AssistantName,
		},
	})
}

func (s *Server) handleDomains(c *fiber.Ctx) error {
	domains, err := s.app.Documents.Domains()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	if domains == nil {
		domains = []domain.DomainCount{}
	}
	return c.JSON(domains)
}

// handleListRepos scans the catalog filesystem directly — catalog is the source of truth.
func (s *Server) handleListRepos(c *fiber.Ctx) error {
	domainFilter := c.Query("domain")
	statusFilter := c.Query("status")

	type catalogRepo struct {
		Name        string      `json:"name"`
		Domain      string      `json:"domain"`
		Status      string      `json:"status"`
		Language    string      `json:"language"`
		Description string      `json:"description,omitempty"`
		Team        string      `json:"team,omitempty"`
		Lifecycle   string      `json:"lifecycle,omitempty"`
		Type        string      `json:"type,omitempty"`
		Owner       string      `json:"owner,omitempty"`
		RepoURL     string      `json:"repoUrl,omitempty"`
		Spec        interface{} `json:"spec,omitempty"`
	}

	catalogBase := filepath.Join(s.root, domain.CatalogDir())
	var results []catalogRepo

	// Walk all domain dirs → repo dirs
	domainDirs, _ := os.ReadDir(catalogBase)
	for _, dd := range domainDirs {
		if !dd.IsDir() {
			continue
		}
		domainName := dd.Name()
		if domainFilter != "" && domainName != domainFilter {
			continue
		}

		repoDirs, _ := os.ReadDir(filepath.Join(catalogBase, domainName))
		for _, rd := range repoDirs {
			if !rd.IsDir() {
				continue
			}
			repoDir := filepath.Join(catalogBase, domainName, rd.Name())

			er := catalogRepo{
				Name:   rd.Name(),
				Domain: domainName,
				Status: "unknown",
			}

			// Read README.md frontmatter
			if content, err := os.ReadFile(filepath.Join(repoDir, "README.md")); err == nil {
				fm, _ := domain.ParseFrontmatter(string(content))
				if d := fm["description"]; d != "" {
					er.Description = d
				}
				if s := fm["status"]; s != "" {
					er.Status = s
				}
				if o := fm["owner"]; o != "" {
					er.Owner = o
				}
				if u := fm["repo"]; u != "" {
					er.RepoURL = u
				}
			}

			// Read catalog-info.json (overrides README, has richer data)
			if data, err := os.ReadFile(filepath.Join(repoDir, "catalog-info.json")); err == nil {
				var spec map[string]interface{}
				if err := json.Unmarshal(data, &spec); err == nil {
					er.Spec = spec
					if d, ok := spec["name"].(string); ok && d != "" {
						er.Name = d
					}
					if d, ok := spec["description"].(string); ok && d != "" {
						er.Description = d
					}
					if d, ok := spec["domain"].(string); ok && d != "" {
						er.Domain = d
					}
					if t, ok := spec["team"].(string); ok && t != "" {
						er.Team = t
					}
					if l, ok := spec["lifecycle"].(string); ok && l != "" {
						er.Lifecycle = l
					}
					if tp, ok := spec["type"].(string); ok && tp != "" {
						er.Type = tp
					}
					if lang, ok := spec["language"].(string); ok && lang != "" {
						er.Language = lang
					}
					// Try tags for language
					if er.Language == "" {
						if tags, ok := spec["tags"].([]interface{}); ok {
							for _, t := range tags {
								if ts, ok := t.(string); ok {
									switch ts {
									case "java", "typescript", "python", "c", "c#", "go", "rust", "kotlin", "swift":
										er.Language = ts
									}
								}
							}
						}
					}
				}
			}

			// Apply status filter
			if statusFilter != "" && er.Status != statusFilter && er.Lifecycle != statusFilter {
				continue
			}

			results = append(results, er)
		}
	}

	if results == nil {
		results = []catalogRepo{}
	}
	return c.JSON(results)
}

// handleDashboard returns a combined stats overview for the dashboard.
func (s *Server) handleDashboard(c *fiber.Ctx) error {
	stats, err := s.app.Documents.Stats()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(stats)
}

// handleArchitectureAll returns all architecture seed data in one response.
func (s *Server) handleArchitectureAll(c *fiber.Ctx) error {
	data, err := s.app.Architecture.GetAll()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(data)
}

// handleArchitectureGraph returns a pre-computed dependency graph.
func (s *Server) handleArchitectureGraph(c *fiber.Ctx) error {
	data, err := s.app.Architecture.GetGraph()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(data)
}

// handleArchitectureSystems returns the C4-L1 system context view aggregated
// from system manifests + catalog entries.
func (s *Server) handleArchitectureSystems(c *fiber.Ctx) error {
	data, err := s.app.Architecture.GetSystems()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(data)
}

// handleArchitectureSection returns a single architecture section by name.
func (s *Server) handleArchitectureSection(c *fiber.Ctx) error {
	section := c.Params("section")
	data, err := s.app.Architecture.GetSection(section)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Type("json").Send(data)
}

// handleChat streams a chat response via SSE. It searches Brain for context,
// then calls Ollama and proxies the streamed response back to the client.
func (s *Server) handleChat(c *fiber.Ctx) error {
	var req app.ChatRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}
	if len(req.Messages) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "messages required"})
	}

	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")

	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		err := s.app.Chat.Stream(req, func(chunkType app.ChunkType, text string) error {
			switch chunkType {
			case app.ChunkDone:
				fmt.Fprintf(w, "data: [DONE]\n\n")
			case app.ChunkThinking:
				chunk, _ := json.Marshal(map[string]string{"thinking": text})
				fmt.Fprintf(w, "data: %s\n\n", chunk)
			default:
				fmt.Fprintf(w, "data: %s\n\n", app.JsonEscape(text))
			}
			return w.Flush()
		})
		if err != nil {
			fmt.Fprintf(w, "data: {\"error\": %s}\n\n", app.JsonEscape(err.Error()))
			w.Flush()
		}
	})

	return nil
}

// Phase 6 — universal entity API backed by the in-memory stitcher.

func (s *Server) handleCatalogReindex(c *fiber.Ctx) error {
	res, err := s.app.Stitcher.Index()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(res)
}

func (s *Server) handleCatalogStats(c *fiber.Ctx) error {
	if _, err := s.app.Stitcher.GetEntry("__noop__"); err != nil {
		// Lazy index trigger; ignore "not found" — we only care about ensuring
		// the in-memory state is populated.
		_ = err
	}
	return c.JSON(s.app.Stitcher.Stats())
}

// handleCatalogGraph returns the full stitched graph in one response — the
// canonical source every client uses to compute its slice. Replaces the
// view-specific fetches (repos / architecture/graph / architecture/systems)
// for clients that want to traverse the typed graph.
//
// Shape: { entities: [...StitchedEntry...], generatedAt: "..." }
func (s *Server) handleCatalogGraph(c *fiber.Ctx) error {
	snap := s.app.Stitcher.Snapshot()
	entities := make([]*app.StitchedEntry, 0, len(snap))
	for _, e := range snap {
		entities = append(entities, e)
	}
	return c.JSON(fiber.Map{
		"entities":    entities,
		"generatedAt": time.Now().UTC().Format(time.RFC3339),
	})
}

func (s *Server) handleGetEntity(c *fiber.Ctx) error {
	name := c.Params("name")
	if name == "" {
		return c.Status(400).JSON(fiber.Map{"error": "name required"})
	}
	e, err := s.app.Stitcher.GetEntry(name)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(e)
}

func (s *Server) handleEntityContributors(c *fiber.Ctx) error {
	name := c.Params("name")
	depth := 6
	if d := c.Query("depth"); d != "" {
		if n, err := strconv.Atoi(d); err == nil && n > 0 {
			depth = n
		}
	}
	out, err := s.app.Stitcher.Contributors(name, depth)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(out)
}

// Phase 8 — diagram payload.

func (s *Server) handleDiagram(c *fiber.Ctx) error {
	view := c.Params("view")
	payload, err := s.app.Diagrams.Build(view)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(payload)
}

// Phase 9 — UnifiedView. Lens registry + per-mode projectors.

func (s *Server) handleScopeLenses(c *fiber.Ctx) error {
	out := make([]fiber.Map, 0)
	for _, l := range s.app.Scope.Lenses() {
		out = append(out, fiber.Map{
			"id":          l.ID,
			"name":        l.Name,
			"description": l.Description,
		})
	}
	return c.JSON(out)
}

// scopeFilterFromQuery reads ?kind=&layer=&system=&domain=&type=&team=&status=
// off a Fiber context. Empty params are dropped; an empty filter narrows
// nothing.
func scopeFilterFromQuery(c *fiber.Ctx) app.ScopeFilter {
	return app.ScopeFilter{
		Kind:   c.Query("kind"),
		Layer:  c.Query("layer"),
		System: c.Query("system"),
		Domain: c.Query("domain"),
		Type:   c.Query("type"),
		Team:   c.Query("team"),
		Status: c.Query("status"),
	}
}

// handleScopeFacets returns just the facet array for a lens — small payload
// so UnifiedShell can populate the filter dropdowns without paying for the
// full table response.
func (s *Server) handleScopeFacets(c *fiber.Ctx) error {
	lensID, err := url.QueryUnescape(c.Params("lens"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	scope, err := s.app.Scope.Resolve(lensID)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": err.Error()})
	}
	t := s.app.Scope.ToTable(scope)
	return c.JSON(fiber.Map{
		"lens":   t.Lens,
		"facets": t.Facets,
		"total":  t.Total,
	})
}

func (s *Server) handleScopeTable(c *fiber.Ctx) error {
	lensID, err := url.QueryUnescape(c.Params("lens"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	scope, err := s.app.Scope.ResolveWith(lensID, scopeFilterFromQuery(c))
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(s.app.Scope.ToTable(scope))
}

func (s *Server) handleScopeDashboard(c *fiber.Ctx) error {
	lensID, err := url.QueryUnescape(c.Params("lens"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	scope, err := s.app.Scope.ResolveWith(lensID, scopeFilterFromQuery(c))
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(s.app.Scope.ToDashboard(scope))
}

func (s *Server) handleScopeGraph(c *fiber.Ctx) error {
	lensID, err := url.QueryUnescape(c.Params("lens"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	filter := scopeFilterFromQuery(c)
	// `catalog` lens with NO filters delegates to the legacy pre-positioned
	// dependency graph (system-zone columns). With filters set we fall back
	// to the layered renderer so the projection narrows correctly.
	if lensID == "catalog" && filter.IsZero() {
		g, err := s.app.Architecture.GetGraph()
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		return c.JSON(fiber.Map{
			"renderer": "dependency",
			"data":     g,
			"lens": fiber.Map{
				"id":          "catalog",
				"name":        "Catalog (all entities)",
				"description": "All services + dependencies, system-zoned.",
			},
		})
	}
	scope, err := s.app.Scope.ResolveWith(lensID, filter)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(s.app.Scope.ToGraph(scope))
}

// Phase 5 — cost endpoints.

func (s *Server) handleCostSources(c *fiber.Ctx) error {
	srcs, err := s.app.Cost.ListSources()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	if srcs == nil {
		srcs = []domain.CostSource{}
	}
	return c.JSON(srcs)
}

func (s *Server) handleCostUnallocated(c *fiber.Ctx) error {
	u, err := s.app.Cost.ListUnallocated(c.Query("from"), c.Query("to"))
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	if u == nil {
		u = []domain.CostUnallocated{}
	}
	return c.JSON(u)
}

func (s *Server) handleCostByEntity(c *fiber.Ctx) error {
	kind := c.Params("kind")
	name := c.Params("name")
	from := c.Query("from")
	to := c.Query("to")
	rollup, err := s.app.Cost.RollupByEntity(kind, name, from, to)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	entries, err := s.app.Cost.ListEntries(domain.CostFilter{
		EntityKind: kind, EntityName: name, From: from, To: to,
	})
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	if entries == nil {
		entries = []domain.CostEntry{}
	}
	return c.JSON(fiber.Map{"rollup": rollup, "entries": entries})
}

// handleCostBySystem aggregates over members of a system. Walks the stitcher
// graph: every entity whose `System` field matches → sum of cost_entries.
func (s *Server) handleCostBySystem(c *fiber.Ctx) error {
	system := c.Params("system")
	from := c.Query("from")
	to := c.Query("to")
	if _, err := s.app.Stitcher.GetEntry(system); err != nil {
		// Lazy index trigger; we want stitcher state regardless of whether the
		// system entity exists yet.
		_ = err
	}
	totalEUR := 0.0
	memberCount := 0
	byEntity := []fiber.Map{}
	for name, e := range s.app.Stitcher.Snapshot() {
		if e.System != system {
			continue
		}
		ru, err := s.app.Cost.RollupByEntity(e.Kind, name, from, to)
		if err != nil {
			continue
		}
		if ru.TotalEUR > 0 {
			byEntity = append(byEntity, fiber.Map{
				"name": name, "kind": e.Kind, "amountEur": ru.TotalEUR,
			})
			totalEUR += ru.TotalEUR
		}
		memberCount++
	}
	return c.JSON(fiber.Map{
		"system":      system,
		"members":     memberCount,
		"totalEur":    totalEUR,
		"byEntity":    byEntity,
		"periodFrom":  from,
		"periodTo":    to,
	})
}

// handleCostByTeam — analogous to by-system but resolves team via stitched
// `ownerTeam` edges. Member set = entities whose stitched outbound includes an
// edge of relation=ownerTeam pointing at the named team.
func (s *Server) handleCostByTeam(c *fiber.Ctx) error {
	team := c.Params("team")
	from := c.Query("from")
	to := c.Query("to")
	teamEntry, err := s.app.Stitcher.GetEntry(team)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": err.Error()})
	}
	totalEUR := 0.0
	byEntity := []fiber.Map{}
	for _, edge := range teamEntry.Inbound {
		if edge.Relation != "ownerTeam" {
			continue
		}
		ent, err := s.app.Stitcher.GetEntry(edge.Source)
		if err != nil {
			continue
		}
		ru, err := s.app.Cost.RollupByEntity(ent.Kind, ent.Name, from, to)
		if err != nil {
			continue
		}
		if ru.TotalEUR > 0 {
			byEntity = append(byEntity, fiber.Map{
				"name": ent.Name, "kind": ent.Kind, "amountEur": ru.TotalEUR,
			})
			totalEUR += ru.TotalEUR
		}
	}
	return c.JSON(fiber.Map{
		"team":       team,
		"totalEur":   totalEUR,
		"byEntity":   byEntity,
		"periodFrom": from,
		"periodTo":   to,
	})
}

func (s *Server) handleCostBudget(c *fiber.Ctx) error {
	kind := c.Params("kind")
	name := c.Params("name")
	period := c.Query("period", "monthly")
	b, err := s.app.Cost.GetBudget(kind, name, period)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	if b == nil {
		return c.Status(404).JSON(fiber.Map{"error": "no budget set"})
	}
	return c.JSON(b)
}

func (s *Server) handleCostRefresh(c *fiber.Ctx) error {
	// Stub — real refresh shells out to provider CLIs. For now this just
	// surfaces the message so callers see the wiring works.
	return c.JSON(fiber.Map{
		"message": "Refresh is a CLI-only operation in this scaffold. Use `brain cost discover --provider csv --file <path>`.",
	})
}

func (s *Server) handleExpandEntity(c *fiber.Ctx) error {
	name := c.Params("name")
	if name == "" {
		return c.Status(400).JSON(fiber.Map{"error": "name required"})
	}
	dir := c.Query("direction", "both")
	depth := 2
	if d := c.Query("depth"); d != "" {
		if n, err := strconv.Atoi(d); err == nil && n > 0 {
			depth = n
		}
	}
	out, err := s.app.Stitcher.Expand(name, dir, depth)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{
		"root":      name,
		"direction": dir,
		"depth":     depth,
		"entries":   out,
	})
}

// ─── Schema-as-runtime (Phase 1) ────────────────────────────────────────

func (s *Server) handleSchemaList(c *fiber.Ctx) error {
	reg, err := s.app.Schema.List()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	// MaxMtime is the cache-bust key — the frontend appends it as ?v=<unix>
	// on subsequent kind fetches. ETag here lets the browser short-circuit
	// the registry fetch itself once it has it cached.
	etag := fmt.Sprintf("W/\"%d\"", reg.MaxMtime.Unix())
	c.Set("ETag", etag)
	if c.Get("If-None-Match") == etag {
		return c.SendStatus(304)
	}
	return c.JSON(reg)
}

func (s *Server) handleSchemaGet(c *fiber.Ctx) error {
	kind := c.Params("kind")
	raw, mtime, err := s.app.Schema.Get(kind)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": err.Error()})
	}
	etag := fmt.Sprintf("W/\"%d\"", mtime.Unix())
	c.Set("ETag", etag)
	c.Set("Cache-Control", "public, max-age=31536000, immutable")
	if c.Get("If-None-Match") == etag {
		return c.SendStatus(304)
	}
	c.Set("Content-Type", "application/schema+json")
	return c.Send(raw)
}

func (s *Server) handleSchemaExamples(c *fiber.Ctx) error {
	kind := c.Params("kind")
	limit := 3
	if v := c.Query("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n < 50 {
			limit = n
		}
	}
	examples, err := s.app.Schema.Examples(kind, limit)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": err.Error()})
	}
	if examples == nil {
		examples = []json.RawMessage{}
	}
	return c.JSON(fiber.Map{
		"kind":     kind,
		"examples": examples,
	})
}
