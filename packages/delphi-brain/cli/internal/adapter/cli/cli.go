package cli

import (
	"fmt"
	"os"
	"strings"
	"sync"
	"text/tabwriter"

	"github.com/spf13/cobra"

	"github.com/goat-io/delphi-brain/cli/internal/app"
	"github.com/goat-io/delphi-brain/cli/internal/domain"
)

// Handler builds the Cobra command tree from application services.
type Handler struct {
	app  *app.App
	root string
}

func NewHandler(a *app.App, root string) *Handler {
	return &Handler{app: a, root: root}
}

// RootCmd returns the fully assembled Cobra root command.
func (h *Handler) RootCmd() *cobra.Command {
	rootCmd := &cobra.Command{
		Use:   "brain",
		Short: "Brain service registry & repo manager",
		Long:  "Service registry, document indexer, and API server for a company knowledge base.",
	}

	rootCmd.AddCommand(
		h.repoCmd(),
		h.cloneCmd(),
		h.svcCmd(),
		h.protoCmd(),
		h.tagCmd(),
		h.queryCmd(),
		h.statsCmd(),
		h.indexCmd(),
	)
	rootCmd.AddCommand(h.AgentCommands()...) // rag/docs/structure/systems/catalog

	return rootCmd
}

// --- Repo commands ---

func (h *Handler) repoCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "repo",
		Short: "Manage repository registry",
	}

	// repo import
	importCmd := &cobra.Command{
		Use:   "import [org]",
		Short: "Import all repos from a GitHub org",
		Args:  cobra.MaximumNArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			org := domain.GitHubOrg()
			if len(args) > 0 {
				org = args[0]
			}
			fmt.Printf("Importing repos from %s...\n", org)
			count, err := h.app.Repos.Import(org)
			exitOnErr(err)
			fmt.Printf("Imported %d repos.\n", count)
		},
	}

	// repo add
	addCmd := &cobra.Command{
		Use:   "add <name> <url> <domain>",
		Short: "Add a repo manually",
		Args:  cobra.ExactArgs(3),
		Run: func(cmd *cobra.Command, args []string) {
			exitOnErr(h.app.Repos.Add(args[0], args[1], args[2]))
			fmt.Printf("Added repo: %s\n", args[0])
		},
	}

	// repo list
	var listDomain, listStatus string
	var listCloned bool
	listCmd := &cobra.Command{
		Use:   "list",
		Short: "List repos",
		Run: func(cmd *cobra.Command, args []string) {
			repos, err := h.app.Repos.List(domain.RepoFilter{
				Domain:     listDomain,
				Status:     listStatus,
				ClonedOnly: listCloned,
			})
			exitOnErr(err)

			w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
			fmt.Fprintf(w, "NAME\tDOMAIN\tSTATUS\tLANG\tCLONED\n")
			for _, r := range repos {
				c := "no"
				if r.Cloned {
					c = "yes"
				}
				fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\n", r.Name, r.Domain, r.Status, r.Language, c)
			}
			w.Flush()
		},
	}
	listCmd.Flags().StringVar(&listDomain, "domain", "", "Filter by domain")
	listCmd.Flags().StringVar(&listStatus, "status", "", "Filter by status")
	listCmd.Flags().BoolVar(&listCloned, "cloned", false, "Show only cloned repos")

	// repo show
	showCmd := &cobra.Command{
		Use:   "show <name>",
		Short: "Show repo details",
		Args:  cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			repo, tags, svcs, err := h.app.Repos.Get(args[0])
			if err != nil {
				fmt.Fprintf(os.Stderr, "not found: %s\n", args[0])
				os.Exit(1)
			}

			fmt.Printf("Name:        %s\n", repo.Name)
			fmt.Printf("URL:         %s\n", repo.GitHubURL)
			fmt.Printf("Domain:      %s\n", repo.Domain)
			fmt.Printf("Description: %s\n", repo.Description)
			fmt.Printf("Status:      %s\n", repo.Status)
			fmt.Printf("Language:    %s\n", repo.Language)
			fmt.Printf("Team:        %s\n", repo.Team)
			printIfSet("System:     ", repo.System)
			printIfSet("Lifecycle:  ", repo.Lifecycle)
			printIfSet("DependsOn:  ", repo.DependsOn)
			printIfSet("Provides:   ", repo.ProvidesAPIs)
			printIfSet("Consumes:   ", repo.ConsumesAPIs)
			printIfSet("Tags:       ", repo.Tags)
			printIfSet("Links:      ", repo.Links)
			printIfSet("Collaborators:", repo.Collaborators)
			printIfSet("Deployment: ", repo.Deployment)
			printIfSet("Observability:", repo.Observability)
			printIfSet("Security:   ", repo.Security)
			fmt.Printf("Cloned:      %v\n", repo.Cloned)
			if repo.LocalPath != "" {
				fmt.Printf("Local Path:  %s\n", repo.LocalPath)
			}
			fmt.Printf("Created:     %s\n", repo.CreatedAt)
			fmt.Printf("Updated:     %s\n", repo.UpdatedAt)

			if len(tags) > 0 {
				fmt.Printf("DB Tags:     %s\n", strings.Join(tags, ", "))
			}
			if len(svcs) > 0 {
				fmt.Println("\nServices:")
				for _, s := range svcs {
					fmt.Printf("  - %s (%s, %s)\n", s.Name, s.Type, s.Status)
				}
			}
		},
	}

	// repo update
	updateCmd := &cobra.Command{
		Use:   "update <name> <field>=<value> ...",
		Short: "Update repo fields (domain, status, language, team, description)",
		Args:  cobra.MinimumNArgs(2),
		Run: func(cmd *cobra.Command, args []string) {
			name := args[0]
			fields := make(map[string]string)
			for _, kv := range args[1:] {
				parts := strings.SplitN(kv, "=", 2)
				if len(parts) != 2 {
					fmt.Fprintf(os.Stderr, "invalid: %s (use field=value)\n", kv)
					continue
				}
				fields[parts[0]] = parts[1]
			}

			errs := h.app.Repos.Update(name, fields)
			for _, err := range errs {
				fmt.Fprintf(os.Stderr, "%v\n", err)
			}
			for field, value := range fields {
				if domain.AllowedRepoUpdateFields[field] {
					fmt.Printf("Updated %s.%s = %s\n", name, field, value)
				}
			}
		},
	}

	// repo sync
	var skipSpecs bool
	syncCmd := &cobra.Command{
		Use:   "sync",
		Short: "Sync repo metadata from GitHub, .brain.yml files, and catalog entries",
		Long: `Three-step sync with priority chain:

  1. Import repos from GitHub (names, URLs, language, topics)
  2. Fetch .brain/spec.json from each repo via GitHub API (highest priority)
  3. Backfill remaining unknowns from Brain catalog entries

Priority: .brain/spec.json > GitHub topics > catalog entries

Teams should add a .brain/ folder to their repo with a spec.json file.`,
		Run: func(cmd *cobra.Command, args []string) {
			org := domain.GitHubOrg()
			// Step 1: Import from GitHub (repos + topics)
			fmt.Printf("Step 1: Importing repos from %s...\n", org)
			count, err := h.app.Repos.Import(org)
			exitOnErr(err)
			fmt.Printf("  Imported %d repos.\n", count)

			// Step 2: Fetch .brain.yml from each repo
			if !skipSpecs {
				fmt.Println("Step 2: Reading .brain/spec.json from repos...")
				found, notFound, err := h.app.Repos.SyncSpecs(org, func(name, status string) {
					fmt.Printf("  %s: %s\n", name, status)
				})
				exitOnErr(err)
				fmt.Printf("  Found %d specs, %d repos without .brain/spec.json.\n", found, notFound)
			} else {
				fmt.Println("Step 2: Skipped (.brain/spec.json fetch disabled)")
			}

			// Step 3: Backfill from catalog entries
			fmt.Println("Step 3: Backfilling from catalog entries...")
			updated, skipped, err := h.app.Repos.SyncFromCatalog()
			exitOnErr(err)
			fmt.Printf("  Updated %d repos, %d catalog entries had no matching repo.\n", updated, skipped)

			fmt.Println("Sync complete.")
		},
	}
	syncCmd.Flags().BoolVar(&skipSpecs, "skip-specs", false, "Skip fetching .brain/spec.json files (faster, use cached data)")

	cmd.AddCommand(importCmd, addCmd, listCmd, showCmd, updateCmd, syncCmd)
	return cmd
}

// --- Clone commands ---

func (h *Handler) cloneCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "clone",
		Short: "Clone repositories",
	}

	// clone repo <name> [name2 ...]
	repoCmd := &cobra.Command{
		Use:   "repo <name> [name2 ...]",
		Short: "Clone specific repos",
		Args:  cobra.MinimumNArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			for _, name := range args {
				msg, err := h.app.Cloner.Clone(name)
				if err != nil {
					fmt.Fprintf(os.Stderr, "error: %v\n", err)
				} else {
					fmt.Println(msg)
				}
			}
		},
	}

	// clone all
	var allBatch int
	allCmd := &cobra.Command{
		Use:   "all",
		Short: "Clone all non-archived repos in parallel",
		Run: func(cmd *cobra.Command, args []string) {
			names, err := h.app.Cloner.CloneAll()
			exitOnErr(err)
			h.cloneParallel(names, allBatch, "")
		},
	}
	allCmd.Flags().IntVar(&allBatch, "batch", 10, "Number of parallel clones per batch")

	// clone domain <domain>
	var domainBatch int
	domainCmd := &cobra.Command{
		Use:   "domain <domain>",
		Short: "Clone all repos in a domain in parallel",
		Args:  cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			names, err := h.app.Cloner.CloneDomain(args[0])
			exitOnErr(err)
			h.cloneParallel(names, domainBatch, args[0])
		},
	}
	domainCmd.Flags().IntVar(&domainBatch, "batch", 10, "Number of parallel clones per batch")

	cmd.AddCommand(repoCmd, allCmd, domainCmd)
	return cmd
}

func (h *Handler) cloneParallel(names []string, batchSize int, label string) {
	total := len(names)
	if label != "" {
		fmt.Printf("Cloning %d repos in domain '%s' (batch size %d)...\n", total, label, batchSize)
	} else {
		fmt.Printf("Cloning %d repos (batch size %d)...\n", total, batchSize)
	}

	var mu sync.Mutex
	var failed, updated, cloned int

	h.app.Cloner.CloneParallel(names, batchSize, func(r app.CloneResult) {
		mu.Lock()
		defer mu.Unlock()
		if r.Err != nil {
			failed++
			fmt.Fprintf(os.Stderr, "  FAIL %s: %v\n", r.Name, r.Err)
		} else if strings.HasPrefix(r.Message, "Updated") {
			updated++
			fmt.Printf("  %s\n", r.Message)
		} else {
			cloned++
			fmt.Printf("  %s\n", r.Message)
		}
	})

	fmt.Printf("\nDone: %d cloned, %d updated, %d failed\n", cloned, updated, failed)
}

// --- Service commands ---

func (h *Handler) svcCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:     "svc",
		Aliases: []string{"service"},
		Short:   "Manage service registry",
	}

	// svc add
	addCmd := &cobra.Command{
		Use:   "add <name> [field=value ...]",
		Short: "Add or update a service",
		Args:  cobra.MinimumNArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			fields := parseKV(args[1:])
			svc := domain.Service{
				Name:         args[0],
				RepoName:     fields["repo"],
				Type:         fields["type"],
				Hosting:      fields["hosting"],
				Port:         fields["port"],
				Protocol:     fields["protocol"],
				Dependencies: fields["dependencies"],
				Description:  fields["description"],
				Status:       fields["status"],
				Notes:        fields["notes"],
			}
			exitOnErr(h.app.Services.Add(svc))
			fmt.Printf("Added service: %s\n", args[0])
		},
	}

	// svc list
	var svcType, svcStatus string
	listCmd := &cobra.Command{
		Use:   "list",
		Short: "List services",
		Run: func(cmd *cobra.Command, args []string) {
			svcs, err := h.app.Services.List(domain.ServiceFilter{Type: svcType, Status: svcStatus})
			exitOnErr(err)

			w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
			fmt.Fprintf(w, "NAME\tREPO\tTYPE\tHOSTING\tSTATUS\n")
			for _, s := range svcs {
				fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\n", s.Name, s.Repo, s.Type, s.Hosting, s.Status)
			}
			w.Flush()
		},
	}
	listCmd.Flags().StringVar(&svcType, "type", "", "Filter by type")
	listCmd.Flags().StringVar(&svcStatus, "status", "", "Filter by status")

	// svc show
	showCmd := &cobra.Command{
		Use:   "show <name>",
		Short: "Show service details",
		Args:  cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			svc, err := h.app.Services.Get(args[0])
			if err != nil {
				fmt.Fprintf(os.Stderr, "not found: %s\n", args[0])
				os.Exit(1)
			}
			fmt.Printf("Name:         %s\n", svc.Name)
			fmt.Printf("Repo:         %s\n", svc.RepoName)
			fmt.Printf("Type:         %s\n", svc.Type)
			fmt.Printf("Hosting:      %s\n", svc.Hosting)
			fmt.Printf("Port:         %s\n", svc.Port)
			fmt.Printf("Protocol:     %s\n", svc.Protocol)
			fmt.Printf("Dependencies: %s\n", svc.Dependencies)
			fmt.Printf("Description:  %s\n", svc.Description)
			fmt.Printf("Status:       %s\n", svc.Status)
			if svc.Notes != "" {
				fmt.Printf("Notes:        %s\n", svc.Notes)
			}
		},
	}

	cmd.AddCommand(addCmd, listCmd, showCmd)
	return cmd
}

// --- Protocol commands ---

func (h *Handler) protoCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:     "proto",
		Aliases: []string{"protocol"},
		Short:   "Manage protocol registry",
	}

	addCmd := &cobra.Command{
		Use:   "add <name> [field=value ...]",
		Short: "Add or update a protocol",
		Args:  cobra.MinimumNArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			fields := parseKV(args[1:])
			proto := domain.Protocol{
				Name:        args[0],
				Type:        fields["type"],
				Transport:   fields["transport"],
				Port:        fields["port"],
				Encryption:  fields["encryption"],
				AuthMethod:  fields["auth"],
				UsedBy:      fields["used_by"],
				Description: fields["description"],
				Notes:       fields["notes"],
			}
			exitOnErr(h.app.Protocols.Add(proto))
			fmt.Printf("Added protocol: %s\n", args[0])
		},
	}

	listCmd := &cobra.Command{
		Use:   "list",
		Short: "List all protocols",
		Run: func(cmd *cobra.Command, args []string) {
			protos, err := h.app.Protocols.List()
			exitOnErr(err)

			w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
			fmt.Fprintf(w, "NAME\tTYPE\tTRANSPORT\tPORT\tENCRYPTION\tUSED BY\n")
			for _, p := range protos {
				fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\t%s\n", p.Name, p.Type, p.Transport, p.Port, p.Encryption, p.UsedBy)
			}
			w.Flush()
		},
	}

	cmd.AddCommand(addCmd, listCmd)
	return cmd
}

// --- Tag command ---

func (h *Handler) tagCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "tag <repo|service|protocol> <name> <tag>",
		Short: "Add a tag to an entity",
		Args:  cobra.ExactArgs(3),
		Run: func(cmd *cobra.Command, args []string) {
			exitOnErr(h.app.Tags.Add(args[0], args[1], args[2]))
			fmt.Printf("Tagged %s:%s with '%s'\n", args[0], args[1], args[2])
		},
	}
}

// --- Query command ---

func (h *Handler) queryCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "query <SQL>",
		Short: "Run a raw SQL query",
		Args:  cobra.MinimumNArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			query := strings.Join(args, " ")
			cols, rows, affected, err := h.app.Query.Run(query)
			exitOnErr(err)

			if cols != nil {
				w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
				fmt.Fprintln(w, strings.Join(cols, "\t"))
				for _, row := range rows {
					fmt.Fprintln(w, strings.Join(row, "\t"))
				}
				w.Flush()
			} else {
				fmt.Printf("OK, %d rows affected\n", affected)
			}
		},
	}
}

// --- Stats command ---

func (h *Handler) statsCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "stats",
		Short: "Show summary statistics",
		Run: func(cmd *cobra.Command, args []string) {
			stats, err := h.app.Query.Stats()
			exitOnErr(err)

			fmt.Println("=== Brain Stats ===")
			fmt.Println()
			fmt.Printf("Repos:     %d total, %d cloned\n", stats.TotalRepos, stats.ClonedRepos)

			fmt.Println("\nRepo status:")
			for _, s := range stats.ReposByStatus {
				fmt.Printf("  %-12s %d\n", s.Status, s.Count)
			}

			fmt.Println("\nRepo domains:")
			for _, d := range stats.ReposByDomain {
				fmt.Printf("  %-20s %d\n", d.Domain, d.Count)
			}

			fmt.Printf("\nServices:  %d\n", stats.ServiceCount)
			fmt.Printf("Protocols: %d\n", stats.ProtocolCount)
			fmt.Printf("Tags:      %d\n", stats.TagCount)
		},
	}
}

// --- Index command ---

func (h *Handler) indexCmd() *cobra.Command {
	var indexRoot string
	cmd := &cobra.Command{
		Use:   "index",
		Short: "Index all markdown files",
		Run: func(cmd *cobra.Command, args []string) {
			root := indexRoot
			if root == "" {
				root = h.root
			}
			if root == "" {
				fmt.Fprintln(os.Stderr, "Could not find repo root (no CLAUDE.md found). Use --root=<path>")
				os.Exit(1)
			}

			fmt.Printf("Indexing markdown files in %s\n", root)
			result, err := h.app.Documents.Index(root)
			exitOnErr(err)

			if result.Removed > 0 {
				fmt.Printf("Removed %d stale entries\n", result.Removed)
			}
			fmt.Printf("Indexed %d documents (%d catalog entries)\n", result.Total, result.Catalog)
			if result.Skipped > 0 {
				fmt.Printf("  (%d unchanged, skipped)\n", result.Skipped)
			}
		},
	}
	cmd.Flags().StringVar(&indexRoot, "root", "", "Repository root path")
	return cmd
}

// --- Helpers ---

func parseKV(args []string) map[string]string {
	fields := make(map[string]string)
	for _, kv := range args {
		parts := strings.SplitN(kv, "=", 2)
		if len(parts) == 2 {
			fields[parts[0]] = parts[1]
		}
	}
	return fields
}

func printIfSet(label, value string) {
	if value != "" {
		fmt.Printf("%s %s\n", label, value)
	}
}

func exitOnErr(err error) {
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
}
