package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/ngcruess/go-off-kilter/backend/internal/models"
	"github.com/ngcruess/go-off-kilter/backend/internal/store"

	"crypto/rand"
	"fmt"
)

func (s *Server) ListClimbs(w http.ResponseWriter, r *http.Request) {
	params := store.ClimbListParams{
		Name:   r.URL.Query().Get("name"),
		Cursor: r.URL.Query().Get("cursor"),
		Limit:  intParam(r, "limit", 20),
	}

	if v := r.URL.Query().Get("grade_min"); v != "" {
		f, err := strconv.ParseFloat(v, 64)
		if err == nil {
			params.GradeMin = &f
		}
	}
	if v := r.URL.Query().Get("grade_max"); v != "" {
		f, err := strconv.ParseFloat(v, 64)
		if err == nil {
			params.GradeMax = &f
		}
	}
	if v := r.URL.Query().Get("angle"); v != "" {
		i, err := strconv.Atoi(v)
		if err == nil {
			params.Angle = &i
		}
	}
	if v := r.URL.Query().Get("no_match"); v != "" {
		b := v == "true" || v == "1"
		params.NoMatch = &b
	}

	climbs, nextCursor, err := s.ClimbStore.List(params)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	resp := map[string]interface{}{
		"climbs": climbs,
	}
	if nextCursor != "" {
		resp["next_cursor"] = nextCursor
	}
	writeJSON(w, http.StatusOK, resp)
}

func (s *Server) GetClimb(w http.ResponseWriter, r *http.Request) {
	uuid := chi.URLParam(r, "uuid")
	climb, err := s.ClimbStore.GetByUUID(uuid)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if climb == nil {
		writeError(w, http.StatusNotFound, "climb not found")
		return
	}
	writeJSON(w, http.StatusOK, climb)
}

func (s *Server) CreateClimb(w http.ResponseWriter, r *http.Request) {
	var req models.ClimbCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Frames == "" {
		writeError(w, http.StatusBadRequest, "frames is required")
		return
	}
	if _, err := models.ParseFrames(req.Frames); err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("invalid frames: %v", err))
		return
	}

	uuid := generateUUID()
	climb, err := s.ClimbStore.Create(req, uuid)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, climb)
}

func (s *Server) PublishClimb(w http.ResponseWriter, r *http.Request) {
	uuid := chi.URLParam(r, "uuid")
	var req models.ClimbPublishRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}

	if err := s.ClimbStore.Publish(uuid, req); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "published"})
}

func (s *Server) ListGrades(w http.ResponseWriter, r *http.Request) {
	grades, err := s.BoardStore.ListGrades()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, grades)
}

func (s *Server) GetBoardLayout(w http.ResponseWriter, r *http.Request) {
	layoutID := intParam(r, "layout_id", 1)
	productSizeID := intParam(r, "product_size_id", 27)
	layout, err := s.BoardStore.GetLayout(layoutID, productSizeID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, layout)
}

func (s *Server) ListLayouts(w http.ResponseWriter, r *http.Request) {
	layouts, err := s.BoardStore.ListLayouts()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, layouts)
}

func (s *Server) SendToBoard(w http.ResponseWriter, r *http.Request) {
	uuid := chi.URLParam(r, "uuid")
	climb, err := s.ClimbStore.GetByUUID(uuid)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if climb == nil {
		writeError(w, http.StatusNotFound, "climb not found")
		return
	}

	placements, err := models.ParseFrames(climb.Frames)
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("parse frames: %v", err))
		return
	}

	roles := make(map[int]models.PlacementRole)
	layout, err := s.BoardStore.GetLayout(climb.LayoutID, 0)
	if err == nil && layout != nil {
		for _, role := range layout.Roles {
			roles[role.ID] = role
		}
	}

	if err := s.BTController.SendProblem(placements, roles); err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("send to board: %v", err))
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "sent"})
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func intParam(r *http.Request, key string, fallback int) int {
	v := r.URL.Query().Get(key)
	if v == "" {
		return fallback
	}
	i, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return i
}

func generateUUID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return fmt.Sprintf("%08x%04x%04x%04x%012x",
		b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}
