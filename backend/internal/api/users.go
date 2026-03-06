package api

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/ngcruess/go-off-kilter/backend/internal/models"
)

func (s *Server) CreateUser(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username string `json:"username"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	if req.Username == "" {
		writeError(w, http.StatusBadRequest, "username is required")
		return
	}
	if len(req.Username) > 30 {
		writeError(w, http.StatusBadRequest, "username must be 30 characters or less")
		return
	}

	existing, _ := s.UserStore.GetByUsername(req.Username)
	if existing != nil {
		writeError(w, http.StatusConflict, "username already taken")
		return
	}

	user, err := s.UserStore.Create(req.Username)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, user)
}

func (s *Server) GetUser(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid user id")
		return
	}
	user, err := s.UserStore.GetByID(id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if user == nil {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}
	writeJSON(w, http.StatusOK, user)
}

func (s *Server) GetUserByUsername(w http.ResponseWriter, r *http.Request) {
	username := chi.URLParam(r, "username")
	user, err := s.UserStore.GetByUsername(username)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if user == nil {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}
	writeJSON(w, http.StatusOK, user)
}

func (s *Server) LogAscent(w http.ResponseWriter, r *http.Request) {
	climbUUID := chi.URLParam(r, "uuid")

	var req models.LogAscentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.UserID == 0 {
		writeError(w, http.StatusBadRequest, "user_id is required")
		return
	}
	if req.Angle < 0 || req.Angle > 70 {
		writeError(w, http.StatusBadRequest, "angle must be between 0 and 70")
		return
	}
	if req.IsSend {
		if req.ProposedGrade == nil {
			writeError(w, http.StatusBadRequest, "proposed_grade is required when logging a send")
			return
		}
		if req.Quality == nil {
			writeError(w, http.StatusBadRequest, "quality is required when logging a send")
			return
		}
	}
	if req.Quality != nil && (*req.Quality < 1 || *req.Quality > 3) {
		writeError(w, http.StatusBadRequest, "quality must be between 1 and 3")
		return
	}

	ascent, err := s.AscentStore.Log(climbUUID, req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, ascent)
}

func (s *Server) ListClimbAscents(w http.ResponseWriter, r *http.Request) {
	climbUUID := chi.URLParam(r, "uuid")
	limit := intParam(r, "limit", 20)
	page := intParam(r, "page", 1)
	offset := (page - 1) * limit

	ascents, total, err := s.AscentStore.ListByClimb(climbUUID, limit, offset)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"ascents": ascents,
		"total":   total,
		"page":    page,
		"limit":   limit,
	})
}

func (s *Server) ListUserAscents(w http.ResponseWriter, r *http.Request) {
	userID, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid user id")
		return
	}
	limit := intParam(r, "limit", 20)
	page := intParam(r, "page", 1)
	offset := (page - 1) * limit
	sendsOnly := r.URL.Query().Get("sends_only") == "true"

	ascents, total, err := s.AscentStore.ListByUser(userID, limit, offset, sendsOnly)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"ascents": ascents,
		"total":   total,
		"page":    page,
		"limit":   limit,
	})
}

func (s *Server) GetUserStats(w http.ResponseWriter, r *http.Request) {
	userID, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid user id")
		return
	}
	stats, err := s.AscentStore.GetUserStats(userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, stats)
}

func (s *Server) UserClimbSummary(w http.ResponseWriter, r *http.Request) {
	userID, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid user id")
		return
	}
	climbUUID := chi.URLParam(r, "uuid")

	summary, err := s.AscentStore.UserClimbSummary(userID, climbUUID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, summary)
}
