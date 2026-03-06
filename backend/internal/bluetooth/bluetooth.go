package bluetooth

import "github.com/ngcruess/go-off-kilter/backend/internal/models"

// BoardController abstracts communication with a Kilter Board LED controller.
// The real implementation will use BLE (UART service 6E400001-B5A3-F393-E0A9-E50E24DCCA9E)
// with the prepBytesV3 packet protocol.
type BoardController interface {
	SendProblem(placements []models.ClimbPlacement, roles map[int]models.PlacementRole) error
	IsConnected() bool
}
