package store

import (
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/ngcruess/go-off-kilter/backend/internal/models"
)

type ClimbStore struct {
	db *sql.DB
}

func NewClimbStore(db *sql.DB) *ClimbStore {
	return &ClimbStore{db: db}
}

type ClimbListParams struct {
	Name     string
	GradeMin *float64
	GradeMax *float64
	Angle    *int
	NoMatch  *bool
	Cursor   string
	Limit    int
}

type cursorValue struct {
	Count int    `json:"c"`
	Name  string `json:"n"`
}

func decodeCursor(s string) (*cursorValue, error) {
	if s == "" {
		return nil, nil
	}
	b, err := base64.URLEncoding.DecodeString(s)
	if err != nil {
		return nil, fmt.Errorf("invalid cursor encoding")
	}
	var cv cursorValue
	if err := json.Unmarshal(b, &cv); err != nil {
		return nil, fmt.Errorf("invalid cursor format")
	}
	return &cv, nil
}

func encodeCursor(count int, name string) string {
	cv := cursorValue{Count: count, Name: name}
	b, _ := json.Marshal(cv)
	return base64.URLEncoding.EncodeToString(b)
}

func (s *ClimbStore) List(params ClimbListParams) ([]models.ClimbSummary, string, error) {
	if params.Limit < 1 || params.Limit > 100 {
		params.Limit = 20
	}

	angle := 40
	if params.Angle != nil {
		angle = *params.Angle
	}

	cursor, err := decodeCursor(params.Cursor)
	if err != nil {
		return nil, "", err
	}

	var where []string
	var args []interface{}

	where = append(where, "c.is_listed = 1")

	if params.Name != "" {
		where = append(where, "c.name LIKE ?")
		args = append(args, "%"+params.Name+"%")
	}
	if params.GradeMin != nil {
		where = append(where, "cs.display_difficulty >= ?")
		args = append(args, *params.GradeMin)
	}
	if params.GradeMax != nil {
		where = append(where, "cs.display_difficulty <= ?")
		args = append(args, *params.GradeMax)
	}
	if params.NoMatch != nil {
		if *params.NoMatch {
			where = append(where, "c.is_no_match = 1")
		} else {
			where = append(where, "c.is_no_match = 0")
		}
	}
	if cursor != nil {
		where = append(where,
			"(COALESCE(cs.ascensionist_count, 0) < ? OR (COALESCE(cs.ascensionist_count, 0) = ? AND c.name > ?))")
		args = append(args, cursor.Count, cursor.Count, cursor.Name)
	}

	whereClause := "WHERE " + strings.Join(where, " AND ")

	fetchLimit := params.Limit + 1
	query := fmt.Sprintf(`
		SELECT c.uuid, c.name, c.setter_username, c.is_draft,
			COALESCE(cs.angle, 0), COALESCE(cs.display_difficulty, 0),
			COALESCE(dg.boulder_name, ''),
			COALESCE(cs.quality_average, 0), COALESCE(cs.ascensionist_count, 0),
			c.is_no_match
		FROM climbs c
		LEFT JOIN climb_stats cs ON cs.climb_uuid = c.uuid AND cs.angle = %d
		LEFT JOIN difficulty_grades dg ON dg.difficulty = CAST(ROUND(cs.display_difficulty) AS INTEGER)
		%s
		ORDER BY COALESCE(cs.ascensionist_count, 0) DESC, c.name ASC
		LIMIT ?`, angle, whereClause)

	args = append(args, fetchLimit)
	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, "", err
	}
	defer rows.Close()

	var climbs []models.ClimbSummary
	for rows.Next() {
		var cs models.ClimbSummary
		if err := rows.Scan(&cs.UUID, &cs.Name, &cs.SetterUsername, &cs.IsDraft,
			&cs.Angle, &cs.DisplayDifficulty, &cs.Grade,
			&cs.QualityAverage, &cs.AscentionistCount, &cs.IsNoMatch); err != nil {
			return nil, "", err
		}
		climbs = append(climbs, cs)
	}
	if err := rows.Err(); err != nil {
		return nil, "", err
	}

	var nextCursor string
	if len(climbs) > params.Limit {
		climbs = climbs[:params.Limit]
		last := climbs[params.Limit-1]
		nextCursor = encodeCursor(last.AscentionistCount, last.Name)
	}

	return climbs, nextCursor, nil
}

func (s *ClimbStore) GetByUUID(uuid string) (*models.ClimbDetail, error) {
	var c models.Climb
	var createdAt string
	err := s.db.QueryRow(`
		SELECT uuid, layout_id, setter_id, setter_username, name, description,
			frames, is_draft, is_listed, is_no_match, created_at
		FROM climbs WHERE uuid = ?`, uuid).Scan(
		&c.UUID, &c.LayoutID, &c.SetterID, &c.SetterUsername, &c.Name, &c.Description,
		&c.Frames, &c.IsDraft, &c.IsListed, &c.IsNoMatch, &createdAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	c.CreatedAt, _ = time.Parse("2006-01-02 15:04:05", createdAt)

	placements, err := models.ParseFrames(c.Frames)
	if err != nil {
		return nil, fmt.Errorf("parse frames for climb %s: %w", uuid, err)
	}

	detail := &models.ClimbDetail{
		Climb:      c,
		Placements: placements,
	}

	var stats models.ClimbStats
	err = s.db.QueryRow(`
		SELECT cs.climb_uuid, cs.angle, cs.display_difficulty,
			COALESCE(dg.boulder_name, ''),
			cs.quality_average, cs.ascensionist_count, cs.difficulty_average
		FROM climb_stats cs
		LEFT JOIN difficulty_grades dg ON dg.difficulty = CAST(ROUND(cs.display_difficulty) AS INTEGER)
		WHERE cs.climb_uuid = ?
		ORDER BY cs.ascensionist_count DESC
		LIMIT 1`, uuid).Scan(
		&stats.ClimbUUID, &stats.Angle, &stats.DisplayDifficulty,
		&stats.Grade, &stats.QualityAverage, &stats.AscentionistCount,
		&stats.DifficultyAverage)
	if err == nil {
		detail.Stats = &stats
	}

	return detail, nil
}

func (s *ClimbStore) Create(req models.ClimbCreateRequest, uuid string) (*models.Climb, error) {
	now := time.Now().UTC().Format("2006-01-02 15:04:05")
	isNoMatch := strings.Contains(strings.ToLower(req.Description), "no match")
	_, err := s.db.Exec(`
		INSERT INTO climbs (uuid, layout_id, name, description, frames, is_draft, is_listed, is_no_match, created_at)
		VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?)`,
		uuid, req.LayoutID, req.Name, req.Description, req.Frames, isNoMatch, now)
	if err != nil {
		return nil, err
	}
	return &models.Climb{
		UUID:        uuid,
		LayoutID:    req.LayoutID,
		Name:        req.Name,
		Description: req.Description,
		Frames:      req.Frames,
		IsDraft:     true,
		IsNoMatch:   isNoMatch,
		CreatedAt:   time.Now().UTC(),
	}, nil
}

func (s *ClimbStore) Publish(uuid string, req models.ClimbPublishRequest) error {
	result, err := s.db.Exec(`
		UPDATE climbs SET name = ?, is_draft = 0, is_listed = 1
		WHERE uuid = ?`, req.Name, uuid)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("climb %s not found", uuid)
	}

	_, err = s.db.Exec(`
		INSERT INTO climb_stats (climb_uuid, angle, display_difficulty)
		VALUES (?, ?, ?)
		ON CONFLICT(climb_uuid, angle) DO UPDATE SET
			display_difficulty = excluded.display_difficulty`,
		uuid, req.Angle, req.Grade)
	return err
}
