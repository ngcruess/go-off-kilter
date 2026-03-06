package bluetooth

import (
	"log"

	"github.com/ngcruess/go-off-kilter/backend/internal/models"
)

type MockController struct{}

func NewMockController() *MockController {
	return &MockController{}
}

func (m *MockController) SendProblem(placements []models.ClimbPlacement, roles map[int]models.PlacementRole) error {
	log.Printf("[BT Mock] SendProblem called with %d placements", len(placements))
	for _, p := range placements {
		role, ok := roles[p.RoleID]
		color := "unknown"
		if ok {
			color = role.LEDColor
		}
		log.Printf("[BT Mock]   placement=%d role=%d color=%s", p.PlacementID, p.RoleID, color)
	}
	return nil
}

func (m *MockController) IsConnected() bool {
	return true
}
