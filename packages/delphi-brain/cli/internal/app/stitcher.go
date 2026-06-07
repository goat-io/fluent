package app

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"

	"github.com/goat-io/delphi-brain/cli/internal/domain"
)

// StitcherService implements Phase 6 of PROPOSAL_GENERIC_TREE.md — at index
// time, walks every catalog entry and builds outbound + inbound adjacency for
// every typed edge. Hand-written `consumedBy` arrays are dropped; if present,
// they're treated as overrides.
//
// Result is held in-memory; rebuild on demand (catalog is small enough that a
// few-millisecond rebuild is preferable to coupling to a file watcher).
type StitcherService struct {
	root string

	mu           sync.RWMutex
	entries      map[string]*StitchedEntry // name → entry
	indexedAt    string
	totalEntries int
}

// StitchedEntry is the universal entity record returned by the catalog API.
// Outbound + inbound carry every edge type; downstream views filter by relation.
type StitchedEntry struct {
	Name        string         `json:"name"`
	Kind        string         `json:"kind"`
	Description string         `json:"description"`
	System      string         `json:"system,omitempty"`
	Layer       string         `json:"layer,omitempty"`
	Domain      string         `json:"domain,omitempty"`
	Folder      string         `json:"folder"` // catalog-relative path
	Spec        map[string]any `json:"spec"`   // full catalog-info.json
	Outbound    []StitchedEdge `json:"outbound"`
	Inbound     []StitchedEdge `json:"inbound"`
}

// StitchedEdge — typed edge with the relation discriminator.
type StitchedEdge struct {
	Relation string         `json:"relation"`         // 'dependsOn' | 'governs' | 'pages' | 'documents' | 'realizedBy' | 'measuredBy' | 'classifiedAs' | 'storedIn' | 'writtenBy' | 'readBy' | 'tracks' | 'componentRepos' | 'communicatesWith' | 'cascadesFrom' | 'memberOf'
	Source   string         `json:"source"`
	Target   string         `json:"target"`
	Kind     string         `json:"kind,omitempty"`   // target kind, mirrored from spec
	Meta     map[string]any `json:"meta,omitempty"`   // protocol/port/purpose/instance from edge object
}

// edgeFields lists the catalog-info.json fields we treat as typed edges.
//
//	relation name → key in spec → "object" | "string-list" | "object-of-targets" | "string"
//
// Keep alphabetical for diffability. New kinds add rows here.
var edgeFields = []struct {
	relation string
	key      string
	shape    string // "deps" | "stringList" | "string"
}{
	{"affects", "affects", "deps"},
	{"binds", "binds", "deps"},
	{"boundsComponent", "boundsComponent", "deps"},
	{"boundsSlo", "boundsSlo", "deps"},
	{"cascadesFrom", "cascadesFrom", "string"},
	{"cascadesTo", "cascadesTo", "stringList"},
	{"classifiedAs", "classifiedAs", "deps"},
	{"communicatesWith", "communicatesWith", "deps"},
	{"componentRepos", "componentRepos", "stringList"},
	{"composedOf", "composedOf", "deps"},
	{"consumes", "consumes", "deps"},
	{"consumesApi", "consumesApis", "stringList"},
	{"dependsOn", "dependsOn", "deps"},
	{"deployedBy", "deployedBy", "stringList"},
	{"documents", "documents", "deps"},
	{"governs", "governs", "deps"},
	{"integratesWith", "integratesWith", "deps"},
	{"measuredBy", "measuredBy", "deps"},
	{"memberOf", "memberOf", "string"},
	{"objective", "objective", "string"},
	{"ownerTeam", "ownerTeam", "string"},
	{"ownsSystems", "ownsSystems", "stringList"},
	{"pages", "pages", "deps"},
	{"produces", "produces", "deps"},
	{"providesApi", "providesApis", "stringList"},
	{"readBy", "readBy", "deps"},
	{"realizedBy", "realizedBy", "deps"},
	{"realizes", "realizes", "deps"},
	{"runsOn", "runsOn", "string"},
	{"storedIn", "storedIn", "deps"},
	{"tracks", "tracks", "deps"},
	{"valueStreams", "valueStreams", "stringList"},
	{"variantOf", "variantOf", "string"},
	{"writtenBy", "writtenBy", "deps"},
}

func NewStitcherService(root string) *StitcherService {
	return &StitcherService{
		root:    root,
		entries: map[string]*StitchedEntry{},
	}
}

// Index walks the catalog tree once and (re)builds adjacency.
//
// Inverse edges are derived: if A `dependsOn` B, B's `Inbound` gets the matching
// edge with relation = "dependsOn" (same name — the relation describes the edge,
// not the direction). The drawer chooses how to render up/sideways/down based
// on relation + direction, not on a separate inverse-relation namespace.
func (s *StitcherService) Index() (StitchResult, error) {
	catalogDir := filepath.Join(s.root, domain.CatalogDir())

	entries := map[string]*StitchedEntry{}

	// Catalog is flat-by-kind: catalog/<kind-folder>/<entry>/. Walk every kind
	// folder and load each entry's catalog-info.json. Domain comes from the
	// spec, not the folder name (folder name is now the kind).
	kindDirs, err := os.ReadDir(catalogDir)
	if err != nil {
		return StitchResult{}, fmt.Errorf("read catalog: %w", err)
	}
	for _, dd := range kindDirs {
		if !dd.IsDir() {
			continue
		}
		folderKind := dd.Name()
		entryDirs, _ := os.ReadDir(filepath.Join(catalogDir, folderKind))
		// Folder name → singular kind (e.g. repos → repo, data-assets → data-asset)
		folderKindSingular := strings.TrimSuffix(folderKind, "s")
		for _, ed := range entryDirs {
			if !ed.IsDir() {
				continue
			}
			specPath := filepath.Join(catalogDir, folderKind, ed.Name(), "catalog-info.json")
			var spec map[string]any
			if data, err := os.ReadFile(specPath); err == nil {
				_ = json.Unmarshal(data, &spec)
			}
			// Synthesise a minimal entry when JSON is missing — folder presence
			// alone implies the entry exists with the folder's kind. Lets the
			// catalog show 173 repos instead of dropping the 31 README-only
			// folders to invisible.
			if spec == nil {
				spec = map[string]any{
					"name": ed.Name(),
					"kind": folderKindSingular,
				}
			}
			name, _ := spec["name"].(string)
			if name == "" {
				name = ed.Name()
			}
			kind, _ := spec["kind"].(string)
			if kind == "" {
				kind = folderKindSingular
			}
			desc, _ := spec["description"].(string)
			system, _ := spec["system"].(string)
			layer, _ := spec["layer"].(string)
			specDomain, _ := spec["domain"].(string)

			entries[name] = &StitchedEntry{
				Name:        name,
				Kind:        kind,
				Description: desc,
				System:      system,
				Layer:       layer,
				Domain:      specDomain,
				Folder:      filepath.Join(folderKind, ed.Name()),
				Spec:        spec,
			}
		}
	}

	// 1.5 — derive a team-string → team-slug map from kind:team entries.
	// Repos still carry a free-text `team` field. The stitcher synthesises an
	// `ownerTeam` edge to the matching team entry (Phase 1.1 backfill bridge).
	// Disappears once repos move to a structured ownerTeam reference.
	teamForString := map[string]string{}
	for slug, e := range entries {
		if e.Kind != "team" {
			continue
		}
		matches, _ := e.Spec["repoTeamMatch"].([]any)
		for _, m := range matches {
			if str, ok := m.(string); ok && str != "" {
				teamForString[str] = slug
			}
		}
	}
	for srcName, src := range entries {
		if src.Kind != "repo" {
			continue
		}
		teamStr, _ := src.Spec["team"].(string)
		if teamStr == "" {
			continue
		}
		slug, ok := teamForString[teamStr]
		if !ok {
			continue
		}
		// Skip if already declared (don't double-stitch).
		alreadyHas := false
		for _, e := range src.Outbound {
			if e.Relation == "ownerTeam" && e.Target == slug {
				alreadyHas = true
				break
			}
		}
		if alreadyHas {
			continue
		}
		edge := StitchedEdge{Relation: "ownerTeam", Source: srcName, Target: slug, Kind: "team"}
		src.Outbound = append(src.Outbound, edge)
		if dst, ok := entries[slug]; ok {
			dst.Inbound = append(dst.Inbound, edge)
		}
	}

	// 2nd pass — for each entry, walk every known edge field and emit forward
	// + inverse edges. Targets that don't exist as catalog entries are still
	// emitted on the source side (link-rot is visible as dangling outbound).
	for srcName, src := range entries {
		for _, ef := range edgeFields {
			raw, ok := src.Spec[ef.key]
			if !ok {
				continue
			}
			switch ef.shape {
			case "deps":
				items, _ := raw.([]any)
				for _, it := range items {
					m, _ := it.(map[string]any)
					if m == nil {
						continue
					}
					target, _ := m["target"].(string)
					if target == "" {
						continue
					}
					tkind, _ := m["kind"].(string)
					meta := map[string]any{}
					for _, k := range []string{"protocol", "port", "purpose", "instance"} {
						if v, ok := m[k]; ok {
							meta[k] = v
						}
					}
					if len(meta) == 0 {
						meta = nil
					}
					edge := StitchedEdge{
						Relation: ef.relation,
						Source:   srcName,
						Target:   target,
						Kind:     tkind,
						Meta:     meta,
					}
					src.Outbound = append(src.Outbound, edge)
					if dst, ok := entries[target]; ok {
						dst.Inbound = append(dst.Inbound, edge)
					}
				}
			case "stringList":
				items, _ := raw.([]any)
				for _, it := range items {
					target, _ := it.(string)
					if target == "" || target == "_TBD_" {
						continue
					}
					edge := StitchedEdge{Relation: ef.relation, Source: srcName, Target: target}
					src.Outbound = append(src.Outbound, edge)
					if dst, ok := entries[target]; ok {
						dst.Inbound = append(dst.Inbound, edge)
					}
				}
			case "string":
				target, _ := raw.(string)
				if target == "" {
					continue
				}
				edge := StitchedEdge{Relation: ef.relation, Source: srcName, Target: target}
				src.Outbound = append(src.Outbound, edge)
				if dst, ok := entries[target]; ok {
					dst.Inbound = append(dst.Inbound, edge)
				}
			}
		}
	}

	// Sort each entry's edges for deterministic API output. Materialise empty
	// slices so the JSON contract always returns `[]`, never `null`.
	for _, e := range entries {
		if e.Outbound == nil {
			e.Outbound = []StitchedEdge{}
		}
		if e.Inbound == nil {
			e.Inbound = []StitchedEdge{}
		}
		sort.Slice(e.Outbound, func(i, j int) bool {
			if e.Outbound[i].Relation != e.Outbound[j].Relation {
				return e.Outbound[i].Relation < e.Outbound[j].Relation
			}
			return e.Outbound[i].Target < e.Outbound[j].Target
		})
		sort.Slice(e.Inbound, func(i, j int) bool {
			if e.Inbound[i].Relation != e.Inbound[j].Relation {
				return e.Inbound[i].Relation < e.Inbound[j].Relation
			}
			return e.Inbound[i].Source < e.Inbound[j].Source
		})
	}

	s.mu.Lock()
	s.entries = entries
	s.totalEntries = len(entries)
	s.mu.Unlock()

	return StitchResult{Entries: len(entries)}, nil
}

type StitchResult struct {
	Entries int `json:"entries"`
}

// Contributors traverses the graph from `start` downward following ownership /
// composition edges and aggregates `spec.collaborators` per reachable repo.
// Result is grouped by closest-repo (where each person's contribution lands
// nearest to the start), depth-tagged, sorted by depth then commits.
//
// Business semantics live HERE so every UI gets the same answer:
//   - which edges count as "down" (componentRepos / dependsOn / …)
//   - role ranking (owner > maintainer > contributor)
//   - sort order (closest first, then commits desc)
type Contributor struct {
	Login          string             `json:"login"`
	TotalCommits   int                `json:"totalCommits"`
	MinDepth       int                `json:"minDepth"`
	TopRole        string             `json:"topRole,omitempty"`
	RecentlyActive bool               `json:"recentlyActive"`
	Repos          []ContributorRepo  `json:"repos"` // sorted closest-first
}

type ContributorRepo struct {
	Name    string `json:"name"`
	Depth   int    `json:"depth"`
	Commits int    `json:"commits"`
	Role    string `json:"role,omitempty"`
}

type ContributorGroup struct {
	RepoName     string        `json:"repoName"`
	Depth        int           `json:"depth"`
	TotalCommits int           `json:"totalCommits"`
	Contributors []*Contributor `json:"contributors"` // sorted by commits-in-this-repo desc
}

type ContributorAggregation struct {
	Entity            string              `json:"entity"`
	Depth             int                 `json:"depth"`
	TotalContributors int                 `json:"totalContributors"`
	TotalCommits      int                 `json:"totalCommits"`
	Groups            []*ContributorGroup `json:"groups"` // closest groups first
}

func (s *StitcherService) Contributors(start string, depth int) (*ContributorAggregation, error) {
	if depth < 1 {
		depth = 6
	}
	root, err := s.GetEntry(start)
	if err != nil {
		return nil, err
	}
	// Follow these relations downward in the natural Outbound direction.
	follow := map[string]bool{
		"dependsOn": true, "componentRepos": true, "communicatesWith": true,
		"composedOf": true, "storedIn": true, "realizedBy": true,
	}
	// Follow these relations in the INVERSE direction — i.e. via Inbound
	// edges. The natural "down" of a team is the entries that point at it
	// with `ownerTeam`; the natural "down" of a system is the entries that
	// declare `memberOf`. Without this, starting BFS from a team or system
	// finds zero downstream repos and the People tab is empty.
	followInverse := map[string]bool{
		"ownerTeam":   true,
		"memberOf":    true,
		"ownsSystems": true,
	}
	roleRank := map[string]int{"owner": 3, "maintainer": 2, "contributor": 1}

	s.mu.RLock()
	defer s.mu.RUnlock()

	depthByName := map[string]int{root.Name: 0}
	frontier := []string{root.Name}
	for d := 0; d < depth; d++ {
		var next []string
		for _, cur := range frontier {
			e, ok := s.entries[cur]
			if !ok {
				continue
			}
			for _, ed := range e.Outbound {
				if !follow[ed.Relation] {
					continue
				}
				if _, seen := depthByName[ed.Target]; seen {
					continue
				}
				depthByName[ed.Target] = d + 1
				next = append(next, ed.Target)
			}
			for _, ed := range e.Inbound {
				if !followInverse[ed.Relation] {
					continue
				}
				if _, seen := depthByName[ed.Source]; seen {
					continue
				}
				depthByName[ed.Source] = d + 1
				next = append(next, ed.Source)
			}
		}
		frontier = next
		if len(frontier) == 0 {
			break
		}
	}

	byLogin := map[string]*Contributor{}
	for name, dep := range depthByName {
		e, ok := s.entries[name]
		if !ok {
			continue
		}
		raw, _ := e.Spec["collaborators"].([]any)
		for _, c := range raw {
			m, _ := c.(map[string]any)
			if m == nil {
				continue
			}
			login, _ := m["login"].(string)
			if login == "" {
				continue
			}
			role, _ := m["role"].(string)
			commitsF, _ := m["commits"].(float64)
			active, _ := m["recentlyActive"].(bool)
			commits := int(commitsF)
			p := byLogin[login]
			if p == nil {
				p = &Contributor{Login: login, MinDepth: 1<<30}
				byLogin[login] = p
			}
			p.TotalCommits += commits
			p.Repos = append(p.Repos, ContributorRepo{Name: name, Depth: dep, Commits: commits, Role: role})
			if active {
				p.RecentlyActive = true
			}
			if roleRank[role] > roleRank[p.TopRole] {
				p.TopRole = role
			}
			if dep < p.MinDepth {
				p.MinDepth = dep
			}
		}
	}

	// Sort each contributor's repo list closest-first (then commits desc)
	for _, p := range byLogin {
		sort.Slice(p.Repos, func(i, j int) bool {
			if p.Repos[i].Depth != p.Repos[j].Depth {
				return p.Repos[i].Depth < p.Repos[j].Depth
			}
			return p.Repos[i].Commits > p.Repos[j].Commits
		})
	}

	// Bucket by closest repo (skip depth-0 — that IS the start entity)
	groups := map[string]*ContributorGroup{}
	for _, p := range byLogin {
		// First repo that's not the start entity
		var anchor *ContributorRepo
		for i := range p.Repos {
			if p.Repos[i].Depth > 0 {
				anchor = &p.Repos[i]
				break
			}
		}
		if anchor == nil {
			continue
		}
		g := groups[anchor.Name]
		if g == nil {
			g = &ContributorGroup{RepoName: anchor.Name, Depth: anchor.Depth}
			groups[anchor.Name] = g
		}
		g.Contributors = append(g.Contributors, p)
		g.TotalCommits += anchor.Commits
	}

	out := &ContributorAggregation{
		Entity: start, Depth: depth,
	}
	for _, g := range groups {
		// Sort contributors by commits-in-this-repo desc
		sort.Slice(g.Contributors, func(i, j int) bool {
			ci := commitsInRepo(g.Contributors[i], g.RepoName)
			cj := commitsInRepo(g.Contributors[j], g.RepoName)
			return ci > cj
		})
		out.Groups = append(out.Groups, g)
		out.TotalContributors += len(g.Contributors)
		out.TotalCommits += g.TotalCommits
	}
	// Sort groups closest first, then by people count desc
	sort.Slice(out.Groups, func(i, j int) bool {
		if out.Groups[i].Depth != out.Groups[j].Depth {
			return out.Groups[i].Depth < out.Groups[j].Depth
		}
		return len(out.Groups[i].Contributors) > len(out.Groups[j].Contributors)
	})
	return out, nil
}

func commitsInRepo(p *Contributor, name string) int {
	for _, r := range p.Repos {
		if r.Name == name {
			return r.Commits
		}
	}
	return 0
}

// GetEntry returns the entry with the given name (globally unique). Triggers a
// lazy index if none has run yet.
func (s *StitcherService) GetEntry(name string) (*StitchedEntry, error) {
	s.mu.RLock()
	if len(s.entries) == 0 {
		s.mu.RUnlock()
		if _, err := s.Index(); err != nil {
			return nil, err
		}
		s.mu.RLock()
	}
	defer s.mu.RUnlock()
	e, ok := s.entries[name]
	if !ok {
		return nil, fmt.Errorf("entry not found: %s", name)
	}
	return e, nil
}

// Expand — graph traversal from a starting entry.
//
//	direction = "down" → follow outbound only
//	direction = "up"   → follow inbound only
//	direction = "both" → both
//	depth = N          → cap on hops
//
// Returns a flat slice of StitchedEntry (root first). Cycle-safe via visited set.
func (s *StitcherService) Expand(start, direction string, depth int) ([]*StitchedEntry, error) {
	if direction == "" {
		direction = "both"
	}
	if depth < 1 {
		depth = 1
	}
	root, err := s.GetEntry(start)
	if err != nil {
		return nil, err
	}
	visited := map[string]bool{start: true}
	out := []*StitchedEntry{root}

	frontier := []string{start}
	for d := 0; d < depth; d++ {
		var next []string
		for _, name := range frontier {
			e, ok := s.entries[name]
			if !ok {
				continue
			}
			edges := []StitchedEdge{}
			if direction == "down" || direction == "both" {
				edges = append(edges, e.Outbound...)
			}
			if direction == "up" || direction == "both" {
				edges = append(edges, e.Inbound...)
			}
			for _, edge := range edges {
				neighbour := edge.Target
				if direction == "up" {
					neighbour = edge.Source
				}
				if direction == "both" && edge.Source == name {
					neighbour = edge.Target
				} else if direction == "both" {
					neighbour = edge.Source
				}
				if visited[neighbour] {
					continue
				}
				if neighbourEntry, ok := s.entries[neighbour]; ok {
					visited[neighbour] = true
					out = append(out, neighbourEntry)
					next = append(next, neighbour)
				}
			}
		}
		frontier = next
		if len(frontier) == 0 {
			break
		}
	}
	return out, nil
}

// Snapshot returns a shallow copy of the current entry map. Callers iterate
// for cross-entity aggregations (cost-by-system, cost-by-team). Triggers a
// lazy index if none has run yet.
func (s *StitcherService) Snapshot() map[string]*StitchedEntry {
	s.mu.RLock()
	if len(s.entries) == 0 {
		s.mu.RUnlock()
		_, _ = s.Index()
		s.mu.RLock()
	}
	defer s.mu.RUnlock()
	out := make(map[string]*StitchedEntry, len(s.entries))
	for k, v := range s.entries {
		out[k] = v
	}
	return out
}

// Stats returns a quick overview for /api/catalog/stats.
func (s *StitcherService) Stats() map[string]any {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if len(s.entries) == 0 {
		return map[string]any{"entries": 0, "byKind": map[string]int{}, "totalEdges": 0}
	}
	byKind := map[string]int{}
	totalEdges := 0
	for _, e := range s.entries {
		byKind[e.Kind]++
		totalEdges += len(e.Outbound)
	}
	return map[string]any{
		"entries":    len(s.entries),
		"byKind":     byKind,
		"totalEdges": totalEdges,
	}
}
