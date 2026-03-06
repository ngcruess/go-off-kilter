package main

import (
	"database/sql"
	"flag"
	"fmt"
	"log"
	"os"

	_ "github.com/mattn/go-sqlite3"

	"github.com/ngcruess/go-off-kilter/backend/internal/store"
)

func main() {
	source := flag.String("source", "", "Path to boardlib SQLite database")
	target := flag.String("target", "app.db", "Path to output app database")
	flag.Parse()

	if *source == "" {
		fmt.Fprintln(os.Stderr, "Usage: seed --source <boardlib.db> [--target <app.db>]")
		os.Exit(1)
	}

	if _, err := os.Stat(*source); os.IsNotExist(err) {
		log.Fatalf("Source database not found: %s", *source)
	}

	db, err := store.Open(*target)
	if err != nil {
		log.Fatalf("Failed to open target database: %v", err)
	}
	defer db.Close()

	if err := store.Migrate(db); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	if _, err := db.Exec(fmt.Sprintf(`ATTACH DATABASE '%s' AS source`, *source)); err != nil {
		log.Fatalf("Failed to attach source database: %v", err)
	}
	defer db.Exec("DETACH DATABASE source")

	tables := []tableMapping{
		{name: "product_sizes", query: seedProductSizes},
		{name: "holes", query: `INSERT OR IGNORE INTO holes (id, product_id, x, y) SELECT id, COALESCE(product_id, 0), x, y FROM source.holes`},
		{name: "layouts", query: `INSERT OR IGNORE INTO layouts (id, product_id, name, is_listed) SELECT id, COALESCE(product_id, 0), COALESCE(name, ''), COALESCE(is_listed, 1) FROM source.layouts`},
		{name: "placements", query: seedPlacements},
		{name: "placement_roles", query: `INSERT OR IGNORE INTO placement_roles (id, name, led_color) SELECT id, COALESCE(name, ''), COALESCE(led_color, 'FFFFFF') FROM source.placement_roles`},
		{name: "leds", query: seedLEDs},
		{name: "climbs", query: seedClimbs},
		{name: "difficulty_grades", query: `INSERT OR IGNORE INTO difficulty_grades (difficulty, boulder_name, route_name, is_listed) SELECT difficulty, boulder_name, route_name, is_listed FROM source.difficulty_grades`},
		{name: "climb_stats", query: seedClimbStats},
	}

	for _, t := range tables {
		count, err := seedTable(db, t)
		if err != nil {
			log.Printf("Warning: failed to seed %s: %v", t.name, err)
			continue
		}
		log.Printf("Seeded %s: %d rows", t.name, count)
	}

	log.Println("Seed complete.")
}

type tableMapping struct {
	name  string
	query string
}

func seedTable(db *sql.DB, t tableMapping) (int64, error) {
	result, err := db.Exec(t.query)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

const seedProductSizes = `
INSERT OR IGNORE INTO product_sizes (id, product_id, name, description, x_min, x_max, y_min, y_max, is_listed)
SELECT id, product_id, COALESCE(name, ''), COALESCE(description, ''),
	edge_left, edge_right, edge_bottom, edge_top,
	COALESCE(is_listed, 1)
FROM source.product_sizes
`

const seedPlacements = `
INSERT OR IGNORE INTO placements (id, layout_id, hole_id, set_id)
SELECT p.id, p.layout_id, p.hole_id, COALESCE(p.set_id, 0)
FROM source.placements p
WHERE EXISTS (SELECT 1 FROM holes WHERE id = p.hole_id)
  AND EXISTS (SELECT 1 FROM layouts WHERE id = p.layout_id)
`

const seedLEDs = `
INSERT OR IGNORE INTO leds (id, product_size_id, hole_id, position)
SELECT l.id, COALESCE(l.product_size_id, 0), l.hole_id, l.position
FROM source.leds l
WHERE EXISTS (SELECT 1 FROM holes WHERE id = l.hole_id)
`

const seedClimbs = `
INSERT OR IGNORE INTO climbs (uuid, layout_id, setter_id, setter_username, name, description, frames, is_draft, is_listed, is_no_match, created_at)
SELECT
	c.uuid,
	c.layout_id,
	COALESCE(c.setter_id, 0),
	COALESCE(c.setter_username, ''),
	COALESCE(c.name, ''),
	COALESCE(c.description, ''),
	COALESCE(c.frames, ''),
	COALESCE(c.is_draft, 0),
	COALESCE(c.is_listed, 1),
	CASE WHEN LOWER(COALESCE(c.description, '')) LIKE '%no match%' THEN 1 ELSE 0 END,
	COALESCE(c.created_at, datetime('now'))
FROM source.climbs c
WHERE c.is_listed = 1
  AND EXISTS (SELECT 1 FROM layouts WHERE id = c.layout_id)
`

const seedClimbStats = `
INSERT OR IGNORE INTO climb_stats (climb_uuid, angle, display_difficulty, quality_average, ascensionist_count, difficulty_average)
SELECT
	cs.climb_uuid,
	COALESCE(cs.angle, 0),
	COALESCE(cs.display_difficulty, 0),
	COALESCE(cs.quality_average, 0),
	COALESCE(cs.ascensionist_count, 0),
	COALESCE(cs.difficulty_average, 0)
FROM source.climb_stats cs
WHERE EXISTS (SELECT 1 FROM climbs WHERE uuid = cs.climb_uuid)
`
