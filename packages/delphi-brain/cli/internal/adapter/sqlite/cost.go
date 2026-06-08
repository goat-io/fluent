package sqlite

import (
	"database/sql"
	"fmt"

	"github.com/goat-io/delphi-brain/cli/internal/domain"
)

// CostRepository implements domain.CostRepository against the cost_* tables in
// brain.db. Schema lives in sqlite.go initSchema().
type CostRepository struct {
	db *sql.DB
}

func NewCostRepository(db *sql.DB) *CostRepository {
	return &CostRepository{db: db}
}

func (r *CostRepository) UpsertEntry(e domain.CostEntry) error {
	_, err := r.db.Exec(`
		INSERT INTO cost_entries
		  (entity_kind, entity_name, period_start, period_end, amount,
		   account_currency, amount_eur, account, source, source_run_id, metadata)
		VALUES (?,?,?,?,?,?,?,?,?,?,?)
		ON CONFLICT (entity_kind, entity_name, period_start, account, source) DO UPDATE SET
		  period_end       = excluded.period_end,
		  amount           = excluded.amount,
		  account_currency = excluded.account_currency,
		  amount_eur       = excluded.amount_eur,
		  source_run_id    = excluded.source_run_id,
		  metadata         = excluded.metadata,
		  ingested_at      = CURRENT_TIMESTAMP
	`,
		e.EntityKind, e.EntityName, e.PeriodStart, e.PeriodEnd, e.Amount,
		e.AccountCurrency, e.AmountEUR, e.Account, e.Source, e.SourceRunID, e.Metadata,
	)
	return err
}

func (r *CostRepository) UpsertEntries(es []domain.CostEntry) (int, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()
	stmt, err := tx.Prepare(`
		INSERT INTO cost_entries
		  (entity_kind, entity_name, period_start, period_end, amount,
		   account_currency, amount_eur, account, source, source_run_id, metadata)
		VALUES (?,?,?,?,?,?,?,?,?,?,?)
		ON CONFLICT (entity_kind, entity_name, period_start, account, source) DO UPDATE SET
		  period_end       = excluded.period_end,
		  amount           = excluded.amount,
		  account_currency = excluded.account_currency,
		  amount_eur       = excluded.amount_eur,
		  source_run_id    = excluded.source_run_id,
		  metadata         = excluded.metadata,
		  ingested_at      = CURRENT_TIMESTAMP
	`)
	if err != nil {
		return 0, err
	}
	defer stmt.Close()
	n := 0
	for _, e := range es {
		if _, err := stmt.Exec(
			e.EntityKind, e.EntityName, e.PeriodStart, e.PeriodEnd, e.Amount,
			e.AccountCurrency, e.AmountEUR, e.Account, e.Source, e.SourceRunID, e.Metadata,
		); err != nil {
			return n, err
		}
		n++
	}
	return n, tx.Commit()
}

func (r *CostRepository) ListEntries(f domain.CostFilter) ([]domain.CostEntry, error) {
	q := `SELECT id, entity_kind, entity_name, period_start, period_end, amount,
	             account_currency, amount_eur, account, source,
	             COALESCE(source_run_id,''), COALESCE(metadata,''),
	             COALESCE(ingested_at,'')
	      FROM cost_entries WHERE 1=1`
	args := []any{}
	if f.EntityKind != "" {
		q += " AND entity_kind = ?"
		args = append(args, f.EntityKind)
	}
	if f.EntityName != "" {
		q += " AND entity_name = ?"
		args = append(args, f.EntityName)
	}
	if f.Account != "" {
		q += " AND account = ?"
		args = append(args, f.Account)
	}
	if f.Source != "" {
		q += " AND source = ?"
		args = append(args, f.Source)
	}
	if f.From != "" {
		q += " AND period_start >= ?"
		args = append(args, f.From)
	}
	if f.To != "" {
		q += " AND period_end <= ?"
		args = append(args, f.To)
	}
	q += " ORDER BY period_start, entity_name"

	rows, err := r.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.CostEntry{}
	for rows.Next() {
		var e domain.CostEntry
		if err := rows.Scan(&e.ID, &e.EntityKind, &e.EntityName, &e.PeriodStart, &e.PeriodEnd,
			&e.Amount, &e.AccountCurrency, &e.AmountEUR, &e.Account, &e.Source,
			&e.SourceRunID, &e.Metadata, &e.IngestedAt); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, nil
}

func (r *CostRepository) RollupByEntity(kind, name, from, to string) (domain.CostRollup, error) {
	return r.rollup("entity_kind = ? AND entity_name = ?", []any{kind, name}, from, to)
}

func (r *CostRepository) RollupByField(field, value, from, to string) (domain.CostRollup, error) {
	// Whitelist allowed fields to avoid SQL injection.
	switch field {
	case "account", "source", "entity_kind":
		return r.rollup(field+" = ?", []any{value}, from, to)
	default:
		return domain.CostRollup{}, fmt.Errorf("unsupported rollup field: %s", field)
	}
}

func (r *CostRepository) rollup(where string, args []any, from, to string) (domain.CostRollup, error) {
	q := "SELECT COALESCE(SUM(amount_eur),0), COUNT(*), COALESCE(MIN(period_start),''), COALESCE(MAX(period_end),'') FROM cost_entries WHERE " + where
	if from != "" {
		q += " AND period_start >= ?"
		args = append(args, from)
	}
	if to != "" {
		q += " AND period_end <= ?"
		args = append(args, to)
	}
	var ru domain.CostRollup
	if err := r.db.QueryRow(q, args...).Scan(&ru.TotalEUR, &ru.EntryCount, &ru.PeriodStart, &ru.PeriodEnd); err != nil {
		return ru, err
	}

	// Per-account breakdown
	q2 := "SELECT account, SUM(amount_eur) FROM cost_entries WHERE " + where
	if from != "" {
		q2 += " AND period_start >= ?"
	}
	if to != "" {
		q2 += " AND period_end <= ?"
	}
	q2 += " GROUP BY account ORDER BY 2 DESC"
	rows, err := r.db.Query(q2, args...)
	if err != nil {
		return ru, err
	}
	defer rows.Close()
	for rows.Next() {
		var acc string
		var amt float64
		if err := rows.Scan(&acc, &amt); err != nil {
			return ru, err
		}
		ru.ByAccount = append(ru.ByAccount, struct {
			Account   string
			AmountEUR float64
		}{acc, amt})
	}
	return ru, nil
}

func (r *CostRepository) UpsertUnallocated(u domain.CostUnallocated) error {
	_, err := r.db.Exec(`
		INSERT INTO cost_unallocated
		  (period_start, period_end, amount, account_currency, amount_eur, account,
		   reason, resource_id, source, source_run_id, metadata)
		VALUES (?,?,?,?,?,?,?,?,?,?,?)
	`,
		u.PeriodStart, u.PeriodEnd, u.Amount, u.AccountCurrency, u.AmountEUR, u.Account,
		u.Reason, u.ResourceID, u.Source, u.SourceRunID, u.Metadata,
	)
	return err
}

func (r *CostRepository) ListUnallocated(from, to string) ([]domain.CostUnallocated, error) {
	q := `SELECT id, period_start, period_end, amount, account_currency, amount_eur,
	             account, COALESCE(reason,''), COALESCE(resource_id,''), source,
	             COALESCE(source_run_id,''), COALESCE(metadata,''), COALESCE(ingested_at,'')
	      FROM cost_unallocated WHERE 1=1`
	args := []any{}
	if from != "" {
		q += " AND period_start >= ?"
		args = append(args, from)
	}
	if to != "" {
		q += " AND period_end <= ?"
		args = append(args, to)
	}
	q += " ORDER BY period_start"
	rows, err := r.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.CostUnallocated{}
	for rows.Next() {
		var u domain.CostUnallocated
		if err := rows.Scan(&u.ID, &u.PeriodStart, &u.PeriodEnd, &u.Amount, &u.AccountCurrency,
			&u.AmountEUR, &u.Account, &u.Reason, &u.ResourceID, &u.Source, &u.SourceRunID,
			&u.Metadata, &u.IngestedAt); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, nil
}

func (r *CostRepository) UpsertSource(s domain.CostSource) error {
	_, err := r.db.Exec(`
		INSERT INTO cost_sources (source, account, last_run_at, last_period, status, error)
		VALUES (?,?,CURRENT_TIMESTAMP,?,?,?)
		ON CONFLICT (source, account) DO UPDATE SET
		  last_run_at = CURRENT_TIMESTAMP,
		  last_period = excluded.last_period,
		  status      = excluded.status,
		  error       = excluded.error
	`, s.Source, s.Account, s.LastPeriod, s.Status, s.Error)
	return err
}

func (r *CostRepository) ListSources() ([]domain.CostSource, error) {
	rows, err := r.db.Query(`SELECT source, account, COALESCE(last_run_at,''),
	    COALESCE(last_period,''), status, COALESCE(error,'') FROM cost_sources ORDER BY source, account`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.CostSource{}
	for rows.Next() {
		var s domain.CostSource
		if err := rows.Scan(&s.Source, &s.Account, &s.LastRunAt, &s.LastPeriod, &s.Status, &s.Error); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, nil
}

func (r *CostRepository) UpsertBudget(b domain.CostBudget) error {
	_, err := r.db.Exec(`
		INSERT INTO cost_budgets (entity_kind, entity_name, period, amount_eur, warn_at_pct, set_by)
		VALUES (?,?,?,?,?,?)
		ON CONFLICT (entity_kind, entity_name, period) DO UPDATE SET
		  amount_eur  = excluded.amount_eur,
		  warn_at_pct = excluded.warn_at_pct,
		  set_by      = excluded.set_by
	`, b.EntityKind, b.EntityName, b.Period, b.AmountEUR, b.WarnAtPct, b.SetBy)
	return err
}

func (r *CostRepository) GetBudget(kind, name, period string) (*domain.CostBudget, error) {
	var b domain.CostBudget
	err := r.db.QueryRow(`SELECT entity_kind, entity_name, period, amount_eur, warn_at_pct, COALESCE(set_by,'')
	    FROM cost_budgets WHERE entity_kind=? AND entity_name=? AND period=?`,
		kind, name, period).Scan(&b.EntityKind, &b.EntityName, &b.Period, &b.AmountEUR, &b.WarnAtPct, &b.SetBy)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &b, nil
}
