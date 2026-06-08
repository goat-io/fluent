package app

import "sort"

// TablePayload is the ready-to-paint shape for the table mode of any lens.
// Columns + rows + facets are computed server-side; the renderer is dumb.
type TablePayload struct {
	Lens    LensMeta       `json:"lens"`
	Columns []TableColumn  `json:"columns"`
	Rows    []TableRow     `json:"rows"`
	Facets  []TableFacet   `json:"facets"`
	Total   int            `json:"total"`
}

// LensMeta is the lens descriptor copied into every payload so the client can
// label the page without an extra request.
type LensMeta struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

// TableColumn describes one cell column. `kind` lets the renderer pick a
// formatter (badge, link, mono, plain).
type TableColumn struct {
	Key      string `json:"key"`
	Label    string `json:"label"`
	Kind     string `json:"kind"` // text | badge | link | mono | pill
	Width    int    `json:"width,omitempty"`
	Sortable bool   `json:"sortable,omitempty"`
}

// TableRow holds a flat map of cell values keyed by column. `id` is the entity
// name — the renderer hands it to the drawer when a row is clicked.
type TableRow struct {
	ID    string         `json:"id"`
	Cells map[string]any `json:"cells"`
}

// TableFacet is a per-column distribution {value, count} sorted by count desc.
// Renders as filter chips. `Placeholder` is the "All Xs" string shown when no
// value is selected — backend-supplied so the frontend can stay company-agnostic.
type TableFacet struct {
	Key         string             `json:"key"`
	Label       string             `json:"label"`
	Placeholder string             `json:"placeholder"`
	Values      []TableFacetValue  `json:"values"`
}

type TableFacetValue struct {
	Value string `json:"value"`
	Label string `json:"label,omitempty"` // human-readable; falls back to Value
	Count int    `json:"count"`
}

// facetLabel returns a human-readable label for a facet value. Today only the
// `kind` facet has a curated map; other facets fall back to the raw value.
// Frontend reads `label` if non-empty, else `value`.
func facetLabel(facetKey, value string) string {
	if facetKey != "kind" {
		return ""
	}
	if l, ok := kindLabels[value]; ok {
		return l
	}
	return ""
}

// facetPlaceholder turns a column label ("Kind", "Layer", "Status") into the
// "All Kinds" / "All Layers" / "All Statuses" string shown as the dropdown
// default. English plural rules — "y" → "ies", default → "s".
func facetPlaceholder(label string) string {
	if label == "" {
		return "All"
	}
	switch label {
	case "Status":
		return "All Statuses"
	}
	if last := label[len(label)-1]; last == 'y' && len(label) > 1 {
		return "All " + label[:len(label)-1] + "ies"
	}
	return "All " + label + "s"
}

var kindLabels = map[string]string{
	"repo":           "Repository",
	"system":         "System",
	"service":        "Service",
	"infra":          "Infrastructure",
	"external":       "External",
	"product":        "Product",
	"team":           "Team",
	"api":            "API",
	"capability":     "Capability",
	"value-stream":   "Value Stream",
	"data-asset":     "Data Asset",
	"data-pipeline":  "Data Pipeline",
	"classification": "Classification",
	"objective":      "Objective",
	"key-result":     "Key Result",
	"kpi":            "KPI",
	"sla":            "SLA",
	"slo":            "SLO",
	"oncall":         "On-call",
	"runbook":        "Runbook",
	"process":        "Process",
	"decision":       "Decision",
	"risk":           "Risk",
	"customer":       "Customer",
	"market":         "Market",
}

// ToTable projects a Scope into a TablePayload. Columns vary by lens — most
// lenses share the same set, but specialised lenses (data, strategy) override.
func (s *ScopeService) ToTable(scope *Scope) *TablePayload {
	cols := tableColumnsFor(scope.Lens.ID)
	rows := make([]TableRow, 0, len(scope.Entries))
	for _, e := range scope.Entries {
		rows = append(rows, TableRow{ID: e.Name, Cells: rowCells(e, cols)})
	}
	sort.Slice(rows, func(i, j int) bool { return rows[i].ID < rows[j].ID })

	facets := tableFacetsFrom(rows, cols)

	return &TablePayload{
		Lens: LensMeta{
			ID:          scope.Lens.ID,
			Name:        scope.Lens.Name,
			Description: scope.Lens.Description,
		},
		Columns: cols,
		Rows:    rows,
		Facets:  facets,
		Total:   len(rows),
	}
}

// tableColumnsFor returns the column set for a given lens ID. Default set
// matches the legacy Catalog table (kind, name, system, layer, team, status,
// description). Lens-specific overrides go in the switch.
func tableColumnsFor(lensID string) []TableColumn {
	base := []TableColumn{
		{Key: "name", Label: "Name", Kind: "link", Width: 240, Sortable: true},
		{Key: "kind", Label: "Kind", Kind: "badge", Width: 100, Sortable: true},
		{Key: "layer", Label: "Layer", Kind: "pill", Width: 100, Sortable: true},
		{Key: "system", Label: "System", Kind: "pill", Width: 110, Sortable: true},
		{Key: "domain", Label: "Domain", Kind: "pill", Width: 120, Sortable: true},
		{Key: "type", Label: "Type", Kind: "pill", Width: 100, Sortable: true},
		{Key: "team", Label: "Team", Kind: "pill", Width: 140, Sortable: true},
		{Key: "status", Label: "Status", Kind: "badge", Width: 100, Sortable: true},
		{Key: "description", Label: "Description", Kind: "text", Sortable: false},
	}
	switch lensID {
	case "communications":
		return []TableColumn{
			{Key: "name", Label: "Name", Kind: "link", Width: 220, Sortable: true},
			{Key: "kind", Label: "Kind", Kind: "badge", Width: 100, Sortable: true},
			{Key: "protocols", Label: "Protocols", Kind: "text", Sortable: false},
			{Key: "system", Label: "System", Kind: "pill", Width: 110, Sortable: true},
			{Key: "layer", Label: "Layer", Kind: "pill", Width: 100, Sortable: true},
			{Key: "description", Label: "Description", Kind: "text"},
		}
	case "data":
		return []TableColumn{
			{Key: "name", Label: "Name", Kind: "link", Width: 220, Sortable: true},
			{Key: "kind", Label: "Kind", Kind: "badge", Width: 110, Sortable: true},
			{Key: "classification", Label: "Classification", Kind: "pill", Width: 130, Sortable: true},
			{Key: "system", Label: "System", Kind: "pill", Width: 110, Sortable: true},
			{Key: "team", Label: "Team", Kind: "text", Width: 130, Sortable: true},
			{Key: "description", Label: "Description", Kind: "text"},
		}
	}
	return base
}

// rowCells projects an entry into a flat cell map. Pulls from spec when the
// column key isn't directly on StitchedEntry.
func rowCells(e *StitchedEntry, cols []TableColumn) map[string]any {
	out := map[string]any{
		"name":        e.Name,
		"kind":        e.Kind,
		"system":      e.System,
		"layer":       e.Layer,
		"domain":      e.Domain,
		"type":        specString(e.Spec, "type"),
		"description": e.Description,
		"team":        specString(e.Spec, "team"),
		"status":      firstNonEmpty(specString(e.Spec, "lifecycle"), specString(e.Spec, "status")),
	}
	// Lens-specific cells.
	for _, c := range cols {
		switch c.Key {
		case "protocols":
			out["protocols"] = collectProtocols(e)
		case "classification":
			out["classification"] = specString(e.Spec, "classification")
		}
	}
	return out
}

// collectProtocols pulls a comma-joined list of protocol names from outbound
// dependsOn / communicatesWith edges. Read once per row, server-side, so the
// renderer doesn't have to walk edges.
func collectProtocols(e *StitchedEntry) string {
	seen := map[string]bool{}
	for _, ed := range e.Outbound {
		if ed.Relation != "dependsOn" && ed.Relation != "communicatesWith" {
			continue
		}
		if p, ok := ed.Meta["protocol"].(string); ok && p != "" {
			seen[p] = true
		}
	}
	out := make([]string, 0, len(seen))
	for k := range seen {
		out = append(out, k)
	}
	sort.Strings(out)
	return joinComma(out)
}

func joinComma(xs []string) string {
	out := ""
	for i, x := range xs {
		if i > 0 {
			out += ", "
		}
		out += x
	}
	return out
}

// tableFacetsFrom counts distinct values per faceted column. Only columns with
// `kind in {badge, pill, text}` and a small cardinality are faceted.
func tableFacetsFrom(rows []TableRow, cols []TableColumn) []TableFacet {
	out := []TableFacet{}
	for _, c := range cols {
		if c.Kind != "badge" && c.Kind != "pill" {
			continue
		}
		counts := map[string]int{}
		for _, r := range rows {
			v, _ := r.Cells[c.Key].(string)
			if v == "" {
				continue
			}
			counts[v]++
		}
		if len(counts) == 0 {
			continue
		}
		vals := make([]TableFacetValue, 0, len(counts))
		for v, n := range counts {
			vals = append(vals, TableFacetValue{Value: v, Label: facetLabel(c.Key, v), Count: n})
		}
		sort.Slice(vals, func(i, j int) bool {
			if vals[i].Count != vals[j].Count {
				return vals[i].Count > vals[j].Count
			}
			return vals[i].Value < vals[j].Value
		})
		out = append(out, TableFacet{
			Key:         c.Key,
			Label:       c.Label,
			Placeholder: facetPlaceholder(c.Label),
			Values:      vals,
		})
	}
	return out
}

// specString reads a string field from a spec map, returning empty when the
// field is missing or wrong type.
func specString(spec map[string]any, key string) string {
	if spec == nil {
		return ""
	}
	if v, ok := spec[key].(string); ok {
		return v
	}
	return ""
}

func firstNonEmpty(xs ...string) string {
	for _, x := range xs {
		if x != "" {
			return x
		}
	}
	return ""
}
