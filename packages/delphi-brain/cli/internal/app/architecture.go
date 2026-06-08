package app

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/goat-io/delphi-brain/cli/internal/domain"
)

// ArchitectureService serves the architecture visualization data.
// It reads JSON seed files from catalog/_seeds/ and aggregates
// security findings from repo catalog-info.json files.
type ArchitectureService struct {
	root string // repo root (for reading files)
}

func NewArchitectureService(root string) *ArchitectureService {
	return &ArchitectureService{root: root}
}

// ArchitectureData is the mega-response for GET /api/architecture.
// One request, all data — avoids round-trips on page load.
//
// Note: `connections` was retired in the catalog-v2 migration. Edge data now
// comes from each catalog entry's `dependsOn` array — see GetGraph().
type ArchitectureData struct {
	Services         json.RawMessage `json:"services"`
	Databases        json.RawMessage `json:"databases"`
	Infrastructure   json.RawMessage `json:"infrastructure"`
	Devices          json.RawMessage `json:"devices"`
	AlarmFlows       json.RawMessage `json:"alarmFlows"`
	SecurityFindings json.RawMessage `json:"securityFindings"`
	Glossary         json.RawMessage `json:"glossary"`
	Personas         json.RawMessage `json:"personas"`
	CatalogPaths     json.RawMessage `json:"catalogPaths"`
	TargetState      json.RawMessage `json:"targetState"`
}

// GetAll reads all architecture seed files and returns them as one bundle.
func (s *ArchitectureService) GetAll() (*ArchitectureData, error) {
	archDir := filepath.Join(s.root, domain.CatalogDir(), "_seeds")

	data := &ArchitectureData{}

	files := map[string]*json.RawMessage{
		"services.json":          &data.Services,
		"databases.json":         &data.Databases,
		"infrastructure.json":    &data.Infrastructure,
		"devices.json":           &data.Devices,
		"alarm-flows.json":       &data.AlarmFlows,
		"security-findings.json": &data.SecurityFindings,
		"glossary.json":          &data.Glossary,
		"personas.json":          &data.Personas,
		"catalog-paths.json":     &data.CatalogPaths,
		"target-state.json":      &data.TargetState,
	}

	for name, dest := range files {
		raw, err := os.ReadFile(filepath.Join(archDir, name))
		if err != nil {
			// File missing — set to null, don't fail
			null := json.RawMessage("null")
			*dest = null
			continue
		}
		// Validate it's valid JSON
		if !json.Valid(raw) {
			return nil, fmt.Errorf("invalid JSON in %s", name)
		}
		*dest = raw
	}

	return data, nil
}

// GetSection reads a single architecture seed file by name.
func (s *ArchitectureService) GetSection(name string) (json.RawMessage, error) {
	archDir := filepath.Join(s.root, domain.CatalogDir(), "_seeds")
	raw, err := os.ReadFile(filepath.Join(archDir, name+".json"))
	if err != nil {
		return nil, fmt.Errorf("section not found: %s", name)
	}
	if !json.Valid(raw) {
		return nil, fmt.Errorf("invalid JSON in %s.json", name)
	}
	return raw, nil
}

// GraphData is the pre-computed dependency graph for the frontend.
type GraphData struct {
	Nodes []GraphNode `json:"nodes"`
	Edges []GraphEdge `json:"edges"`
	Zones []GraphZone `json:"zones"`
	Lanes []GraphLane `json:"lanes"` // horizontal type lanes
}

// GraphLane is a horizontal swim lane grouping repos by type.
type GraphLane struct {
	Type   string `json:"type"`
	Label  string `json:"label"`
	Y      int    `json:"y"`
	Height int    `json:"height"`
}

type GraphNode struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Domain      string `json:"domain"`
	Team        string `json:"team,omitempty"`
	Language    string `json:"language,omitempty"`
	Status      string `json:"status"`
	Description string `json:"description,omitempty"`
	Type        string `json:"type,omitempty"`
	Kind        string `json:"kind,omitempty"`
	Layer       string `json:"layer,omitempty"`
	System      string `json:"system,omitempty"`
	DepCount    int    `json:"depCount"`
	HasSecurity bool   `json:"hasSecurity"`
	X           int    `json:"x"`
	Y           int    `json:"y"`
}

type GraphEdge struct {
	ID     string `json:"id"`
	Source string `json:"source"`
	Target string `json:"target"`
}

type GraphZone struct {
	Domain string `json:"domain"`
	Label  string `json:"label"`
	Team   string `json:"team,omitempty"`
	X      int    `json:"x"`
	Y      int    `json:"y"`
	Width  int    `json:"width"`
	Height int    `json:"height"`
}

type repoInfo struct {
	Name        string
	Domain      string
	Team        string
	Language    string
	Status      string
	Description string
	Type        string
	Kind        string
	Layer       string
	System      string
	DependsOn   []specDep
	HasSecurity bool
}

// specDep mirrors domain.Dependency for inline JSON decoding inside this package.
type specDep struct {
	Target   string `json:"target"`
	Kind     string `json:"kind"`
	Protocol string `json:"protocol,omitempty"`
	Port     int    `json:"port,omitempty"`
	Purpose  string `json:"purpose,omitempty"`
	Instance string `json:"instance,omitempty"`
}

type domainGroup struct {
	domain string
	repos  []repoInfo
}

// GetGraph builds a pre-computed dependency graph from all repos + catalog-info.json specs.
func (s *ArchitectureService) GetGraph() (*GraphData, error) {
	catalogDir := filepath.Join(s.root, domain.CatalogDir())

	// Domain layout config
	domainColumn := map[string]int{
		"embedded": 0, "iot-backend": 1, "icc": 2, "identity": 3, "apps": 3,
		"ico": 4, "infrastructure": 5, "data": 5, "labs": 5, "legacy": 5,
		"docs": 5, "recruiting": 5, "unknown": 5,
	}
	colX := []int{0, 360, 720, 1080, 1440, 1800}
	domainLabels := map[string]string{
		"embedded": "Embedded / Devices", "iot-backend": "IoT Backend", "icc": "ICC Platform",
		"apps": "Apps (ICP/ICG)", "identity": "Identity", "ico": "ICO",
		"infrastructure": "Infrastructure", "data": "Data", "labs": "Labs",
		"legacy": "Legacy", "docs": "Docs", "recruiting": "Recruiting",
	}
	domainTeams := map[string]string{
		"embedded": "Luleå", "iot-backend": "Malmö", "icc": "Madrid",
		"apps": "Malmö", "identity": "Malmö", "ico": "Vietnam",
		"infrastructure": "Platform", "data": "Platform",
	}

	const nodeW = 220
	const nodeH = 52
	const nodeGap = 14
	const zonePadX = 16
	const zonePadTop = 34
	const zonePadBottom = 16
	const interGroupGap = 40

	// Scan all catalog-info.json files
	var allRepos []repoInfo
	repoNames := map[string]bool{}

	entries, _ := os.ReadDir(catalogDir)
	for _, domainDir := range entries {
		if !domainDir.IsDir() {
			continue
		}
		repoEntries, _ := os.ReadDir(filepath.Join(catalogDir, domainDir.Name()))
		for _, repoDir := range repoEntries {
			if !repoDir.IsDir() {
				continue
			}
			specPath := filepath.Join(catalogDir, domainDir.Name(), repoDir.Name(), "catalog-info.json")
			data, err := os.ReadFile(specPath)
			if err != nil {
				continue
			}
			var spec struct {
				Name        string    `json:"name"`
				Kind        string    `json:"kind"`
				Description string    `json:"description"`
				Domain      string    `json:"domain"`
				Type        string    `json:"type"`
				Lifecycle   string    `json:"lifecycle"`
				Language    []string  `json:"language"`
				Team        string    `json:"team"`
				System      string    `json:"system"`
				Layer       string    `json:"layer"`
				Tags        []string  `json:"tags"`
				DependsOn   []specDep `json:"dependsOn"`
				Security    *struct {
					Findings            []interface{} `json:"findings"`
					HasHardcodedSecrets bool          `json:"hasHardcodedSecrets"`
					HasMissingAuth      bool          `json:"hasMissingAuth"`
				} `json:"security"`
			}
			if err := json.Unmarshal(data, &spec); err != nil {
				continue
			}

			// The dep graph is repo-to-repo. Every other kind has its own
			// home: products in Communications, systems in Systems view,
			// service/infra/external/team/etc. in Catalog. Skip them here so
			// they don't fall through to the "Developer Tools" lane.
			if spec.Kind != "" && spec.Kind != "repo" {
				continue
			}

			name := spec.Name
			if name == "" {
				name = repoDir.Name()
			}
			domain := spec.Domain
			if domain == "" {
				domain = domainDir.Name()
			}
			status := spec.Lifecycle
			if status == "" {
				status = "unknown"
			}
			kind := spec.Kind
			if kind == "" {
				kind = "repo"
			}
			lang := ""
			// Prefer canonical language[] field; fall back to legacy tag scan.
			if len(spec.Language) > 0 {
				lang = spec.Language[0]
			} else {
				for _, t := range spec.Tags {
					switch t {
					case "java", "typescript", "python", "c", "c#", "go", "rust", "kotlin", "swift", "shell":
						lang = t
					}
				}
			}

			hasSec := false
			if spec.Security != nil {
				hasSec = len(spec.Security.Findings) > 0 || spec.Security.HasHardcodedSecrets || spec.Security.HasMissingAuth
			}

			allRepos = append(allRepos, repoInfo{
				Name: name, Domain: domain, Team: spec.Team, Language: lang,
				Status: status, Description: spec.Description, Type: spec.Type,
				Kind: kind, Layer: spec.Layer, System: spec.System,
				DependsOn: spec.DependsOn, HasSecurity: hasSec,
			})
			repoNames[name] = true
		}
	}

	// ── 2D Grid Layout: columns = domain, rows = type ──
	// Type rows (top to bottom = architectural layers)
	typeRow := map[string]int{
		"app": 0, "service": 1, "library": 2, "firmware": 3, "tool": 4, "config": 5,
	}
	typeLabels := map[string]string{
		"app": "User-Facing Applications", "service": "Backend Services & APIs",
		"library": "Shared Libraries", "firmware": "Firmware / Embedded",
		"tool": "Developer Tools", "config": "Infrastructure / Config",
	}
	typeOrder := []string{"app", "service", "library", "firmware", "tool", "config"}

	// Group repos into cells: [col][row] → []repoInfo
	type cell struct{ col, row int }
	cellRepos := map[cell][]repoInfo{}
	for _, r := range allRepos {
		col, ok := domainColumn[r.Domain]
		if !ok {
			col = 5
		}
		row, ok := typeRow[r.Type]
		if !ok {
			row = 4 // default to "tool"
		}
		c := cell{col, row}
		cellRepos[c] = append(cellRepos[c], r)
	}
	// Sort within each cell
	for c := range cellRepos {
		repoInfoSort(cellRepos[c]).sort()
	}

	// Compute row heights (max cell height per row across all columns)
	rowHeight := map[int]int{} // row → pixel height
	for row := 0; row < len(typeOrder); row++ {
		maxCount := 0
		for col := 0; col < len(colX); col++ {
			if repos, ok := cellRepos[cell{col, row}]; ok && len(repos) > maxCount {
				maxCount = len(repos)
			}
		}
		if maxCount == 0 {
			rowHeight[row] = 0
		} else {
			rowHeight[row] = zonePadTop + maxCount*(nodeH+nodeGap) + zonePadBottom
		}
	}

	// Compute Y offsets for each row
	const laneGap = 30
	const startY = 50
	rowY := map[int]int{}
	currentY := startY
	for _, t := range typeOrder {
		row := typeRow[t]
		rowY[row] = currentY
		if rowHeight[row] > 0 {
			currentY += rowHeight[row] + laneGap
		}
	}

	// Compute node positions
	nodePositions := map[string]struct{ x, y int }{}
	for c, repos := range cellRepos {
		x := colX[c.col]
		baseY := rowY[c.row]
		for i, repo := range repos {
			nodePositions[repo.Name] = struct{ x, y int }{
				x, baseY + zonePadTop + i*(nodeH+nodeGap),
			}
		}
	}

	// Build domain zones (vertical columns spanning all rows)
	var zones []GraphZone
	domainCols := map[int][]string{} // col → domains in that col
	for domain, col := range domainColumn {
		found := false
		for _, r := range allRepos {
			if r.Domain == domain {
				found = true
				break
			}
		}
		if found {
			domainCols[col] = append(domainCols[col], domain)
		}
	}
	totalHeight := currentY - startY
	for colIdx := 0; colIdx < len(colX); colIdx++ {
		domains := domainCols[colIdx]
		if len(domains) == 0 {
			continue
		}
		// Use first domain's label for the zone (most important)
		repoInfoSort := domains
		if len(repoInfoSort) > 1 {
			// Sort for determinism
			for i := 1; i < len(repoInfoSort); i++ {
				for j := i; j > 0 && repoInfoSort[j] < repoInfoSort[j-1]; j-- {
					repoInfoSort[j], repoInfoSort[j-1] = repoInfoSort[j-1], repoInfoSort[j]
				}
			}
		}
		primary := repoInfoSort[0]
		label := domainLabels[primary]
		if len(domains) > 1 {
			label = label + " +"
		}
		zones = append(zones, GraphZone{
			Domain: primary,
			Label:  label,
			Team:   domainTeams[primary],
			X:      colX[colIdx] - zonePadX,
			Y:      startY - 10,
			Width:  nodeW + zonePadX*2,
			Height: totalHeight + 20,
		})
	}

	// Build horizontal type lanes
	var lanes []GraphLane
	for _, t := range typeOrder {
		row := typeRow[t]
		if rowHeight[row] == 0 {
			continue
		}
		lanes = append(lanes, GraphLane{
			Type:   t,
			Label:  typeLabels[t],
			Y:      rowY[row],
			Height: rowHeight[row],
		})
	}

	// Build nodes
	var nodes []GraphNode
	for _, r := range allRepos {
		pos, ok := nodePositions[r.Name]
		if !ok {
			continue
		}
		depCount := 0
		for _, d := range r.DependsOn {
			if d.Kind == "repo" && repoNames[d.Target] {
				depCount++
			}
		}
		nodes = append(nodes, GraphNode{
			ID: r.Name, Name: r.Name, Domain: r.Domain,
			Team: r.Team, Language: r.Language, Status: r.Status,
			Description: r.Description, Type: r.Type,
			Kind: r.Kind, Layer: r.Layer, System: r.System,
			DepCount: depCount, HasSecurity: r.HasSecurity,
			X: pos.x, Y: pos.y,
		})
	}

	// Build edges (repo-to-repo only — infra/external/service deps are kept on
	// the originating node's full spec but skipped from the graph here)
	var edges []GraphEdge
	edgeSet := map[string]bool{}
	for _, r := range allRepos {
		for _, dep := range r.DependsOn {
			if dep.Kind != "repo" || !repoNames[dep.Target] {
				continue
			}
			edgeID := r.Name + "|" + dep.Target
			if edgeSet[edgeID] {
				continue
			}
			edgeSet[edgeID] = true
			edges = append(edges, GraphEdge{
				ID:     edgeID,
				Source: r.Name,
				Target: dep.Target,
			})
		}
	}

	return &GraphData{Nodes: nodes, Edges: edges, Zones: zones, Lanes: lanes}, nil
}

func contains(s, sub string) bool {
	return len(s) >= len(sub) && (s == sub || len(sub) == 0 ||
		(len(s) > 0 && len(sub) > 0 && containsStr(s, sub)))
}

func containsStr(s, sub string) bool {
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}

type repoInfoSort []repoInfo

func (s repoInfoSort) sort() {
	for i := 1; i < len(s); i++ {
		for j := i; j > 0 && s[j].Name < s[j-1].Name; j-- {
			s[j], s[j-1] = s[j-1], s[j]
		}
	}
}

type domainGroupSort []domainGroup

func (s domainGroupSort) sort() {
	for i := 1; i < len(s); i++ {
		for j := i; j > 0 && s[j].domain < s[j-1].domain; j-- {
			s[j], s[j-1] = s[j-1], s[j]
		}
	}
}

// ===========================================================================
// Systems view (C4 Level 1) — aggregates catalog entries by `system` field
// and joins with kind:system manifests at catalog/systems/<id>/catalog-info.json.
// ===========================================================================

// SystemsData is the response shape for GET /api/architecture/systems.
type SystemsData struct {
	Systems []SystemNode `json:"systems"`
	Edges   []SystemEdge `json:"edges"`
}

// SystemNode is one C4-L1 node — a system (or `external_system`).
type SystemNode struct {
	ID             string             `json:"id"`
	Name           string             `json:"name"`
	Description    string             `json:"description"`
	Layer          string             `json:"layer"`
	OwnerTeam      string             `json:"owner_team,omitempty"`
	Boundary       string             `json:"boundary,omitempty"`
	C4Kind         string             `json:"c4_kind"`
	ExternalActors []string           `json:"external_actors,omitempty"`
	EntryPoints    []SystemEntryPoint `json:"entry_points,omitempty"`
	Members        []SystemMember     `json:"members"`
	MemberCount    int                `json:"member_count"`
}

// SystemMember is a catalog entry that belongs to a system.
type SystemMember struct {
	Name        string `json:"name"`
	Kind        string `json:"kind"`
	Layer       string `json:"layer,omitempty"`
	Domain      string `json:"domain,omitempty"`
	Type        string `json:"type,omitempty"`
	Description string `json:"description,omitempty"`
}

// SystemEntryPoint mirrors the manifest's entry_points.
type SystemEntryPoint struct {
	Kind      string `json:"kind"`
	Protocol  string `json:"protocol,omitempty"`
	Port      int    `json:"port,omitempty"`
	Purpose   string `json:"purpose,omitempty"`
	ExposedBy string `json:"exposedBy,omitempty"`
}

// SystemEdge is a system→system edge derived from member-to-member dependsOn
// entries (where source.system != target.system).
type SystemEdge struct {
	ID       string                 `json:"id"`
	Source   string                 `json:"source"`
	Target   string                 `json:"target"`
	Count    int                    `json:"count"`
	Examples []SystemEdgeExample    `json:"examples,omitempty"`
}

type SystemEdgeExample struct {
	From     string `json:"from"`
	To       string `json:"to"`
	Protocol string `json:"protocol,omitempty"`
	Port     int    `json:"port,omitempty"`
	Purpose  string `json:"purpose,omitempty"`
}

// systemManifest is the on-disk shape of a kind:system catalog entry.
type systemManifest struct {
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

// catalogEntry is the union of fields we care about for systems aggregation.
type catalogEntry struct {
	Name        string    `json:"name"`
	Kind        string    `json:"kind"`
	Description string    `json:"description"`
	System      string    `json:"system"`
	Layer       string    `json:"layer"`
	Domain      string    `json:"domain"`
	Type        string    `json:"type"`
	DependsOn   []specDep `json:"dependsOn"`
}

// GetSystems builds the C4-L1 view from system manifests + all catalog entries.
//
// Manifests are kind:system entries at catalog/systems/<id>/catalog-info.json.
func (s *ArchitectureService) GetSystems() (*SystemsData, error) {
	catalogDir := filepath.Join(s.root, domain.CatalogDir())

	// 1. Load manifests — prefer kind:system entries under systems/<id>/, fall
	// loads the C4 L1 system manifests from kind:system catalog entries.
	manifests := map[string]systemManifest{}

	// 1a. New location — kind:system folders
	if sysDirs, err := os.ReadDir(filepath.Join(catalogDir, "systems")); err == nil {
		for _, sd := range sysDirs {
			if !sd.IsDir() {
				continue
			}
			data, err := os.ReadFile(filepath.Join(catalogDir, "systems", sd.Name(), "catalog-info.json"))
			if err != nil {
				continue
			}
			var entry struct {
				Name           string             `json:"name"`
				Kind           string             `json:"kind"`
				Description    string             `json:"description"`
				Layer          string             `json:"layer"`
				DisplayName    string             `json:"displayName"`
				Boundary       string             `json:"boundary"`
				C4Kind         string             `json:"c4Kind"`
				OwnerTeam      string             `json:"ownerTeam"`
				ExternalActors []string           `json:"externalActors"`
				EntryPoints    []SystemEntryPoint `json:"entryPoints"`
			}
			if err := json.Unmarshal(data, &entry); err != nil {
				continue
			}
			if entry.Kind != "system" || entry.Name == "" {
				continue
			}
			manifests[entry.Name] = systemManifest{
				ID:             entry.Name,
				Name:           entry.DisplayName,
				Description:    entry.Description,
				Layer:          entry.Layer,
				OwnerTeam:      entry.OwnerTeam,
				Boundary:       entry.Boundary,
				C4Kind:         entry.C4Kind,
				ExternalActors: entry.ExternalActors,
				EntryPoints:    entry.EntryPoints,
			}
		}
	}

	// 2. Walk all catalog-info.json catalog entries.
	//    Skip systems/ (manifests already loaded above; entries themselves
	//    shouldn't be members) and kind:team/system.
	entries := []catalogEntry{}
	kindDirs, _ := os.ReadDir(catalogDir)
	for _, dd := range kindDirs {
		if !dd.IsDir() || dd.Name() == "systems" {
			continue
		}
		entryDirs, _ := os.ReadDir(filepath.Join(catalogDir, dd.Name()))
		for _, rd := range entryDirs {
			if !rd.IsDir() {
				continue
			}
			data, err := os.ReadFile(filepath.Join(catalogDir, dd.Name(), rd.Name(), "catalog-info.json"))
			if err != nil {
				continue
			}
			var ce catalogEntry
			if err := json.Unmarshal(data, &ce); err != nil {
				continue
			}
			// Skip non-architectural kinds — they aren't system members.
			switch ce.Kind {
			case "team", "system", "slo", "oncall", "runbook",
				"capability", "value-stream", "kpi", "sla", "objective", "key-result",
				"data-asset", "classification", "data-pipeline":
				continue
			}
			if ce.Name == "" {
				ce.Name = rd.Name()
			}
			if ce.Kind == "" {
				ce.Kind = strings.TrimSuffix(dd.Name(), "s")
			}
			entries = append(entries, ce)
		}
	}

	// 3. Index entries by name (for resolving cross-system edges)
	entryBySystem := map[string]string{} // entry name → system id
	for _, e := range entries {
		if e.System != "" {
			entryBySystem[e.Name] = e.System
		}
	}

	// 4. Group members per system
	systemMembers := map[string][]SystemMember{}
	for _, e := range entries {
		sys := e.System
		if sys == "" {
			sys = "cross-cutting"
		}
		systemMembers[sys] = append(systemMembers[sys], SystemMember{
			Name:        e.Name,
			Kind:        e.Kind,
			Layer:       e.Layer,
			Domain:      e.Domain,
			Type:        e.Type,
			Description: e.Description,
		})
	}

	// 5. Derive edges from cross-system dependsOn
	type edgeKey struct{ src, dst string }
	edgeAgg := map[edgeKey]*SystemEdge{}
	for _, e := range entries {
		srcSys := e.System
		if srcSys == "" {
			srcSys = "cross-cutting"
		}
		for _, dep := range e.DependsOn {
			dstSys := entryBySystem[dep.Target]
			if dstSys == "" || dstSys == srcSys {
				continue
			}
			k := edgeKey{srcSys, dstSys}
			if edgeAgg[k] == nil {
				edgeAgg[k] = &SystemEdge{
					ID:     srcSys + "|" + dstSys,
					Source: srcSys,
					Target: dstSys,
				}
			}
			edgeAgg[k].Count++
			if len(edgeAgg[k].Examples) < 3 {
				edgeAgg[k].Examples = append(edgeAgg[k].Examples, SystemEdgeExample{
					From: e.Name, To: dep.Target,
					Protocol: dep.Protocol, Port: dep.Port, Purpose: dep.Purpose,
				})
			}
		}
	}

	// 6. Assemble system nodes — union of manifest-defined systems + systems
	//    that have members but no manifest (fallback "cross-cutting")
	systemIDs := map[string]bool{}
	for id := range manifests {
		systemIDs[id] = true
	}
	for sys := range systemMembers {
		systemIDs[sys] = true
	}

	var systems []SystemNode
	for id := range systemIDs {
		m := manifests[id] // zero-value if missing
		members := systemMembers[id]
		// sort members by name for determinism
		for i := 1; i < len(members); i++ {
			for j := i; j > 0 && members[j].Name < members[j-1].Name; j-- {
				members[j], members[j-1] = members[j-1], members[j]
			}
		}
		node := SystemNode{
			ID:             id,
			Name:           m.Name,
			Description:    m.Description,
			Layer:          m.Layer,
			OwnerTeam:      m.OwnerTeam,
			Boundary:       m.Boundary,
			C4Kind:         m.C4Kind,
			ExternalActors: m.ExternalActors,
			EntryPoints:    m.EntryPoints,
			Members:        members,
			MemberCount:    len(members),
		}
		// Fallbacks when manifest is missing
		if node.Name == "" {
			node.Name = id
		}
		if node.C4Kind == "" {
			node.C4Kind = "system"
		}
		if node.Layer == "" && len(members) > 0 {
			node.Layer = members[0].Layer
		}
		systems = append(systems, node)
	}
	// sort systems by id for stable output
	for i := 1; i < len(systems); i++ {
		for j := i; j > 0 && systems[j].ID < systems[j-1].ID; j-- {
			systems[j], systems[j-1] = systems[j-1], systems[j]
		}
	}

	// Flatten edge map to slice
	var edges []SystemEdge
	for _, e := range edgeAgg {
		edges = append(edges, *e)
	}
	for i := 1; i < len(edges); i++ {
		for j := i; j > 0 && edges[j].ID < edges[j-1].ID; j-- {
			edges[j], edges[j-1] = edges[j-1], edges[j]
		}
	}

	return &SystemsData{Systems: systems, Edges: edges}, nil
}
