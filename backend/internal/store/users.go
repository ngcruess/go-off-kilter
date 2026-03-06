package store

import (
	"database/sql"

	"github.com/ngcruess/go-off-kilter/backend/internal/models"
)

type UserStore struct {
	db *sql.DB
}

func NewUserStore(db *sql.DB) *UserStore {
	return &UserStore{db: db}
}

func (s *UserStore) Create(username string) (*models.User, error) {
	result, err := s.db.Exec(
		`INSERT INTO users (username) VALUES (?)`, username)
	if err != nil {
		return nil, err
	}
	id, _ := result.LastInsertId()
	return s.GetByID(int(id))
}

func (s *UserStore) GetByID(id int) (*models.User, error) {
	var u models.User
	err := s.db.QueryRow(
		`SELECT id, username, created_at FROM users WHERE id = ?`, id,
	).Scan(&u.ID, &u.Username, &u.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (s *UserStore) GetByUsername(username string) (*models.User, error) {
	var u models.User
	err := s.db.QueryRow(
		`SELECT id, username, created_at FROM users WHERE username = ?`, username,
	).Scan(&u.ID, &u.Username, &u.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}
