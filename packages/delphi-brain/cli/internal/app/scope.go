package app

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// ScopeService implements the lens registry and scope resolver — Phase 9 of
// PROPOSAL_GENERIC_TREE.md (UnifiedView). One service feeds three projectors
// (table / dashboard / graph). Frontend never filters; it just paints.
type ScopeService struct {
	stitcher *StitcherService
	registry map[string]Lens
}

// Lens is a named filter over the stitched catalog. Predicate decides whether
// an entry is in scope; Description is shown in payload meta for UI labels.
type Lens struct {
	ID          string
	Name        string
	Description string
	Predicate   func(e *StitchedEntry) bool
}

// Scope is the in-memory subgraph a lens produces. Projectors consume this.
type Scope struct {
	Lens    Lens
	Entries map[string]*StitchedEntry
	Edges   []ScopeEdge
}

// ScopeEdge is a flattened typed edge between two in-scope entries.
type ScopeEdge struct {
	Relation string         `json:"relation"`
	Source   string         `json:"source"`
	Target   string         `json:"target"`
	Kind     string         `json:"kind,omitempty"`
	Meta     map[string]any `json:"meta,omitempty"`
}

// NewScopeService wires the built-in lens registry.
func NewScopeService(stitcher *StitcherService) *ScopeService {
	s := &ScopeService{
		stitcher: stitcher,
		registry: map[string]Lens{},
	}
	s.registerBuiltin()
	return s
}

func (s *ScopeService) registerBuiltin() {
	for _, l := range []Lens{
		{
			ID: "catalog", Name: "Catalog (all entities)",
			Description: "Every entry in the catalog.",
			Predicate:   func(e *StitchedEntry) bool { return true },
		},
		{
			ID: "systems", Name: "Systems",
			Description: "Systems with their member entries — C4 L1 view.",
			Predicate: func(e *StitchedEntry) bool {
				if e.Kind == "system" {
					return true
				}
				return e.System != "" && isComponentKind(e.Kind)
			},
		},
		{
			ID: "communications", Name: "Communications",
			Description: "Devices, services, externals — entities that exchange protocol traffic.",
			Predicate: func(e *StitchedEntry) bool {
				switch e.Kind {
				case "product", "service", "infra", "external":
					return true
				case "repo":
					return hasProtocolEdge(e)
				}
				return false
			},
		},
		{
			ID: "data", Name: "Data layer",
			Description: "Data assets, pipelines, classifications, and storage infra.",
			Predicate: func(e *StitchedEntry) bool {
				if e.Layer == "data" {
					return true
				}
				switch e.Kind {
				case "data-asset", "data-pipeline", "classification":
					return true
				}
				return false
			},
		},
		{
			ID: "operations", Name: "Operations",
			Description: "On-call rotations, SLOs, runbooks.",
			Predicate: func(e *StitchedEntry) bool {
				switch e.Kind {
				case "oncall", "slo", "sla", "runbook":
					return true
				}
				return false
			},
		},
		{
			ID: "strategy", Name: "Strategy & metrics",
			Description: "Capabilities, value streams, KPIs, objectives, key results.",
			Predicate: func(e *StitchedEntry) bool {
				switch e.Kind {
				case "capability", "value-stream", "kpi", "objective", "key-result":
					return true
				}
				return false
			},
		},
		{
			ID: "teams", Name: "Teams",
			Description: "R&D teams. Pick a team in the lens menu to see what they own.",
			Predicate: func(e *StitchedEntry) bool {
				return e.Kind == "team"
			},
		},
	} {
		s.registry[l.ID] = l
	}
}

// isComponentKind decides whether a kind counts as a "system member" for the
// systems lens — entries that belong inside a system box.
func isComponentKind(k string) bool {
	switch k {
	case "repo", "service", "infra", "external", "product":
		return true
	}
	return false
}

// hasProtocolEdge returns true if any outbound edge of e carries a protocol —
// signals that the entry actually participates in network traffic, not just
// that it imports another repo. Used to narrow the communications lens to
// entries that meaningfully appear in protocol diagrams.
func hasProtocolEdge(e *StitchedEntry) bool {
	for _, ed := range e.Outbound {
		if ed.Relation != "dependsOn" && ed.Relation != "communicatesWith" {
			continue
		}
		if p, ok := ed.Meta["protocol"].(string); ok && p != "" {
			return true
		}
	}
	return false
}

// Lenses returns every available lens — built-ins plus dynamic ones derived
// from the catalog so users discover them in the UI without typing URLs.
// Today we expose `team:<slug>` per kind:team entry; future families (per
// system, per layer) plug in the same way.
func (s *ScopeService) Lenses() []Lens {
	out := make([]Lens, 0, len(s.registry)+8)
	for _, l := range s.registry {
		out = append(out, l)
	}
	for _, l := range s.derivedTeamLenses() {
		out = append(out, l)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out
}

// LoadManifests reads every <name>.json in the given directory and registers
// it as a kind-based lens. Phase 7 of brain-llm-wiki-evolution-plan.md —
// drop-a-file mechanism for simple lenses. Manifest shape:
//
//	{
//	  "name":  "actions",
//	  "label": "Actions",
//	  "kinds": ["action"],
//	  "description": "Open work items across the wiki",
//	  ...other fields (ignored here; frontend reads them via fs glob)
//	}
//
// Custom-predicate lenses with arbitrary logic stay in code (registerBuiltin).
// Manifests with `name` that collides with a built-in are ignored — built-in
// wins. This lets us migrate lenses to manifests incrementally without
// breaking the UI.
func (s *ScopeService) LoadManifests(dir string) (int, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return 0, nil
		}
		return 0, err
	}
	count := 0
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".json") {
			continue
		}
		raw, err := os.ReadFile(filepath.Join(dir, e.Name()))
		if err != nil {
			continue
		}
		var m struct {
			Name        string   `json:"name"`
			Label       string   `json:"label"`
			Description string   `json:"description"`
			Kinds       []string `json:"kinds"`
		}
		if err := json.Unmarshal(raw, &m); err != nil {
			continue
		}
		if m.Name == "" || len(m.Kinds) == 0 {
			continue
		}
		if _, ok := s.registry[m.Name]; ok {
			continue // built-in wins
		}
		kindSet := map[string]bool{}
		for _, k := range m.Kinds {
			kindSet[k] = true
		}
		label := m.Label
		if label == "" {
			label = m.Name
		}
		s.registry[m.Name] = Lens{
			ID:          m.Name,
			Name:        label,
			Description: m.Description,
			Predicate: func(set map[string]bool) func(*StitchedEntry) bool {
				return func(e *StitchedEntry) bool { return set[e.Kind] }
			}(kindSet),
		}
		count++
	}
	return count, nil
}

// derivedTeamLenses returns one lens per kind:team entry in the catalog.
// Display name uses the team's `displayName` when set so the dropdown reads
// "Team — External (Spain + Sweden)" rather than the slug "external".
func (s *ScopeService) derivedTeamLenses() []Lens {
	snap := s.stitcher.Snapshot()
	out := []Lens{}
	for name, e := range snap {
		if e.Kind != "team" {
			continue
		}
		display := name
		if d, ok := e.Spec["displayName"].(string); ok && d != "" {
			display = d
		}
		out = append(out, Lens{
			ID:          "team:" + name,
			Name:        "Team — " + display,
			Description: fmt.Sprintf("Every entry owned by team '%s'.", display),
			Predicate: func(slug string) func(*StitchedEntry) bool {
				return func(e *StitchedEntry) bool {
					if e.Kind == "team" && e.Name == slug {
						return true
					}
					if t, ok := e.Spec["team"].(string); ok && t == slug {
						return true
					}
					if t, ok := e.Spec["ownerTeam"].(string); ok && t == slug {
						return true
					}
					return false
				}
			}(name),
		})
	}
	return out
}

// ScopeFilter narrows a lens further. Each non-empty field requires the
// entry's matching attribute to equal the filter value. Filters compose
// AND-style (every set field must match). Drives the cross-mode filter UI
// on UnifiedView.
type ScopeFilter struct {
	Kind   string
	Layer  string
	System string
	Domain string
	Type   string
	Team   string
	Status string
}

// IsZero — true when no filter is set; lets handlers cheap-check whether
// they need to apply the filter pass.
func (f ScopeFilter) IsZero() bool {
	return f.Kind == "" && f.Layer == "" && f.System == "" && f.Domain == "" &&
		f.Type == "" && f.Team == "" && f.Status == ""
}

// Match — true when an entry passes every set field on the filter.
func (f ScopeFilter) Match(e *StitchedEntry) bool {
	if f.Kind != "" && e.Kind != f.Kind {
		return false
	}
	if f.Layer != "" && e.Layer != f.Layer {
		return false
	}
	if f.System != "" && e.System != f.System {
		return false
	}
	if f.Domain != "" && e.Domain != f.Domain {
		return false
	}
	if f.Type != "" && specString(e.Spec, "type") != f.Type {
		return false
	}
	if f.Team != "" && specString(e.Spec, "team") != f.Team {
		return false
	}
	if f.Status != "" {
		s := firstNonEmpty(specString(e.Spec, "lifecycle"), specString(e.Spec, "status"))
		if s != f.Status {
			return false
		}
	}
	return true
}

// Resolve walks every stitched entry, applies the lens predicate, and gathers
// every typed edge whose source AND target are both in scope. Supports
// parameterised lenses via "kind:<value>" syntax — e.g. "team:platform" yields
// a per-team scope without needing a registered entry.
func (s *ScopeService) Resolve(lensID string) (*Scope, error) {
	return s.ResolveWith(lensID, ScopeFilter{})
}

// ResolveWith resolves a lens then narrows the entry set with filter.
// Empty filter is equivalent to Resolve.
func (s *ScopeService) ResolveWith(lensID string, filter ScopeFilter) (*Scope, error) {
	lens, ok := s.lookup(lensID)
	if !ok {
		return nil, fmt.Errorf("unknown lens: %s", lensID)
	}
	snapshot := s.stitcher.Snapshot()
	if len(snapshot) == 0 {
		if _, err := s.stitcher.Index(); err != nil {
			return nil, err
		}
		snapshot = s.stitcher.Snapshot()
	}

	entries := make(map[string]*StitchedEntry, len(snapshot))
	for name, e := range snapshot {
		if !lens.Predicate(e) {
			continue
		}
		if !filter.IsZero() && !filter.Match(e) {
			continue
		}
		entries[name] = e
	}

	var edges []ScopeEdge
	for _, e := range entries {
		for _, ed := range e.Outbound {
			if _, in := entries[ed.Target]; !in {
				continue
			}
			edges = append(edges, ScopeEdge{
				Relation: ed.Relation,
				Source:   ed.Source,
				Target:   ed.Target,
				Kind:     ed.Kind,
				Meta:     ed.Meta,
			})
		}
	}
	sort.Slice(edges, func(i, j int) bool {
		if edges[i].Relation != edges[j].Relation {
			return edges[i].Relation < edges[j].Relation
		}
		if edges[i].Source != edges[j].Source {
			return edges[i].Source < edges[j].Source
		}
		return edges[i].Target < edges[j].Target
	})

	return &Scope{Lens: lens, Entries: entries, Edges: edges}, nil
}

// lookup resolves a lens ID, supporting "<key>:<value>" parameterised lenses.
// Falls back to "team:<slug>" by default, which is the most common
// per-thing slice. Add new dynamic lens families here.
func (s *ScopeService) lookup(id string) (Lens, bool) {
	if l, ok := s.registry[id]; ok {
		return l, true
	}
	if i := strings.IndexByte(id, ':'); i > 0 {
		key, val := id[:i], id[i+1:]
		switch key {
		case "team":
			return Lens{
				ID:   id,
				Name: "Team — " + val,
				Description: fmt.Sprintf(
					"Every entry owned by team '%s'.", val,
				),
				Predicate: func(e *StitchedEntry) bool {
					if e.Kind == "team" && e.Name == val {
						return true
					}
					if t, ok := e.Spec["team"].(string); ok && t == val {
						return true
					}
					if t, ok := e.Spec["ownerTeam"].(string); ok && t == val {
						return true
					}
					return false
				},
			}, true
		case "system":
			return Lens{
				ID:   id,
				Name: "System — " + val,
				Description: fmt.Sprintf(
					"The %s system and its members.", val,
				),
				Predicate: func(e *StitchedEntry) bool {
					if e.Kind == "system" && e.Name == val {
						return true
					}
					return e.System == val
				},
			}, true
		case "kind":
			return Lens{
				ID:   id,
				Name: "Kind — " + val,
				Description: fmt.Sprintf(
					"Every entry of kind '%s'.", val,
				),
				Predicate: func(e *StitchedEntry) bool { return e.Kind == val },
			}, true
		case "layer":
			return Lens{
				ID:   id,
				Name: "Layer — " + val,
				Description: fmt.Sprintf(
					"Every entry on the %s layer.", val,
				),
				Predicate: func(e *StitchedEntry) bool { return e.Layer == val },
			}, true
		}
	}
	return Lens{}, false
}
