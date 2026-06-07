package app

import (
	"fmt"
	"sort"
	"time"
)

// ToGraph projects a Scope into a ready-to-paint DiagramPayload — same shape
// the existing /api/diagrams/:view endpoint returns, so the frontend's
// LayeredDiagram renderer consumes it as-is.
//
// Layout is left to the renderer (elkjs). The server only decides STRUCTURE:
// which lane each node sits in, edge typing, accent colors, badges, legend.
// Lane assignment is lens-aware:
//
//   - "systems"          → C4 L1: lane = layer; nodes = kind:system; edges = cross-system dependsOn
//   - "communications"   → wire-protocol map: 6 lanes by depth from products
//   - any other lens     → generic: lane = layer (or kind when no layer); edges = scope.Edges
func (s *ScopeService) ToGraph(scope *Scope) *DiagramPayload {
	switch scope.Lens.ID {
	case "systems":
		return s.graphSystems(scope)
	case "communications":
		return s.graphCommunications(scope)
	case "catalog":
		// "Every entry" is too dense for a graph (265+ nodes). Fall back to
		// the C4 L1 systems aggregation so the graph stays readable.
		// Users who want the full set can stay in the table mode, or pick a
		// narrower lens (data, communications, team:<x>, system:<x>, ...).
		return s.graphSystems(scope)
	}
	return s.graphGeneric(scope)
}

// graphGeneric builds a layered diagram from any scope. Lane = entry.Layer
// when set, falling back to entry.Kind. Edges come from scope.Edges, typed by
// protocol when present, otherwise by relation.
func (s *ScopeService) graphGeneric(scope *Scope) *DiagramPayload {
	lanes := genericLanes(scope.Entries)

	nodes := make([]DiagramNode, 0, len(scope.Entries))
	for _, e := range scope.Entries {
		laneID := pickLane(e)
		hint := laneOrder(lanes, laneID)
		nodes = append(nodes, DiagramNode{
			ID:        e.Name,
			LaneID:    laneID,
			Kind:      e.Kind,
			Display:   nodeDisplay(e, laneColor(lanes, laneID)),
			Clickable: true,
			LayerHint: &hint,
		})
	}
	sort.Slice(nodes, func(i, j int) bool { return nodes[i].ID < nodes[j].ID })

	edges := make([]DiagramEdge, 0, len(scope.Edges))
	for _, ed := range scope.Edges {
		// Skip edges the layered diagram can't render meaningfully.
		if ed.Relation == "memberOf" || ed.Relation == "ownerTeam" {
			continue
		}
		proto, _ := ed.Meta["protocol"].(string)
		family := protocolFamily(proto)
		if family == "" {
			family = relationFamily(ed.Relation)
		}
		edges = append(edges, DiagramEdge{
			ID:             ed.Source + "|" + ed.Target + "|" + ed.Relation,
			Source:         ed.Source,
			Target:         ed.Target,
			ProtocolFamily: family,
			Label:          edgeLabel(ed, proto),
			Curve:          "bezier",
		})
	}
	sort.Slice(edges, func(i, j int) bool { return edges[i].ID < edges[j].ID })

	return &DiagramPayload{
		Lanes:  lanes,
		Nodes:  nodes,
		Edges:  edges,
		Legend: defaultLegend(),
		Meta: DiagramPayloadMeta{
			Title:       scope.Lens.Name,
			View:        "scope:" + scope.Lens.ID,
			GeneratedAt: time.Now().UTC().Format(time.RFC3339),
		},
	}
}

// graphSystems delegates to the existing C4-L1 builder via DiagramService —
// preserves the hand-tuned lane layout and cross-system edge aggregation.
func (s *ScopeService) graphSystems(scope *Scope) *DiagramPayload {
	d := NewDiagramService(s.stitcher)
	p, err := d.Build("systems")
	if err != nil {
		return s.graphGeneric(scope)
	}
	return p
}

// graphCommunications delegates to the existing depth-bucketed builder.
func (s *ScopeService) graphCommunications(scope *Scope) *DiagramPayload {
	d := NewDiagramService(s.stitcher)
	p, err := d.Build("communications")
	if err != nil {
		return s.graphGeneric(scope)
	}
	return p
}

// genericLanes derives a lane set from the entries in scope. Tries layers
// first; if no entry has a layer, falls back to kinds. Each lane gets a
// stable color from the canonical layer/kind palette.
func genericLanes(entries map[string]*StitchedEntry) []DiagramLane {
	useLayer := false
	for _, e := range entries {
		if e.Layer != "" {
			useLayer = true
			break
		}
	}
	if useLayer {
		return layerLanes(entries)
	}
	return kindLanes(entries)
}

func layerLanes(entries map[string]*StitchedEntry) []DiagramLane {
	order := []string{"device", "edge", "domain", "platform", "data", "cross-cutting", "r-and-d", "business"}
	colors := map[string]string{
		"device":        "#007A6E",
		"edge":          "#0EA5E9",
		"domain":        "#3B82F6",
		"platform":      "#8B5CF6",
		"data":          "#336791",
		"cross-cutting": "#94A3B8",
		"r-and-d":       "#EC4899",
		"business":      "#EAB308",
	}
	used := map[string]bool{}
	for _, e := range entries {
		if e.Layer != "" {
			used[e.Layer] = true
		} else {
			used["cross-cutting"] = true
		}
	}
	out := []DiagramLane{}
	idx := 0
	for _, id := range order {
		if !used[id] {
			continue
		}
		col := colors[id]
		if col == "" {
			col = "#94A3B8"
		}
		out = append(out, DiagramLane{
			ID: id, Label: laneLabel(id), Color: col, Order: idx,
		})
		idx++
	}
	return out
}

func kindLanes(entries map[string]*StitchedEntry) []DiagramLane {
	colors := map[string]string{
		"system":     "#3B82F6",
		"product":    "#007A6E",
		"service":    "#8B5CF6",
		"infra":      "#94A3B8",
		"external":   "#F5913E",
		"repo":       "#16A34A",
		"team":       "#EC4899",
		"capability": "#0EA5E9",
		"slo":        "#EAB308",
		"oncall":     "#EF4444",
		"runbook":    "#22D3EE",
		"data-asset":  "#336791",
	}
	used := map[string]bool{}
	for _, e := range entries {
		k := e.Kind
		if k == "" {
			k = "repo"
		}
		used[k] = true
	}
	keys := make([]string, 0, len(used))
	for k := range used {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	out := make([]DiagramLane, 0, len(keys))
	for i, k := range keys {
		col := colors[k]
		if col == "" {
			col = "#94A3B8"
		}
		out = append(out, DiagramLane{
			ID: k, Label: laneLabel(k), Color: col, Order: i,
		})
	}
	return out
}

func pickLane(e *StitchedEntry) string {
	if e.Layer != "" {
		return e.Layer
	}
	if e.Kind != "" {
		return e.Kind
	}
	return "cross-cutting"
}

func laneOrder(lanes []DiagramLane, id string) int {
	for _, l := range lanes {
		if l.ID == id {
			return l.Order
		}
	}
	return 0
}

func laneLabel(id string) string {
	switch id {
	case "device":
		return "Device"
	case "edge":
		return "Edge / gateway"
	case "domain":
		return "Domain"
	case "platform":
		return "Platform"
	case "data":
		return "Data"
	case "cross-cutting":
		return "Cross-cutting"
	case "r-and-d":
		return "R&D"
	case "business":
		return "Business"
	case "system":
		return "Systems"
	case "product":
		return "Products"
	case "service":
		return "Services"
	case "infra":
		return "Infrastructure"
	case "external":
		return "External"
	case "repo":
		return "Repos"
	case "team":
		return "Teams"
	}
	return id
}

func nodeDisplay(e *StitchedEntry, accent string) DiagramNodeDisplay {
	display, _ := e.Spec["displayName"].(string)
	if display == "" {
		display = e.Name
	}
	subtitle := e.System
	if t := specString(e.Spec, "team"); t != "" {
		subtitle = t
	}

	var badges []DiagramNodeBadge
	if k := e.Kind; k != "" && k != "repo" {
		badges = append(badges, DiagramNodeBadge{Label: k, Color: accent})
	}
	if status := firstNonEmpty(specString(e.Spec, "lifecycle"), specString(e.Spec, "status")); status != "" && status != "production" {
		badges = append(badges, DiagramNodeBadge{Label: status, Color: "#EAB308"})
	}

	return DiagramNodeDisplay{
		Name:        display,
		Subtitle:    subtitle,
		AccentColor: accent,
		Detail:      e.Description,
		Badges:      badges,
		Placeholder: &DiagramNodePlaceholder{
			Initials:     initials(e.Name),
			FallbackText: e.Name,
		},
	}
}

// relationFamily maps non-protocol relations to a legend family so generic
// edges still get colored. Communications edges map to "tcp" by default
// elsewhere; here we expose the relation so the legend can document it.
func relationFamily(rel string) string {
	switch rel {
	case "componentRepos", "composedOf", "realizedBy":
		return "compose"
	case "memberOf":
		return "member"
	case "storedIn", "writtenBy", "readBy":
		return "data"
	case "governs", "tracks", "measuredBy":
		return "strategy"
	case "communicatesWith":
		return "tcp"
	}
	return "dependsOn"
}

func edgeLabel(ed ScopeEdge, proto string) string {
	if proto != "" {
		return proto
	}
	if purpose, ok := ed.Meta["purpose"].(string); ok && purpose != "" {
		return purpose
	}
	if ed.Relation != "dependsOn" {
		return ed.Relation
	}
	return ""
}

// Compile-time guard so the package builds even if helpers move.
var _ = fmt.Sprintf
