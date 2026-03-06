# go-off-kilter

An open-source controller for the Kilter Board climbing training system.

## Project Structure

```
go-off-kilter/
  backend/       Go REST API server (SQLite, chi router)
  mobile/        React Native (Expo) mobile app
```

## Backend

The Go backend serves a REST API for browsing, creating, and publishing boulder problems. It uses SQLite for storage and can be seeded with data from the official Kilter Board database via [boardlib](https://github.com/lemeryfertitta/BoardLib).

### Quick Start

```bash
cd backend
go run ./cmd/server
```

### Seeding Data

1. Install boardlib: `pip install boardlib`
2. Download the Kilter database: `boardlib database kilter --username <your_username> kilter.db`
3. Seed the app database: `go run ./cmd/seed --source kilter.db --target app.db`

## Mobile

The React Native app provides a visual interface for browsing and creating boulder problems on the Kilter Board.

### Quick Start

```bash
cd mobile
npm install
npx expo start
```

## License

MIT
