package app

import (
	"crypto/md5"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/goat-io/delphi-brain/cli/internal/domain"
)

var mdLinkRe = regexp.MustCompile(`\[(?:[^\]]+)\]\(([^)#\s]+)`)

// extractMarkdownLinks parses [text](relative-path) refs from a markdown body
// and returns the targets normalised against `srcPath`'s directory. Skips
// absolute URLs, fragments, and example syntax. Used for Phase C backlinks.
func extractMarkdownLinks(srcPath, body string) []string {
	srcDir := filepath.Dir(srcPath)
	seen := map[string]bool{}
	var out []string
	for _, m := range mdLinkRe.FindAllStringSubmatch(body, -1) {
		url := m[1]
		if url == "" || strings.HasPrefix(url, "http") || strings.HasPrefix(url, "mailto:") || strings.HasPrefix(url, "/") || strings.HasPrefix(url, "#") {
			continue
		}
		if strings.Contains(url, "path/to/") { continue }
		target := filepath.Clean(filepath.Join(srcDir, url))
		if target == srcPath || seen[target] { continue }
		seen[target] = true
		out = append(out, target)
	}
	return out
}

type DocumentService struct {
	docs domain.DocumentRepository
	rag  *RAGService // optional; nil = no semantic ingestion
}

func NewDocumentService(docs domain.DocumentRepository) *DocumentService {
	return &DocumentService{docs: docs}
}

// NewDocumentServiceWithRAG wires Ollama-backed embedding into the indexer.
// When rag.Available() is false at ingest time the call is silently skipped,
// so the rest of indexing keeps working with Ollama offline.
func NewDocumentServiceWithRAG(docs domain.DocumentRepository, rag *RAGService) *DocumentService {
	return &DocumentService{docs: docs, rag: rag}
}

func (s *DocumentService) InitSchema() error {
	return s.docs.InitSchema()
}

// Index walks the given root directory and indexes all markdown files.
func (s *DocumentService) Index(root string) (*domain.IndexResult, error) {
	if err := s.docs.InitSchema(); err != nil {
		return nil, fmt.Errorf("schema error: %w", err)
	}

	existingHashes, _ := s.docs.GetHashes()
	if existingHashes == nil {
		existingHashes = make(map[string]string)
	}

	result := &domain.IndexResult{}

	// Candidates are LLM-proposed wiki drafts pending human review. Per §8 Q11
	// of brain-llm-wiki-evolution-plan.md they are fully invisible to RAG, BM25,
	// and graph traversal until promoted. The full path under root is used so
	// the rule survives nested layouts.
	candidatesAbs := filepath.Join(root, domain.CandidatesDir())

	filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		name := info.Name()
		if info.IsDir() {
			if path == candidatesAbs {
				return filepath.SkipDir
			}
			if strings.HasPrefix(name, ".") || name == "node_modules" || name == "target" ||
				name == "dist" || name == "build" || name == "vendor" || name == "__pycache__" ||
				name == ".next" || name == "coverage" {
				return filepath.SkipDir
			}
			return nil
		}
		isMd := strings.HasSuffix(name, ".md")
		isJson := name == "package.json" || name == "catalog-info.json" || name == "openapi.json" || name == "tsconfig.json" || name == "composer.json"
		isConfig := name == "Dockerfile" || name == "docker-compose.yml" || name == "docker-compose.yaml" ||
			name == "serverless.yml" || name == "serverless.yaml" ||
			name == ".env.example" || name == "Makefile" ||
			strings.HasSuffix(name, ".tf") || strings.HasSuffix(name, ".proto") ||
			strings.HasSuffix(name, ".graphql") || strings.HasSuffix(name, ".gql")
		isYaml := (strings.HasSuffix(name, ".yml") || strings.HasSuffix(name, ".yaml")) &&
			(strings.Contains(path, "workflows") || strings.Contains(path, "helm") ||
				strings.Contains(path, "k8s") || strings.Contains(path, "values"))
		catalogPrefix := domain.CatalogDir() + "/"
		archPrefix := domain.NarrativesDir() + "/architecture/"
		isArchJson := strings.HasSuffix(name, ".json") &&
			(strings.Contains(path, catalogPrefix) || strings.Contains(path, archPrefix))

		if !isMd && !isJson && !isConfig && !isYaml && !isArchJson {
			return nil
		}

		relPath, _ := filepath.Rel(root, path)

		data, err := os.ReadFile(path)
		if err != nil {
			return nil
		}

		hash := fmt.Sprintf("%x", md5.Sum(data))
		isCatalog := strings.HasPrefix(relPath, catalogPrefix)

		if isCatalog {
			result.Catalog++
		}

		// Schema-definition files get embedded for RAG (see below). Detect
		// here so the early-skip can still defer to RAG for them.
		isProtoLike := strings.HasSuffix(name, ".proto") ||
			strings.HasSuffix(name, ".graphql") || strings.HasSuffix(name, ".gql")

		// Skip unchanged. For markdown + proto-like files we still attempt RAG
		// ingest below — it has its own hash cache and is a no-op when the
		// vector store is already up to date, so this only does work the first
		// time after we widen RAG coverage.
		if existingHashes[relPath] == hash {
			result.Skipped++
			result.Total++
			if (isMd || isProtoLike) && s.rag != nil {
				body := string(data)
				if isMd {
					_, body = domain.ParseFrontmatter(body)
				}
				if _, err := s.rag.Ingest(relPath, hash, body); err != nil {
					fmt.Fprintf(os.Stderr, "  rag ingest %s: %v\n", relPath, err)
				}
			}
			return nil
		}

		var docName, docDesc, docDomain, docOwner, docStatus, docRepo, docUpdated, docSystem, body string
		var docTags, docAudience []string

		if isMd {
			content := string(data)
			fm, mdBody := domain.ParseFrontmatter(content)
			body = mdBody
			docName = fm["name"]
			docDesc = fm["description"]
			docDomain = fm["domain"]
			docOwner = fm["owner"]
			docStatus = fm["status"]
			docRepo = fm["repo"]
			docUpdated = fm["last-updated"]
			docSystem = fm["system"]
			docTags = domain.ParseList(fm["tags"])
			docAudience = domain.ParseList(fm["audience"])
		} else if isJson || isArchJson {
			// JSON — flatten all string values into searchable body
			body = flattenJSON(string(data))
			docName = extractJSONField(data, "name")
			docDesc = extractJSONField(data, "description")
			docDomain = extractJSONField(data, "domain")
			docSystem = extractJSONField(data, "system")
		} else {
			// Config/YAML/Dockerfile/proto/etc — index as plain text
			body = string(data)
			// Use filename as name
			docName = name
		}

		doc := domain.Document{
			Path:        relPath,
			Name:        docName,
			Description: docDesc,
			Domain:      docDomain,
			Owner:       docOwner,
			Status:      docStatus,
			RepoURL:     docRepo,
			LastUpdated: docUpdated,
			ContentHash: hash,
			IsCatalog:   isCatalog,
			System:      docSystem,
			Tags:        docTags,
			Audience:    docAudience,
		}

		if err := s.docs.Upsert(doc, body); err != nil {
			fmt.Fprintf(os.Stderr, "  error indexing %s: %v\n", relPath, err)
			return nil
		}

		// Phase C: extract markdown link targets and persist for backlinks/related.
		if isMd {
			s.docs.SetLinks(relPath, extractMarkdownLinks(relPath, body))
		}

		// Phase D: chunk + embed + store vectors for semantic search. Only when
		// content_hash differs (skip cache) and Ollama is reachable. Errors here
		// are logged but don't fail the index — RAG degrades gracefully.
		//
		// Embed markdown + schema-definition files (.proto, .graphql, .gql).
		// These are comment-heavy and conceptually dense — high semantic signal
		// per byte. Source code (.go/.ts/.py) and configs (Dockerfile, yaml)
		// stay out: too much boilerplate, dilutes the embedding space.
		if (isMd || isProtoLike) && s.rag != nil {
			if _, err := s.rag.Ingest(relPath, hash, body); err != nil {
				fmt.Fprintf(os.Stderr, "  rag ingest %s: %v\n", relPath, err)
			}
		}

		result.Total++
		return nil
	})

	// Clean stale entries
	paths, _ := s.docs.AllPaths()
	for _, p := range paths {
		fullPath := filepath.Join(root, p)
		if _, err := os.Stat(fullPath); os.IsNotExist(err) {
			s.docs.Delete(p)
			result.Removed++
		}
	}

	return result, nil
}

func (s *DocumentService) List(filter domain.DocumentFilter) ([]domain.DocumentMeta, error) {
	return s.docs.List(filter)
}

func (s *DocumentService) Get(path string) (*domain.DocumentMeta, error) {
	return s.docs.Get(path)
}

func (s *DocumentService) Search(query string, limit int) ([]domain.SearchResult, error) {
	return s.docs.Search(query, limit)
}

func (s *DocumentService) Stats() (*domain.DocumentStats, error) {
	return s.docs.Stats()
}

func (s *DocumentService) Domains() ([]domain.DomainCount, error) {
	return s.docs.Domains()
}

func (s *DocumentService) Count() (int, error) {
	return s.docs.Count()
}

func (s *DocumentService) Facets() (map[string]map[string]int, error) {
	return s.docs.Facets()
}

func (s *DocumentService) Backlinks(path string) ([]domain.DocumentMeta, error) {
	return s.docs.Backlinks(path)
}

func (s *DocumentService) Related(path string, limit int) ([]domain.DocumentMeta, error) {
	if limit <= 0 { limit = 10 }
	return s.docs.Related(path, limit)
}

// flattenJSON extracts all string values from a JSON document into a single
// searchable text blob. Keys and string values are space-separated.
func flattenJSON(raw string) string {
	var result []string
	var extract func(v interface{})
	extract = func(v interface{}) {
		switch val := v.(type) {
		case map[string]interface{}:
			for k, child := range val {
				result = append(result, k)
				extract(child)
			}
		case []interface{}:
			for _, child := range val {
				extract(child)
			}
		case string:
			if len(val) > 0 && len(val) < 500 {
				result = append(result, val)
			}
		}
	}

	var parsed interface{}
	if err := json.Unmarshal([]byte(raw), &parsed); err == nil {
		extract(parsed)
	}
	return strings.Join(result, " ")
}

// extractJSONField pulls a top-level string field from JSON bytes.
func extractJSONField(data []byte, field string) string {
	var m map[string]interface{}
	if err := json.Unmarshal(data, &m); err != nil {
		return ""
	}
	if v, ok := m[field].(string); ok {
		return v
	}
	return ""
}
