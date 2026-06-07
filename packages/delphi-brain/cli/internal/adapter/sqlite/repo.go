package sqlite

import (
	"database/sql"
	"fmt"

	"github.com/goat-io/delphi-brain/cli/internal/domain"
)

type RepoRepository struct {
	db *sql.DB
}

func NewRepoRepository(db *sql.DB) *RepoRepository {
	return &RepoRepository{db: db}
}

func (r *RepoRepository) Upsert(repo domain.Repo) error {
	_, err := r.db.Exec(
		`INSERT INTO repos (name, github_url, domain) VALUES (?, ?, ?)
		ON CONFLICT(name) DO UPDATE SET github_url=excluded.github_url, domain=excluded.domain, updated_at=CURRENT_TIMESTAMP`,
		repo.Name, repo.GitHubURL, repo.Domain)
	return err
}

func (r *RepoRepository) UpsertBatch(repos []domain.Repo) (int, error) {
	stmt, err := r.db.Prepare(
		`INSERT INTO repos (name, github_url, description, language, status, domain, team)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(name) DO UPDATE SET
			github_url=excluded.github_url,
			description=excluded.description,
			language=excluded.language,
			status=excluded.status,
			domain=CASE WHEN excluded.domain != 'unknown' AND excluded.domain != '' THEN excluded.domain ELSE repos.domain END,
			team=CASE WHEN excluded.team != '' THEN excluded.team ELSE repos.team END,
			updated_at=CURRENT_TIMESTAMP`)
	if err != nil {
		return 0, err
	}
	defer stmt.Close()

	count := 0
	for _, repo := range repos {
		if _, err := stmt.Exec(repo.Name, repo.GitHubURL, repo.Description, repo.Language, repo.Status, repo.Domain, repo.Team); err != nil {
			continue
		}
		count++
	}
	return count, nil
}

func (r *RepoRepository) List(filter domain.RepoFilter) ([]domain.RepoSummary, error) {
	query := "SELECT name, domain, status, language, cloned FROM repos WHERE 1=1"
	var args []interface{}

	if filter.Domain != "" {
		query += " AND domain = ?"
		args = append(args, filter.Domain)
	}
	if filter.Status != "" {
		query += " AND status = ?"
		args = append(args, filter.Status)
	}
	if filter.ClonedOnly {
		query += " AND cloned = 1"
	}
	if filter.ExcludeArchived {
		query += " AND status != 'archived'"
	}
	query += " ORDER BY domain, name"

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []domain.RepoSummary
	for rows.Next() {
		var s domain.RepoSummary
		var cloned int
		if err := rows.Scan(&s.Name, &s.Domain, &s.Status, &s.Language, &cloned); err != nil {
			continue
		}
		s.Cloned = cloned == 1
		result = append(result, s)
	}
	return result, nil
}

func (r *RepoRepository) Get(name string) (*domain.Repo, error) {
	row := r.db.QueryRow(
		`SELECT name, github_url, domain, description, status, language, team,
			system, lifecycle, depends_on, provides_apis, consumes_apis, tags, links,
			collaborators, deployment, observability, security,
			cloned, local_path, created_at, updated_at
		FROM repos WHERE name = ?`, name)

	var repo domain.Repo
	var cloned int
	err := row.Scan(&repo.Name, &repo.GitHubURL, &repo.Domain, &repo.Description,
		&repo.Status, &repo.Language, &repo.Team,
		&repo.System, &repo.Lifecycle, &repo.DependsOn, &repo.ProvidesAPIs,
		&repo.ConsumesAPIs, &repo.Tags, &repo.Links,
		&repo.Collaborators, &repo.Deployment, &repo.Observability, &repo.Security,
		&cloned, &repo.LocalPath, &repo.CreatedAt, &repo.UpdatedAt)
	if err != nil {
		return nil, err
	}
	repo.Cloned = cloned == 1
	return &repo, nil
}

func (r *RepoRepository) Update(name, field, value string) error {
	_, err := r.db.Exec(
		fmt.Sprintf("UPDATE repos SET %s = ?, updated_at = CURRENT_TIMESTAMP WHERE name = ?", field),
		value, name)
	return err
}

func (r *RepoRepository) GetURL(name string) (string, error) {
	var url string
	err := r.db.QueryRow("SELECT github_url FROM repos WHERE name = ?", name).Scan(&url)
	return url, err
}

func (r *RepoRepository) SetCloned(name, localPath string) error {
	_, err := r.db.Exec(
		"UPDATE repos SET cloned = 1, local_path = ?, updated_at = CURRENT_TIMESTAMP WHERE name = ?",
		localPath, name)
	return err
}

func (r *RepoRepository) ListNames(filter domain.RepoFilter) ([]string, error) {
	query := "SELECT name FROM repos WHERE 1=1"
	var args []interface{}

	if filter.Domain != "" {
		query += " AND domain = ?"
		args = append(args, filter.Domain)
	}
	if filter.ExcludeArchived {
		query += " AND status != 'archived'"
	}
	query += " ORDER BY name"

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var names []string
	for rows.Next() {
		var n string
		rows.Scan(&n)
		names = append(names, n)
	}
	return names, nil
}
