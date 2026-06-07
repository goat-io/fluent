package app

import (
	"encoding/csv"
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/goat-io/delphi-brain/cli/internal/domain"
)

// CostService implements Phase 5 of PROPOSAL_GENERIC_TREE.md §4.7 — cost
// attribution time-series. Real provider discovery (AWS Cost Explorer, GCP
// Billing Export, Azure Cost Management) shells out to vendor CLIs and lives
// in `Discover*` methods. The CSV path is the universal fallback and the only
// one wired in this scaffold; the others return "not implemented".
type CostService struct {
	repo domain.CostRepository
}

func NewCostService(repo domain.CostRepository) *CostService {
	return &CostService{repo: repo}
}

// CSV format expected:
//
//   period_start,period_end,entity_kind,entity_name,amount,account_currency,amount_eur,account[,reason]
//
// `entity_name == ""` (or absent) marks the row as unallocated; `reason`
// becomes the unallocated row's reason column. Header row is required.
//
// Idempotent for a given (provider=csv, account, period) tuple — re-running
// over the same input replaces the slice it covers via the ON CONFLICT clause
// in cost_entries.
func (s *CostService) DiscoverCSV(path, sourceRunID string) (DiscoverResult, error) {
	f, err := os.Open(path)
	if err != nil {
		return DiscoverResult{}, fmt.Errorf("open csv: %w", err)
	}
	defer f.Close()

	r := csv.NewReader(f)
	r.FieldsPerRecord = -1 // tolerate optional `reason` column
	header, err := r.Read()
	if err != nil {
		return DiscoverResult{}, fmt.Errorf("read header: %w", err)
	}
	idx := map[string]int{}
	for i, h := range header {
		idx[strings.TrimSpace(h)] = i
	}
	required := []string{"period_start", "period_end", "amount", "account_currency", "amount_eur", "account"}
	for _, k := range required {
		if _, ok := idx[k]; !ok {
			return DiscoverResult{}, fmt.Errorf("csv missing required column: %s", k)
		}
	}

	var entries []domain.CostEntry
	var unallocated []domain.CostUnallocated
	accounts := map[string]struct{}{}
	maxPeriod := ""

	row := 1
	for {
		rec, err := r.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return DiscoverResult{}, fmt.Errorf("csv row %d: %w", row+1, err)
		}
		row++
		get := func(k string) string {
			i, ok := idx[k]
			if !ok || i >= len(rec) {
				return ""
			}
			return strings.TrimSpace(rec[i])
		}

		amount, err := strconv.ParseFloat(get("amount"), 64)
		if err != nil {
			return DiscoverResult{}, fmt.Errorf("row %d: bad amount: %w", row, err)
		}
		amountEUR, err := strconv.ParseFloat(get("amount_eur"), 64)
		if err != nil {
			return DiscoverResult{}, fmt.Errorf("row %d: bad amount_eur: %w", row, err)
		}
		entityKind := get("entity_kind")
		entityName := get("entity_name")
		account := get("account")
		periodStart := get("period_start")
		periodEnd := get("period_end")
		reason := get("reason")

		accounts[account] = struct{}{}
		if periodStart > maxPeriod {
			maxPeriod = periodStart
		}

		if entityName == "" {
			if reason == "" {
				reason = "missing-brain:catalog-entry"
			}
			unallocated = append(unallocated, domain.CostUnallocated{
				PeriodStart:     periodStart,
				PeriodEnd:       periodEnd,
				Amount:          amount,
				AccountCurrency: get("account_currency"),
				AmountEUR:       amountEUR,
				Account:         account,
				Reason:          reason,
				Source:          "csv",
				SourceRunID:     sourceRunID,
			})
			continue
		}

		entries = append(entries, domain.CostEntry{
			EntityKind:      entityKind,
			EntityName:      entityName,
			PeriodStart:     periodStart,
			PeriodEnd:       periodEnd,
			Amount:          amount,
			AccountCurrency: get("account_currency"),
			AmountEUR:       amountEUR,
			Account:         account,
			Source:          "csv",
			SourceRunID:     sourceRunID,
		})
	}

	n, err := s.repo.UpsertEntries(entries)
	if err != nil {
		return DiscoverResult{}, fmt.Errorf("upsert entries: %w", err)
	}
	for _, u := range unallocated {
		if err := s.repo.UpsertUnallocated(u); err != nil {
			return DiscoverResult{}, fmt.Errorf("upsert unallocated: %w", err)
		}
	}

	// Heartbeat — one cost_sources row per (csv, account) pair.
	for account := range accounts {
		_ = s.repo.UpsertSource(domain.CostSource{
			Source:     "csv",
			Account:    account,
			LastPeriod: maxPeriod,
			Status:     "ok",
		})
	}

	return DiscoverResult{
		EntriesIngested:     n,
		UnallocatedIngested: len(unallocated),
		Accounts:            len(accounts),
		At:                  time.Now().UTC().Format(time.RFC3339),
	}, nil
}

// DiscoverAWS — placeholder. Real impl shells `aws ce get-cost-and-usage` with
// `--group-by Type=TAG,Key=brain:catalog-entry` and inserts the rows.
// Documented in PROPOSAL_GENERIC_TREE.md §4.7.2.
func (s *CostService) DiscoverAWS(account, from, to string) (DiscoverResult, error) {
	return DiscoverResult{}, fmt.Errorf("aws discovery not implemented in this scaffold; use --provider csv with `aws ce get-cost-and-usage --output json | jq` precomputation, or wait for the AWS adapter")
}

// DiscoverGCP — placeholder. Real impl runs `bq query` against the billing
// export dataset.
func (s *CostService) DiscoverGCP(billingAccount, from, to string) (DiscoverResult, error) {
	return DiscoverResult{}, fmt.Errorf("gcp discovery not implemented in this scaffold")
}

// DiscoverResult — discovery summary returned to the CLI / API caller.
type DiscoverResult struct {
	EntriesIngested     int    `json:"entriesIngested"`
	UnallocatedIngested int    `json:"unallocatedIngested"`
	Accounts            int    `json:"accounts"`
	At                  string `json:"at"`
}

// Read-side passthroughs.

func (s *CostService) ListEntries(f domain.CostFilter) ([]domain.CostEntry, error) {
	return s.repo.ListEntries(f)
}

func (s *CostService) RollupByEntity(kind, name, from, to string) (domain.CostRollup, error) {
	return s.repo.RollupByEntity(kind, name, from, to)
}

func (s *CostService) ListUnallocated(from, to string) ([]domain.CostUnallocated, error) {
	return s.repo.ListUnallocated(from, to)
}

func (s *CostService) ListSources() ([]domain.CostSource, error) {
	return s.repo.ListSources()
}

func (s *CostService) GetBudget(kind, name, period string) (*domain.CostBudget, error) {
	return s.repo.GetBudget(kind, name, period)
}

func (s *CostService) SetBudget(b domain.CostBudget) error {
	return s.repo.UpsertBudget(b)
}
