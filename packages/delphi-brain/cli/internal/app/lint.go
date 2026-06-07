// Phase 3 of brain-llm-wiki-evolution-plan.md — lint skill engine.
//
// LintService runs the structural checks. The /lint Claude skill (markdown)
// drives reasoning-style checks (contradictions, query gaps); this Go side
// owns the cheap deterministic scans that don't need an LLM.
//
// Findings emit as `lint-finding` telemetry events (Phase 2) so /brain-evolve
// (Phase 4) can rank them. Each /lint run also appends one summary line to
// narratives/log.md.
package app

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/goat-io/delphi-brain/cli/internal/domain"
)

type LintService struct {
	repoRoot string
	tel      *TelemetryService // optional
	docs     *DocumentService  // optional — used for query-gap, ad-hoc-field reports
	schema   *SchemaService    // optional — used for declared-field knowledge
}

func NewLintService(repoRoot string, tel *TelemetryService, docs *DocumentService, schema *SchemaService) *LintService {
	return &LintService{repoRoot: repoRoot, tel: tel, docs: docs, schema: schema}
}

type Finding struct {
	Type     string `json:"type"`     // orphan-page, broken-link, stale, missing-frontmatter, ad-hoc-field-cluster, missing-back-edge, ownership-violation
	Severity string `json:"severity"` // soft | pattern | hard
	Path     string `json:"path,omitempty"`
	Detail   string `json:"detail,omitempty"`
	// Optional: cluster info for ad-hoc-field-cluster
	Field       string   `json:"field,omitempty"`
	Occurrences int      `json:"occurrences,omitempty"`
	Examples    []string `json:"examples,omitempty"`
}

type LintReport struct {
	GeneratedAt time.Time  `json:"generatedAt"`
	Findings    []Finding  `json:"findings"`
	ByType      map[string]int `json:"byType"`
	BySeverity  map[string]int `json:"bySeverity"`
}

// Run executes all enabled checks and returns a report. Each finding is also
// emitted as a telemetry event (best-effort) and the report summary is appended
// to narratives/log.md.
func (l *LintService) Run() (*LintReport, error) {
	report := &LintReport{
		GeneratedAt: time.Now().UTC(),
		ByType:      map[string]int{},
		BySeverity:  map[string]int{},
	}

	checks := []func() ([]Finding, error){
		l.checkStaleAndMissingFrontmatter,
		l.checkBrokenLinks,
		l.checkOrphanPages,
		l.checkAdHocFieldClusters,
		l.checkMissingBackEdges,
	}

	for _, check := range checks {
		findings, err := check()
		if err != nil {
			fmt.Fprintln(os.Stderr, "lint check failed:", err)
			continue
		}
		report.Findings = append(report.Findings, findings...)
	}

	for _, f := range report.Findings {
		report.ByType[f.Type]++
		report.BySeverity[f.Severity]++
		if l.tel != nil {
			payload := map[string]any{
				"type":     f.Type,
				"severity": f.Severity,
				"path":     f.Path,
			}
			if f.Field != "" {
				payload["value"] = f.Field
				payload["occurrences"] = f.Occurrences
			}
			_ = l.tel.Log("lint-finding", payload)
		}
	}

	// Append summary line to log.md (best-effort).
	logPath := filepath.Join(l.repoRoot, domain.NarrativesDir(), "log.md")
	if f, err := os.OpenFile(logPath, os.O_APPEND|os.O_WRONLY, 0644); err == nil {
		defer f.Close()
		fmt.Fprintf(f, "## [%s] lint | %d findings (%s) | brain lint output\n",
			time.Now().UTC().Format("2006-01-02"),
			len(report.Findings),
			summarizeSeverity(report.BySeverity),
		)
	}

	return report, nil
}

// ─── checks ──────────────────────────────────────────────────────────────

var fmStartRe = regexp.MustCompile(`(?s)\A---\s*\n(.*?)\n---\s*\n`)
var fmFieldRe = regexp.MustCompile(`(?m)^([a-zA-Z0-9_-]+):\s*(.*)$`)
var mdLinkRe2 = regexp.MustCompile(`\[(?:[^\]]*)\]\(([^)#\s]+)`)

const staleDays = 90

func (l *LintService) checkStaleAndMissingFrontmatter() ([]Finding, error) {
	root := l.repoRoot
	narrativesAbs := filepath.Join(root, domain.NarrativesDir())
	candidatesAbs := filepath.Join(root, domain.CandidatesDir())
	cutoff := time.Now().AddDate(0, 0, -staleDays)

	var findings []Finding

	filepath.Walk(narrativesAbs, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if info.IsDir() {
			if path == candidatesAbs {
				return filepath.SkipDir
			}
			return nil
		}
		if !strings.HasSuffix(info.Name(), ".md") {
			return nil
		}
		rel, _ := filepath.Rel(root, path)
		raw, err := os.ReadFile(path)
		if err != nil {
			return nil
		}
		match := fmStartRe.FindSubmatch(raw)
		if match == nil {
			findings = append(findings, Finding{
				Type:     "missing-frontmatter",
				Severity: "pattern",
				Path:     rel,
				Detail:   "no YAML frontmatter block",
			})
			return nil
		}
		fields := map[string]string{}
		for _, m := range fmFieldRe.FindAllStringSubmatch(string(match[1]), -1) {
			fields[m[1]] = strings.TrimSpace(m[2])
		}
		if fields["status"] != "active" {
			return nil
		}
		updated := strings.Trim(fields["last-updated"], `" `)
		if updated == "" {
			findings = append(findings, Finding{
				Type:     "missing-frontmatter",
				Severity: "soft",
				Path:     rel,
				Detail:   "missing `last-updated`",
			})
			return nil
		}
		t, err := time.Parse("2006-01-02", updated)
		if err != nil {
			return nil
		}
		if t.Before(cutoff) {
			findings = append(findings, Finding{
				Type:     "stale",
				Severity: "soft",
				Path:     rel,
				Detail:   fmt.Sprintf("last-updated %s, status:active, >%dd", updated, staleDays),
			})
		}
		return nil
	})
	return findings, nil
}

func (l *LintService) checkBrokenLinks() ([]Finding, error) {
	root := l.repoRoot
	narrativesAbs := filepath.Join(root, domain.NarrativesDir())
	candidatesAbs := filepath.Join(root, domain.CandidatesDir())

	var findings []Finding
	filepath.Walk(narrativesAbs, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if info.IsDir() {
			if path == candidatesAbs {
				return filepath.SkipDir
			}
			return nil
		}
		if !strings.HasSuffix(info.Name(), ".md") {
			return nil
		}
		raw, err := os.ReadFile(path)
		if err != nil {
			return nil
		}
		rel, _ := filepath.Rel(root, path)
		dir := filepath.Dir(path)
		seen := map[string]bool{}
		for _, m := range mdLinkRe2.FindAllStringSubmatch(string(raw), -1) {
			url := m[1]
			if url == "" || strings.HasPrefix(url, "http") || strings.HasPrefix(url, "mailto:") || strings.HasPrefix(url, "#") || strings.HasPrefix(url, "/") {
				continue
			}
			if seen[url] {
				continue
			}
			seen[url] = true
			target := filepath.Clean(filepath.Join(dir, url))
			if _, err := os.Stat(target); os.IsNotExist(err) {
				findings = append(findings, Finding{
					Type:     "broken-link",
					Severity: "pattern",
					Path:     rel,
					Detail:   url,
				})
			}
		}
		return nil
	})
	return findings, nil
}

// checkOrphanPages: a narrative .md with no inbound markdown links from any
// other narrative or catalog README. Skips index files (log.md, README.md,
// candidates/), handovers (chronological by design), and the plan + decisions
// (often referenced by external systems we don't see).
func (l *LintService) checkOrphanPages() ([]Finding, error) {
	root := l.repoRoot
	narrativesAbs := filepath.Join(root, domain.NarrativesDir())
	candidatesAbs := filepath.Join(root, domain.CandidatesDir())

	// Build: rel-path -> exists; and inbound count map.
	pages := map[string]bool{}
	inbound := map[string]int{}

	filepath.Walk(narrativesAbs, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if info.IsDir() {
			if path == candidatesAbs {
				return filepath.SkipDir
			}
			return nil
		}
		if !strings.HasSuffix(info.Name(), ".md") {
			return nil
		}
		rel, _ := filepath.Rel(root, path)
		pages[rel] = true
		return nil
	})

	// Scan all md files (narratives + catalog) for outbound links.
	scanRoots := []string{narrativesAbs, filepath.Join(root, domain.CatalogDir())}
	for _, sroot := range scanRoots {
		filepath.Walk(sroot, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return nil
			}
			if info.IsDir() {
				if path == candidatesAbs {
					return filepath.SkipDir
				}
				return nil
			}
			if !strings.HasSuffix(info.Name(), ".md") {
				return nil
			}
			raw, _ := os.ReadFile(path)
			dir := filepath.Dir(path)
			for _, m := range mdLinkRe2.FindAllStringSubmatch(string(raw), -1) {
				url := m[1]
				if url == "" || strings.HasPrefix(url, "http") || strings.HasPrefix(url, "#") || strings.HasPrefix(url, "/") {
					continue
				}
				target := filepath.Clean(filepath.Join(dir, url))
				rel, err := filepath.Rel(root, target)
				if err != nil {
					continue
				}
				inbound[rel]++
			}
			return nil
		})
	}

	var findings []Finding
	for p := range pages {
		base := filepath.Base(p)
		if base == "README.md" || base == "log.md" || base == "index.md" {
			continue
		}
		if strings.Contains(p, "/handovers/") {
			continue
		}
		if strings.Contains(p, "/decisions/") {
			continue
		}
		if inbound[p] == 0 {
			findings = append(findings, Finding{
				Type:     "orphan-page",
				Severity: "soft",
				Path:     p,
				Detail:   "no inbound links from narratives or catalog",
			})
		}
	}
	return findings, nil
}

// checkAdHocFieldClusters: scans catalog-info.json files. Builds a frequency
// table of property keys NOT declared in the relevant kind schema. Any key
// appearing in 3+ entries is a cluster — input for /propose-kind-field.
func (l *LintService) checkAdHocFieldClusters() ([]Finding, error) {
	if l.schema == nil {
		return nil, nil
	}
	root := l.repoRoot
	catalogAbs := filepath.Join(root, domain.CatalogDir())

	declared := map[string]map[string]bool{} // kind -> set of declared properties
	reg, err := l.schema.List()
	if err == nil {
		for _, k := range reg.Kinds {
			raw, _, err := l.schema.Get(k.Kind)
			if err != nil {
				continue
			}
			var doc map[string]any
			if err := json.Unmarshal(raw, &doc); err != nil {
				continue
			}
			set := map[string]bool{}
			if props, ok := doc["properties"].(map[string]any); ok {
				for k := range props {
					set[k] = true
				}
			}
			declared[k.Kind] = set
		}
	}

	type usage struct {
		count    int
		examples []string
	}
	clusters := map[string]map[string]*usage{} // kind -> field -> usage

	filepath.Walk(catalogAbs, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if info.IsDir() || info.Name() != "catalog-info.json" {
			return nil
		}
		raw, _ := os.ReadFile(path)
		var entry map[string]any
		if err := json.Unmarshal(raw, &entry); err != nil {
			return nil
		}
		kind, _ := entry["kind"].(string)
		if kind == "" {
			return nil
		}
		decl := declared[kind]
		if decl == nil {
			return nil
		}
		rel, _ := filepath.Rel(root, path)
		for k := range entry {
			if decl[k] {
				continue
			}
			if _, ok := clusters[kind]; !ok {
				clusters[kind] = map[string]*usage{}
			}
			u, ok := clusters[kind][k]
			if !ok {
				u = &usage{}
				clusters[kind][k] = u
			}
			u.count++
			if len(u.examples) < 3 {
				u.examples = append(u.examples, rel)
			}
		}
		return nil
	})

	var findings []Finding
	for kind, fields := range clusters {
		for f, u := range fields {
			if u.count < 3 {
				continue
			}
			findings = append(findings, Finding{
				Type:        "ad-hoc-field-cluster",
				Severity:    "pattern",
				Field:       fmt.Sprintf("%s.%s", kind, f),
				Occurrences: u.count,
				Examples:    u.examples,
				Detail:      fmt.Sprintf("propose-kind-field candidate"),
			})
		}
	}
	return findings, nil
}

// checkMissingBackEdges: for every dependsOn edge `A → B`, B's catalog-info.json
// should reference A in some way. Soft signal — many legit cases have no
// reciprocal, so we only count entries where B exists in catalog and has zero
// references back. Useful as input rather than as a hard rule.
func (l *LintService) checkMissingBackEdges() ([]Finding, error) {
	root := l.repoRoot
	catalogAbs := filepath.Join(root, domain.CatalogDir())

	// Build name → catalog-info.json contents map.
	entries := map[string][]byte{}
	filepath.Walk(catalogAbs, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() || info.Name() != "catalog-info.json" {
			return nil
		}
		raw, _ := os.ReadFile(path)
		var doc map[string]any
		if err := json.Unmarshal(raw, &doc); err != nil {
			return nil
		}
		name, _ := doc["name"].(string)
		if name != "" {
			entries[name] = raw
		}
		return nil
	})

	var findings []Finding
	for src, raw := range entries {
		var doc map[string]any
		json.Unmarshal(raw, &doc)
		deps, ok := doc["dependsOn"].([]any)
		if !ok {
			continue
		}
		for _, d := range deps {
			edge, ok := d.(map[string]any)
			if !ok {
				continue
			}
			tgt, _ := edge["target"].(string)
			if tgt == "" {
				continue
			}
			tgtRaw, exists := entries[tgt]
			if !exists {
				continue // target not in catalog; not an orphan-back-edge issue
			}
			if !strings.Contains(string(tgtRaw), `"`+src+`"`) {
				findings = append(findings, Finding{
					Type:     "missing-back-edge",
					Severity: "soft",
					Path:     fmt.Sprintf("%s → %s", src, tgt),
					Detail:   "target's catalog-info.json doesn't reference source",
				})
			}
		}
	}
	return findings, nil
}

// ─── helpers ─────────────────────────────────────────────────────────────

func summarizeSeverity(by map[string]int) string {
	if len(by) == 0 {
		return "0"
	}
	keys := make([]string, 0, len(by))
	for k := range by {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	parts := make([]string, len(keys))
	for i, k := range keys {
		parts[i] = fmt.Sprintf("%s=%d", k, by[k])
	}
	return strings.Join(parts, ", ")
}
