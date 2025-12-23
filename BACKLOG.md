# Niche Collector Connector - Project Backlog

## Current State (December 2024)

The platform has been fully migrated from a local Flask/SQLite stack to Cloudflare's edge infrastructure:
- **Backend**: Cloudflare Workers with Python/FastAPI
- **Database**: Cloudflare D1 (SQLite-compatible)
- **Storage**: Cloudflare R2 (image caching)
- **Auth**: Google OAuth2 with JWT tokens
- **AI**: Together.ai (Apriel 1.6 15B Thinker)
- **Frontend**: Vanilla HTML/CSS/JS (Cloudflare Pages)

---

## Completed Features

### Core Platform
- [x] Google OAuth2 authentication
- [x] User profiles (bio, pronouns, background image)
- [x] Multi-category support (vinyl, cards, cars, sneakers, watches, comics, games, coins)
- [x] Category-specific profiles and showcases
- [x] Collection management (add, edit, delete items)
- [x] Showcase feature (8 items per category)
- [x] Discogs integration for vinyl records
- [x] AI chat assistant for profile/collection help
- [x] PWA support with offline caching

### Social Features
- [x] Friends system (add, accept, reject)
- [x] Friend request notifications
- [x] View friend profiles and collections
- [x] Direct messaging between friends
- [x] Unread message indicators

### Forum System
- [x] Category-based forums
- [x] Interest groups within categories
- [x] Post types (discussion, showcase, WTT/WTS, question)
- [x] Comments with threading
- [x] Upvote/downvote system
- [x] Image uploads in posts and comments
- [x] User-created interest groups

### Admin
- [x] Admin user list page
- [x] CSV export of user data

---

## Backlog

### High Priority

#### Security Improvements
- [ ] Add rate limiting to API endpoints
- [ ] Move Discogs API calls to server-side proxy
- [ ] Add CSRF protection
- [ ] Implement session invalidation on logout

#### Code Quality
- [ ] Split profile.js into modules (3400+ lines)
- [ ] Add automated tests (Python backend)
- [ ] Add frontend component tests
- [ ] Set up CI/CD pipeline

### Medium Priority

#### Feature Enhancements
- [ ] Email notifications for messages/friend requests
- [ ] Push notifications (PWA)
- [ ] Collection statistics dashboard
- [ ] Search within own collection
- [ ] Sort/filter options for collection
- [ ] Bulk import from CSV/text files

#### Forum Improvements
- [ ] Bookmark/save posts
- [ ] Post edit history
- [ ] Moderator tools
- [ ] Report system
- [ ] Rich text editor for posts

#### Profile Enhancements
- [ ] Profile visibility settings (public/friends/private)
- [ ] Activity feed on profile
- [ ] Collection value estimates
- [ ] Trade/wishlist features

### Low Priority

- [ ] Dark/light theme toggle
- [ ] Multiple language support
- [ ] API documentation (Swagger/OpenAPI)
- [ ] Mobile app (React Native or Flutter)
- [ ] Analytics dashboard for admins

---

## Technical Debt

- [ ] Remove legacy files from repository (now in /legacy)
- [ ] Update migration naming (0010 duplicates fixed)
- [ ] Document API endpoints comprehensively
- [ ] Add database backup strategy
- [ ] Performance optimization for large collections

---

## Infrastructure

| Service | Purpose |
|---------|---------|
| Cloudflare Workers | Python/FastAPI backend |
| Cloudflare D1 | SQLite database |
| Cloudflare R2 | Image/cache storage |
| Cloudflare Pages | Static frontend hosting |
| Together.ai | AI chat (Apriel 1.6 15B) |
| Google Cloud | OAuth2 authentication |
| Discogs API | Vinyl record data |

---

## Notes

- AI model must remain `ServiceNow-AI/Apriel-1.6-15b-Thinker`
- CORS is restricted to production domains
- JsProxy conversion required for D1 query results
- See CLAUDE.md for development standards and workflows
