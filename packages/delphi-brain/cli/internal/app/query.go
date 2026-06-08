package app

import (
	"strings"

	"github.com/goat-io/delphi-brain/cli/internal/domain"
)

type QueryService struct {
	runner domain.QueryRunner
}

func NewQueryService(runner domain.QueryRunner) *QueryService {
	return &QueryService{runner: runner}
}

// Run executes a raw SQL query. Returns columns+rows for SELECT, or affected count for DML.
func (s *QueryService) Run(query string) (cols []string, rows [][]string, affected int64, err error) {
	if strings.HasPrefix(strings.ToUpper(strings.TrimSpace(query)), "SELECT") {
		cols, rows, err = s.runner.Select(query)
		return
	}
	affected, err = s.runner.Exec(query)
	return
}

func (s *QueryService) Select(query string) ([]string, [][]string, error) {
	return s.runner.Select(query)
}

func (s *QueryService) Stats() (*domain.BrainStats, error) {
	return s.runner.BrainStats()
}
