package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"

	"github.com/goat-io/delphi-brain/cli/internal/adapter/cli"
	"github.com/goat-io/delphi-brain/cli/internal/adapter/github"
	"github.com/goat-io/delphi-brain/cli/internal/adapter/httpapi"
	"github.com/goat-io/delphi-brain/cli/internal/adapter/ollama"
	"github.com/goat-io/delphi-brain/cli/internal/adapter/sqlite"
	"github.com/goat-io/delphi-brain/cli/internal/app"
	"github.com/goat-io/delphi-brain/cli/internal/domain"
)

func main() {
	root := findRepoRoot()
	// DB path: BRAIN_DB env wins; otherwise it lives at the instance root.
	dbPath := os.Getenv("BRAIN_DB")
	if dbPath == "" {
		dbPath = filepath.Join(root, "brain.db")
	}

	// Infrastructure: open database
	db, err := sqlite.Open(dbPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "db error: %v\n", err)
		os.Exit(1)
	}
	defer db.Close()

	// Driven adapters (outbound)
	repoRepo := sqlite.NewRepoRepository(db)
	svcRepo := sqlite.NewServiceRepository(db)
	protoRepo := sqlite.NewProtocolRepository(db)
	tagRepo := sqlite.NewTagRepository(db)
	docRepo := sqlite.NewDocumentRepository(db)
	queryRunner := sqlite.NewQueryRunner(db)
	costRepo := sqlite.NewCostRepository(db)
	ragRepo := sqlite.NewRAGRepository(db)
	ragRepo.InitSchema() // Phase D table; ignore error so existing dbs keep working
	ghClient := github.NewClient()
	embedder := ollama.New()

	reposDir := filepath.Join(root, "repos")

	// Application layer
	application := app.New(repoRepo, svcRepo, protoRepo, tagRepo, docRepo, queryRunner, costRepo, ghClient, ragRepo, embedder, reposDir, root)
	application.PostInit(root)

	// Driving adapters
	handler := cli.NewHandler(application, root)
	rootCmd := handler.RootCmd()

	// Add serve command (needs HTTP adapter, wired here)
	rootCmd.AddCommand(serveCmd(application, root))
	rootCmd.AddCommand(costCmd(application))

	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}

func serveCmd(application *app.App, defaultRoot string) *cobra.Command {
	var port, root string
	cmd := &cobra.Command{
		Use:   "serve",
		Short: "Start the HTTP API server",
		Run: func(cmd *cobra.Command, args []string) {
			if root == "" {
				root = defaultRoot
			}
			server := httpapi.NewServer(application, root, port)
			if err := server.Start(); err != nil {
				fmt.Fprintf(os.Stderr, "server error: %v\n", err)
				os.Exit(1)
			}
		},
	}
	cmd.Flags().StringVar(&port, "port", domain.DefaultPort, "Port to listen on")
	cmd.Flags().StringVar(&root, "root", "", "Repository root path")
	return cmd
}

func costCmd(application *app.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "cost",
		Short: "Cost attribution — discover, query, budget (Phase 5 of PROPOSAL_GENERIC_TREE.md §4.7)",
	}

	// brain cost discover --provider csv --file path/to/spend.csv
	var provider, file, account, fromDate, toDate, runID string
	discover := &cobra.Command{
		Use:   "discover",
		Short: "Ingest cost data from a provider (csv|aws|gcp)",
		RunE: func(cmd *cobra.Command, args []string) error {
			switch provider {
			case "csv":
				if file == "" {
					return fmt.Errorf("--file required for csv provider")
				}
				if runID == "" {
					runID = fmt.Sprintf("csv-%d", os.Getpid())
				}
				res, err := application.Cost.DiscoverCSV(file, runID)
				if err != nil {
					return err
				}
				fmt.Printf("Ingested %d entries, %d unallocated rows across %d accounts (run=%s, at=%s)\n",
					res.EntriesIngested, res.UnallocatedIngested, res.Accounts, runID, res.At)
				return nil
			case "aws":
				_, err := application.Cost.DiscoverAWS(account, fromDate, toDate)
				return err
			case "gcp":
				_, err := application.Cost.DiscoverGCP(account, fromDate, toDate)
				return err
			default:
				return fmt.Errorf("unknown provider: %s (csv|aws|gcp)", provider)
			}
		},
	}
	discover.Flags().StringVar(&provider, "provider", "csv", "csv|aws|gcp")
	discover.Flags().StringVar(&file, "file", "", "CSV input path (csv provider)")
	discover.Flags().StringVar(&account, "account", "", "Account / billing-account / subscription id (aws/gcp)")
	discover.Flags().StringVar(&fromDate, "from", "", "Start period (ISO date)")
	discover.Flags().StringVar(&toDate, "to", "", "End period (ISO date)")
	discover.Flags().StringVar(&runID, "run-id", "", "Optional source-run identifier (defaults to csv-<pid>)")
	cmd.AddCommand(discover)

	// brain cost stats
	stats := &cobra.Command{
		Use:   "stats",
		Short: "Show ingest health + totals",
		RunE: func(cmd *cobra.Command, args []string) error {
			sources, err := application.Cost.ListSources()
			if err != nil {
				return err
			}
			fmt.Printf("Cost sources (%d):\n", len(sources))
			for _, s := range sources {
				fmt.Printf("  %-12s %-30s %s  last_period=%s  %s\n", s.Source, s.Account, s.Status, s.LastPeriod, s.LastRunAt)
			}
			unalloc, _ := application.Cost.ListUnallocated("", "")
			var total float64
			for _, u := range unalloc {
				total += u.AmountEUR
			}
			fmt.Printf("\nUnallocated: %d rows totalling %.2f EUR\n", len(unalloc), total)
			return nil
		},
	}
	cmd.AddCommand(stats)

	return cmd
}

// isInstanceRoot reports whether dir looks like a Brain instance root — i.e. it
// carries a config file or the framework's schema dir. Company-agnostic: no
// dependency on any particular repo marker (e.g. CLAUDE.md).
func isInstanceRoot(dir string) bool {
	for _, marker := range []string{"brain.config.json", "brain.config.example.json", "schema/kinds-registry.json", "CLAUDE.md"} {
		if _, err := os.Stat(filepath.Join(dir, marker)); err == nil {
			return true
		}
	}
	return false
}

// findRepoRoot locates the Brain instance root. Precedence: BRAIN_ROOT env, the
// binary's package dir, then the nearest ancestor of cwd that looks like an
// instance root.
func findRepoRoot() string {
	if v := os.Getenv("BRAIN_ROOT"); v != "" {
		return v
	}

	// Try from binary location (…/<pkg>/cli/brain → …/<pkg>)
	if abs, err := filepath.Abs(filepath.Join(filepath.Dir(os.Args[0]), "..")); err == nil && isInstanceRoot(abs) {
		return abs
	}

	// Walk up from cwd
	cwd, _ := os.Getwd()
	for d := cwd; d != "/" && d != "."; d = filepath.Dir(d) {
		if isInstanceRoot(d) {
			return d
		}
	}

	// Fallback to cwd
	return cwd
}
