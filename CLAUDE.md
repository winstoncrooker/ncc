# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Niche Collector Connector is a profile-based social platform for vinyl collectors. Users sign in with Google, create their profile, build their vinyl collection, and showcase their favorite records. The AI assistant helps with profile creation and collection management.

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
│   ├── index.html              # Login page (Google Sign-In)
│   ├── profile.html            # Main profile page with showcase
│   ├── style.css               # Global styles
│   ├── js/
│   │   ├── config.js           # API configuration
│   │   ├── auth.js             # Google OAuth authentication
│   │   └── profile.js          # Profile page logic
│   ├── css/
│   │   ├── auth.css            # Auth UI styles
│   │   └── profile.css         # Profile page styles
│   ├── manifest.json           # PWA manifest
│   └── sw.js                   # Service worker (offline support)
│
├── worker/                      # Cloudflare Worker (Python/FastAPI)
│   ├── src/
│   │   ├── main.py             # FastAPI entry point
│   │   └── routes/
│   │       ├── auth.py         # Google OAuth2 authentication
│   │       ├── profile.py      # User profile CRUD + showcase
│   │       ├── collection.py   # User collection CRUD
│   │       ├── discogs.py      # Discogs proxy + R2 caching
│   │       └── chat.py         # Together.ai AI proxy
│   ├── wrangler.toml           # Worker config (D1, R2 bindings)
│   └── pyproject.toml          # Python dependencies
│
├── migrations/                  # D1 database migrations
│   ├── 0001_initial.sql        # Users and collections tables
│   ├── 0002_google_oauth.sql   # Google OAuth columns
│   └── 0003_profile_fields.sql # Profile fields and showcase table
│
├── tools/                       # Setup automation tools
│   ├── gcp-init/               # GCP project setup
│   └── oauth-setup/            # OAuth credential configuration
│
├── CLAUDE.md                    # This file
├── IMPLEMENTATION_PLAN.md       # Implementation roadmap
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

### User Profile (requires auth)
```
GET    /api/profile/me                 # Get user profile
PUT    /api/profile/me                 # Update profile (bio, pronouns, etc.)
GET    /api/profile/me/showcase        # Get showcase albums
POST   /api/profile/me/showcase        # Add album to showcase
DELETE /api/profile/me/showcase/{id}   # Remove from showcase
PUT    /api/profile/me/showcase/reorder # Reorder showcase albums
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
```

**Note**: Direct Worker→Discogs requests are blocked by Cloudflare. Client-side Discogs calls are used instead.

### AI Chat
```
POST /api/chat                  # Send message to AI
```

## Development

### Local Development (Worker)
```bash
cd worker
uv run pywrangler dev
```

### Frontend Server
```bash
cd frontend
python3 -m http.server 8000
```

### Deploy Worker
```bash
cd worker
uv run pywrangler deploy
```

### Deploy Frontend to Cloudflare Pages
```bash
CLOUDFLARE_ACCOUNT_ID=9afe1741eb5cf958177ce6cc0acdf6fd npx wrangler pages deploy frontend/ --project-name=niche-collector
```

### After Every Edit
Always commit, push, and deploy after making changes:
```bash
git add -A && git commit -m "Description of changes" && git push
CLOUDFLARE_ACCOUNT_ID=9afe1741eb5cf958177ce6cc0acdf6fd npx wrangler pages deploy frontend/ --project-name=niche-collector
```

### Database Migrations
```bash
# Run migration locally
cd worker
npx wrangler d1 execute vinyl-vault --local --file=../migrations/0003_profile_fields.sql

# Run migration on production
CLOUDFLARE_ACCOUNT_ID=9afe1741eb5cf958177ce6cc0acdf6fd \
  wrangler d1 execute vinyl-vault --file=migrations/0003_profile_fields.sql --remote
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

## Authentication Flow

1. User visits index.html, sees login prompt
2. User clicks "Sign in with Google" button
3. Frontend redirects to `/api/auth/google`
4. Worker redirects to Google OAuth consent screen
5. After consent, Google redirects to `/api/auth/google/callback`
6. Worker exchanges code for tokens, creates/updates user in D1
7. Worker redirects to `/profile.html` with JWT token in URL params
8. Frontend extracts token, stores in localStorage, clears URL
9. Profile page loads user data and renders

## Database Schema

### Users Table
- `id`, `email`, `password_hash` (legacy), `google_id`
- `name`, `picture` (from Google)
- `bio`, `pronouns`, `background_image` (profile fields)
- `created_at`

### Collections Table
- `id`, `user_id`, `artist`, `album`
- `genre`, `cover`, `price`, `discogs_id`, `year`
- `created_at`, `updated_at`

### Showcase Albums Table
- `id`, `user_id`, `collection_id`, `position`
- `created_at`

## Styling Conventions

- Primary accent: `#1db954` (Spotify green)
- Background: `#0e0e0e`, cards: `#1a1a1a`
- Fonts: Orbitron (headings), Montserrat (body)
- Mobile breakpoint: 768px

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
| `TOGETHER_API_KEY` | AI chat (Apriel-1.6-15b-Thinker) |

## Features

### Profile Page
- **Profile Card**: Picture, name, pronouns, bio
- **Showcase**: Up to 8 featured albums from collection
- **Collection Grid**: All albums in user's collection
- **Edit Mode**: Update profile info via modal

### AI Assistant Sidebar
- Draggable sidebar with chat interface
- Helps write bios, add records, get recommendations
- Supports .txt file upload for bulk album adding
- Uses `ServiceNow-AI/Apriel-1.6-15b-Thinker` via Together.ai
- **IMPORTANT: NEVER change the AI model from `ServiceNow-AI/Apriel-1.6-15b-Thinker`**

### Collection Management
- Manual entry: Artist, album, year, cover URL
- Discogs search: Find and add albums from Discogs
- AI-powered: Add/remove via natural language

### PWA Support
- **Service Worker**: Offline caching with stale-while-revalidate
- **Manifest**: Installable as standalone app
- **Theme**: #1db954 accent color

### Security
- **XSS Protection**: DOMPurify for AI response sanitization
- **API Proxying**: Together.ai calls go through Worker (no exposed key)
- **OAuth2**: Google Sign-In (test users only until app is published)
- **Auth Required**: All pages require login (no public browsing)

---

# Development Standards

For every task, work through these phases sequentially and show your work at each step:

## Phase 1: Architect
- Analyze requirements and edge cases
- Consider how this fits into the existing codebase structure
- Identify potential impacts on other parts of the system
- Choose appropriate design patterns
- Plan the file structure and module organization

## Phase 2: Security Analyst
- Authentication/authorization implications
- Input validation requirements
- SQL injection, XSS, CSRF vulnerabilities
- Sensitive data exposure risks
- API rate limiting needs
- Environment variable and secrets handling

## Phase 3: Developer
- Clean, readable, self-documenting code
- Proper error handling and logging
- TypeScript types or proper type hints (if applicable)
- Consistent naming conventions
- DRY principles without over-abstraction
- Comments only where intent isn't obvious

## Phase 4: Database Expert
- Optimal schema design
- Proper indexing strategy
- Query performance considerations
- Migration safety (backwards compatible if needed)
- Data validation at the DB level

## Phase 5: API Designer
- RESTful conventions (or GraphQL best practices)
- Consistent error response formats
- Proper HTTP status codes
- Request/response validation
- API versioning considerations
- Documentation (OpenAPI/Swagger if applicable)

## Phase 6: Frontend Specialist
- Component structure and reusability
- Accessibility (WCAG compliance)
- Responsive design
- Loading and error states
- Optimistic updates where appropriate
- Performance (bundle size, lazy loading)

## Phase 7: Test Engineer
- Unit tests for business logic
- Integration tests for API endpoints
- Component tests for UI (if applicable)
- Edge cases and error conditions
- Identify what should be mocked vs real

## Phase 8: Code Reviewer
- Identify any code smells
- Check for potential race conditions
- Verify error handling completeness
- Assess maintainability and readability
- Look for premature optimization or over-engineering
- Confirm naming clarity

## Phase 9: DevOps Engineer
- Environment configuration
- Deployment implications
- Logging and monitoring hooks
- Performance bottlenecks
- Caching opportunities
- CI/CD impact

## Phase 10: Final Pass
- Address any issues found in the review phase
- Ensure all phases are satisfied
- Provide a summary of what was built and any tradeoffs made

Always be critical of your own work. If you find issues at any phase, go back and fix them before proceeding. Production-quality code only, not prototypes.
