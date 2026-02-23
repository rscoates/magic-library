# Magic: The Gathering Collection Tracker

A web application to track your Magic: The Gathering card collection, organized by boxes, files, and decks.

## Features

- **Card Database**: All cards loaded from MTGJSON AllPrintings.json
- **Collection Management**: Track cards by set/number with quantity, language, finish (foil variants), and comments
- **Container Hierarchy**: Organize cards in boxes, files, and decks with up to 10 levels of nesting
- **Card Entry**: Streamlined workflow for quickly adding cards to containers
- **Search**: Find cards in your collection and see all locations
- **Decklist Checker**: Paste an MTGO format decklist to see what you own and what's missing
- **Multi-user Support**: Optional authentication with user isolation

## Tech Stack

- **Backend**: Python, FastAPI, SQLAlchemy, Alembic, PostgreSQL
- **Frontend**: React, TypeScript, Material UI, Vite
- **Infrastructure**: Docker, Docker Compose

## Quick Start

### Prerequisites

- Docker and Docker Compose
- `AllPrintings.json` from [MTGJSON](https://mtgjson.com/downloads/all-files/) in the project root

### Production Mode

```bash
# Build and start all services
docker-compose up --build

# Access the app at http://localhost:3000
```

### Development Mode

```bash
# Start with hot-reload for both backend and frontend
docker-compose -f docker-compose.dev.yml up --build

# Access the app at http://localhost:5173
# API available at http://localhost:8000
```

## Configuration

Copy `.env.example` to `.env` and customize:

```bash
# Disable authentication for single-user mode
AUTH_ENABLED=false

# Set a secure secret key for production
SECRET_KEY=your-secure-random-key-here
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get token
- `GET /api/auth/me` - Get current user
- `GET /api/auth/status` - Check if auth is enabled

### Cards
- `GET /api/cards/search?q=...` - Search cards by name/set/number
- `GET /api/cards/by-set/{set_code}/{number}` - Get specific card
- `GET /api/cards/sets` - List all set codes
- `GET /api/cards/set/{set_code}/numbers` - List numbers in a set

### Containers
- `GET /api/containers/types` - List container types
- `POST /api/containers/types?name=...` - Create container type
- `GET /api/containers/` - List root containers
- `GET /api/containers/all` - List all containers
- `POST /api/containers/` - Create container
- `PUT /api/containers/{id}` - Update container
- `DELETE /api/containers/{id}` - Delete container

### Collection
- `POST /api/collection/` - Add card to collection
- `GET /api/collection/` - List collection entries
- `GET /api/collection/search?q=...` - Search owned cards
- `PUT /api/collection/{id}` - Update entry
- `DELETE /api/collection/{id}` - Delete entry

### Decklist
- `POST /api/decklist/check` - Check decklist against collection

### Metadata
- `GET /api/metadata/languages` - List available languages
- `GET /api/metadata/finishes` - List available finishes

## Database Schema

### Cards (loaded from JSON)
- `id`, `set_code`, `number`, `name`, `rarity`
- Indexed on `(set_code, number)` and `name`

### Containers
- `id`, `name`, `description`, `type_id`, `parent_id`, `depth`, `user_id`, `created_at`
- Max depth: 10

### Collection Entries
- `id`, `set_code`, `card_number`, `container_id`, `quantity`, `finish_id`, `language_id`, `comments`, `user_id`
- Unique constraint on `(set_code, card_number, container_id, finish_id, language_id)`

### Languages & Finishes
- Extracted from the card JSON during migration

## Future Enhancements

- [ ] OCR functionality for card identification via webcam
- [ ] Card image display (Scryfall API integration)
- [ ] Bulk import/export
- [ ] Collection statistics and analytics
- [ ] Price tracking integration

## License

MIT
