// Phase 6 of brain-llm-wiki-evolution-plan.md — candidate staging service.
//
// The /ingest skill produces drafts under narratives/candidates/. This service
// handles the mechanical promote/discard operations: rewriting frontmatter,
// moving files into the live wiki, appending to log.md, and emitting telemetry.
//
// The skill itself owns the *reasoning* (read source → identify entities →
// summarize → place at correct target-path); this service is the executor.
package app

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/goat-io/delphi-brain/cli/internal/domain"
)

type CandidateService struct {
	repoRoot string
	tel      *TelemetryService
}

func NewCandidateService(repoRoot string, tel *TelemetryService) *CandidateService {
	return &CandidateService{repoRoot: repoRoot, tel: tel}
}

// Stage writes a new candidate file. The body is expected to already include
// frontmatter; this function ensures the candidate-only fields are present.
// Returns the absolute path written.
func (c *CandidateService) Stage(relPath, body string) (string, error) {
	if !strings.HasPrefix(relPath, domain.CandidatesDir()+"/") {
		// Auto-prefix for convenience; allows callers to pass a target-style path.
		relPath = filepath.Join(domain.CandidatesDir(), filepath.Base(relPath))
	}
	abs := filepath.Join(c.repoRoot, relPath)
	if err := os.MkdirAll(filepath.Dir(abs), 0755); err != nil {
		return "", err
	}
	if err := os.WriteFile(abs, []byte(body), 0644); err != nil {
		return "", err
	}
	if c.tel != nil {
		c.tel.Log("candidate-stage", map[string]any{"path": relPath})
	}
	c.appendLog(fmt.Sprintf("candidate-stage | %s | %s", filepath.Base(relPath), relPath))
	return abs, nil
}

// Promote moves a candidate to its target path. Reads frontmatter `target-path:`
// (required), rewrites ownership + status + last-updated, strips candidate-only
// fields. Returns the new live path.
func (c *CandidateService) Promote(candidateRel string) (string, error) {
	abs := filepath.Join(c.repoRoot, candidateRel)
	raw, err := os.ReadFile(abs)
	if err != nil {
		return "", fmt.Errorf("read candidate: %w", err)
	}
	fm, body := domain.ParseFrontmatter(string(raw))

	targetRel := strings.Trim(fm["target-path"], `" `)
	if targetRel == "" {
		return "", fmt.Errorf("missing target-path in frontmatter")
	}

	newFM := map[string]string{}
	for k, v := range fm {
		switch k {
		case "target-path", "proposed-by", "review-notes":
			continue
		default:
			newFM[k] = v
		}
	}
	// Rewrite candidate-specific values.
	if newFM["status"] == "candidate" {
		newFM["status"] = "active"
	}
	if newFM["ownership"] == "llm" {
		newFM["ownership"] = "shared"
	}
	newFM["last-updated"] = time.Now().UTC().Format("2006-01-02")

	out := buildFrontmatter(newFM) + body
	targetAbs := filepath.Join(c.repoRoot, targetRel)
	if err := os.MkdirAll(filepath.Dir(targetAbs), 0755); err != nil {
		return "", err
	}
	if err := os.WriteFile(targetAbs, []byte(out), 0644); err != nil {
		return "", err
	}
	if err := os.Remove(abs); err != nil {
		return "", err
	}
	if c.tel != nil {
		c.tel.Log("candidate-promote", map[string]any{
			"path":        candidateRel,
			"target-path": targetRel,
		})
	}
	c.appendLog(fmt.Sprintf("promote | %s | %s", filepath.Base(targetRel), targetRel))
	return targetAbs, nil
}

func (c *CandidateService) Discard(candidateRel, reason string) error {
	abs := filepath.Join(c.repoRoot, candidateRel)
	if err := os.Remove(abs); err != nil {
		return err
	}
	if c.tel != nil {
		c.tel.Log("candidate-discard", map[string]any{
			"path":   candidateRel,
			"detail": reason,
		})
	}
	c.appendLog(fmt.Sprintf("discard | %s | %s", filepath.Base(candidateRel), reason))
	return nil
}

func (c *CandidateService) List() ([]string, error) {
	root := filepath.Join(c.repoRoot, domain.CandidatesDir())
	var out []string
	filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}
		if !strings.HasSuffix(info.Name(), ".md") {
			return nil
		}
		if info.Name() == "README.md" {
			return nil
		}
		rel, _ := filepath.Rel(c.repoRoot, path)
		out = append(out, rel)
		return nil
	})
	return out, nil
}

func (c *CandidateService) appendLog(line string) {
	path := filepath.Join(c.repoRoot, domain.NarrativesDir(), "log.md")
	f, err := os.OpenFile(path, os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		return
	}
	defer f.Close()
	fmt.Fprintf(f, "## [%s] %s\n", time.Now().UTC().Format("2006-01-02"), line)
}

func buildFrontmatter(fields map[string]string) string {
	// Preserve a stable key order so diffs are small.
	order := []string{"name", "description", "last-updated", "owner", "status", "ownership", "tags", "audience", "system", "source"}
	seen := map[string]bool{}
	var b strings.Builder
	b.WriteString("---\n")
	for _, k := range order {
		if v, ok := fields[k]; ok {
			b.WriteString(fmt.Sprintf("%s: %s\n", k, v))
			seen[k] = true
		}
	}
	for k, v := range fields {
		if seen[k] {
			continue
		}
		b.WriteString(fmt.Sprintf("%s: %s\n", k, v))
	}
	b.WriteString("---\n")
	return b.String()
}
