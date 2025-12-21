# Vinyl Vault Implementation Plan

**Created**: 2025-12-21
**Status**: PENDING USER APPROVAL
**Scope**: 12 improvements based on code review

---

## Context & Decisions

| Question | Answer |
|----------|--------|
| Authentication | JWT with offline-to-online merge library |
| Discogs API key | Single personal key, proxy through server |
| Together.ai key | Remove custom key option, use single hardcoded key |
| Legacy pages | Delete after confirming genre.html coverage |
| Collection size | 1-1000 albums expected |
| Offline support | Resiliency backup only (service worker) |
| Deployment | Multi-user, self-hosted now, Cloudflare research in progress |

---

## Implementation Tasks

### Phase 1: Security (Critical)

#### 1.1 Move API Credentials to Environment Variables
**Files affected**: `server.py`, `mycollection.html`

- Create `.env` file (add to `.gitignore`)
- Install `python-dotenv` for Flask
- Move Discogs credentials to `.env`:
  ```
  DISCOGS_KEY=yRxzvHyveKiFOEHuwmcW
  DISCOGS_SECRET=GnnPcnLGovdJLMfMyEpaSRoXOsRqojBr
  TOGETHER_API_KEY=cd6f547c5977a88af60b786907b065bfb293faab06dc78d35c50fe230f249161
  ```
- Update `server.py` to load from environment
- Add Together.ai proxy endpoint to `server.py`
- Remove hardcoded keys from `mycollection.html`

#### 1.2 Remove Custom API Key Option
**Files affected**: `mycollection.html`

- Remove API key setup UI (`apiKeySetup` div)
- Remove `saveApiKey()` function
- Remove localStorage API key logic
- All API calls route through server proxy

#### 1.3 Add XSS Sanitization for AI Responses
**Files affected**: `mycollection.html`

- Add DOMPurify library (CDN or bundled)
- Sanitize AI responses before rendering
- Sanitize user input display

---

### Phase 2: Structure & Organization

#### 2.1 Extract Navigation to Shared Component
**Files affected**: All HTML files

- Create `components/nav.js` that injects navigation
- Single source of truth for nav links
- Include hamburger menu logic

#### 2.2 Delete Legacy Static Pages
**Files affected**: `rock.html`, `blues.html`, `misc.html`

- Verify all content accessible via `genre.html?genre=X`
- Delete redundant files
- Update any internal links if needed

#### 2.3 Consolidate Utility Functions
**Files affected**: `utils.js`, `index.html`, `genre.html`, `album.html`

- Remove inline `getRecordById`, `getRecordsByGenre`, `formatPrice` definitions
- Ensure `utils.js` loads before usage in all pages
- Add `escapeHtml` to utils.js (currently only in mycollection.html)

#### 2.4 Split mycollection.html into Modules
**New files**:
- `js/collection.js` - Collection management, display, search
- `js/discogs.js` - Discogs API integration
- `js/chat.js` - AI chat functionality
- `css/mycollection.css` - Page-specific styles

---

### Phase 3: Performance

#### 3.1 Add Lazy Loading to Images
**Files affected**: `index.html`, `genre.html`, `album.html`, `stats.html`, `mycollection.html`

- Add `loading="lazy"` attribute to album cover images
- Apply to dynamically created images via JS

#### 3.2 Implement Service Worker for Offline Resiliency
**New files**: `sw.js`, `manifest.json`

- Cache static assets (HTML, CSS, JS, fonts)
- Cache `record.js` data
- Offline fallback page
- Background sync for collection updates when back online

---

### Phase 4: Reliability & Data Handling

#### 4.1 Add Collection Export/Import
**Files affected**: `mycollection.html` (or new `js/collection.js`)

- Export to JSON button
- Export to CSV button
- Import from JSON file
- Merge logic for duplicates

#### 4.2 Add Input Validation for Uploads
**Files affected**: `mycollection.html`

- Stricter regex for "Artist - Album" format
- Max artist/album name length (255 chars)
- Reject entries with suspicious content
- Display validation errors clearly

#### 4.3 Implement AI Chat Error Handling & Retry
**Files affected**: `mycollection.html` (or new `js/chat.js`)

- Exponential backoff on API failures
- Retry button for failed messages
- Rate limiting indicator
- Graceful degradation message

---

### Phase 5: Authentication & Sync (JWT)

#### 5.1 Research & Select JWT Library
**Candidates for offline-to-online merge**:
- **localForage + JWT**: IndexedDB wrapper with JWT auth
- **PouchDB + CouchDB**: Automatic sync with conflict resolution
- **Dexie.js + custom sync**: IndexedDB with manual sync logic
- **RxDB**: Reactive database with offline-first sync

**Recommended**: Dexie.js with custom JWT sync
- Lightweight (~20KB)
- IndexedDB-based (larger storage than localStorage)
- Observable queries
- Easy JWT integration

#### 5.2 Database Schema
```javascript
// Dexie schema
db.version(1).stores({
  collections: '++id, odId, artist, album, genre, cover, price, synced',
  syncQueue: '++id, action, data, timestamp'
});
```

#### 5.3 Server Endpoints (Flask)
```
POST /api/auth/register - Create account
POST /api/auth/login - Get JWT token
POST /api/auth/refresh - Refresh token
GET  /api/collection - Get user's collection
POST /api/collection/sync - Sync offline changes
```

#### 5.4 Sync Strategy
1. Local changes stored in IndexedDB immediately
2. Changes queued in `syncQueue` table
3. When online, sync queue processed
4. Server returns merged state
5. Conflicts resolved by timestamp (last-write-wins) or user choice

---

## File Structure After Implementation

```
Website/
├── .env                    # API credentials (gitignored)
├── .gitignore              # Add .env, cache/, *.pyc
├── index.html
├── genre.html
├── album.html
├── stats.html
├── mycollection.html
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker
├── record.js
├── utils.js
├── style.css
├── server.py               # Enhanced with auth + proxy
├── components/
│   └── nav.js              # Shared navigation
├── js/
│   ├── collection.js       # Collection management
│   ├── discogs.js          # Discogs integration
│   ├── chat.js             # AI chat
│   └── sync.js             # Offline sync logic
├── css/
│   └── mycollection.css    # Page-specific styles
├── cache/                  # Discogs cache (gitignored)
│   ├── images/
│   └── data/
├── CLAUDE.md
├── BACKLOG.md
└── IMPLEMENTATION_PLAN.md
```

---

## Dependencies to Add

### Python (server.py)
```
flask
flask-cors
python-dotenv
PyJWT
bcrypt (for password hashing)
```

### Frontend (CDN or bundled)
```
DOMPurify - XSS sanitization
Dexie.js - IndexedDB wrapper
PDF.js - Already in use
```

---

## Deployment Considerations (Cloudflare)

### Cloudflare Pages (Static Frontend)
- Host HTML/CSS/JS files
- Automatic CDN distribution
- Free SSL

### Cloudflare Workers (API Backend)
- Serverless Python alternative: Convert Flask to Workers
- Or: Use Cloudflare Tunnel to self-hosted Flask

### Cloudflare D1 (SQLite Database)
- Serverless SQLite at edge
- Compatible with existing SQLite schema plans

### Migration Path
1. Deploy static files to Cloudflare Pages
2. Keep Flask server self-hosted initially
3. Use Cloudflare Tunnel for API
4. Optional: Migrate to Workers + D1 later

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking existing functionality | Keep backup of current state, incremental deploys |
| localStorage to IndexedDB migration | One-time migration script on first load |
| API key exposure during transition | Server proxy first, then remove client keys |
| Sync conflicts | Last-write-wins with optional manual resolution |

---

## Estimated Complexity

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| Phase 1: Security | Medium | python-dotenv, DOMPurify |
| Phase 2: Structure | Low-Medium | None |
| Phase 3: Performance | Low | None |
| Phase 4: Reliability | Medium | None |
| Phase 5: Auth/Sync | High | Dexie.js, PyJWT, bcrypt |

---

## Questions for User Before Implementation

*Awaiting user questions before proceeding*

---

**Status**: Plan finalized, implementation PAUSED pending user questions.
