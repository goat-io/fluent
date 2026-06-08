package sqlite

import (
	"database/sql"

	"github.com/goat-io/delphi-brain/cli/internal/domain"
)

type ProtocolRepository struct {
	db *sql.DB
}

func NewProtocolRepository(db *sql.DB) *ProtocolRepository {
	return &ProtocolRepository{db: db}
}

func (r *ProtocolRepository) Upsert(proto domain.Protocol) error {
	_, err := r.db.Exec(
		`INSERT INTO protocols (name, type, transport, port, encryption, auth_method, used_by, description, notes)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(name) DO UPDATE SET type=excluded.type, transport=excluded.transport, port=excluded.port,
			encryption=excluded.encryption, auth_method=excluded.auth_method, used_by=excluded.used_by,
			description=excluded.description, notes=excluded.notes`,
		proto.Name, proto.Type, proto.Transport, proto.Port,
		proto.Encryption, proto.AuthMethod, proto.UsedBy, proto.Description, proto.Notes)
	return err
}

func (r *ProtocolRepository) List() ([]domain.ProtocolSummary, error) {
	rows, err := r.db.Query("SELECT name, type, transport, port, encryption, used_by FROM protocols ORDER BY name")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []domain.ProtocolSummary
	for rows.Next() {
		var p domain.ProtocolSummary
		rows.Scan(&p.Name, &p.Type, &p.Transport, &p.Port, &p.Encryption, &p.UsedBy)
		result = append(result, p)
	}
	return result, nil
}
