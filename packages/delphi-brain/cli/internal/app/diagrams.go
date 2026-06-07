package app

import (
	"fmt"
	"sort"
	"time"
)

// DiagramService — implements PROPOSAL_GENERIC_TREE.md §8.
//
// Every view returns the same DiagramPayload shape. A single React component
// consumes it. Adding a view = adding a Build* method here; no React change.
type DiagramService struct {
	stitcher *StitcherService
}

func NewDiagramService(s *StitcherService) *DiagramService {
	return &DiagramService{stitcher: s}
}

// DiagramPayload — must round-trip with src/lib/diagramPayload.d.ts.
type DiagramPayload struct {
	Lanes  []DiagramLane    `json:"lanes"`
	Nodes  []DiagramNode    `json:"nodes"`
	Edges  []DiagramEdge    `json:"edges"`
	Legend []DiagramLegend  `json:"legend"`
	Meta   DiagramPayloadMeta `json:"meta"`
}

type DiagramPayloadMeta struct {
	Title       string         `json:"title"`
	View        string         `json:"view"`
	Filters     map[string]any `json:"filters,omitempty"`
	GeneratedAt string         `json:"generatedAt"`
}

type DiagramLane struct {
	ID      string `json:"id"`
	Label   string `json:"label"`
	Color   string `json:"color"`
	Order   int    `json:"order"`
	GroupBy string `json:"groupBy,omitempty"`
}

type DiagramNode struct {
	ID        string             `json:"id"`
	LaneID    string             `json:"laneId"`
	Kind      string             `json:"kind"`
	Display   DiagramNodeDisplay `json:"display"`
	Size      *DiagramNodeSize   `json:"size,omitempty"`
	Clickable bool               `json:"clickable"`
	LayerHint *int               `json:"layerHint,omitempty"`
}

type DiagramNodeDisplay struct {
	Name        string                 `json:"name"`
	Subtitle    string                 `json:"subtitle,omitempty"`
	Image       string                 `json:"image,omitempty"`
	AccentColor string                 `json:"accentColor"`
	Badges      []DiagramNodeBadge     `json:"badges,omitempty"`
	Detail      string                 `json:"detail,omitempty"`
	Placeholder *DiagramNodePlaceholder `json:"placeholder,omitempty"`
}

type DiagramNodeBadge struct {
	Label string `json:"label"`
	Color string `json:"color"`
}

type DiagramNodePlaceholder struct {
	Initials     string `json:"initials"`
	FallbackText string `json:"fallbackText"`
}

type DiagramNodeSize struct {
	Width  int `json:"width"`
	Height int `json:"height"`
}

type DiagramEdge struct {
	ID             string  `json:"id"`
	Source         string  `json:"source"`
	Target         string  `json:"target"`
	ProtocolFamily string  `json:"protocolFamily"`
	Label          string  `json:"label,omitempty"`
	Curve          string  `json:"curve"`
	Weight         float64 `json:"weight,omitempty"`
	Dashed         bool    `json:"dashed,omitempty"`
}

type DiagramLegend struct {
	ProtocolFamily string `json:"protocolFamily"`
	Color          string `json:"color"`
	Label          string `json:"label"`
	Dashed         bool   `json:"dashed,omitempty"`
}

// Build returns the payload for a named view. Unknown views return error 404
// at the HTTP layer.
func (s *DiagramService) Build(view string) (*DiagramPayload, error) {
	switch view {
	case "systems":
		return s.buildSystems()
	case "communications":
		return s.buildCommunications()
	default:
		return nil, fmt.Errorf("unknown diagram view: %s", view)
	}
}

// systems — C4 L1 system context. Lane = layer; node = system; edge = derived
// from member-to-member dependsOn (delegated to ArchitectureService.GetSystems
// via stitched data, but here implemented directly off Snapshot for symmetry).
//
// Curated for readability:
//   - Hide catch-all containers (cross-cutting, infrastructure, tooling, etc.).
//     These show up via the Catalog lens with kind=system; here we want only
//     the business systems readers think about (icc, ico, iot-backend, …).
//   - Merge A↔B back-edges into one edge labelled with the dominant flow.
//   - Edge label = protocol families, not "N edges". Tells the reader WHAT
//     flows between two systems, not how many leaf-level dependsOn rows.
func (s *DiagramService) buildSystems() (*DiagramPayload, error) {
	snap := s.stitcher.Snapshot()

	// Layers we keep on the C4-L1 view.
	layerOrder := map[string]int{
		"device": 0, "edge": 1, "domain": 2, "platform": 3, "data": 4,
	}
	lanes := []DiagramLane{
		{ID: "device", Label: "Device", Color: "#007A6E", Order: 0},
		{ID: "edge", Label: "Edge / gateway", Color: "#0EA5E9", Order: 1},
		{ID: "domain", Label: "Domain", Color: "#3B82F6", Order: 2},
		{ID: "platform", Label: "Platform", Color: "#8B5CF6", Order: 3},
		{ID: "data", Label: "Data", Color: "#336791", Order: 4},
	}

	var systemNodes []DiagramNode
	systemSet := map[string]bool{}
	for _, e := range snap {
		if e.Kind != "system" {
			continue
		}
		// Skip systems whose layer isn't part of the C4-L1 lanes — those
		// catch-all containers (cross-cutting / infrastructure / tooling /
		// labs / legacy / docs / ci-cd) crowd the view and add no signal.
		if _, ok := layerOrder[e.Layer]; !ok {
			continue
		}
		systemSet[e.Name] = true
		display, _ := e.Spec["displayName"].(string)
		if display == "" {
			display = e.Name
		}
		layer := e.Layer
		owner, _ := e.Spec["ownerTeam"].(string)
		hint := layerOrder[layer]
		// Surface entry-point count + member count as badges; helps the
		// reader scan which systems are large/busy at a glance.
		var badges []DiagramNodeBadge
		if eps, _ := e.Spec["entryPoints"].([]any); len(eps) > 0 {
			badges = append(badges, DiagramNodeBadge{
				Label: fmt.Sprintf("%d entry points", len(eps)),
				Color: laneColor(lanes, layer),
			})
		}
		systemNodes = append(systemNodes, DiagramNode{
			ID: e.Name, LaneID: layer, Kind: "system",
			Display: DiagramNodeDisplay{
				Name:        display,
				Subtitle:    owner,
				AccentColor: laneColor(lanes, layer),
				Detail:      e.Description,
				Badges:      badges,
				Placeholder: &DiagramNodePlaceholder{
					Initials:     initials(e.Name),
					FallbackText: e.Name,
				},
			},
			Clickable: true,
			LayerHint: &hint,
		})
	}
	sort.Slice(systemNodes, func(i, j int) bool { return systemNodes[i].ID < systemNodes[j].ID })

	// Cross-system edges: walk every non-system entry's outbound dependsOn,
	// resolve src.System → dst.System. Aggregate per directed pair, capture
	// every distinct protocol that flows on it. Then merge bidirectional
	// pairs (A→B + B→A) into a single edge keyed by sorted endpoints — the
	// reader rarely cares which direction "auth" flows; what they want to
	// see is "icc and identity talk over OIDC + JMS".
	// systemLayer is the ordered position of each system's lane. We use it
	// to orient the merged bidirectional edge so it always flows left →
	// right (lower lane order → higher lane order). Without this, ELK
	// receives back-edges across lanes and reshuffles unrelated nodes
	// (orphan systems landed in the wrong column).
	systemLayer := map[string]int{}
	for _, n := range systemNodes {
		systemLayer[n.ID] = layerOrder[n.LaneID]
	}
	type pairKey struct{ a, b string }
	type pairAgg struct {
		count     int
		protocols map[string]bool
	}
	pairs := map[pairKey]*pairAgg{}
	for _, e := range snap {
		if e.Kind == "system" {
			continue
		}
		src := e.System
		if !systemSet[src] {
			continue
		}
		for _, ed := range e.Outbound {
			if ed.Relation != "dependsOn" {
				continue
			}
			dstEntry, ok := snap[ed.Target]
			if !ok {
				continue
			}
			dst := dstEntry.System
			if dst == "" || dst == src || !systemSet[dst] {
				continue
			}
			k := pairKey{src, dst}
			// Always orient lower-layer → higher-layer so ELK sees a
			// forward-flowing layered DAG. Tie-breaker = alphabetic, so
			// the dedup key is stable even when two systems share a lane.
			if systemLayer[k.a] > systemLayer[k.b] ||
				(systemLayer[k.a] == systemLayer[k.b] && k.a > k.b) {
				k.a, k.b = k.b, k.a
			}
			p := pairs[k]
			if p == nil {
				p = &pairAgg{protocols: map[string]bool{}}
				pairs[k] = p
			}
			p.count++
			if proto, _ := ed.Meta["protocol"].(string); proto != "" {
				p.protocols[proto] = true
			}
		}
	}
	var edges []DiagramEdge
	for k, p := range pairs {
		// Pick the dominant protocol family for routing-color (use the
		// alphabetically-first protocol when multiple — stable across runs).
		var protoList []string
		for proto := range p.protocols {
			protoList = append(protoList, proto)
		}
		sort.Strings(protoList)
		family := "reference"
		if len(protoList) > 0 {
			family = protocolFamily(protoList[0])
		}
		// Label = comma-joined protocols (e.g. "OIDC, JMS"). Falls back to
		// "depends on" so an unlabelled edge still tells the reader what
		// it represents. Append a density hint when the underlying member
		// dependsOn rows are unusually thick (≥10) — flags hubs without
		// reintroducing the "N edges" noise on every line.
		label := joinProtocols(protoList)
		if label == "" {
			label = "depends on"
		}
		if p.count >= 10 {
			label = fmt.Sprintf("%s · %d×", label, p.count)
		}
		edges = append(edges, DiagramEdge{
			ID:             k.a + "|" + k.b,
			Source:         k.a,
			Target:         k.b,
			ProtocolFamily: family,
			Label:          label,
			Curve:          "bezier",
			Weight:         float64(p.count),
		})
	}
	sort.Slice(edges, func(i, j int) bool { return edges[i].ID < edges[j].ID })

	return &DiagramPayload{
		Lanes:  lanes,
		Nodes:  systemNodes,
		Edges:  edges,
		Legend: defaultLegend(),
		Meta: DiagramPayloadMeta{
			Title:       "C4 L1 — system context",
			View:        "systems",
			GeneratedAt: time.Now().UTC().Format(time.RFC3339),
		},
	}, nil
}

// communications — device → backend wire-protocol map. Reproduces the legacy
// CommunicationsView's 6-lane scheme: ① sensors ② hub ③ mobile ④⑤⑥ backends-1/2/3.
// Backend lane is decided by BFS depth from products, so each hop occupies
// its own column (matches legacy's hand-tuned column placement).
func (s *DiagramService) buildCommunications() (*DiagramPayload, error) {
	snap := s.stitcher.Snapshot()

	// 6 lanes — same shape as legacy.
	lanes := []DiagramLane{
		{ID: "sensors",    Label: "Wireless sensors", Color: "#F5913E", Order: 0},
		{ID: "hub",        Label: "Home hub",         Color: "#007A6E", Order: 1},
		{ID: "mobile",     Label: "Mobile alarms",    Color: "#D4A853", Order: 2},
		{ID: "backends-1", Label: "Backends",         Color: "#3B82F6", Order: 3},
		{ID: "backends-2", Label: "Backends",         Color: "#3B82F6", Order: 4},
		{ID: "backends-3", Label: "Backends",         Color: "#3B82F6", Order: 5},
	}

	// Product category → device lane.
	productLane := func(category string) string {
		switch category {
		case "radio-peripheral":
			return "sensors"
		case "home-hub":
			return "hub"
		case "mobile-alarm", "partner-device":
			return "mobile"
		default:
			return "sensors"
		}
	}

	// 1) Walk: discover every alarm-path edge (product communicatesWith +
	//    purpose-annotated dependsOn from each backend). Then compute
	//    LONGEST path from any product to each backend — terminals end up
	//    in backends-3 even when a shorter path exists. Matches legacy
	//    column placement.
	type discoveredEdge struct {
		src, dst, proto, label string
		curve                  string
	}
	var discoveredEdges []discoveredEdge
	productNames := map[string]bool{}
	backendNames := map[string]bool{}
	// adjacency among backends (and from products to backends).
	adj := map[string][]string{}

	for _, e := range snap {
		if e.Kind != "product" {
			continue
		}
		productNames[e.Name] = true
	}

	// Seed from every product. Sensor→hub edges (product→product) are KEPT
	// because the legacy view shows them — orange 868 MHz radio lines from
	// each sensor card landing on the Eliza A150 hub.
	type queueItem struct{ name string }
	queue := []queueItem{}
	visited := map[string]bool{}

	for _, e := range snap {
		if e.Kind != "product" {
			continue
		}
		comms, _ := e.Spec["communicatesWith"].([]any)
		for _, c := range comms {
			m, _ := c.(map[string]any)
			if m == nil {
				continue
			}
			target, _ := m["target"].(string)
			if target == "" {
				continue
			}
			tkind, _ := m["kind"].(string)
			proto, _ := m["protocol"].(string)
			port, _ := m["port"].(float64)
			purpose, _ := m["purpose"].(string)
			label := proto
			if port > 0 {
				label = fmt.Sprintf("%s :%d", proto, int(port))
			}
			if purpose != "" {
				label = fmt.Sprintf("%s · %s", label, purpose)
			}
			discoveredEdges = append(discoveredEdges, discoveredEdge{
				src: e.Name, dst: target, proto: proto, label: label,
				curve: "bezier",
			})
			if tkind == "product" {
				continue // sensor → hub; not a backend
			}
			adj[e.Name] = append(adj[e.Name], target)
			backendNames[target] = true
			if !visited[target] {
				visited[target] = true
				queue = append(queue, queueItem{target})
			}
		}
	}

	for len(queue) > 0 {
		head := queue[0]
		queue = queue[1:]
		e := snap[head.name]
		if e == nil {
			continue
		}
		for _, ed := range e.Outbound {
			if ed.Relation != "dependsOn" {
				continue
			}
			purpose, _ := ed.Meta["purpose"].(string)
			if purpose == "" {
				continue
			}
			proto, _ := ed.Meta["protocol"].(string)
			portF, _ := ed.Meta["port"].(float64)
			port := int(portF)
			label := proto
			if port > 0 {
				label = fmt.Sprintf("%s :%d", proto, port)
			}
			if purpose != "" {
				label = fmt.Sprintf("%s · %s", label, purpose)
			}
			discoveredEdges = append(discoveredEdges, discoveredEdge{
				src: head.name, dst: ed.Target, proto: proto, label: label,
				curve: "bezier",
			})
			adj[head.name] = append(adj[head.name], ed.Target)
			backendNames[ed.Target] = true
			if !visited[ed.Target] {
				visited[ed.Target] = true
				queue = append(queue, queueItem{ed.Target})
			}
		}
	}

	// LONGEST-path depth from any product (DFS with memoisation; the
	// alarm-path subgraph is a DAG — products → first-hop → … → terminals).
	depthByBackend := map[string]int{}
	var longest func(name string) int
	memo := map[string]int{}
	longest = func(name string) int {
		if v, ok := memo[name]; ok {
			return v
		}
		memo[name] = 0 // cycle guard
		best := 1
		// Find all incoming alarm-path edges to `name`.
		for src, targets := range adj {
			for _, t := range targets {
				if t != name {
					continue
				}
				var d int
				if productNames[src] {
					d = 1
				} else if backendNames[src] {
					d = longest(src) + 1
				}
				if d > best {
					best = d
				}
			}
		}
		memo[name] = best
		return best
	}
	for name := range backendNames {
		depthByBackend[name] = longest(name)
	}

	// 2) Bucket each non-product node into a backend lane by depth.
	//    BFS depth → lane: 1 → backends-1, 2 → backends-2, 3+ → backends-3.
	backendLane := func(depth int) string {
		switch {
		case depth <= 1:
			return "backends-1"
		case depth == 2:
			return "backends-2"
		default:
			return "backends-3"
		}
	}

	nodeSet := map[string]*DiagramNode{}
	addNode := func(name, kind, lane string) {
		if _, ok := nodeSet[name]; ok {
			return
		}
		e := snap[name]
		display := name
		var detail, image, subtitle string
		accent := "#3B82F6"
		switch kind {
		case "product":
			switch lane {
			case "sensors":
				accent = "#F5913E"
			case "hub":
				accent = "#007A6E"
			case "mobile":
				accent = "#D4A853"
			default:
				accent = "#0EA5E9"
			}
		case "external":
			accent = "#8B5CF6"
		}
		if e != nil {
			detail = e.Description
			if img, _ := e.Spec["image"].(string); img != "" {
				image = img
			}
			if vendor, _ := e.Spec["vendor"].(string); vendor != "" {
				subtitle = vendor
			}
		}
		nodeSet[name] = &DiagramNode{
			ID: name, LaneID: lane, Kind: kind,
			Display: DiagramNodeDisplay{
				Name:        display,
				Subtitle:    subtitle,
				Image:       image,
				AccentColor: accent,
				Detail:      detail,
				Placeholder: &DiagramNodePlaceholder{Initials: initials(name), FallbackText: name},
			},
			Clickable: true,
		}
	}

	// 2a) Add product nodes in their device lanes.
	for _, e := range snap {
		if e.Kind != "product" {
			continue
		}
		category, _ := e.Spec["category"].(string)
		addNode(e.Name, "product", productLane(category))
	}
	// 2b) Add backend / external nodes in their depth-derived lane.
	for name, depth := range depthByBackend {
		e := snap[name]
		kind := "repo"
		if e != nil {
			kind = e.Kind
		}
		addNode(name, kind, backendLane(depth))
	}

	// 3) Materialise edges. Drop labels on the orange sensor→hub edges
	//    except one (skill rule §14 — one label per redundant group).
	var edges []DiagramEdge
	sensorHubLabelled := false
	for _, ed := range discoveredEdges {
		label := ed.label
		// Identify sensor→hub edges (both endpoints are products, source isn't a hub).
		if productNames[ed.src] && productNames[ed.dst] {
			srcEntry := snap[ed.src]
			if srcEntry != nil {
				if cat, _ := srcEntry.Spec["category"].(string); cat == "radio-peripheral" {
					if sensorHubLabelled {
						label = ""
					}
					sensorHubLabelled = true
				}
			}
		}
		edges = append(edges, DiagramEdge{
			ID:             ed.src + "|" + ed.dst + "|" + ed.proto,
			Source:         ed.src,
			Target:         ed.dst,
			ProtocolFamily: protocolFamily(ed.proto),
			Label:          label,
			Curve:          ed.curve,
		})
	}

	var nodes []DiagramNode
	for _, n := range nodeSet {
		nodes = append(nodes, *n)
	}
	sort.Slice(nodes, func(i, j int) bool { return nodes[i].ID < nodes[j].ID })
	sort.Slice(edges, func(i, j int) bool { return edges[i].ID < edges[j].ID })

	return &DiagramPayload{
		Lanes:  lanes,
		Nodes:  nodes,
		Edges:  edges,
		Legend: defaultLegend(),
		Meta: DiagramPayloadMeta{
			Title:       "Device → backend communications",
			View:        "communications",
			GeneratedAt: time.Now().UTC().Format(time.RFC3339),
		},
	}, nil
}

// Helpers.

func protocolFamily(p string) string {
	switch p {
	case "UDP":
		return "udp"
	case "TCP":
		return "tcp"
	case "TCP/TLS", "TCP+TLS", "TLS":
		return "tcp-tls"
	case "SIP", "SIP/SCAIP":
		return "sip"
	case "HTTPS", "HTTP", "REST", "GraphQL":
		return "https"
	case "MQTT":
		return "mqtt"
	case "AMQP", "JMS":
		return "amqp"
	case "868MHz FSK", "FSK":
		return "radio"
	case "SMS":
		return "cellular"
	default:
		if p == "" {
			return "reference"
		}
		return "other"
	}
}

func defaultLegend() []DiagramLegend {
	return []DiagramLegend{
		{ProtocolFamily: "udp", Color: "#22C55E", Label: "UDP"},
		{ProtocolFamily: "tcp", Color: "#3B82F6", Label: "TCP"},
		{ProtocolFamily: "tcp-tls", Color: "#1D4ED8", Label: "TCP + TLS"},
		{ProtocolFamily: "sip", Color: "#8B5CF6", Label: "SIP / SCAIP"},
		{ProtocolFamily: "https", Color: "#0EA5E9", Label: "HTTP / HTTPS / GraphQL"},
		{ProtocolFamily: "mqtt", Color: "#EC4899", Label: "MQTT"},
		{ProtocolFamily: "amqp", Color: "#F97316", Label: "AMQP / JMS"},
		{ProtocolFamily: "radio", Color: "#10B981", Label: "868MHz radio"},
		{ProtocolFamily: "cellular", Color: "#F59E0B", Label: "SMS / cellular"},
		{ProtocolFamily: "reference", Color: "#94A3B8", Label: "Reference / unknown", Dashed: true},
	}
}

func initials(name string) string {
	if name == "" {
		return "?"
	}
	out := ""
	cap := false
	for i, r := range name {
		if i == 0 {
			out += string(r)
			cap = false
			continue
		}
		if r == '-' || r == '_' {
			cap = true
			continue
		}
		if cap {
			out += string(r)
			cap = false
		}
		if len(out) >= 3 {
			break
		}
	}
	if len(out) > 3 {
		out = out[:3]
	}
	return out
}

func optProto(p string) string {
	if p == "" {
		return ""
	}
	return " · " + p
}

// joinProtocols renders a deduped, comma-joined protocol list for an
// inter-system edge label. Empty input → "" (caller falls back to a default).
func joinProtocols(xs []string) string {
	out := ""
	for i, x := range xs {
		if i > 0 {
			out += ", "
		}
		out += x
	}
	return out
}

func laneColor(lanes []DiagramLane, id string) string {
	for _, l := range lanes {
		if l.ID == id {
			return l.Color
		}
	}
	return "#94A3B8"
}
