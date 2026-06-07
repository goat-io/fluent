// Phase 4 of brain-llm-wiki-evolution-plan.md — /brain-evolve scanner.
//
// EvolveService aggregates telemetry signals (Phase 2) and lint findings
// (Phase 3) into ranked proposal candidates. The Claude /brain-evolve skill
// reads this output and dispatches to /propose-kind, /propose-edge, etc. for
// the actual schema-edit reasoning.
//
// Scoring is deliberately simple: occurrences × severity-weight. We tune as
// the proposal queue grows.
package app

import (
	"sort"
	"time"
)

type EvolveService struct {
	tel  *TelemetryService
	lint *LintService
}

func NewEvolveService(tel *TelemetryService, lint *LintService) *EvolveService {
	return &EvolveService{tel: tel, lint: lint}
}

type Proposal struct {
	Kind        string  `json:"kind"`         // propose-kind | propose-edge | propose-page | promote-candidate | propose-lens
	Subject     string  `json:"subject"`      // human-readable title
	Score       float64 `json:"score"`
	Reason      string  `json:"reason"`
	Examples    []string `json:"examples,omitempty"`
	SourceTypes []string `json:"sourceTypes,omitempty"` // which signal categories fed this
}

type EvolveReport struct {
	GeneratedAt time.Time  `json:"generatedAt"`
	Proposals   []Proposal `json:"proposals"`
	Truncated   bool       `json:"truncated"`
}

// Scan runs a single rollup + analysis pass and returns ranked proposals.
// `top` caps the result; pass 0 for unlimited.
func (e *EvolveService) Scan(top int) (*EvolveReport, error) {
	if e.tel != nil {
		_, _ = e.tel.Rollup() // best-effort; rebuild sqlite for fresh queries
	}

	var proposals []Proposal

	// 1) Ad-hoc field clusters from lint telemetry → propose-kind-field
	if e.tel != nil {
		rows, _ := e.tel.Query(`
			SELECT value, COUNT(*) AS n FROM events
			WHERE kind='lint-finding' AND value LIKE '%.%'
			GROUP BY value HAVING n >= 1 ORDER BY n DESC LIMIT 50
		`)
		for _, r := range rows {
			val, _ := r["value"].(string)
			if val == "" {
				continue
			}
			n := intOf(r["n"])
			proposals = append(proposals, Proposal{
				Kind:        "propose-kind",
				Subject:     val,
				Score:       float64(n) * 1.0,
				Reason:      "ad-hoc field cluster surfaced by lint",
				SourceTypes: []string{"lint-finding"},
			})
		}
	}

	// 2) Edge-pattern signals → propose-edge
	if e.tel != nil {
		rows, _ := e.tel.Query(`
			SELECT value, COUNT(*) AS n FROM events
			WHERE kind='edge-pattern' GROUP BY value HAVING n >= 5 ORDER BY n DESC
		`)
		for _, r := range rows {
			val, _ := r["value"].(string)
			n := intOf(r["n"])
			if val == "" {
				continue
			}
			proposals = append(proposals, Proposal{
				Kind:        "propose-edge",
				Subject:     val,
				Score:       float64(n) * 1.5,
				Reason:      "free-string edge type repeated; promote to enum",
				SourceTypes: []string{"edge-pattern"},
			})
		}
	}

	// 3) Query gaps → propose-page
	if e.tel != nil {
		rows, _ := e.tel.Query(`
			SELECT topic, COUNT(*) AS n FROM events
			WHERE kind='query-gap' AND topic IS NOT NULL AND topic != ''
			GROUP BY topic HAVING n >= 2 ORDER BY n DESC LIMIT 20
		`)
		for _, r := range rows {
			topic, _ := r["topic"].(string)
			n := intOf(r["n"])
			proposals = append(proposals, Proposal{
				Kind:        "propose-page",
				Subject:     topic,
				Score:       float64(n) * 2.0,
				Reason:      "repeated chat query with zero-or-low RAG hits",
				SourceTypes: []string{"query-gap"},
			})
		}
	}

	// 4) Validation failures → propose-kind-field (hard signal)
	if e.tel != nil {
		rows, _ := e.tel.Query(`
			SELECT value, COUNT(*) AS n FROM events
			WHERE kind='validation-fail' GROUP BY value HAVING n >= 1 ORDER BY n DESC
		`)
		for _, r := range rows {
			val, _ := r["value"].(string)
			n := intOf(r["n"])
			if val == "" {
				continue
			}
			proposals = append(proposals, Proposal{
				Kind:        "propose-kind",
				Subject:     val,
				Score:       float64(n) * 3.0,
				Reason:      "validation failures — schema mismatch with reality",
				SourceTypes: []string{"validation-fail"},
			})
		}
	}

	// 5) Pending candidates → promote-candidate (informational, no scoring boost)
	if e.lint != nil {
		// Skipped — candidates surface through their own dir, not telemetry.
		// Keep as a placeholder for the orchestrator skill to enumerate them.
	}

	// Rank
	sort.Slice(proposals, func(i, j int) bool { return proposals[i].Score > proposals[j].Score })

	report := &EvolveReport{
		GeneratedAt: time.Now().UTC(),
	}
	if top > 0 && len(proposals) > top {
		report.Proposals = proposals[:top]
		report.Truncated = true
	} else {
		report.Proposals = proposals
	}
	return report, nil
}

func intOf(v any) int {
	switch n := v.(type) {
	case int64:
		return int(n)
	case float64:
		return int(n)
	case int:
		return n
	}
	return 0
}
