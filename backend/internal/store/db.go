package store

import (
	"database/sql"
	"fmt"

	_ "github.com/mattn/go-sqlite3"
)

func Open(path string) (*sql.DB, error) {
	db, err := sql.Open("sqlite3", path+"?_journal_mode=WAL&_foreign_keys=on")
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}
	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}
	return db, nil
}

func Migrate(db *sql.DB) error {
	_, err := db.Exec(schema)
	if err != nil {
		return fmt.Errorf("run migrations: %w", err)
	}
	for _, m := range migrations {
		if _, err := db.Exec(m); err != nil {
			// Column/index may already exist; that's fine.
		}
	}
	return nil
}

var migrations = []string{
	`ALTER TABLE climbs ADD COLUMN is_no_match INTEGER NOT NULL DEFAULT 0`,
	`UPDATE climbs SET is_no_match = 1 WHERE LOWER(description) LIKE '%no match%' AND is_no_match = 0`,
	`CREATE INDEX IF NOT EXISTS idx_climbs_no_match ON climbs(is_no_match)`,
	`ALTER TABLE lists ADD COLUMN color TEXT NOT NULL DEFAULT '#42A5F5'`,
}

const schema = `
CREATE TABLE IF NOT EXISTS holes (
	id         INTEGER PRIMARY KEY,
	product_id INTEGER NOT NULL DEFAULT 0,
	x          INTEGER NOT NULL,
	y          INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS layouts (
	id         INTEGER PRIMARY KEY,
	product_id INTEGER NOT NULL DEFAULT 0,
	name       TEXT NOT NULL DEFAULT '',
	is_listed  INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS product_sizes (
	id         INTEGER PRIMARY KEY,
	product_id INTEGER NOT NULL DEFAULT 0,
	name       TEXT NOT NULL DEFAULT '',
	description TEXT NOT NULL DEFAULT '',
	x_min      INTEGER NOT NULL DEFAULT 0,
	x_max      INTEGER NOT NULL DEFAULT 0,
	y_min      INTEGER NOT NULL DEFAULT 0,
	y_max      INTEGER NOT NULL DEFAULT 0,
	is_listed  INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS placements (
	id        INTEGER PRIMARY KEY,
	layout_id INTEGER NOT NULL REFERENCES layouts(id),
	hole_id   INTEGER NOT NULL REFERENCES holes(id),
	set_id    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS placement_roles (
	id        INTEGER PRIMARY KEY,
	name      TEXT NOT NULL,
	led_color TEXT NOT NULL DEFAULT 'FFFFFF'
);

CREATE TABLE IF NOT EXISTS leds (
	id              INTEGER PRIMARY KEY,
	product_size_id INTEGER NOT NULL DEFAULT 0,
	hole_id         INTEGER NOT NULL REFERENCES holes(id),
	position        INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS climbs (
	uuid            TEXT PRIMARY KEY,
	layout_id       INTEGER NOT NULL REFERENCES layouts(id),
	setter_id       INTEGER NOT NULL DEFAULT 0,
	setter_username TEXT NOT NULL DEFAULT '',
	name            TEXT NOT NULL DEFAULT '',
	description     TEXT NOT NULL DEFAULT '',
	frames          TEXT NOT NULL DEFAULT '',
	is_draft        INTEGER NOT NULL DEFAULT 1,
	is_listed       INTEGER NOT NULL DEFAULT 0,
	created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS climb_stats (
	climb_uuid         TEXT NOT NULL REFERENCES climbs(uuid),
	angle              INTEGER NOT NULL DEFAULT 0,
	display_difficulty REAL NOT NULL DEFAULT 0,
	quality_average    REAL NOT NULL DEFAULT 0,
	ascensionist_count INTEGER NOT NULL DEFAULT 0,
	difficulty_average REAL NOT NULL DEFAULT 0,
	PRIMARY KEY (climb_uuid, angle)
);

CREATE TABLE IF NOT EXISTS difficulty_grades (
	difficulty INTEGER PRIMARY KEY,
	boulder_name TEXT NOT NULL DEFAULT '',
	route_name   TEXT NOT NULL DEFAULT '',
	is_listed    INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS users (
	id         INTEGER PRIMARY KEY AUTOINCREMENT,
	username   TEXT UNIQUE NOT NULL,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ascents (
	id          INTEGER PRIMARY KEY AUTOINCREMENT,
	user_id     INTEGER NOT NULL REFERENCES users(id),
	climb_uuid  TEXT NOT NULL REFERENCES climbs(uuid),
	angle       INTEGER NOT NULL,
	is_send     INTEGER NOT NULL DEFAULT 0,
	proposed_grade INTEGER,
	quality     INTEGER CHECK(quality IS NULL OR (quality >= 1 AND quality <= 3)),
	comment     TEXT NOT NULL DEFAULT '',
	created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_climbs_name ON climbs(name);
CREATE INDEX IF NOT EXISTS idx_climbs_layout ON climbs(layout_id);
CREATE INDEX IF NOT EXISTS idx_climbs_listed ON climbs(is_listed);
CREATE INDEX IF NOT EXISTS idx_climb_stats_angle ON climb_stats(angle);
CREATE INDEX IF NOT EXISTS idx_climb_stats_difficulty ON climb_stats(display_difficulty);
CREATE INDEX IF NOT EXISTS idx_placements_layout ON placements(layout_id);
CREATE INDEX IF NOT EXISTS idx_placements_hole ON placements(hole_id);
CREATE TABLE IF NOT EXISTS lists (
	id         INTEGER PRIMARY KEY AUTOINCREMENT,
	user_id    INTEGER NOT NULL REFERENCES users(id),
	name       TEXT NOT NULL,
	color      TEXT NOT NULL DEFAULT '#42A5F5',
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS list_items (
	list_id    INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
	climb_uuid TEXT NOT NULL REFERENCES climbs(uuid),
	added_at   TEXT NOT NULL DEFAULT (datetime('now')),
	PRIMARY KEY (list_id, climb_uuid)
);

CREATE TABLE IF NOT EXISTS follows (
	follower_id INTEGER NOT NULL REFERENCES users(id),
	followed_id INTEGER NOT NULL REFERENCES users(id),
	created_at  TEXT NOT NULL DEFAULT (datetime('now')),
	PRIMARY KEY (follower_id, followed_id),
	CHECK (follower_id != followed_id)
);

CREATE INDEX IF NOT EXISTS idx_ascents_user ON ascents(user_id);
CREATE INDEX IF NOT EXISTS idx_ascents_climb ON ascents(climb_uuid);
CREATE INDEX IF NOT EXISTS idx_lists_user ON lists(user_id);
CREATE INDEX IF NOT EXISTS idx_list_items_climb ON list_items(climb_uuid);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_followed ON follows(followed_id);
`
