// Phase 1 of the Brain LLM-Wiki evolution plan — schema-as-runtime.
//
// SchemaService exposes the JSON Schemas under brain/schema/ to the HTTP API
// and CLI so the frontend (and any agent) can read schema at runtime instead
// of hard-coding field knowledge per kind. Adding a new kind = drop one
// .schema.json file; the UI catches up on next `brain serve` restart.
//
// Source of truth: brain/schema/<kind>.schema.json. Everything below is
// derived: the registry (auto-generated index), the example-entry probe
// (filesystem scan of catalog/<kind>/), and the mtime used for cache-busting
// per §8 Q12 of brain-llm-wiki-evolution-plan.md.
package app

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/goat-io/delphi-brain/cli/internal/domain"
)

type SchemaService struct {
	repoRoot  string
	schemaDir string // absolute path to brain/schema/
}

// NewSchemaService wires the schema service to the repo root. The schema dir
// is resolved relative to repoRoot (brain/schema/) so the same Brain binary
// works for any company instance.
func NewSchemaService(repoRoot string) *SchemaService {
	return &SchemaService{
		repoRoot:  repoRoot,
		schemaDir: filepath.Join(repoRoot, domain.SchemaDir()),
	}
}

// KindInfo is one row in the registry — what the UI needs to render a kind
// selector + decide whether to show it (suppress drafts, hide deprecated).
type KindInfo struct {
	Kind         string    `json:"kind"`
	Title        string    `json:"title"`
	Description  string    `json:"description"`
	SchemaPath   string    `json:"schemaPath"`            // relative to repo root
	ExamplesPath string    `json:"examplesPath,omitempty"` // catalog/<kind>/ if it exists
	EntryCount   int       `json:"entryCount"`            // number of catalog folders for this kind
	LastModified time.Time `json:"lastModified"`
}

// Registry is the top-level document the UI loads once on mount. Cache key is
// the max mtime across all schemas (§8 Q12: cache forever, mtime-busts).
type Registry struct {
	Kinds        []KindInfo `json:"kinds"`
	GeneratedAt  time.Time  `json:"generatedAt"`
	MaxMtime     time.Time  `json:"maxMtime"`     // for cache-bust query param
	SchemaDir    string     `json:"schemaDir"`    // relative to repo root, informational
}

// List returns the registry. Scans brain/schema/*.schema.json each call —
// cheap (≤30 files) and avoids cache invalidation bugs.
func (s *SchemaService) List() (*Registry, error) {
	entries, err := os.ReadDir(s.schemaDir)
	if err != nil {
		return nil, fmt.Errorf("read schema dir %q: %w", s.schemaDir, err)
	}

	reg := &Registry{
		GeneratedAt: time.Now().UTC(),
		SchemaDir:   domain.SchemaDir(),
	}

	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".schema.json") {
			continue
		}
		kind := strings.TrimSuffix(e.Name(), ".schema.json")

		schemaPath := filepath.Join(s.schemaDir, e.Name())
		raw, err := os.ReadFile(schemaPath)
		if err != nil {
			continue // skip unreadable; lint will catch
		}

		fi, err := os.Stat(schemaPath)
		if err != nil {
			continue
		}
		mtime := fi.ModTime().UTC()
		if mtime.After(reg.MaxMtime) {
			reg.MaxMtime = mtime
		}

		var doc map[string]any
		if err := json.Unmarshal(raw, &doc); err != nil {
			continue // malformed schema — surface via lint later
		}

		info := KindInfo{
			Kind:         kind,
			Title:        stringField(doc, "title"),
			Description:  stringField(doc, "description"),
			SchemaPath:   filepath.Join(domain.SchemaDir(), e.Name()),
			LastModified: mtime,
		}

		// Probe catalog/<kind>/ for example entries — informational only.
		// Kind name is the schema file basename; the catalog folder name may
		// differ (plural vs singular). We try both.
		catalogCandidates := []string{
			filepath.Join(s.repoRoot, domain.CatalogDir(), kind),
			filepath.Join(s.repoRoot, domain.CatalogDir(), kind+"s"),
		}
		for _, cd := range catalogCandidates {
			if fi, err := os.Stat(cd); err == nil && fi.IsDir() {
				info.ExamplesPath = strings.TrimPrefix(cd, s.repoRoot+string(os.PathSeparator))
				if children, err := os.ReadDir(cd); err == nil {
					for _, ch := range children {
						if ch.IsDir() {
							info.EntryCount++
						}
					}
				}
				break
			}
		}

		reg.Kinds = append(reg.Kinds, info)
	}

	sort.Slice(reg.Kinds, func(i, j int) bool { return reg.Kinds[i].Kind < reg.Kinds[j].Kind })
	return reg, nil
}

// Get returns the raw JSON Schema bytes for one kind. Caller is expected to
// pass through the bytes unchanged (the schema is itself valid JSON for the
// HTTP response).
func (s *SchemaService) Get(kind string) ([]byte, time.Time, error) {
	if !validKind(kind) {
		return nil, time.Time{}, fmt.Errorf("invalid kind name: %q", kind)
	}
	path := filepath.Join(s.schemaDir, kind+".schema.json")
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, time.Time{}, fmt.Errorf("schema for kind %q: %w", kind, err)
	}
	fi, _ := os.Stat(path)
	return raw, fi.ModTime().UTC(), nil
}

// Examples scans catalog/<kind>/<entry>/catalog-info.json and returns up to
// `limit` parsed entries as raw JSON. Backs `GET /api/schema/:kind/examples`
// — UI can show "what does a real entry look like" without hardcoding.
func (s *SchemaService) Examples(kind string, limit int) ([]json.RawMessage, error) {
	if !validKind(kind) {
		return nil, fmt.Errorf("invalid kind name: %q", kind)
	}
	if limit <= 0 {
		limit = 3
	}

	// Try singular and plural folder names.
	candidates := []string{
		filepath.Join(s.repoRoot, domain.CatalogDir(), kind),
		filepath.Join(s.repoRoot, domain.CatalogDir(), kind+"s"),
	}
	var dir string
	for _, c := range candidates {
		if fi, err := os.Stat(c); err == nil && fi.IsDir() {
			dir = c
			break
		}
	}
	if dir == "" {
		return []json.RawMessage{}, nil
	}

	children, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}

	var out []json.RawMessage
	for _, ch := range children {
		if !ch.IsDir() {
			continue
		}
		spec := filepath.Join(dir, ch.Name(), "catalog-info.json")
		raw, err := os.ReadFile(spec)
		if err != nil {
			continue
		}
		// Re-marshal to compact form — saves bytes for a UI that just
		// wants to display the shape, not the original formatting.
		var v any
		if err := json.Unmarshal(raw, &v); err != nil {
			continue
		}
		compact, err := json.Marshal(v)
		if err != nil {
			continue
		}
		out = append(out, json.RawMessage(compact))
		if len(out) >= limit {
			break
		}
	}
	return out, nil
}

// WriteRegistry serializes the current registry to brain/schema/kinds-registry.json.
// Idempotent: writes only when the content actually changed (preserves mtimes
// in git). Called by `brain schema registry --write` and ideally by a Makefile
// build step before `brain serve`.
func (s *SchemaService) WriteRegistry() (changed bool, path string, err error) {
	reg, err := s.List()
	if err != nil {
		return false, "", err
	}
	path = filepath.Join(s.schemaDir, "kinds-registry.json")

	new, err := json.MarshalIndent(reg, "", "  ")
	if err != nil {
		return false, path, err
	}
	new = append(new, '\n')

	existing, err := os.ReadFile(path)
	if err == nil && bytesEqual(existing, new) {
		return false, path, nil
	}
	if err := os.WriteFile(path, new, 0644); err != nil {
		return false, path, err
	}
	return true, path, nil
}

// ─── helpers ────────────────────────────────────────────────────────────

func stringField(m map[string]any, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}

// validKind rejects path-traversal and weird characters. Kind names are
// kebab-case lowercase letters + digits + hyphens; anything else is suspect.
func validKind(k string) bool {
	if k == "" || len(k) > 64 {
		return false
	}
	for _, r := range k {
		switch {
		case r >= 'a' && r <= 'z':
		case r >= '0' && r <= '9':
		case r == '-':
		default:
			return false
		}
	}
	return true
}

func bytesEqual(a, b []byte) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
