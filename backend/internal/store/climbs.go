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
	Name       string
	SetterName string
	GradeMin   *float64
	GradeMax   *float64
	Angle      *int
	SetAngle   *int
	NoMatch    *bool
	UserID     *int
	UserFilter string // "attempted", "sent", "not_sent"
	Sort       string // "ascents", "date", "rating", "name"
	Order      string // "asc", "desc"
	Cursor     string
	Limit      int
}

type cursorValue struct {
	Val  string `json:"v"`
	Name string `json:"n"`
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

func encodeCursor(val, name string) string {
	cv := cursorValue{Val: val, Name: name}
	b, _ := json.Marshal(cv)
	return base64.URLEncoding.EncodeToString(b)
}

type sortSpec struct {
	expr     string // SQL expression for the sort column
	castExpr string // SQL expression for cursor comparison (with CAST if needed)
}

var sortSpecs = map[string]sortSpec{
	"ascents": {expr: "COALESCE(cs.ascensionist_count, 0)", castExpr: "CAST(? AS INTEGER)"},
	"date":    {expr: "c.created_at", castExpr: "?"},
	"rating":  {expr: "COALESCE(cs.quality_average, 0)", castExpr: "CAST(? AS REAL)"},
	"name":    {expr: "c.name", castExpr: "?"},
}

func (s *ClimbStore) List(params ClimbListParams) ([]models.ClimbSummary, string, error) {
	if params.Limit < 1 || params.Limit > 100 {
		params.Limit = 20
	}
	if params.Sort == "" {
		params.Sort = "ascents"
	}
	if params.Order == "" {
		if params.Sort == "name" {
			params.Order = "asc"
		} else {
			params.Order = "desc"
		}
	}

	spec, ok := sortSpecs[params.Sort]
	if !ok {
		spec = sortSpecs["ascents"]
		params.Sort = "ascents"
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
	if params.SetterName != "" {
		where = append(where, "c.setter_username LIKE ?")
		args = append(args, "%"+params.SetterName+"%")
	}
	if params.GradeMin != nil {
		where = append(where, "cs.display_difficulty >= ?")
		args = append(args, *params.GradeMin)
	}
	if params.GradeMax != nil {
		where = append(where, "cs.display_difficulty <= ?")
		args = append(args, *params.GradeMax)
	}
	if params.SetAngle != nil {
		where = append(where,
			`(SELECT sa.angle FROM climb_stats sa WHERE sa.climb_uuid = c.uuid
			  ORDER BY sa.ascensionist_count DESC LIMIT 1) = ?`)
		args = append(args, *params.SetAngle)
	}
	if params.NoMatch != nil {
		if *params.NoMatch {
			where = append(where, "c.is_no_match = 1")
		} else {
			where = append(where, "c.is_no_match = 0")
		}
	}
	if params.UserID != nil {
		switch params.UserFilter {
		case "attempted":
			where = append(where,
				"EXISTS (SELECT 1 FROM ascents a WHERE a.climb_uuid = c.uuid AND a.user_id = ?)")
			args = append(args, *params.UserID)
		case "sent":
			where = append(where,
				"EXISTS (SELECT 1 FROM ascents a WHERE a.climb_uuid = c.uuid AND a.user_id = ? AND a.is_send = 1)")
			args = append(args, *params.UserID)
		case "not_sent":
			where = append(where,
				"NOT EXISTS (SELECT 1 FROM ascents a WHERE a.climb_uuid = c.uuid AND a.user_id = ? AND a.is_send = 1)")
			args = append(args, *params.UserID)
		}
	}

	if cursor != nil {
		cmpOp := "<"
		tieOp := ">"
		if params.Order == "asc" {
			cmpOp = ">"
			tieOp = ">"
		}
		if params.Sort == "name" {
			where = append(where, fmt.Sprintf("c.name %s ?", cmpOp))
			args = append(args, cursor.Name)
		} else {
			where = append(where, fmt.Sprintf(
				"(%s %s %s OR (%s = %s AND c.name %s ?))",
				spec.expr, cmpOp, spec.castExpr,
				spec.expr, spec.castExpr, tieOp))
			args = append(args, cursor.Val, cursor.Val, cursor.Name)
		}
	}

	whereClause := "WHERE " + strings.Join(where, " AND ")

	orderDir := "DESC"
	if params.Order == "asc" {
		orderDir = "ASC"
	}
	var orderClause string
	if params.Sort == "name" {
		orderClause = fmt.Sprintf("ORDER BY c.name %s", orderDir)
	} else {
		orderClause = fmt.Sprintf("ORDER BY %s %s, c.name ASC", spec.expr, orderDir)
	}

	fetchLimit := params.Limit + 1
	query := fmt.Sprintf(`
		SELECT c.uuid, c.name, c.setter_username, c.is_draft,
			COALESCE(cs.angle, 0), COALESCE(cs.display_difficulty, 0),
			COALESCE(dg.boulder_name, ''),
			COALESCE(cs.quality_average, 0), COALESCE(cs.ascensionist_count, 0),
			c.is_no_match, c.created_at
		FROM climbs c
		LEFT JOIN climb_stats cs ON cs.climb_uuid = c.uuid AND cs.angle = %d
		LEFT JOIN difficulty_grades dg ON dg.difficulty = CAST(ROUND(cs.display_difficulty) AS INTEGER)
		%s
		%s
		LIMIT ?`, angle, whereClause, orderClause)

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
			&cs.QualityAverage, &cs.AscentionistCount, &cs.IsNoMatch, &cs.CreatedAt); err != nil {
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
		var sortVal string
		switch params.Sort {
		case "ascents":
			sortVal = fmt.Sprintf("%d", last.AscentionistCount)
		case "date":
			sortVal = last.CreatedAt
		case "rating":
			sortVal = fmt.Sprintf("%f", last.QualityAverage)
		default:
			sortVal = last.Name
		}
		nextCursor = encodeCursor(sortVal, last.Name)
	}

	return climbs, nextCursor, nil
}

func (s *ClimbStore) ListBySetter(username string, angle, limit int) ([]models.ClimbSummary, error) {
	if limit < 1 || limit > 100 {
		limit = 20
	}
	rows, err := s.db.Query(fmt.Sprintf(`
		SELECT c.uuid, c.name, c.setter_username, c.is_draft,
			COALESCE(cs.angle, 0), COALESCE(cs.display_difficulty, 0),
			COALESCE(dg.boulder_name, ''),
			COALESCE(cs.quality_average, 0), COALESCE(cs.ascensionist_count, 0),
			c.is_no_match, c.created_at
		FROM climbs c
		LEFT JOIN climb_stats cs ON cs.climb_uuid = c.uuid AND cs.angle = %d
		LEFT JOIN difficulty_grades dg ON dg.difficulty = CAST(ROUND(cs.display_difficulty) AS INTEGER)
		WHERE c.setter_username = ? AND c.is_listed = 1
		ORDER BY COALESCE(cs.ascensionist_count, 0) DESC
		LIMIT ?`, angle), username, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var climbs []models.ClimbSummary
	for rows.Next() {
		var cs models.ClimbSummary
		if err := rows.Scan(&cs.UUID, &cs.Name, &cs.SetterUsername, &cs.IsDraft,
			&cs.Angle, &cs.DisplayDifficulty, &cs.Grade,
			&cs.QualityAverage, &cs.AscentionistCount, &cs.IsNoMatch, &cs.CreatedAt); err != nil {
			return nil, err
		}
		climbs = append(climbs, cs)
	}
	return climbs, rows.Err()
}

func (s *ClimbStore) GetByUUID(uuid string, angle *int) (*models.ClimbDetail, error) {
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

	var setAngle int
	err = s.db.QueryRow(`
		SELECT angle FROM climb_stats
		WHERE climb_uuid = ? ORDER BY ascensionist_count DESC LIMIT 1`, uuid).Scan(&setAngle)
	if err == nil {
		detail.SetAngle = &setAngle
	}

	var stats models.ClimbStats
	if angle != nil {
		err = s.db.QueryRow(`
			SELECT cs.climb_uuid, cs.angle, cs.display_difficulty,
				COALESCE(dg.boulder_name, ''),
				cs.quality_average, cs.ascensionist_count, cs.difficulty_average
			FROM climb_stats cs
			LEFT JOIN difficulty_grades dg ON dg.difficulty = CAST(ROUND(cs.display_difficulty) AS INTEGER)
			WHERE cs.climb_uuid = ? AND cs.angle = ?`, uuid, *angle).Scan(
			&stats.ClimbUUID, &stats.Angle, &stats.DisplayDifficulty,
			&stats.Grade, &stats.QualityAverage, &stats.AscentionistCount,
			&stats.DifficultyAverage)
	} else {
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
	}
	if err == nil {
		detail.Stats = &stats
	}

	return detail, nil
}

func (s *ClimbStore) Create(req models.ClimbCreateRequest, uuid, setterUsername string) (*models.Climb, error) {
	now := time.Now().UTC().Format("2006-01-02 15:04:05")
	isNoMatch := strings.Contains(strings.ToLower(req.Description), "no match")
	_, err := s.db.Exec(`
		INSERT INTO climbs (uuid, layout_id, setter_id, setter_username, name, description, frames, is_draft, is_listed, is_no_match, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)`,
		uuid, req.LayoutID, req.SetterID, setterUsername, req.Name, req.Description, req.Frames, isNoMatch, now)
	if err != nil {
		return nil, err
	}
	return &models.Climb{
		UUID:           uuid,
		LayoutID:       req.LayoutID,
		SetterID:       req.SetterID,
		SetterUsername: setterUsername,
		Name:           req.Name,
		Description:    req.Description,
		Frames:         req.Frames,
		IsDraft:        true,
		IsNoMatch:      isNoMatch,
		CreatedAt:      time.Now().UTC(),
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

	// Resolve the V-grade index to a display_difficulty value from the grades table.
	// The frontend sends a grade label like "V3"; we find the matching difficulty value.
	gradeName := fmt.Sprintf("V%d", req.Grade)
	var displayDifficulty float64
	err = s.db.QueryRow(
		`SELECT difficulty FROM difficulty_grades
		 WHERE boulder_name LIKE ? ORDER BY difficulty ASC LIMIT 1`,
		"%"+gradeName).Scan(&displayDifficulty)
	if err != nil {
		displayDifficulty = float64(req.Grade)
	}

	_, err = s.db.Exec(`
		INSERT INTO climb_stats (climb_uuid, angle, display_difficulty)
		VALUES (?, ?, ?)
		ON CONFLICT(climb_uuid, angle) DO UPDATE SET
			display_difficulty = excluded.display_difficulty`,
		uuid, req.Angle, displayDifficulty)
	return err
}
