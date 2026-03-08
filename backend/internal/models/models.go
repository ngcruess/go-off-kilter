package models

import "time"

type Hole struct {
	ID        int `json:"id"`
	ProductID int `json:"product_id"`
	X         int `json:"x"`
	Y         int `json:"y"`
}

type Placement struct {
	ID       int `json:"id"`
	LayoutID int `json:"layout_id"`
	HoleID   int `json:"hole_id"`
	SetID    int `json:"set_id"`
}

type PlacementRole struct {
	ID       int    `json:"id"`
	Name     string `json:"name"`
	LEDColor string `json:"led_color"`
}

type ProductSize struct {
	ID          int    `json:"id"`
	ProductID   int    `json:"product_id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	XMin        int    `json:"x_min"`
	XMax        int    `json:"x_max"`
	YMin        int    `json:"y_min"`
	YMax        int    `json:"y_max"`
}

type DifficultyGrade struct {
	Difficulty  int    `json:"difficulty"`
	BoulderName string `json:"boulder_name"`
	RouteName   string `json:"route_name"`
	IsListed    bool   `json:"is_listed"`
}

type LED struct {
	ID            int `json:"id"`
	ProductSizeID int `json:"product_size_id"`
	HoleID        int `json:"hole_id"`
	Position      int `json:"position"`
}

type Layout struct {
	ID          int    `json:"id"`
	ProductID   int    `json:"product_id"`
	Name        string `json:"name"`
	IsListed    bool   `json:"is_listed"`
}

type Climb struct {
	UUID           string    `json:"uuid"`
	LayoutID       int       `json:"layout_id"`
	SetterID       int       `json:"setter_id,omitempty"`
	SetterUsername string    `json:"setter_username,omitempty"`
	Name           string    `json:"name"`
	Description    string    `json:"description,omitempty"`
	Frames         string    `json:"frames"`
	IsDraft        bool      `json:"is_draft"`
	IsListed       bool      `json:"is_listed"`
	IsNoMatch      bool      `json:"is_no_match"`
	CreatedAt      time.Time `json:"created_at"`
}

type ClimbStats struct {
	ClimbUUID         string  `json:"climb_uuid"`
	Angle             int     `json:"angle"`
	DisplayDifficulty float64 `json:"display_difficulty"`
	Grade             string  `json:"grade,omitempty"`
	QualityAverage    float64 `json:"quality_average"`
	AscentionistCount int     `json:"ascensionist_count"`
	DifficultyAverage float64 `json:"difficulty_average"`
}

// ClimbPlacement represents a single hold placement within a climb's frame string,
// decoded from the compact "p{id}r{role}" format.
type ClimbPlacement struct {
	PlacementID int `json:"placement_id"`
	RoleID      int `json:"role_id"`
}

// BoardLayout is the aggregate response sent to the frontend containing everything
// needed to render the board.
type BoardLayout struct {
	ProductSize *ProductSize    `json:"product_size,omitempty"`
	Holes       []Hole          `json:"holes"`
	Placements  []PlacementFull `json:"placements"`
	Roles       []PlacementRole `json:"roles"`
	LEDs        []LED           `json:"leds"`
}

// PlacementFull joins a placement with its hole coordinates for frontend rendering.
type PlacementFull struct {
	ID       int `json:"id"`
	LayoutID int `json:"layout_id"`
	HoleID   int `json:"hole_id"`
	SetID    int `json:"set_id"`
	X        int `json:"x"`
	Y        int `json:"y"`
}

// ClimbDetail is the full response for a single climb, including decoded placements.
type ClimbDetail struct {
	Climb
	SetAngle   *int             `json:"set_angle,omitempty"`
	Stats      *ClimbStats      `json:"stats,omitempty"`
	Placements []ClimbPlacement `json:"placements"`
}

// ClimbSummary is a compact representation for list views.
type ClimbSummary struct {
	UUID              string  `json:"uuid"`
	Name              string  `json:"name"`
	SetterUsername    string  `json:"setter_username,omitempty"`
	IsDraft           bool    `json:"is_draft"`
	Angle             int     `json:"angle,omitempty"`
	DisplayDifficulty float64 `json:"display_difficulty,omitempty"`
	Grade             string  `json:"grade,omitempty"`
	QualityAverage    float64 `json:"quality_average,omitempty"`
	AscentionistCount int     `json:"ascensionist_count,omitempty"`
	IsNoMatch         bool    `json:"is_no_match"`
	CreatedAt         string  `json:"created_at,omitempty"`
}

type User struct {
	ID        int    `json:"id"`
	Username  string `json:"username"`
	CreatedAt string `json:"created_at"`
}

type Ascent struct {
	ID            int    `json:"id"`
	UserID        int    `json:"user_id"`
	ClimbUUID     string `json:"climb_uuid"`
	Angle         int    `json:"angle"`
	IsSend        bool   `json:"is_send"`
	ProposedGrade *int   `json:"proposed_grade,omitempty"`
	Quality       *int   `json:"quality,omitempty"`
	Comment       string `json:"comment,omitempty"`
	CreatedAt     string `json:"created_at"`
}

type AscentSummary struct {
	Ascent
	ClimbName string `json:"climb_name"`
	Grade     string `json:"grade,omitempty"`
	Username  string `json:"username,omitempty"`
}

type LogAscentRequest struct {
	UserID        int    `json:"user_id"`
	Angle         int    `json:"angle"`
	IsSend        bool   `json:"is_send"`
	ProposedGrade *int   `json:"proposed_grade,omitempty"`
	Quality       *int   `json:"quality,omitempty"`
	Comment       string `json:"comment,omitempty"`
}

type UserClimbSummary struct {
	Attempts int `json:"attempts"`
	Sends    int `json:"sends"`
}

type UserStats struct {
	TotalAscents int          `json:"total_ascents"`
	TotalSends   int          `json:"total_sends"`
	HighestGrade string       `json:"highest_grade"`
	SendsByGrade []GradeCount `json:"sends_by_grade"`
	SendsByAngle []AngleCount `json:"sends_by_angle"`
	SendsByMonth []MonthCount `json:"sends_by_month"`
}

type GradeCount struct {
	Grade string `json:"grade"`
	Count int    `json:"count"`
}

type AngleCount struct {
	Angle int `json:"angle"`
	Count int `json:"count"`
}

type MonthCount struct {
	Month string `json:"month"`
	Count int    `json:"count"`
}

// ClimbCreateRequest is the payload for creating a new climb.
type ClimbCreateRequest struct {
	LayoutID    int    `json:"layout_id"`
	SetterID    int    `json:"setter_id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Frames      string `json:"frames"`
}

// ClimbPublishRequest is the payload for publishing a draft climb.
type ClimbPublishRequest struct {
	Name       string  `json:"name"`
	Difficulty float64 `json:"difficulty"`
	Angle      int     `json:"angle"`
}

type List struct {
	ID        int       `json:"id"`
	UserID    int       `json:"user_id"`
	Name      string    `json:"name"`
	Color     string    `json:"color"`
	ItemCount int       `json:"item_count"`
	CreatedAt time.Time `json:"created_at"`
}

type ListDetail struct {
	List
	Items []ClimbSummary `json:"items"`
}

type ListMembership struct {
	ListID   int    `json:"list_id"`
	Name     string `json:"name"`
	Color    string `json:"color"`
	Contains bool   `json:"contains"`
}

type ListCreateRequest struct {
	Name  string `json:"name"`
	Color string `json:"color"`
}

type ListItemRequest struct {
	ClimbUUID string `json:"climb_uuid"`
}
