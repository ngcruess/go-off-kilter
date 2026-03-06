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

func (s *UserStore) Search(query string, limit int) ([]models.User, error) {
	if limit < 1 || limit > 50 {
		limit = 20
	}
	rows, err := s.db.Query(
		`SELECT id, username, created_at FROM users
		 WHERE username LIKE ? ORDER BY username ASC LIMIT ?`,
		"%"+query+"%", limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var u models.User
		if err := rows.Scan(&u.ID, &u.Username, &u.CreatedAt); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

func (s *UserStore) Follow(followerID, followedID int) error {
	_, err := s.db.Exec(
		`INSERT OR IGNORE INTO follows (follower_id, followed_id) VALUES (?, ?)`,
		followerID, followedID)
	return err
}

func (s *UserStore) Unfollow(followerID, followedID int) error {
	_, err := s.db.Exec(
		`DELETE FROM follows WHERE follower_id = ? AND followed_id = ?`,
		followerID, followedID)
	return err
}

func (s *UserStore) ListFollowing(userID int) ([]models.User, error) {
	rows, err := s.db.Query(`
		SELECT u.id, u.username, u.created_at
		FROM follows f
		JOIN users u ON u.id = f.followed_id
		WHERE f.follower_id = ?
		ORDER BY u.username ASC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var u models.User
		if err := rows.Scan(&u.ID, &u.Username, &u.CreatedAt); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

func (s *UserStore) IsFollowing(followerID, followedID int) (bool, error) {
	var count int
	err := s.db.QueryRow(
		`SELECT COUNT(*) FROM follows WHERE follower_id = ? AND followed_id = ?`,
		followerID, followedID).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}
