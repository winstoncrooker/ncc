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

### Phase 1: Google OAuth2 Authentication (Primary Auth)

**Goal**: Replace email/password JWT auth with Google OAuth2 as sole authentication mechanism.

#### 1.1 Google Cloud Console Setup (MANUAL STEPS)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project (e.g., "Vinyl Vault")
3. Navigate to **APIs & Services > Credentials**
4. Click **Create Credentials > OAuth 2.0 Client ID**
5. Configure OAuth consent screen:
   - User Type: External
   - App name: "Vinyl Vault"
   - User support email: your email
   - Developer contact: your email
6. Create OAuth 2.0 Client ID:
   - Application type: **Web application**
   - Name: "Vinyl Vault Web"
   - Authorized JavaScript origins:
     - `http://localhost:8787` (dev)
     - `https://vinyl-vault.pages.dev` (prod)
     - Your custom domain if applicable
   - Authorized redirect URIs:
     - `http://localhost:8787/api/auth/google/callback`
     - `https://vinyl-vault-api.christophercrooker.workers.dev/api/auth/google/callback`
7. Copy **Client ID** and **Client Secret**
8. Set secrets in Cloudflare Worker:
   ```bash
   cd worker
   wrangler secret put GOOGLE_CLIENT_ID
   wrangler secret put GOOGLE_CLIENT_SECRET
   ```

#### 1.2 Backend: Google OAuth Routes

Update `worker/src/routes/auth.py`:
- Remove email/password registration
- Add `/auth/google` - Redirect to Google OAuth
- Add `/auth/google/callback` - Handle OAuth callback
- Keep `/auth/me` and `/auth/refresh` for session management

#### 1.3 Frontend: Google Sign-In

- Add Google Sign-In button to UI
- Remove email/password forms
- Handle OAuth redirect flow
- Store JWT token from callback

#### 1.4 Database Schema Update

- Remove `password_hash` from users table (optional, can keep for backwards compat)
- Add `google_id` column for linking Google accounts

---

### Phase 2: Security Improvements

#### 2.1 XSS Sanitization for AI Responses
- Add DOMPurify library
- Sanitize all AI-generated content before rendering
- Sanitize user input display

#### 2.2 Remove Exposed API Keys
- Discogs credentials already moved to Worker secrets
- Together.ai key already proxied through Worker
- Remove any remaining client-side keys

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
| `DISCOGS_KEY` | Discogs API | Set |
| `DISCOGS_SECRET` | Discogs API | Set |
| `TOGETHER_API_KEY` | AI chat | Set |
| `JWT_SECRET` | Token signing | Set |
| `GOOGLE_CLIENT_ID` | OAuth2 | **TO SET** |
| `GOOGLE_CLIENT_SECRET` | OAuth2 | **TO SET** |

---

**Next Step**: Set up Google OAuth2 credentials in Google Cloud Console.
