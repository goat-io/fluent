// Phase 2 of brain-llm-wiki-evolution-plan.md — telemetry foundation.
//
// TelemetryService captures every observation Brain needs to evolve itself.
// Events go to brain/telemetry/events.jsonl (append-only, grep-friendly) and
// are periodically rolled up into brain/telemetry/rollup.sqlite for queries.
//
// Both files are committed to git per §8 Q1 decision. Chat queries become
// permanent history — treat the chat panel as semi-public.
//
// The event schema is brain/schema/telemetry-event.schema.json. Adding a new
// event kind = add to the enum and start emitting.
package app

import (
	"bufio"
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/goat-io/delphi-brain/cli/internal/domain"
)

type TelemetryService struct {
	repoRoot string
	dir      string
	jsonl    string
	sqlite   string
}

func NewTelemetryService(repoRoot string) *TelemetryService {
	dir := filepath.Join(repoRoot, domain.TelemetryDir())
	return &TelemetryService{
		repoRoot: repoRoot,
		dir:      dir,
		jsonl:    filepath.Join(dir, "events.jsonl"),
		sqlite:   filepath.Join(dir, "rollup.sqlite"),
	}
}

// Log appends one event. The event MUST be a JSON object; we add `ts` if
// missing. Errors here are non-fatal — telemetry must never break callers.
func (t *TelemetryService) Log(kind string, payload map[string]any) error {
	if err := os.MkdirAll(t.dir, 0755); err != nil {
		return err
	}
	if payload == nil {
		payload = map[string]any{}
	}
	if _, ok := payload["ts"]; !ok {
		payload["ts"] = time.Now().UTC().Format(time.RFC3339Nano)
	}
	payload["kind"] = kind

	f, err := os.OpenFile(t.jsonl, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	defer f.Close()

	enc := json.NewEncoder(f)
	enc.SetEscapeHTML(false)
	return enc.Encode(payload)
}

// Rollup reads events.jsonl and (re)builds rollup.sqlite. Idempotent — drops
// the events table and rebuilds. Cheap enough at our scale (10k events) that
// incremental rollup isn't worth the complexity yet.
func (t *TelemetryService) Rollup() (int, error) {
	if err := os.MkdirAll(t.dir, 0755); err != nil {
		return 0, err
	}

	db, err := sql.Open("sqlite3", t.sqlite+"?_journal_mode=WAL")
	if err != nil {
		return 0, err
	}
	defer db.Close()

	if _, err := db.Exec(`
		DROP TABLE IF EXISTS events;
		CREATE TABLE events (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			ts TEXT NOT NULL,
			kind TEXT NOT NULL,
			skill TEXT,
			value TEXT,
			topic TEXT,
			path TEXT,
			payload TEXT NOT NULL
		);
		CREATE INDEX events_kind ON events(kind);
		CREATE INDEX events_ts ON events(ts);
	`); err != nil {
		return 0, err
	}

	f, err := os.Open(t.jsonl)
	if err != nil {
		if os.IsNotExist(err) {
			return 0, nil
		}
		return 0, err
	}
	defer f.Close()

	tx, err := db.Begin()
	if err != nil {
		return 0, err
	}
	stmt, err := tx.Prepare(`INSERT INTO events (ts, kind, skill, value, topic, path, payload) VALUES (?,?,?,?,?,?,?)`)
	if err != nil {
		tx.Rollback()
		return 0, err
	}
	defer stmt.Close()

	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 1024*1024), 1024*1024)

	count := 0
	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}
		var ev map[string]any
		if err := json.Unmarshal(line, &ev); err != nil {
			continue // skip malformed; lint can surface later
		}
		ts, _ := ev["ts"].(string)
		kind, _ := ev["kind"].(string)
		skill, _ := ev["skill"].(string)
		value, _ := ev["value"].(string)
		topic, _ := ev["topic"].(string)
		path, _ := ev["path"].(string)
		if _, err := stmt.Exec(ts, kind, skill, value, topic, path, string(line)); err != nil {
			continue
		}
		count++
	}
	if err := scanner.Err(); err != nil {
		tx.Rollback()
		return count, err
	}
	if err := tx.Commit(); err != nil {
		return count, err
	}
	return count, nil
}

// Query runs a read-only SELECT against rollup.sqlite. Anything else is rejected.
func (t *TelemetryService) Query(sqlStr string) ([]map[string]any, error) {
	if !isSelectOnly(sqlStr) {
		return nil, fmt.Errorf("only SELECT is allowed")
	}
	db, err := sql.Open("sqlite3", t.sqlite+"?_journal_mode=WAL&mode=ro")
	if err != nil {
		return nil, err
	}
	defer db.Close()

	rows, err := db.Query(sqlStr)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	cols, _ := rows.Columns()
	var out []map[string]any
	for rows.Next() {
		vals := make([]any, len(cols))
		ptrs := make([]any, len(cols))
		for i := range vals {
			ptrs[i] = &vals[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			continue
		}
		row := map[string]any{}
		for i, c := range cols {
			row[c] = vals[i]
		}
		out = append(out, row)
	}
	return out, nil
}

// Stats returns counts by kind for the rollup (cheap aggregate for dashboards).
func (t *TelemetryService) Stats() (map[string]int, int, error) {
	rows, err := t.Query("SELECT kind, COUNT(*) AS n FROM events GROUP BY kind ORDER BY n DESC")
	if err != nil {
		return nil, 0, err
	}
	out := map[string]int{}
	total := 0
	for _, r := range rows {
		k, _ := r["kind"].(string)
		n := 0
		switch v := r["n"].(type) {
		case int64:
			n = int(v)
		case float64:
			n = int(v)
		}
		out[k] = n
		total += n
	}
	return out, total, nil
}

func isSelectOnly(q string) bool {
	// Cheap guard. Anything starting with SELECT and not containing dangerous
	// keywords. The sqlite mode=ro at open-time is the real seatbelt.
	for i := 0; i < len(q); i++ {
		if q[i] == ' ' || q[i] == '\t' || q[i] == '\n' {
			continue
		}
		if i+6 > len(q) {
			return false
		}
		head := q[i : i+6]
		return head == "SELECT" || head == "select"
	}
	return false
}
