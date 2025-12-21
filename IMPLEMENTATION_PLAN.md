# Vinyl Vault Implementation Plan (Updated)

**Created**: 2025-12-21
**Updated**: 2025-12-21
**Status**: IN PROGRESS

---

## Architecture Summary

The project has been migrated to Cloudflare Workers:
- **Backend**: Cloudflare Worker (Python/FastAPI) at `vinyl-vault-api.christophercrooker.workers.dev`
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2 (image/data caching)
- **Frontend**: Static files in `frontend/` directory

---

## Remaining Implementation Tasks

### Phase 1: Google OAuth2 Authentication ✅ COMPLETE

**Status**: Fully implemented and tested.

- ✅ GCP Project: `vinyl-vault-0204`
- ✅ OAuth consent screen configured
- ✅ OAuth 2.0 Client ID created
- ✅ Worker secrets set: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- ✅ Backend routes: `/auth/google`, `/auth/google/callback`, `/auth/me`, `/auth/refresh`, `/auth/logout`
- ✅ Frontend: `js/auth.js` with login button and user profile
- ✅ Database: `google_id`, `name`, `picture` columns added to users table
- ✅ Local dev working on localhost:8788

**Files modified:**
- `worker/src/routes/auth.py` - Google OAuth flow
- `frontend/js/auth.js` - Auth state management
- `frontend/css/auth.css` - Auth UI styles
- `frontend/mycollection.html` - Integrated auth UI
- `migrations/0002_google_oauth.sql` - Schema update
- `tools/gcp-init/` - GCP setup automation
- `tools/oauth-setup/` - OAuth configuration tool

---

### Phase 2: Security Improvements ✅ COMPLETE

#### 2.1 XSS Sanitization ✅
- Added DOMPurify library (CDN)
- All AI chat responses sanitized before rendering
- Using `textContent` with DOMPurify for safety

#### 2.2 API Key Security ✅
- **Together.ai key**: Removed from frontend, proxied through Worker `/api/chat/`
- **Discogs keys**: Kept client-side (intentionally)
  - Cloudflare Workers blocked by Discogs (403)
  - Keys are low-risk: read-only, rate-limited
  - Alternative: Use a non-Cloudflare proxy server

---

### Phase 3: Frontend Modularization

#### 3.1 Split mycollection.html into Modules
- `js/collection.js` - Collection display and management
- `js/discogs.js` - Discogs API integration (via cache-first pattern)
- `js/chat.js` - AI chat functionality
- `js/auth.js` - Authentication state management
- `css/mycollection.css` - Page-specific styles

#### 3.2 Shared Navigation Component
- Already exists: `components/nav.js`
- Integrate into all pages

---

### Phase 4: Performance & UX

#### 4.1 Lazy Loading Images
- Add `loading="lazy"` to all album cover images
- Apply to dynamically created images

#### 4.2 Collection Export/Import
- Export to JSON
- Export to CSV
- Import from JSON with merge logic

#### 4.3 Input Validation
- Stricter validation for "Artist - Album" format
- Max field lengths
- Error display

#### 4.4 AI Chat Error Handling
- Retry logic with exponential backoff
- Error messages and retry button
- Loading states

---

### Phase 5: Offline Support

#### 5.1 Service Worker
- Cache static assets
- Cache collection data
- Offline fallback page
- Background sync for changes

#### 5.2 PWA Manifest
- App icons
- Theme colors
- Standalone display mode

---

### Phase 6: Cleanup

#### 6.1 Delete Legacy Files
- Remove any remaining Flask files
- Remove old static genre pages if present
- Clean up test files

#### 6.2 Update Documentation
- Update CLAUDE.md with new architecture
- Update any inline comments

---

## Current File Structure

```
Website/
├── frontend/                    # Static frontend files
│   ├── index.html
│   ├── genre.html
│   ├── album.html
│   ├── stats.html
│   ├── mycollection.html
│   ├── record.js               # Album data
│   ├── utils.js                # Shared utilities
│   ├── style.css               # Global styles
│   ├── components/
│   │   └── nav.js              # Shared navigation
│   ├── js/
│   │   └── config.js           # API configuration
│   └── css/
│       └── (empty, to be populated)
│
├── worker/                      # Cloudflare Worker (Python)
│   ├── src/
│   │   ├── main.py             # FastAPI entry point
│   │   ├── routes/
│   │   │   ├── auth.py         # Authentication (to be updated for OAuth)
│   │   │   ├── collection.py   # Collection CRUD
│   │   │   ├── discogs.py      # Discogs proxy + caching
│   │   │   └── chat.py         # AI chat proxy
│   │   └── ...
│   ├── wrangler.toml           # Worker config
│   └── pyproject.toml          # Python deps
│
├── migrations/                  # D1 database migrations
│   └── 0001_initial.sql
│
├── CLAUDE.md                    # Project documentation
├── IMPLEMENTATION_PLAN.md       # This file
└── REFACTOR.md                  # Cloudflare migration notes
```

---

## Implementation Order

1. **Google OAuth2** - Primary authentication (Phase 1)
2. **XSS Sanitization** - Security critical (Phase 2)
3. **Frontend Modularization** - Code organization (Phase 3)
4. **Performance** - UX improvements (Phase 4)
5. **Offline Support** - PWA features (Phase 5)
6. **Cleanup** - Final polish (Phase 6)

---

## Secrets Required

| Secret | Purpose | Status |
|--------|---------|--------|
| `DISCOGS_KEY` | Discogs API | ✅ Set |
| `DISCOGS_SECRET` | Discogs API | ✅ Set |
| `TOGETHER_API_KEY` | AI chat | ✅ Set |
| `JWT_SECRET` | Token signing | ✅ Set |
| `GOOGLE_CLIENT_ID` | OAuth2 | ✅ Set |
| `GOOGLE_CLIENT_SECRET` | OAuth2 | ✅ Set |

---

**Next Step**: Phase 2 - Security Improvements (XSS sanitization).
