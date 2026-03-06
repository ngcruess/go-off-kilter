package models

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

var framePattern = regexp.MustCompile(`p(\d+)r(\d+)`)

// ParseFrames decodes a compact frame string like "p1083r15p1117r15p1164r12"
// into a slice of ClimbPlacement.
func ParseFrames(frames string) ([]ClimbPlacement, error) {
	matches := framePattern.FindAllStringSubmatch(frames, -1)
	if len(matches) == 0 && frames != "" {
		return nil, fmt.Errorf("invalid frames string: %q", frames)
	}

	placements := make([]ClimbPlacement, 0, len(matches))
	for _, m := range matches {
		pid, err := strconv.Atoi(m[1])
		if err != nil {
			return nil, fmt.Errorf("invalid placement id %q: %w", m[1], err)
		}
		rid, err := strconv.Atoi(m[2])
		if err != nil {
			return nil, fmt.Errorf("invalid role id %q: %w", m[2], err)
		}
		placements = append(placements, ClimbPlacement{
			PlacementID: pid,
			RoleID:      rid,
		})
	}
	return placements, nil
}

// EncodeFrames encodes a slice of ClimbPlacement back into the compact string format.
func EncodeFrames(placements []ClimbPlacement) string {
	var b strings.Builder
	for _, p := range placements {
		fmt.Fprintf(&b, "p%dr%d", p.PlacementID, p.RoleID)
	}
	return b.String()
}
