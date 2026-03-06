package store

import (
	"database/sql"

	"github.com/ngcruess/go-off-kilter/backend/internal/models"
)

type AscentStore struct {
	db *sql.DB
}

func NewAscentStore(db *sql.DB) *AscentStore {
	return &AscentStore{db: db}
}

func (s *AscentStore) Log(climbUUID string, req models.LogAscentRequest) (*models.Ascent, error) {
	result, err := s.db.Exec(`
		INSERT INTO ascents (user_id, climb_uuid, angle, is_send, proposed_grade, quality, comment)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		req.UserID, climbUUID, req.Angle, boolToInt(req.IsSend),
		req.ProposedGrade, req.Quality, req.Comment)
	if err != nil {
		return nil, err
	}
	id, _ := result.LastInsertId()

	var a models.Ascent
	err = s.db.QueryRow(`
		SELECT id, user_id, climb_uuid, angle, is_send, proposed_grade, quality, comment, created_at
		FROM ascents WHERE id = ?`, id).Scan(
		&a.ID, &a.UserID, &a.ClimbUUID, &a.Angle, &a.IsSend,
		&a.ProposedGrade, &a.Quality, &a.Comment, &a.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

func (s *AscentStore) ListByClimb(climbUUID string, limit, offset int) ([]models.AscentSummary, int, error) {
	if limit < 1 || limit > 100 {
		limit = 20
	}

	var total int
	if err := s.db.QueryRow(
		`SELECT COUNT(*) FROM ascents WHERE climb_uuid = ?`, climbUUID,
	).Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := s.db.Query(`
		SELECT a.id, a.user_id, a.climb_uuid, a.angle, a.is_send,
			a.proposed_grade, a.quality, a.comment, a.created_at,
			c.name, COALESCE(dg.boulder_name, ''), u.username
		FROM ascents a
		JOIN climbs c ON c.uuid = a.climb_uuid
		JOIN users u ON u.id = a.user_id
		LEFT JOIN difficulty_grades dg ON dg.difficulty = a.proposed_grade
		WHERE a.climb_uuid = ?
		ORDER BY a.created_at DESC
		LIMIT ? OFFSET ?`, climbUUID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var ascents []models.AscentSummary
	for rows.Next() {
		var as models.AscentSummary
		if err := rows.Scan(
			&as.ID, &as.UserID, &as.ClimbUUID, &as.Angle, &as.IsSend,
			&as.ProposedGrade, &as.Quality, &as.Comment, &as.CreatedAt,
			&as.ClimbName, &as.Grade, &as.Username,
		); err != nil {
			return nil, 0, err
		}
		ascents = append(ascents, as)
	}
	return ascents, total, rows.Err()
}

func (s *AscentStore) ListByUser(userID int, limit, offset int, sendsOnly bool) ([]models.AscentSummary, int, error) {
	if limit < 1 || limit > 100 {
		limit = 20
	}

	whereClause := "WHERE a.user_id = ?"
	args := []interface{}{userID}
	if sendsOnly {
		whereClause += " AND a.is_send = 1"
	}

	var total int
	if err := s.db.QueryRow(
		"SELECT COUNT(*) FROM ascents a "+whereClause, args...,
	).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := `
		SELECT a.id, a.user_id, a.climb_uuid, a.angle, a.is_send,
			a.proposed_grade, a.quality, a.comment, a.created_at,
			c.name, COALESCE(dg.boulder_name, ''), u.username
		FROM ascents a
		JOIN climbs c ON c.uuid = a.climb_uuid
		JOIN users u ON u.id = a.user_id
		LEFT JOIN difficulty_grades dg ON dg.difficulty = a.proposed_grade
		` + whereClause + `
		ORDER BY a.created_at DESC
		LIMIT ? OFFSET ?`
	rows, err := s.db.Query(query, append(args, limit, offset)...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var ascents []models.AscentSummary
	for rows.Next() {
		var as models.AscentSummary
		if err := rows.Scan(
			&as.ID, &as.UserID, &as.ClimbUUID, &as.Angle, &as.IsSend,
			&as.ProposedGrade, &as.Quality, &as.Comment, &as.CreatedAt,
			&as.ClimbName, &as.Grade, &as.Username,
		); err != nil {
			return nil, 0, err
		}
		ascents = append(ascents, as)
	}
	return ascents, total, rows.Err()
}

func (s *AscentStore) UserClimbSummary(userID int, climbUUID string) (*models.UserClimbSummary, error) {
	var summary models.UserClimbSummary
	err := s.db.QueryRow(`
		SELECT
			COALESCE(SUM(CASE WHEN is_send = 0 THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN is_send = 1 THEN 1 ELSE 0 END), 0)
		FROM ascents
		WHERE user_id = ? AND climb_uuid = ?`, userID, climbUUID,
	).Scan(&summary.Attempts, &summary.Sends)
	if err != nil {
		return nil, err
	}
	return &summary, nil
}

func (s *AscentStore) GetUserStats(userID int) (*models.UserStats, error) {
	var stats models.UserStats

	err := s.db.QueryRow(`
		SELECT COUNT(*),
			COALESCE(SUM(CASE WHEN is_send = 1 THEN 1 ELSE 0 END), 0)
		FROM ascents WHERE user_id = ?`, userID,
	).Scan(&stats.TotalAscents, &stats.TotalSends)
	if err != nil {
		return nil, err
	}

	var highest sql.NullString
	_ = s.db.QueryRow(`
		SELECT dg.boulder_name
		FROM ascents a
		JOIN difficulty_grades dg ON dg.difficulty = a.proposed_grade
		WHERE a.user_id = ? AND a.is_send = 1
		ORDER BY a.proposed_grade DESC
		LIMIT 1`, userID).Scan(&highest)
	if highest.Valid {
		stats.HighestGrade = highest.String
	}

	gradeRows, err := s.db.Query(`
		SELECT COALESCE(dg.boulder_name, '??'), COUNT(*)
		FROM ascents a
		LEFT JOIN difficulty_grades dg ON dg.difficulty = a.proposed_grade
		WHERE a.user_id = ? AND a.is_send = 1
		GROUP BY a.proposed_grade
		ORDER BY a.proposed_grade ASC`, userID)
	if err != nil {
		return nil, err
	}
	defer gradeRows.Close()
	for gradeRows.Next() {
		var gc models.GradeCount
		if err := gradeRows.Scan(&gc.Grade, &gc.Count); err != nil {
			return nil, err
		}
		stats.SendsByGrade = append(stats.SendsByGrade, gc)
	}
	if stats.SendsByGrade == nil {
		stats.SendsByGrade = []models.GradeCount{}
	}

	angleRows, err := s.db.Query(`
		SELECT a.angle, COUNT(*)
		FROM ascents a
		WHERE a.user_id = ? AND a.is_send = 1
		GROUP BY a.angle
		ORDER BY a.angle ASC`, userID)
	if err != nil {
		return nil, err
	}
	defer angleRows.Close()
	for angleRows.Next() {
		var ac models.AngleCount
		if err := angleRows.Scan(&ac.Angle, &ac.Count); err != nil {
			return nil, err
		}
		stats.SendsByAngle = append(stats.SendsByAngle, ac)
	}
	if stats.SendsByAngle == nil {
		stats.SendsByAngle = []models.AngleCount{}
	}

	monthRows, err := s.db.Query(`
		SELECT strftime('%Y-%m', a.created_at), COUNT(*)
		FROM ascents a
		WHERE a.user_id = ? AND a.is_send = 1
		GROUP BY strftime('%Y-%m', a.created_at)
		ORDER BY strftime('%Y-%m', a.created_at) ASC`, userID)
	if err != nil {
		return nil, err
	}
	defer monthRows.Close()
	for monthRows.Next() {
		var mc models.MonthCount
		if err := monthRows.Scan(&mc.Month, &mc.Count); err != nil {
			return nil, err
		}
		stats.SendsByMonth = append(stats.SendsByMonth, mc)
	}
	if stats.SendsByMonth == nil {
		stats.SendsByMonth = []models.MonthCount{}
	}

	return &stats, nil
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
