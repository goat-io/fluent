package sqlite

import (
	"database/sql"
)

type TagRepository struct {
	db *sql.DB
}

func NewTagRepository(db *sql.DB) *TagRepository {
	return &TagRepository{db: db}
}

func (r *TagRepository) Add(entityType, entityName, tag string) error {
	_, err := r.db.Exec(
		"INSERT OR IGNORE INTO tags (entity_type, entity_name, tag) VALUES (?, ?, ?)",
		entityType, entityName, tag)
	return err
}

func (r *TagRepository) ListByEntity(entityType, entityName string) ([]string, error) {
	rows, err := r.db.Query(
		"SELECT tag FROM tags WHERE entity_type=? AND entity_name=?",
		entityType, entityName)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tags []string
	for rows.Next() {
		var t string
		rows.Scan(&t)
		tags = append(tags, t)
	}
	return tags, nil
}
