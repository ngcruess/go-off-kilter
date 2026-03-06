package api

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/ngcruess/go-off-kilter/backend/internal/bluetooth"
	"github.com/ngcruess/go-off-kilter/backend/internal/store"
)

type Server struct {
	ClimbStore   *store.ClimbStore
	BoardStore   *store.BoardStore
	UserStore    *store.UserStore
	AscentStore  *store.AscentStore
	BTController bluetooth.BoardController
}

func NewRouter(s *Server) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(corsMiddleware)

	r.Route("/api", func(r chi.Router) {
		r.Get("/climbs", s.ListClimbs)
		r.Post("/climbs", s.CreateClimb)
		r.Get("/climbs/{uuid}", s.GetClimb)
		r.Put("/climbs/{uuid}/publish", s.PublishClimb)

		r.Post("/climbs/{uuid}/ascents", s.LogAscent)
		r.Get("/climbs/{uuid}/ascents", s.ListClimbAscents)

		r.Post("/users", s.CreateUser)
		r.Get("/users/{id}", s.GetUser)
		r.Get("/users/by-username/{username}", s.GetUserByUsername)
		r.Get("/users/{id}/ascents", s.ListUserAscents)
		r.Get("/users/{id}/stats", s.GetUserStats)
		r.Get("/users/{id}/climb-summary/{uuid}", s.UserClimbSummary)

		r.Get("/grades", s.ListGrades)

		r.Get("/board/layout", s.GetBoardLayout)
		r.Get("/board/layouts", s.ListLayouts)

		r.Post("/board/send/{uuid}", s.SendToBoard)
	})

	return r
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}
