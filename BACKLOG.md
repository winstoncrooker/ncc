# Vinyl Vault Engineering Backlog

## Epic: Enhanced My Collection Feature

Users can upload a PDF of their vinyl collection (Artist - Album format), automatically receive album artwork and pricing from Discogs, and have a persistent personalized page with grid view and statistics.

---

### Phase 1: PDF Upload & Parsing
- [x] Add PDF.js integration for client-side PDF text extraction
- [x] Parse PDF content to extract "Artist - Album" pairs
- [ ] Handle various PDF formats and edge cases (multi-column, tables, etc.)
- [x] Display upload progress and validation feedback

### Phase 2: Discogs API Integration
- [x] Set up Discogs API authentication (consumer key/secret)
- [x] Implement album search endpoint (artist + album query)
- [x] Fetch album cover images from Discogs
- [x] Fetch median marketplace prices from Discogs
- [x] Handle rate limiting (60 requests/min for authenticated)
- [x] Cache API responses in localStorage
- [x] Graceful fallbacks for albums not found
- [x] New grid-based UI with album artwork display

### Phase 3: Backend Infrastructure (Python + SQLite)
- [ ] Set up Python backend (Flask or FastAPI)
- [ ] Create SQLite database schema:
  - `users` table (id, email, password_hash, created_at)
  - `collections` table (id, user_id, artist, album, cover_url, price, added_at)
- [ ] Set up user authentication (session-based or JWT)
- [ ] Create API endpoints:
  - POST /api/auth/register - Create new user
  - POST /api/auth/login - User login
  - GET /api/auth/me - Get current user
  - POST /api/collection - Save user collection
  - GET /api/collection - Retrieve user collection
  - PUT /api/collection/:id - Update album in collection
  - DELETE /api/collection/:id - Remove album from collection
- [ ] Implement session management for returning users
- [ ] Set up CORS for frontend communication

### Phase 4: User Collection Page
- [ ] Create personalized collection grid view
  - Album covers in responsive grid
  - Hover states showing artist/album/price
  - Click to view album details
- [ ] Add collection statistics dashboard
  - Total albums count
  - Estimated collection value
  - Genre breakdown chart
  - Most valuable albums list
- [ ] Search and filter functionality within user collection
- [ ] Sort options (artist, album, price, date added)

### Phase 5: Polish & UX
- [ ] Loading states and skeleton screens
- [ ] Error handling and user-friendly messages
- [ ] Mobile-responsive design
- [ ] "Add more albums" flow for returning users
- [ ] Export collection as PDF/CSV option

---

### Phase 6: AI Chat Assistant (NEW)
- [x] Add chat UI to My Collection page
- [x] Integrate Together.ai API with Apriel 1.6 15B Thinker model
- [x] Pass user collection as context to AI
- [x] Handle API key storage in localStorage
- [x] Add ability to add albums via natural language chat
- [ ] Improve conversation memory/persistence

---

## Technical Decisions Made
- **Backend**: Custom Python (Flask or FastAPI)
- **Database**: SQLite
- **Authentication**: Session-based or JWT (TBD during implementation)

## Dependencies
- Discogs API account and credentials
- Python 3.x environment
- Hosting for Python backend (PythonAnywhere, Railway, Render, or local)
