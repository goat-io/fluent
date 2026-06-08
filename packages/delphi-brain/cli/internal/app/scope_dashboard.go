package app

import (
	"fmt"
	"sort"
)

// DashboardPayload is the ready-to-paint shape for the dashboard mode of any
// lens. Cards are computed server-side; the renderer dispatches by `kind`.
type DashboardPayload struct {
	Lens  LensMeta        `json:"lens"`
	Cards []DashboardCard `json:"cards"`
	Total int             `json:"total"`
}

// DashboardCard is the discriminated union of card shapes the renderer can
// paint. Add a new kind here, add a renderer branch in DashboardMode.jsx —
// nothing else changes.
type DashboardCard struct {
	Kind    string       `json:"kind"`              // counter | breakdown | top | section
	Title   string       `json:"title"`
	Section string       `json:"section,omitempty"` // groups cards into visual blocks
	Tone    string       `json:"tone,omitempty"`    // success | warning | danger | info | accent
	Icon    string       `json:"icon,omitempty"`    // emoji or empty
	Value   any          `json:"value,omitempty"`   // counter
	Sub     string       `json:"sub,omitempty"`     // counter
	Slices  []CardSlice  `json:"slices,omitempty"`  // breakdown
	Rows    []CardTopRow `json:"rows,omitempty"`    // top
	Width   string       `json:"width,omitempty"`   // small | medium | wide
}

type CardSlice struct {
	Label   string         `json:"label"`
	Value   int            `json:"value"`
	Color   string         `json:"color,omitempty"`
	Members []CardMember   `json:"members,omitempty"` // expandable drill-down
}

// CardMember is one entity inside a breakdown slice. Letting the server
// pre-populate this means a single endpoint round-trip serves both the
// summary and the drill-down — no second fetch when the user expands a row.
type CardMember struct {
	ID     string `json:"id"`
	Label  string `json:"label,omitempty"`
	Domain string `json:"domain,omitempty"`
	Kind   string `json:"kind,omitempty"`
}

type CardTopRow struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Sub   string `json:"sub,omitempty"`
	Value int    `json:"value"`
}

// ToDashboard projects a Scope into a DashboardPayload. Card composition is
// driven by what's *present in the data*, not by lens hardcoding — every
// breakdown emits only when ≥1 entry has a value for that field, every
// counter emits only when its predicate matches ≥1 entry. Adding a new lens
// gets a sensible dashboard for free.
func (s *ScopeService) ToDashboard(scope *Scope) *DashboardPayload {
	entries := scope.Entries
	cards := []DashboardCard{}

	// ── 1. Overview — size + health at a glance ─────────────────────────
	// Top-3 kinds composing the scope so the user sees WHAT this number is
	// (e.g. "142 repos · 34 infra · 24 external") instead of an opaque "265".
	cards = append(cards, DashboardCard{
		Section: "Overview", Width: "small",
		Kind: "counter", Title: "Entries", Icon: "📦",
		Value: len(entries),
		Sub:   topKindsSummary(entries, 3),
	})
	// Production / Deprecated / etc. are lifecycle-only signals. The
	// denominator is the count of entries that *have* a lifecycle field —
	// teams, systems, externals usually don't, so including them in the
	// denominator would understate health. `withLifecycle` is that pool.
	withLifecycle := countWhere(entries, func(e *StitchedEntry) bool {
		return firstNonEmpty(specString(e.Spec, "lifecycle"), specString(e.Spec, "status")) != ""
	})
	if production := countWhere(entries, func(e *StitchedEntry) bool {
		return getEntryField(e, "status") == "production"
	}); production > 0 {
		cards = append(cards, DashboardCard{
			Section: "Overview", Width: "small",
			Kind: "counter", Title: "Production",
			Value: production, Tone: "success", Icon: "●",
			Sub: pctOf(production, withLifecycle, "tracked"),
		})
	}
	for _, status := range []string{"deprecated", "sunset", "experimental", "prototype", "dead"} {
		if n := countWhere(entries, func(e *StitchedEntry) bool {
			return getEntryField(e, "status") == status
		}); n > 0 {
			cards = append(cards, DashboardCard{
				Section: "Overview", Width: "small",
				Kind: "counter", Title: title(status),
				Value: n, Tone: toneForStatus(status), Icon: "●",
				Sub: pctOf(n, withLifecycle, "tracked"),
			})
		}
	}

	// ── 2. Risk — what's worrying. APIs sit here too because exposing
	//        an API is a security surface, not a tech-stack fact. ───────
	if api := countWhere(entries, hasProvidedApi); api > 0 {
		cards = append(cards, DashboardCard{
			Section: "Risk", Width: "small",
			Kind: "counter", Title: "Provides APIs",
			Value: api, Icon: "🔌", Sub: "with `providesApi`",
		})
	}
	if crit, high := countSeverity(entries); crit+high > 0 {
		cards = append(cards, DashboardCard{
			Section: "Risk", Width: "small",
			Kind: "counter", Title: "Security findings",
			Value: crit + high, Tone: "danger", Icon: "🔒",
			Sub: fmt.Sprintf("%d critical · %d high", crit, high),
		})
	}
	if hardcoded := countWhere(entries, hasFlag("hasHardcodedSecrets")); hardcoded > 0 {
		cards = append(cards, DashboardCard{
			Section: "Risk", Width: "small",
			Kind: "counter", Title: "Hardcoded secrets",
			Value: hardcoded, Tone: "danger", Icon: "🔑",
		})
	}
	if missing := countWhere(entries, hasFlag("hasMissingAuth")); missing > 0 {
		cards = append(cards, DashboardCard{
			Section: "Risk", Width: "small",
			Kind: "counter", Title: "Missing auth",
			Value: missing, Tone: "warning", Icon: "🔓",
		})
	}

	// ── 3. Ownership — who owns it, where does it live? ─────────────────
	cards = append(cards,
		breakdown(entries, "By domain", "Ownership",
			func(e *StitchedEntry) []string { return single(e.Domain) }),
		breakdown(entries, "By team", "Ownership",
			func(e *StitchedEntry) []string { return single(specString(e.Spec, "team")) }),
		breakdown(entries, "By system", "Ownership",
			func(e *StitchedEntry) []string { return single(e.System) }),
	)

	// ── 4. Stack — what tech is in use? ─────────────────────────────────
	dsCard := s.datastoreUsageCard(entries)
	dsCard.Section = "Stack"
	cards = append(cards,
		breakdown(entries, "Languages", "Stack",
			func(e *StitchedEntry) []string { return specStringList(e.Spec, "language") }),
		dsCard,
		breakdown(entries, "Cloud providers", "Stack",
			func(e *StitchedEntry) []string { return single(deploymentString(e, "cloud")) }),
		breakdown(entries, "Compute", "Stack",
			func(e *StitchedEntry) []string { return single(deploymentString(e, "compute")) }),
	)

	// ── 5. Connectivity — most-central nodes ────────────────────────────
	if len(scope.Edges) > 0 {
		c := mostConnectedCard(scope)
		c.Section = "Connectivity"
		c.Width = "wide"
		cards = append(cards, c)
	}
	if scope.Lens.ID == "teams" {
		c := ownedEntitiesCard(scope)
		c.Section = "Connectivity"
		c.Width = "wide"
		cards = append(cards, c)
	}

	// ── 6. Reference — secondary breakdowns kept for drill-down only ────
	cards = append(cards,
		breakdown(entries, "By kind", "Reference",
			func(e *StitchedEntry) []string { return single(e.Kind) }),
		breakdown(entries, "By layer", "Reference",
			func(e *StitchedEntry) []string { return single(e.Layer) }),
		breakdown(entries, "By status", "Reference",
			func(e *StitchedEntry) []string {
				return single(firstNonEmpty(specString(e.Spec, "lifecycle"), specString(e.Spec, "status")))
			}),
		breakdown(entries, "By type", "Reference",
			func(e *StitchedEntry) []string { return single(specString(e.Spec, "type")) }),
		breakdown(entries, "Categories", "Reference",
			func(e *StitchedEntry) []string { return single(specString(e.Spec, "category")) }),
		breakdown(entries, "Datastore types", "Reference",
			func(e *StitchedEntry) []string {
				if !isDataStoreEntry(e) {
					return nil
				}
				return single(firstNonEmpty(specString(e.Spec, "category"), specString(e.Spec, "service")))
			}),
	)

	cards = dropEmpty(cards)

	return &DashboardPayload{
		Lens: LensMeta{
			ID:          scope.Lens.ID,
			Name:        scope.Lens.Name,
			Description: scope.Lens.Description,
		},
		Cards: cards,
		Total: len(entries),
	}
}

// breakdown is the universal multi-value distribution helper. `extract`
// returns one or more bucket labels per entry — supports both single-value
// (kind, system) and multi-value (language[]) fields. Every slice carries
// drill-down members so the frontend doesn't fetch a second time.
func breakdown(entries map[string]*StitchedEntry, title, section string, extract func(*StitchedEntry) []string) DashboardCard {
	type bucket struct {
		count   int
		members []CardMember
	}
	groups := map[string]*bucket{}
	for _, e := range entries {
		labels := extract(e)
		seen := map[string]bool{}
		for _, l := range labels {
			if l == "" || seen[l] {
				continue
			}
			seen[l] = true
			b := groups[l]
			if b == nil {
				b = &bucket{}
				groups[l] = b
			}
			b.count++
			b.members = append(b.members, CardMember{
				ID:     e.Name,
				Label:  e.Name,
				Domain: e.Domain,
				Kind:   e.Kind,
			})
		}
	}
	slices := make([]CardSlice, 0, len(groups))
	for label, b := range groups {
		// Sort members by name for stable rendering.
		sort.Slice(b.members, func(i, j int) bool { return b.members[i].ID < b.members[j].ID })
		slices = append(slices, CardSlice{
			Label:   label,
			Value:   b.count,
			Members: b.members,
		})
	}
	sort.Slice(slices, func(i, j int) bool {
		if slices[i].Value != slices[j].Value {
			return slices[i].Value > slices[j].Value
		}
		return slices[i].Label < slices[j].Label
	})
	return DashboardCard{
		Kind: "breakdown", Title: title, Section: section,
		Slices: slices, Width: "wide",
	}
}

// ── Predicates + extractors ────────────────────────────────────────────

func countWhere(entries map[string]*StitchedEntry, ok func(*StitchedEntry) bool) int {
	n := 0
	for _, e := range entries {
		if ok(e) {
			n++
		}
	}
	return n
}

func hasProvidedApi(e *StitchedEntry) bool {
	if v, _ := e.Spec["providesApis"].([]any); len(v) > 0 {
		return true
	}
	if v, _ := e.Spec["providesApi"].([]any); len(v) > 0 {
		return true
	}
	return false
}

// hasFlag returns true when the entity's `spec.security.<flag>` is true.
func hasFlag(flag string) func(*StitchedEntry) bool {
	return func(e *StitchedEntry) bool {
		sec, _ := e.Spec["security"].(map[string]any)
		if sec == nil {
			return false
		}
		v, _ := sec[flag].(bool)
		return v
	}
}

// countSeverity returns the count of {critical, high} findings across the
// scope. Reads `spec.security.findings[]`.
func countSeverity(entries map[string]*StitchedEntry) (crit, high int) {
	for _, e := range entries {
		sec, _ := e.Spec["security"].(map[string]any)
		if sec == nil {
			continue
		}
		findings, _ := sec["findings"].([]any)
		for _, f := range findings {
			m, _ := f.(map[string]any)
			if m == nil {
				continue
			}
			switch m["severity"] {
			case "critical":
				crit++
			case "high":
				high++
			}
		}
	}
	return
}

// isDataStoreEntry returns true for entries the catalog itself classifies as
// storage. Reads only catalog-declared fields — no name regex, no enum
// hardcoding beyond the schema's own enums.
func isDataStoreEntry(e *StitchedEntry) bool {
	if e.Kind == "data-asset" {
		return true
	}
	if e.Kind == "service" || e.Kind == "infra" {
		switch specString(e.Spec, "category") {
		case "database", "cache", "message-broker", "search", "cdc", "object-store", "queue":
			return true
		}
	}
	return false
}

func deploymentString(e *StitchedEntry, key string) string {
	dep, _ := e.Spec["deployment"].(map[string]any)
	if dep == nil {
		return ""
	}
	v, _ := dep[key].(string)
	return v
}

// specStringList reads a `spec.<key>` that's an array of strings. Used for
// multi-value fields like `language: ["c", "cpp"]`.
func specStringList(spec map[string]any, key string) []string {
	if spec == nil {
		return nil
	}
	v, _ := spec[key].([]any)
	out := make([]string, 0, len(v))
	for _, x := range v {
		if s, ok := x.(string); ok && s != "" {
			out = append(out, s)
		}
	}
	return out
}

func single(s string) []string {
	if s == "" {
		return nil
	}
	return []string{s}
}

func pct(n, total int) string {
	if total == 0 {
		return ""
	}
	return fmt.Sprintf("%d%% of total", int(float64(n)/float64(total)*100+0.5))
}

// pctOf renders "<n>% of <total> <noun>" — used when the natural denominator
// isn't `len(entries)` (e.g. lifecycle counts only apply to entries that
// declare a lifecycle).
func pctOf(n, total int, noun string) string {
	if total == 0 {
		return ""
	}
	return fmt.Sprintf("%d%% of %d %s", int(float64(n)/float64(total)*100+0.5), total, noun)
}

// topKindsSummary returns "142 repos · 34 infra · 24 external" — a one-line
// sub-label that demystifies what the headline count actually counts.
func topKindsSummary(entries map[string]*StitchedEntry, n int) string {
	counts := map[string]int{}
	for _, e := range entries {
		k := e.Kind
		if k == "" {
			k = "entry"
		}
		counts[k]++
	}
	type pair struct {
		k string
		v int
	}
	pairs := make([]pair, 0, len(counts))
	for k, v := range counts {
		pairs = append(pairs, pair{k, v})
	}
	sort.Slice(pairs, func(i, j int) bool {
		if pairs[i].v != pairs[j].v {
			return pairs[i].v > pairs[j].v
		}
		return pairs[i].k < pairs[j].k
	})
	if len(pairs) > n {
		pairs = pairs[:n]
	}
	parts := make([]string, len(pairs))
	for i, p := range pairs {
		parts[i] = fmt.Sprintf("%d %s", p.v, pluralKind(p.k, p.v))
	}
	return joinSep(parts, " · ")
}

// pluralKind is a minimal english pluraliser for kind names. Only handles
// the regular pattern — extend if/when an irregular kind shows up.
func pluralKind(k string, n int) string {
	if n == 1 {
		return k
	}
	switch k {
	case "infra":
		return "infra"
	case "data":
		return "data"
	}
	return k + "s"
}

func joinSep(xs []string, sep string) string {
	out := ""
	for i, x := range xs {
		if i > 0 {
			out += sep
		}
		out += x
	}
	return out
}

func title(s string) string {
	if s == "" {
		return s
	}
	return string([]rune(s)[0]-32) + s[1:]
}

// toneForStatus maps lifecycle values to a generic tone keyword. The only
// concrete values in the schema's lifecycle enum drive this. Frontend turns
// the tone into a colour from its theme.
// datastoreUsageCard counts how many in-scope entries depend on each known
// datastore (one row per datastore service). Reads outbound dependsOn edges,
// resolves each target via the stitcher snapshot, keeps targets that the
// catalog itself classifies as storage. Label format: `<category>: <name>`
// — same shape the legacy Catalog dashboard used.
func (s *ScopeService) datastoreUsageCard(entries map[string]*StitchedEntry) DashboardCard {
	snap := s.stitcher.Snapshot()
	type bucket struct {
		count   int
		members []CardMember
		seen    map[string]bool
	}
	groups := map[string]*bucket{}
	for _, e := range entries {
		for _, ed := range e.Outbound {
			if ed.Relation != "dependsOn" {
				continue
			}
			target, ok := snap[ed.Target]
			if !ok || !isDataStoreEntry(target) {
				continue
			}
			cat := firstNonEmpty(specString(target.Spec, "category"), specString(target.Spec, "service"))
			if cat == "" {
				cat = target.Kind
			}
			label := cat + ": " + target.Name
			b := groups[label]
			if b == nil {
				b = &bucket{seen: map[string]bool{}}
				groups[label] = b
			}
			if b.seen[e.Name] {
				continue
			}
			b.seen[e.Name] = true
			b.count++
			b.members = append(b.members, CardMember{
				ID: e.Name, Label: e.Name, Domain: e.Domain, Kind: e.Kind,
			})
		}
	}
	slices := make([]CardSlice, 0, len(groups))
	for label, b := range groups {
		sort.Slice(b.members, func(i, j int) bool { return b.members[i].ID < b.members[j].ID })
		slices = append(slices, CardSlice{Label: label, Value: b.count, Members: b.members})
	}
	sort.Slice(slices, func(i, j int) bool {
		if slices[i].Value != slices[j].Value {
			return slices[i].Value > slices[j].Value
		}
		return slices[i].Label < slices[j].Label
	})
	return DashboardCard{
		Kind: "breakdown", Title: "Datastores", Section: "Data",
		Slices: slices, Width: "wide",
	}
}

func toneForStatus(status string) string {
	switch status {
	case "production":
		return "success"
	case "deprecated", "sunset":
		return "warning"
	case "dead":
		return "danger"
	case "experimental", "prototype", "new":
		return "info"
	}
	return ""
}

// mostConnectedCard returns the top entries by total edge count (in + out
// bound). Useful for spotting hubs in a scope.
func mostConnectedCard(scope *Scope) DashboardCard {
	type item struct {
		name string
		kind string
		out  int
		in   int
	}
	idx := map[string]*item{}
	for name, e := range scope.Entries {
		idx[name] = &item{name: name, kind: e.Kind}
	}
	for _, ed := range scope.Edges {
		if it := idx[ed.Source]; it != nil {
			it.out++
		}
		if it := idx[ed.Target]; it != nil {
			it.in++
		}
	}
	rows := make([]item, 0, len(idx))
	for _, it := range idx {
		if it.in+it.out == 0 {
			continue
		}
		rows = append(rows, *it)
	}
	sort.Slice(rows, func(i, j int) bool {
		ai := rows[i].in + rows[i].out
		bi := rows[j].in + rows[j].out
		if ai != bi {
			return ai > bi
		}
		return rows[i].name < rows[j].name
	})
	if len(rows) > 10 {
		rows = rows[:10]
	}
	out := make([]CardTopRow, 0, len(rows))
	for _, r := range rows {
		out = append(out, CardTopRow{
			ID: r.name, Label: r.name,
			Sub:   r.kind,
			Value: r.in + r.out,
		})
	}
	return DashboardCard{
		Kind: "top", Title: "Most connected", Rows: out,
	}
}

// ownedEntitiesCard counts how many entries each team owns. Only meaningful
// for the teams lens.
func ownedEntitiesCard(scope *Scope) DashboardCard {
	counts := map[string]int{}
	for _, e := range scope.Entries {
		if e.Kind != "team" {
			continue
		}
		// Owned count = inbound ownerTeam edges.
		n := 0
		for _, ed := range e.Inbound {
			if ed.Relation == "ownerTeam" {
				n++
			}
		}
		counts[e.Name] = n
	}
	rows := make([]CardTopRow, 0, len(counts))
	for k, v := range counts {
		rows = append(rows, CardTopRow{ID: k, Label: k, Value: v})
	}
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].Value != rows[j].Value {
			return rows[i].Value > rows[j].Value
		}
		return rows[i].Label < rows[j].Label
	})
	return DashboardCard{Kind: "top", Title: "Entries owned by team", Rows: rows}
}

// getEntryField reads the named field from a StitchedEntry, supporting both
// top-level fields and a small set of derived ones. Used by breakdownCard.
func getEntryField(e *StitchedEntry, field string) string {
	switch field {
	case "kind":
		return e.Kind
	case "system":
		return e.System
	case "layer":
		return e.Layer
	case "domain":
		return e.Domain
	case "status":
		return firstNonEmpty(specString(e.Spec, "lifecycle"), specString(e.Spec, "status"))
	case "team":
		return specString(e.Spec, "team")
	}
	return ""
}

// slicesFromCounts converts a count map into sorted CardSlice list (desc by
// count, asc by label as tiebreaker).
func slicesFromCounts(counts map[string]int) []CardSlice {
	out := make([]CardSlice, 0, len(counts))
	for k, v := range counts {
		out = append(out, CardSlice{Label: k, Value: v})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Value != out[j].Value {
			return out[i].Value > out[j].Value
		}
		return out[i].Label < out[j].Label
	})
	return out
}

// dropEmpty removes breakdown cards with no slices and top cards with no
// rows — they would render as empty placeholders.
func dropEmpty(cards []DashboardCard) []DashboardCard {
	out := cards[:0]
	for _, c := range cards {
		switch c.Kind {
		case "breakdown":
			if len(c.Slices) == 0 {
				continue
			}
		case "top":
			if len(c.Rows) == 0 {
				continue
			}
		}
		out = append(out, c)
	}
	return out
}
