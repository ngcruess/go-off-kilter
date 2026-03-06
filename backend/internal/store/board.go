package store

import (
	"database/sql"

	"github.com/ngcruess/go-off-kilter/backend/internal/models"
)

type BoardStore struct {
	db *sql.DB
}

func NewBoardStore(db *sql.DB) *BoardStore {
	return &BoardStore{db: db}
}

func (s *BoardStore) GetLayout(layoutID, productSizeID int) (*models.BoardLayout, error) {
	layout := &models.BoardLayout{}

	var ps models.ProductSize
	err := s.db.QueryRow(`
		SELECT id, product_id, name, description, x_min, x_max, y_min, y_max
		FROM product_sizes WHERE id = ?`, productSizeID).Scan(
		&ps.ID, &ps.ProductID, &ps.Name, &ps.Description,
		&ps.XMin, &ps.XMax, &ps.YMin, &ps.YMax)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}
	if err == nil {
		layout.ProductSize = &ps
	}

	boundsFilter := ""
	if layout.ProductSize != nil {
		boundsFilter = " AND h.x > ? AND h.x < ? AND h.y < ?"
	}

	boundsArgs := func(base ...interface{}) []interface{} {
		if layout.ProductSize != nil {
			return append(base, ps.XMin, ps.XMax, ps.YMax)
		}
		return base
	}

	rows, err := s.db.Query(`
		SELECT DISTINCT h.id, h.x, h.y
		FROM holes h
		INNER JOIN placements p ON p.hole_id = h.id
		WHERE p.layout_id = ?`+boundsFilter+`
		ORDER BY h.id`, boundsArgs(layoutID)...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var h models.Hole
		if err := rows.Scan(&h.ID, &h.X, &h.Y); err != nil {
			return nil, err
		}
		layout.Holes = append(layout.Holes, h)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	rows, err = s.db.Query(`
		SELECT p.id, p.layout_id, p.hole_id, p.set_id, h.x, h.y
		FROM placements p
		INNER JOIN holes h ON h.id = p.hole_id
		WHERE p.layout_id = ?`+boundsFilter+`
		ORDER BY p.id`, boundsArgs(layoutID)...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var pf models.PlacementFull
		if err := rows.Scan(&pf.ID, &pf.LayoutID, &pf.HoleID, &pf.SetID, &pf.X, &pf.Y); err != nil {
			return nil, err
		}
		layout.Placements = append(layout.Placements, pf)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	rows, err = s.db.Query(`SELECT id, name, led_color FROM placement_roles ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var r models.PlacementRole
		if err := rows.Scan(&r.ID, &r.Name, &r.LEDColor); err != nil {
			return nil, err
		}
		layout.Roles = append(layout.Roles, r)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	rows, err = s.db.Query(`SELECT id, hole_id, position FROM leds ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var l models.LED
		if err := rows.Scan(&l.ID, &l.HoleID, &l.Position); err != nil {
			return nil, err
		}
		layout.LEDs = append(layout.LEDs, l)
	}
	return layout, rows.Err()
}

func (s *BoardStore) ListLayouts() ([]models.Layout, error) {
	rows, err := s.db.Query(`SELECT id, product_id, name, is_listed FROM layouts WHERE is_listed = 1 ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var layouts []models.Layout
	for rows.Next() {
		var l models.Layout
		if err := rows.Scan(&l.ID, &l.ProductID, &l.Name, &l.IsListed); err != nil {
			return nil, err
		}
		layouts = append(layouts, l)
	}
	return layouts, rows.Err()
}

func (s *BoardStore) ListGrades() ([]models.DifficultyGrade, error) {
	rows, err := s.db.Query(
		`SELECT difficulty, boulder_name, route_name, is_listed
		FROM difficulty_grades WHERE is_listed = 1 ORDER BY difficulty`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var grades []models.DifficultyGrade
	for rows.Next() {
		var g models.DifficultyGrade
		if err := rows.Scan(&g.Difficulty, &g.BoulderName, &g.RouteName, &g.IsListed); err != nil {
			return nil, err
		}
		grades = append(grades, g)
	}
	return grades, rows.Err()
}

func (s *BoardStore) ListProductSizes(productID int) ([]models.ProductSize, error) {
	rows, err := s.db.Query(`
		SELECT id, product_id, name, description, x_min, x_max, y_min, y_max
		FROM product_sizes WHERE product_id = ? AND is_listed = 1 ORDER BY id`, productID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sizes []models.ProductSize
	for rows.Next() {
		var ps models.ProductSize
		if err := rows.Scan(&ps.ID, &ps.ProductID, &ps.Name, &ps.Description,
			&ps.XMin, &ps.XMax, &ps.YMin, &ps.YMax); err != nil {
			return nil, err
		}
		sizes = append(sizes, ps)
	}
	return sizes, rows.Err()
}
