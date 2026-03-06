package store

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/ngcruess/go-off-kilter/backend/internal/models"
)

type ListStore struct {
	db *sql.DB
}

func NewListStore(db *sql.DB) *ListStore {
	return &ListStore{db: db}
}

func (s *ListStore) Create(userID int, name, color string) (*models.List, error) {
	if color == "" {
		color = "#42A5F5"
	}
	now := time.Now().UTC().Format("2006-01-02 15:04:05")
	result, err := s.db.Exec(
		`INSERT INTO lists (user_id, name, color, created_at) VALUES (?, ?, ?, ?)`,
		userID, name, color, now)
	if err != nil {
		return nil, err
	}
	id, _ := result.LastInsertId()
	createdAt, _ := time.Parse("2006-01-02 15:04:05", now)
	return &models.List{
		ID:        int(id),
		UserID:    userID,
		Name:      name,
		Color:     color,
		ItemCount: 0,
		CreatedAt: createdAt,
	}, nil
}

func (s *ListStore) ListByUser(userID int) ([]models.List, error) {
	rows, err := s.db.Query(`
		SELECT l.id, l.user_id, l.name, l.color, l.created_at,
			COUNT(li.climb_uuid) AS item_count
		FROM lists l
		LEFT JOIN list_items li ON li.list_id = l.id
		WHERE l.user_id = ?
		GROUP BY l.id
		ORDER BY l.created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var lists []models.List
	for rows.Next() {
		var l models.List
		var createdAt string
		if err := rows.Scan(&l.ID, &l.UserID, &l.Name, &l.Color, &createdAt, &l.ItemCount); err != nil {
			return nil, err
		}
		l.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", createdAt)
		lists = append(lists, l)
	}
	return lists, rows.Err()
}

func (s *ListStore) GetByID(id int, angle int) (*models.ListDetail, error) {
	var l models.List
	var createdAt string
	err := s.db.QueryRow(
		`SELECT id, user_id, name, color, created_at FROM lists WHERE id = ?`, id).Scan(
		&l.ID, &l.UserID, &l.Name, &l.Color, &createdAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	l.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", createdAt)

	rows, err := s.db.Query(fmt.Sprintf(`
		SELECT c.uuid, c.name, c.setter_username, c.is_draft,
			COALESCE(cs.angle, 0), COALESCE(cs.display_difficulty, 0),
			COALESCE(dg.boulder_name, ''),
			COALESCE(cs.quality_average, 0), COALESCE(cs.ascensionist_count, 0),
			c.is_no_match
		FROM list_items li
		JOIN climbs c ON c.uuid = li.climb_uuid
		LEFT JOIN climb_stats cs ON cs.climb_uuid = c.uuid AND cs.angle = %d
		LEFT JOIN difficulty_grades dg ON dg.difficulty = CAST(ROUND(cs.display_difficulty) AS INTEGER)
		WHERE li.list_id = ?
		ORDER BY li.added_at DESC`, angle), id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.ClimbSummary
	for rows.Next() {
		var cs models.ClimbSummary
		if err := rows.Scan(&cs.UUID, &cs.Name, &cs.SetterUsername, &cs.IsDraft,
			&cs.Angle, &cs.DisplayDifficulty, &cs.Grade,
			&cs.QualityAverage, &cs.AscentionistCount, &cs.IsNoMatch); err != nil {
			return nil, err
		}
		items = append(items, cs)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	l.ItemCount = len(items)
	return &models.ListDetail{
		List:  l,
		Items: items,
	}, nil
}

func (s *ListStore) AddItem(listID int, climbUUID string) error {
	_, err := s.db.Exec(
		`INSERT OR IGNORE INTO list_items (list_id, climb_uuid) VALUES (?, ?)`,
		listID, climbUUID)
	return err
}

func (s *ListStore) RemoveItem(listID int, climbUUID string) error {
	_, err := s.db.Exec(
		`DELETE FROM list_items WHERE list_id = ? AND climb_uuid = ?`,
		listID, climbUUID)
	return err
}

func (s *ListStore) ListsForClimb(userID int, climbUUID string) ([]models.ListMembership, error) {
	rows, err := s.db.Query(`
		SELECT l.id, l.name, l.color,
			CASE WHEN li.climb_uuid IS NOT NULL THEN 1 ELSE 0 END AS contains
		FROM lists l
		LEFT JOIN list_items li ON li.list_id = l.id AND li.climb_uuid = ?
		WHERE l.user_id = ?
		ORDER BY l.name ASC`, climbUUID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var memberships []models.ListMembership
	for rows.Next() {
		var m models.ListMembership
		if err := rows.Scan(&m.ListID, &m.Name, &m.Color, &m.Contains); err != nil {
			return nil, err
		}
		memberships = append(memberships, m)
	}
	return memberships, rows.Err()
}
