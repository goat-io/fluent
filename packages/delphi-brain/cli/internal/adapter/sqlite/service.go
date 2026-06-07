package sqlite

import (
	"database/sql"

	"github.com/goat-io/delphi-brain/cli/internal/domain"
)

type ServiceRepository struct {
	db *sql.DB
}

func NewServiceRepository(db *sql.DB) *ServiceRepository {
	return &ServiceRepository{db: db}
}

func (r *ServiceRepository) Upsert(svc domain.Service) error {
	_, err := r.db.Exec(
		`INSERT INTO services (name, repo_name, type, hosting, port, protocol, dependencies, description, status, notes)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(name) DO UPDATE SET repo_name=excluded.repo_name, type=excluded.type, hosting=excluded.hosting,
			port=excluded.port, protocol=excluded.protocol, dependencies=excluded.dependencies,
			description=excluded.description, status=excluded.status, notes=excluded.notes, updated_at=CURRENT_TIMESTAMP`,
		svc.Name, svc.RepoName, svc.Type, svc.Hosting, svc.Port,
		svc.Protocol, svc.Dependencies, svc.Description, svc.Status, svc.Notes)
	return err
}

func (r *ServiceRepository) List(filter domain.ServiceFilter) ([]domain.ServiceSummary, error) {
	query := "SELECT name, repo_name, type, hosting, status FROM services WHERE 1=1"
	var args []interface{}

	if filter.Type != "" {
		query += " AND type = ?"
		args = append(args, filter.Type)
	}
	if filter.Status != "" {
		query += " AND status = ?"
		args = append(args, filter.Status)
	}
	query += " ORDER BY name"

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []domain.ServiceSummary
	for rows.Next() {
		var s domain.ServiceSummary
		rows.Scan(&s.Name, &s.Repo, &s.Type, &s.Hosting, &s.Status)
		result = append(result, s)
	}
	return result, nil
}

func (r *ServiceRepository) Get(name string) (*domain.Service, error) {
	row := r.db.QueryRow(
		"SELECT name, repo_name, type, hosting, port, protocol, dependencies, description, status, notes FROM services WHERE name = ?",
		name)

	var svc domain.Service
	err := row.Scan(&svc.Name, &svc.RepoName, &svc.Type, &svc.Hosting,
		&svc.Port, &svc.Protocol, &svc.Dependencies, &svc.Description,
		&svc.Status, &svc.Notes)
	if err != nil {
		return nil, err
	}
	return &svc, nil
}

func (r *ServiceRepository) ListByRepo(repoName string) ([]domain.ServiceSummary, error) {
	rows, err := r.db.Query("SELECT name, type, status FROM services WHERE repo_name=?", repoName)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []domain.ServiceSummary
	for rows.Next() {
		var s domain.ServiceSummary
		rows.Scan(&s.Name, &s.Type, &s.Status)
		result = append(result, s)
	}
	return result, nil
}
