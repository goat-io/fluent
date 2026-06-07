// Agent-facing CLI commands — mirror the HTTP API so other agents can call
// Brain directly without spinning up `brain serve`. Every command emits JSON
// to stdout (matching the HTTP shape) so it pipes cleanly into `jq`, `python
// -c`, or another agent's tool stack.
//
// Coverage:
//   brain rag query <text>       → POST equivalent of /api/rag/query
//   brain rag stats              → /api/rag/stats
//   brain docs facets            → /api/documents/facets
//   brain docs search <query>    → /api/search?q=…
//   brain docs backlinks <path>  → /api/documents/backlinks?path=…
//   brain docs related <path>    → /api/documents/related?path=…
//   brain docs get <path>        → /api/documents/<path>
//   brain docs list [--system X --tag X --owner X --status X --audience X --catalog]
//   brain structure              → /api/structure
//   brain systems                → /api/architecture/systems
//   brain catalog get <name>     → /api/catalog/*/<name>  (kind-fallback)
//   brain schema list            → /api/schema
//   brain schema get <kind>      → /api/schema/<kind>
//   brain schema examples <kind> → /api/schema/<kind>/examples
//   brain schema registry        → (re)write brain/schema/kinds-registry.json
//
// Output is always JSON so agents don't have to parse pretty tables.
package cli

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"

	"github.com/goat-io/delphi-brain/cli/internal/domain"
)

// AgentCommands returns the top-level commands an agent uses to consume Brain
// without going through the HTTP API. Wire into rootCmd from RootCmd().
func (h *Handler) AgentCommands() []*cobra.Command {
	return []*cobra.Command{
		h.ragCmd(),
		h.docsCmd(),
		h.structureCmd(),
		h.systemsCmd(),
		h.catalogCmd(),
		h.schemaCmd(),
		h.telemetryCmd(),
		h.lintCmd(),
		h.evolveCmd(),
		h.hookCmd(),
		h.candidateCmd(),
	}
}

// ─── candidate (Phase 6) ────────────────────────────────────────────────

func (h *Handler) candidateCmd() *cobra.Command {
	cmd := &cobra.Command{Use: "candidate", Short: "Manage staged wiki drafts (Phase 6)"}

	listCmd := &cobra.Command{
		Use:   "list",
		Short: "All candidates pending review",
		Run: func(cmd *cobra.Command, args []string) {
			paths, err := h.app.Candidate.List()
			exitOnErr(err)
			if paths == nil { paths = []string{} }
			emitJSON(map[string]any{"candidates": paths, "count": len(paths)})
		},
	}

	promoteCmd := &cobra.Command{
		Use:   "promote <candidate-path>",
		Short: "Move candidate into the live wiki at its `target-path:`",
		Args:  cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			abs, err := h.app.Candidate.Promote(args[0])
			exitOnErr(err)
			emitJSON(map[string]any{"promoted": true, "to": abs})
		},
	}

	var reason string
	discardCmd := &cobra.Command{
		Use:   "discard <candidate-path>",
		Short: "Delete candidate; log reason",
		Args:  cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			exitOnErr(h.app.Candidate.Discard(args[0], reason))
			emitJSON(map[string]any{"discarded": true, "reason": reason})
		},
	}
	discardCmd.Flags().StringVarP(&reason, "reason", "r", "no reason given", "Why this draft is being rejected")

	cmd.AddCommand(listCmd, promoteCmd, discardCmd)
	return cmd
}

// ─── hook (Phase 5) ─────────────────────────────────────────────────────

// Wraps the trigger logic the Claude-Code hooks (PostToolUse / Stop /
// UserPromptSubmit) call into. Keeps shell side trivial so the hook config
// is one-liner per event.
func (h *Handler) hookCmd() *cobra.Command {
	cmd := &cobra.Command{Use: "hook", Short: "Wrappers invoked by Claude-Code hooks (Phase 5)"}

	stopCmd := &cobra.Command{
		Use:   "stop",
		Short: "Session-end: rollup telemetry, scan for proposals, surface count",
		Run: func(cmd *cobra.Command, args []string) {
			if h.app.Telemetry != nil {
				h.app.Telemetry.Rollup()
			}
			if h.app.Evolve == nil { return }
			report, err := h.app.Evolve.Scan(3)
			if err != nil { return }
			// Surface a single line for the user; stdin/stdout of Stop hooks
			// goes to the model context, not the user. Print compact summary.
			if len(report.Proposals) > 0 {
				fmt.Printf("🧠 brain-evolve: %d pending proposals (top: %s — `%s`)\n",
					len(report.Proposals), report.Proposals[0].Kind, report.Proposals[0].Subject)
			}
		},
	}

	pendingCmd := &cobra.Command{
		Use:   "pending",
		Short: "Quick check: print one line if hard signals exist; silent otherwise",
		Run: func(cmd *cobra.Command, args []string) {
			if h.app.Telemetry == nil { return }
			// Hard signals = validation-fail OR contradiction lint findings in last 24h.
			rows, err := h.app.Telemetry.Query(`
				SELECT COUNT(*) AS n FROM events
				WHERE (kind='validation-fail' OR (kind='lint-finding' AND value='contradiction'))
				AND ts > datetime('now','-1 day')
			`)
			if err != nil || len(rows) == 0 { return }
			var n int
			switch v := rows[0]["n"].(type) {
			case int64: n = int(v)
			case float64: n = int(v)
			case int: n = v
			}
			if n > 0 {
				fmt.Printf("🧠 brain: %d hard signals pending — run `/brain-evolve`\n", n)
			}
		},
	}

	logCmd := &cobra.Command{
		Use:   "skill-complete <skill-name>",
		Short: "Telemetry shim for PostToolUse: log skill-complete with no payload",
		Args:  cobra.MinimumNArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			if h.app.Telemetry == nil { return }
			h.app.Telemetry.Log("skill-complete", map[string]any{"skill": args[0]})
		},
	}

	cmd.AddCommand(stopCmd, pendingCmd, logCmd)
	return cmd
}

// ─── evolve (Phase 4) ───────────────────────────────────────────────────

func (h *Handler) evolveCmd() *cobra.Command {
	cmd := &cobra.Command{Use: "evolve", Short: "Brain self-evolution proposals (Phase 4)"}

	var top int
	scanCmd := &cobra.Command{
		Use:   "scan",
		Short: "Read telemetry, return ranked proposals (top-N by default)",
		Run: func(cmd *cobra.Command, args []string) {
			if h.app.Evolve == nil {
				fmt.Fprintln(os.Stderr, "evolve not initialized — call PostInit()")
				os.Exit(1)
			}
			report, err := h.app.Evolve.Scan(top)
			exitOnErr(err)
			emitJSON(report)
		},
	}
	scanCmd.Flags().IntVarP(&top, "top", "n", 3, "Max proposals to return; 0 for unlimited")

	cmd.AddCommand(scanCmd)
	return cmd
}

// ─── lint (Phase 3) ─────────────────────────────────────────────────────

func (h *Handler) lintCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "lint",
		Short: "Structural health check (orphans, broken links, stale, ad-hoc fields, missing back-edges)",
		Run: func(cmd *cobra.Command, args []string) {
			if h.app.Lint == nil {
				fmt.Fprintln(os.Stderr, "lint not initialized — call PostInit()")
				os.Exit(1)
			}
			report, err := h.app.Lint.Run()
			exitOnErr(err)
			emitJSON(report)
		},
	}
	return cmd
}

// ─── telemetry (Phase 2) ────────────────────────────────────────────────

func (h *Handler) telemetryCmd() *cobra.Command {
	cmd := &cobra.Command{Use: "telemetry", Short: "Brain self-evolution telemetry (Phase 2)"}

	logCmd := &cobra.Command{
		Use:   "log <event-kind> <json>",
		Short: "Append one event to brain/telemetry/events.jsonl",
		Args:  cobra.ExactArgs(2),
		Run: func(cmd *cobra.Command, args []string) {
			var payload map[string]any
			if err := json.Unmarshal([]byte(args[1]), &payload); err != nil {
				fmt.Fprintln(os.Stderr, "invalid JSON:", err)
				os.Exit(1)
			}
			exitOnErr(h.app.Telemetry.Log(args[0], payload))
			emitJSON(map[string]any{"ok": true, "kind": args[0]})
		},
	}

	rollupCmd := &cobra.Command{
		Use:   "rollup",
		Short: "(Re)build brain/telemetry/rollup.sqlite from events.jsonl",
		Run: func(cmd *cobra.Command, args []string) {
			n, err := h.app.Telemetry.Rollup()
			exitOnErr(err)
			emitJSON(map[string]any{"events": n})
		},
	}

	queryCmd := &cobra.Command{
		Use:   "query <select-sql>",
		Short: "Read-only SELECT against rollup.sqlite",
		Args:  cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			rows, err := h.app.Telemetry.Query(args[0])
			exitOnErr(err)
			if rows == nil { rows = []map[string]any{} }
			emitJSON(rows)
		},
	}

	statsCmd := &cobra.Command{
		Use:   "stats",
		Short: "Counts by event kind",
		Run: func(cmd *cobra.Command, args []string) {
			byKind, total, err := h.app.Telemetry.Stats()
			exitOnErr(err)
			emitJSON(map[string]any{"byKind": byKind, "total": total})
		},
	}

	cmd.AddCommand(logCmd, rollupCmd, queryCmd, statsCmd)
	return cmd
}

// ─── schema (Phase 1 schema-as-runtime) ─────────────────────────────────

func (h *Handler) schemaCmd() *cobra.Command {
	cmd := &cobra.Command{Use: "schema", Short: "Read Brain JSON Schemas at runtime (Phase 1)"}

	listCmd := &cobra.Command{
		Use:   "list",
		Short: "Registry of all kinds (auto-discovered from brain/schema/*.schema.json)",
		Run: func(cmd *cobra.Command, args []string) {
			reg, err := h.app.Schema.List()
			exitOnErr(err)
			emitJSON(reg)
		},
	}

	getCmd := &cobra.Command{
		Use:   "get <kind>",
		Short: "Raw JSON Schema for one kind",
		Args:  cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			raw, _, err := h.app.Schema.Get(args[0])
			exitOnErr(err)
			fmt.Println(string(raw))
		},
	}

	var exLimit int
	examplesCmd := &cobra.Command{
		Use:   "examples <kind>",
		Short: "Up to N existing catalog entries that match this kind",
		Args:  cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			ex, err := h.app.Schema.Examples(args[0], exLimit)
			exitOnErr(err)
			emitJSON(map[string]any{"kind": args[0], "examples": ex})
		},
	}
	examplesCmd.Flags().IntVarP(&exLimit, "limit", "n", 3, "Max examples to return")

	registryCmd := &cobra.Command{
		Use:   "registry",
		Short: "(Re)write brain/schema/kinds-registry.json from current schemas",
		Run: func(cmd *cobra.Command, args []string) {
			changed, path, err := h.app.Schema.WriteRegistry()
			exitOnErr(err)
			emitJSON(map[string]any{"path": path, "changed": changed})
		},
	}

	cmd.AddCommand(listCmd, getCmd, examplesCmd, registryCmd)
	return cmd
}

// ─── rag ────────────────────────────────────────────────────────────────

func (h *Handler) ragCmd() *cobra.Command {
	cmd := &cobra.Command{Use: "rag", Short: "Semantic search via local embeddings (Phase D RAG)"}

	var k int
	queryCmd := &cobra.Command{
		Use:   "query <text>",
		Short: "Top-k semantically similar chunks across indexed markdown",
		Args:  cobra.MinimumNArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			text := strings.Join(args, " ")
			if !h.app.RAG.Available() {
				emitJSON(map[string]any{"available": false, "hits": []any{}})
				return
			}
			hits, err := h.app.RAG.Query(text, k)
			exitOnErr(err)
			emitJSON(map[string]any{"available": true, "hits": hits})
		},
	}
	queryCmd.Flags().IntVarP(&k, "k", "k", 10, "Number of chunks to return")

	statsCmd := &cobra.Command{
		Use:   "stats",
		Short: "RAG corpus stats: chunk + indexed-doc counts",
		Run: func(cmd *cobra.Command, args []string) {
			chunks, docs, _ := h.app.RAG.Stats()
			emitJSON(map[string]any{
				"available": h.app.RAG.Available(),
				"chunks":    chunks,
				"documents": docs,
			})
		},
	}

	cmd.AddCommand(queryCmd, statsCmd)
	return cmd
}

// ─── docs ───────────────────────────────────────────────────────────────

func (h *Handler) docsCmd() *cobra.Command {
	cmd := &cobra.Command{Use: "docs", Short: "Indexed-document operations (facets, search, backlinks, related)"}

	facetsCmd := &cobra.Command{
		Use:   "facets",
		Short: "Value→count distributions across the corpus (owner/status/system/domain/tags/audience)",
		Run: func(cmd *cobra.Command, args []string) {
			facets, err := h.app.Documents.Facets()
			exitOnErr(err)
			emitJSON(facets)
		},
	}

	var searchLimit int
	searchCmd := &cobra.Command{
		Use:   "search <query>",
		Short: "Full-text search (FTS5) with snippets",
		Args:  cobra.MinimumNArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			results, err := h.app.Documents.Search(strings.Join(args, " "), searchLimit)
			exitOnErr(err)
			if results == nil {
				results = []domain.SearchResult{}
			}
			emitJSON(results)
		},
	}
	searchCmd.Flags().IntVarP(&searchLimit, "limit", "l", 20, "Max results")

	backlinksCmd := &cobra.Command{
		Use:   "backlinks <path>",
		Short: "Docs that link to <path>",
		Args:  cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			out, err := h.app.Documents.Backlinks(args[0])
			exitOnErr(err)
			if out == nil { out = []domain.DocumentMeta{} }
			emitJSON(out)
		},
	}

	relatedCmd := &cobra.Command{
		Use:   "related <path>",
		Short: "Ranked neighbour docs by link/system/tag overlap",
		Args:  cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			out, err := h.app.Documents.Related(args[0], 10)
			exitOnErr(err)
			if out == nil { out = []domain.DocumentMeta{} }
			emitJSON(out)
		},
	}

	getCmd := &cobra.Command{
		Use:   "get <path>",
		Short: "Read a document's content + metadata + (if catalog) catalog-info.json + openapi.json",
		Args:  cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			path := args[0]
			meta, err := h.app.Documents.Get(path)
			exitOnErr(err)
			content, _ := os.ReadFile(filepath.Join(h.root, path))
			emitJSON(map[string]any{
				"metadata": meta,
				"content":  string(content),
			})
		},
	}

	var (
		fSystem, fTag, fOwner, fStatus, fAudience, fDomain string
		fCatalog                                            bool
	)
	listCmd := &cobra.Command{
		Use:   "list",
		Short: "List indexed docs (filterable by system/tag/owner/status/audience/domain/catalog)",
		Run: func(cmd *cobra.Command, args []string) {
			docs, err := h.app.Documents.List(domain.DocumentFilter{
				System: fSystem, Tag: fTag, Owner: fOwner, Status: fStatus,
				Audience: fAudience, Domain: fDomain, Catalog: fCatalog,
			})
			exitOnErr(err)
			if docs == nil { docs = []domain.DocumentMeta{} }
			emitJSON(docs)
		},
	}
	listCmd.Flags().StringVar(&fSystem,   "system",   "", "Filter by system field")
	listCmd.Flags().StringVar(&fTag,      "tag",      "", "Filter by tag (single)")
	listCmd.Flags().StringVar(&fOwner,    "owner",    "", "Filter by owner")
	listCmd.Flags().StringVar(&fStatus,   "status",   "", "Filter by status")
	listCmd.Flags().StringVar(&fAudience, "audience", "", "Filter by audience")
	listCmd.Flags().StringVar(&fDomain,   "domain",   "", "Filter by domain")
	listCmd.Flags().BoolVar(&fCatalog,    "catalog",  false, "Only catalog entries")

	cmd.AddCommand(facetsCmd, searchCmd, backlinksCmd, relatedCmd, getCmd, listCmd)
	return cmd
}

// ─── structure ─────────────────────────────────────────────────────────

func (h *Handler) structureCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "structure",
		Short: "Read catalog/_structure.json (sidebar + Documents categories)",
		Run: func(cmd *cobra.Command, args []string) {
			p := filepath.Join(h.root, domain.CatalogDir(), "_structure.json")
			raw, err := os.ReadFile(p)
			if err != nil {
				emitJSON(map[string]any{})
				return
			}
			var v any
			json.Unmarshal(raw, &v)
			emitJSON(v)
		},
	}
}

// ─── systems (C4 L1 view) ──────────────────────────────────────────────

func (h *Handler) systemsCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "systems",
		Short: "C4 L1 system map: kind:system entries + cross-system edges",
		Run: func(cmd *cobra.Command, args []string) {
			data, err := h.app.Architecture.GetSystems()
			exitOnErr(err)
			emitJSON(data)
		},
	}
}

// ─── catalog get ───────────────────────────────────────────────────────

func (h *Handler) catalogCmd() *cobra.Command {
	cmd := &cobra.Command{Use: "catalog", Short: "Catalog entry operations"}
	getCmd := &cobra.Command{
		Use:   "get <name>",
		Short: "Read a catalog entry by name (scans all kind buckets)",
		Args:  cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			name := args[0]
			catalogDir := filepath.Join(h.root, domain.CatalogDir())
			kindDirs, _ := os.ReadDir(catalogDir)
			for _, kd := range kindDirs {
				if !kd.IsDir() { continue }
				entryDir := filepath.Join(catalogDir, kd.Name(), name)
				readme := filepath.Join(entryDir, "README.md")
				if _, err := os.Stat(readme); err != nil { continue }
				content, _ := os.ReadFile(readme)
				out := map[string]any{
					"path":    filepath.Join(domain.CatalogDir(), kd.Name(), name, "README.md"),
					"content": string(content),
				}
				if spec, err := os.ReadFile(filepath.Join(entryDir, "catalog-info.json")); err == nil {
					var v any
					json.Unmarshal(spec, &v)
					out["spec"] = v
				}
				if api, err := os.ReadFile(filepath.Join(entryDir, "openapi.json")); err == nil {
					var v any
					json.Unmarshal(api, &v)
					out["openapi"] = v
				}
				emitJSON(out)
				return
			}
			fmt.Fprintln(os.Stderr, "not found:", name)
			os.Exit(1)
		},
	}
	cmd.AddCommand(getCmd)
	return cmd
}

// ─── helpers ───────────────────────────────────────────────────────────

func emitJSON(v any) {
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	enc.Encode(v)
}
