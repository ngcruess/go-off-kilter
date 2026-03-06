package main

import (
	"flag"
	"log"
	"net/http"

	"github.com/ngcruess/go-off-kilter/backend/internal/api"
	"github.com/ngcruess/go-off-kilter/backend/internal/bluetooth"
	"github.com/ngcruess/go-off-kilter/backend/internal/store"
)

func main() {
	dbPath := flag.String("db", "app.db", "Path to SQLite database")
	addr := flag.String("addr", ":8080", "Listen address")
	flag.Parse()

	db, err := store.Open(*dbPath)
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}
	defer db.Close()

	if err := store.Migrate(db); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	server := &api.Server{
		ClimbStore:   store.NewClimbStore(db),
		BoardStore:   store.NewBoardStore(db),
		UserStore:    store.NewUserStore(db),
		AscentStore:  store.NewAscentStore(db),
		BTController: bluetooth.NewMockController(),
	}

	router := api.NewRouter(server)

	log.Printf("Starting server on %s", *addr)
	if err := http.ListenAndServe(*addr, router); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
