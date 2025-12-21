# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Vinyl Vault is a vinyl record collection website. It displays Winston's record collection with browsing by genre, album details, collection statistics, and user collection management features with AI-powered recommendations.

## Architecture

### Backend: Cloudflare Workers (Python)

The API runs on Cloudflare Workers using Python (pywrangler/FastAPI):

- **Worker URL**: `https://vinyl-vault-api.christophercrooker.workers.dev`
- **Local Dev**: `http://localhost:8788`
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2 (image/data caching)

### Frontend: Static Files

Pure vanilla HTML/CSS/JavaScript in `frontend/` directory. No build system required.

## Directory Structure

```
Website/
├── frontend/                    # Static frontend files
│   ├── index.html              # Homepage with album carousel
│   ├── genre.html              # Genre listing with search/filter
│   ├── album.html              # Individual album details
│   ├── stats.html              # Collection statistics
│   ├── mycollection.html       # User collection management
│   ├── record.js               # Album data store (112 records)
│   ├── utils.js                # Shared utility functions
│   ├── style.css               # Global styles
│   ├── components/
│   │   └── nav.js              # Shared navigation
│   ├── js/
│   │   ├── config.js           # API configuration
│   │   └── auth.js             # Google OAuth authentication
│   ├── css/
│   │   └── auth.css            # Auth UI styles
│   ├── manifest.json           # PWA manifest
│   └── sw.js                   # Service worker (offline support)
│
├── worker/                      # Cloudflare Worker (Python/FastAPI)
│   ├── src/
│   │   ├── main.py             # FastAPI entry point
│   │   └── routes/
│   │       ├── auth.py         # Google OAuth2 authentication
│   │       ├── collection.py   # User collection CRUD
│   │       ├── discogs.py      # Discogs proxy + R2 caching
│   │       └── chat.py         # Together.ai proxy
│   ├── wrangler.toml           # Worker config (D1, R2 bindings)
│   └── pyproject.toml          # Python dependencies
│
├── migrations/                  # D1 database migrations
│   ├── 0001_initial.sql        # Users and collections tables
│   └── 0002_google_oauth.sql   # Google OAuth columns
│
├── tools/                       # Setup automation tools
│   ├── gcp-init/               # GCP project setup
│   └── oauth-setup/            # OAuth credential configuration
│
├── CLAUDE.md                    # This file
├── IMPLEMENTATION_PLAN.md       # Implementation roadmap (complete)
└── REFACTOR.md                  # Migration notes
```

## API Endpoints

### Authentication (Google OAuth2)
```
GET  /api/auth/google           # Initiate OAuth flow
GET  /api/auth/google/callback  # OAuth callback (internal)
GET  /api/auth/me               # Get current user (requires auth)
POST /api/auth/refresh          # Refresh JWT token
POST /api/auth/logout           # Logout
```

### User Collection (requires auth)
```
GET    /api/collection          # Get user's collection
POST   /api/collection          # Add album to collection
PUT    /api/collection/{id}     # Update album
DELETE /api/collection/{id}     # Delete album
POST   /api/collection/sync     # Sync offline changes
GET    /api/collection/stats    # Get collection statistics
```

### Discogs (cache-first pattern)
```
GET  /api/discogs/cache/check   # Check if album is cached
POST /api/discogs/cache/store   # Store album data + image
GET  /api/discogs/cache/{path}  # Serve cached images
GET  /api/discogs/search        # Search (may be blocked by Cloudflare)
GET  /api/discogs/price/{id}    # Get price (may be blocked)
```

**Note**: Direct Worker→Discogs requests are blocked by Cloudflare. Client-side Discogs calls with cache-first pattern are used instead.

### AI Chat
```
POST /api/chat                  # Send message to AI
POST /api/chat/stream           # Streaming response
```

## Development

### Local Development (Worker)
```bash
cd worker
uv run pywrangler dev
```

### Deploy Worker
```bash
cd worker
uv run pywrangler deploy
```

### Database Migrations
```bash
# Run migration
CLOUDFLARE_ACCOUNT_ID=9afe1741eb5cf958177ce6cc0acdf6fd \
  wrangler d1 execute vinyl-vault --file=migrations/0002_google_oauth.sql --remote
```

### Set Secrets
```bash
cd worker
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put JWT_SECRET
wrangler secret put DISCOGS_KEY
wrangler secret put DISCOGS_SECRET
wrangler secret put TOGETHER_API_KEY
```

## Core Data Files

### record.js
Central data store containing all album records as a `records` array. Each record has:
- `id` - lowercase hyphen-separated slug
- `artist`, `album`, `genre`
- `cover` - album art URL
- `tracks` - array of track names
- `fun` - fun fact string
- `price` - number or null

### Genres
rock, blues, metal, pop, jazz, soul, funk, country, hiphop, folk, classical, experimental, comedy

## Authentication Flow

1. User clicks "Sign in with Google" button
2. Frontend redirects to `/api/auth/google`
3. Worker redirects to Google OAuth consent screen
4. After consent, Google redirects to `/api/auth/google/callback`
5. Worker exchanges code for tokens, creates/updates user in D1
6. Worker redirects to frontend with JWT token in URL params
7. Frontend extracts token, stores in localStorage, clears URL

## Styling Conventions

- Primary accent: `#1db954` (Spotify green)
- Background: `#0e0e0e`, cards: `#1a1a1a`
- Fonts: Orbitron (headings), Montserrat (body)
- Mobile breakpoint: 800px

## Adding New Records

Add entries to `frontend/record.js`:
```javascript
{
  id: "artist-album-slug",
  artist: "Artist Name",
  album: "Album Name",
  genre: "rock",
  cover: "https://...",
  tracks: ["Track 1", "Track 2"],
  fun: "Fun fact about the album",
  price: 25.00
}
```

## Cloudflare Resources

- **Account**: CrookerTech (`9afe1741eb5cf958177ce6cc0acdf6fd`)
- **D1 Database**: vinyl-vault (`a0f6124f-ba4c-4d5d-945b-bfba29b5abd9`)
- **R2 Bucket**: vinyl-vault-cache
- **Worker**: vinyl-vault-api

## Required Secrets

| Secret | Purpose |
|--------|---------|
| `GOOGLE_CLIENT_ID` | Google OAuth2 |
| `GOOGLE_CLIENT_SECRET` | Google OAuth2 |
| `JWT_SECRET` | Token signing |
| `DISCOGS_KEY` | Discogs API |
| `DISCOGS_SECRET` | Discogs API |
| `TOGETHER_API_KEY` | AI chat (Llama-3.3-70B) |

## Features

### Collection Management (mycollection.html)
- **Upload**: PDF or TXT file with "Artist - Album" format
- **Export**: JSON (full data) or CSV (simplified)
- **Import**: JSON files with duplicate detection
- **AI Chat**: Add/remove albums via natural language
- **Discogs Integration**: Auto-fetch covers and prices

### PWA Support
- **Service Worker**: Offline caching with stale-while-revalidate
- **Manifest**: Installable as standalone app
- **Theme**: #1db954 accent color

### Security
- **XSS Protection**: DOMPurify for AI response sanitization
- **API Proxying**: Together.ai calls go through Worker (no exposed key)
- **OAuth2**: Google Sign-In (test users only until app is published)
