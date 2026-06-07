package sqlite

import (
	"database/sql"

	_ "github.com/mattn/go-sqlite3"
)

// Open connects to the SQLite database and initializes the core schema.
func Open(dbPath string) (*sql.DB, error) {
	db, err := sql.Open("sqlite3", dbPath+"?_journal_mode=WAL&_foreign_keys=on")
	if err != nil {
		return nil, err
	}

	if err := initSchema(db); err != nil {
		db.Close()
		return nil, err
	}

	return db, nil
}

func initSchema(db *sql.DB) error {
	schema := `
	CREATE TABLE IF NOT EXISTS repos (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT UNIQUE NOT NULL,
		github_url TEXT NOT NULL,
		domain TEXT NOT NULL DEFAULT 'unknown',
		description TEXT DEFAULT '',
		status TEXT DEFAULT 'unknown' CHECK(status IN ('active','maintained','stale','dead','archived','unknown')),
		language TEXT DEFAULT '',
		team TEXT DEFAULT '',
		system TEXT DEFAULT '',
		lifecycle TEXT DEFAULT '',
		depends_on TEXT DEFAULT '',
		provides_apis TEXT DEFAULT '',
		consumes_apis TEXT DEFAULT '',
		tags TEXT DEFAULT '',
		links TEXT DEFAULT '',
		collaborators TEXT DEFAULT '',
		deployment TEXT DEFAULT '',
		observability TEXT DEFAULT '',
		security TEXT DEFAULT '',
		cloned INTEGER DEFAULT 0,
		local_path TEXT DEFAULT '',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS services (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT UNIQUE NOT NULL,
		repo_name TEXT REFERENCES repos(name),
		type TEXT DEFAULT 'service' CHECK(type IN ('service','library','frontend','firmware','lambda','tool','infrastructure','other')),
		hosting TEXT DEFAULT '',
		port TEXT DEFAULT '',
		protocol TEXT DEFAULT '',
		dependencies TEXT DEFAULT '',
		description TEXT DEFAULT '',
		status TEXT DEFAULT 'unknown' CHECK(status IN ('production','staging','development','deprecated','dead','unknown')),
		notes TEXT DEFAULT '',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS protocols (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT UNIQUE NOT NULL,
		type TEXT DEFAULT '' CHECK(type IN ('custom','standard','hybrid','')),
		transport TEXT DEFAULT '',
		port TEXT DEFAULT '',
		encryption TEXT DEFAULT '',
		auth_method TEXT DEFAULT '',
		used_by TEXT DEFAULT '',
		description TEXT DEFAULT '',
		notes TEXT DEFAULT '',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS tags (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		entity_type TEXT NOT NULL CHECK(entity_type IN ('repo','service','protocol')),
		entity_name TEXT NOT NULL,
		tag TEXT NOT NULL,
		UNIQUE(entity_type, entity_name, tag)
	);

	-- Phase 5 (PROPOSAL_GENERIC_TREE.md §4.7) — cost attribution time-series.
	-- Cloud spend → catalog entity. amount kept in source currency for audit;
	-- amount_eur normalized for cross-account aggregation.
	CREATE TABLE IF NOT EXISTS cost_entries (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		entity_kind TEXT NOT NULL,
		entity_name TEXT NOT NULL,
		period_start TEXT NOT NULL,
		period_end TEXT NOT NULL,
		amount REAL NOT NULL,
		account_currency TEXT NOT NULL,
		amount_eur REAL NOT NULL,
		account TEXT NOT NULL,
		source TEXT NOT NULL,
		source_run_id TEXT DEFAULT '',
		metadata TEXT DEFAULT '',
		ingested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		UNIQUE (entity_kind, entity_name, period_start, account, source)
	);
	CREATE INDEX IF NOT EXISTS cost_entries_period ON cost_entries(period_start, period_end);
	CREATE INDEX IF NOT EXISTS cost_entries_entity ON cost_entries(entity_kind, entity_name);
	CREATE INDEX IF NOT EXISTS cost_entries_account ON cost_entries(account, period_start);

	-- Spend that couldn't be attributed (no tag, malformed tag, untagged
	-- resource). Kept separate so reporting can show "your unallocated %"
	-- without contaminating attributed totals.
	CREATE TABLE IF NOT EXISTS cost_unallocated (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		period_start TEXT NOT NULL,
		period_end TEXT NOT NULL,
		amount REAL NOT NULL,
		account_currency TEXT NOT NULL,
		amount_eur REAL NOT NULL,
		account TEXT NOT NULL,
		reason TEXT DEFAULT '',
		resource_id TEXT DEFAULT '',
		source TEXT NOT NULL,
		source_run_id TEXT DEFAULT '',
		metadata TEXT DEFAULT '',
		ingested_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	CREATE INDEX IF NOT EXISTS cost_unallocated_period ON cost_unallocated(period_start, period_end);

	-- Discovery-job heartbeats. Surface stale ingests to the user before they
	-- look at numbers and trust them.
	CREATE TABLE IF NOT EXISTS cost_sources (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		source TEXT NOT NULL,
		account TEXT NOT NULL,
		last_run_at DATETIME,
		last_period TEXT DEFAULT '',
		status TEXT NOT NULL CHECK(status IN ('ok','partial','failed')),
		error TEXT DEFAULT '',
		UNIQUE (source, account)
	);

	-- Budgets per entity, used by /api/cost/budgets/:kind/:name.
	CREATE TABLE IF NOT EXISTS cost_budgets (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		entity_kind TEXT NOT NULL,
		entity_name TEXT NOT NULL,
		period TEXT NOT NULL CHECK(period IN ('monthly','quarterly')),
		amount_eur REAL NOT NULL,
		warn_at_pct INTEGER NOT NULL DEFAULT 80,
		set_by TEXT DEFAULT '',
		UNIQUE (entity_kind, entity_name, period)
	);
	`
	_, err := db.Exec(schema)
	if err != nil {
		return err
	}

	// Migrate existing databases: add columns if missing
	migrations := []string{
		"ALTER TABLE repos ADD COLUMN system TEXT DEFAULT ''",
		"ALTER TABLE repos ADD COLUMN lifecycle TEXT DEFAULT ''",
		"ALTER TABLE repos ADD COLUMN depends_on TEXT DEFAULT ''",
		"ALTER TABLE repos ADD COLUMN provides_apis TEXT DEFAULT ''",
		"ALTER TABLE repos ADD COLUMN consumes_apis TEXT DEFAULT ''",
		"ALTER TABLE repos ADD COLUMN tags TEXT DEFAULT ''",
		"ALTER TABLE repos ADD COLUMN links TEXT DEFAULT ''",
		"ALTER TABLE repos ADD COLUMN collaborators TEXT DEFAULT ''",
		"ALTER TABLE repos ADD COLUMN deployment TEXT DEFAULT ''",
		"ALTER TABLE repos ADD COLUMN observability TEXT DEFAULT ''",
		"ALTER TABLE repos ADD COLUMN security TEXT DEFAULT ''",
	}
	for _, m := range migrations {
		db.Exec(m) // ignore "duplicate column" errors
	}

	return nil
}
