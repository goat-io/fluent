package sqlite

import (
	"database/sql"
	"fmt"

	"github.com/goat-io/delphi-brain/cli/internal/domain"
)

type QueryRunner struct {
	db *sql.DB
}

func NewQueryRunner(db *sql.DB) *QueryRunner {
	return &QueryRunner{db: db}
}

func (q *QueryRunner) Select(query string) ([]string, [][]string, error) {
	rows, err := q.db.Query(query)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	cols, _ := rows.Columns()
	var result [][]string

	vals := make([]interface{}, len(cols))
	ptrs := make([]interface{}, len(cols))
	for i := range vals {
		ptrs[i] = &vals[i]
	}

	for rows.Next() {
		rows.Scan(ptrs...)
		row := make([]string, len(cols))
		for i, v := range vals {
			if v == nil {
				row[i] = ""
			} else {
				row[i] = fmt.Sprintf("%v", v)
			}
		}
		result = append(result, row)
	}

	return cols, result, nil
}

func (q *QueryRunner) Exec(query string) (int64, error) {
	result, err := q.db.Exec(query)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

func (q *QueryRunner) BrainStats() (*domain.BrainStats, error) {
	stats := &domain.BrainStats{}

	q.db.QueryRow("SELECT COUNT(*), SUM(cloned) FROM repos").Scan(&stats.TotalRepos, &stats.ClonedRepos)

	rows, _ := q.db.Query("SELECT status, COUNT(*) FROM repos GROUP BY status ORDER BY COUNT(*) DESC")
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var s string
			var c int
			rows.Scan(&s, &c)
			stats.ReposByStatus = append(stats.ReposByStatus, domain.StatusCount{Status: s, Count: c})
		}
	}

	rows2, _ := q.db.Query("SELECT domain, COUNT(*) FROM repos WHERE domain != 'unknown' GROUP BY domain ORDER BY COUNT(*) DESC")
	if rows2 != nil {
		defer rows2.Close()
		for rows2.Next() {
			var s string
			var c int
			rows2.Scan(&s, &c)
			stats.ReposByDomain = append(stats.ReposByDomain, domain.DomainCount{Domain: s, Count: c})
		}
	}

	q.db.QueryRow("SELECT COUNT(*) FROM services").Scan(&stats.ServiceCount)
	q.db.QueryRow("SELECT COUNT(*) FROM protocols").Scan(&stats.ProtocolCount)
	q.db.QueryRow("SELECT COUNT(*) FROM tags").Scan(&stats.TagCount)

	return stats, nil
}
