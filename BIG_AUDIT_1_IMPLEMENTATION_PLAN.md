# BIG_AUDIT_1: Implementation Plan

## Progress Tracking

All execution progress is tracked in `BIG_AUDIT_1_LOG.md`.

Each agent appends progress using simple echo commands:
```bash
echo "[TIMESTAMP] [AGENT_ID] [TASK_ID] [STATUS] [NOTES]" >> BIG_AUDIT_1_LOG.md
```

Status values: `STARTED` | `IN_PROGRESS` | `BLOCKED` | `COMPLETED` | `FAILED`

Do NOT use structured data files or per-task status files.
Forward scan validates completion state; tail shows recent activity.

---

## Phase 1: Security & Stability

> **Goal**: Eliminate all CRITICAL security vulnerabilities and data integrity issues.
> **Prerequisite**: None
> **Validation**: Security scan passes, no XSS/CSRF/info leakage

### Wave 1.1: XSS Vulnerabilities (PARALLEL)

These tasks are independent and can run concurrently.

| Task ID | Description | Files | Dependencies | Parallel |
|---------|-------------|-------|--------------|----------|
| 1.1.1 | Fix XSS in template system - wrap all user data in Utils.escapeHtml() | `frontend/js/templates/index.js` | None | Yes |
| 1.1.2 | Fix XSS in public profile - sanitize innerHTML content | `frontend/public.html` | None | Yes |
| 1.1.3 | Fix XSS in admin panel - apply escapeHtml consistently | `frontend/admin.html` | None | Yes |

#### Task 1.1.1 Details
```
File: frontend/js/templates/index.js
Lines: 42-67, 176-225, all template render functions

Find all instances of:
  ${profile.display_name}
  ${profile.bio}
  ${item.title}
  ${item.subtitle}
  ${item.artist}
  ${item.album}

Replace with:
  ${Utils.escapeHtml(profile.display_name || '')}
  ${Utils.escapeHtml(profile.bio || '')}
  etc.
```

#### Task 1.1.2 Details
```
File: frontend/public.html
Lines: 528-534

Find innerHTML assignments with template literals containing user data.
Either:
  a) Use textContent for text-only content
  b) Use DOMPurify.sanitize() for rich content
  c) Build DOM elements programmatically
```

#### Task 1.1.3 Details
```
File: frontend/admin.html
Lines: 778-803

Ensure ALL user-controlled fields use escapeHtml():
  - user.name
  - user.email
  - user.picture (as src, needs URL validation)
  - report content
  - any other user-provided data
```

### Wave 1.2: Backend Security (SEQUENTIAL)

These tasks must run in order.

| Task ID | Description | Files | Dependencies | Parallel |
|---------|-------------|-------|--------------|----------|
| 1.2.1 | Fix information leakage in exception handler | `worker/src/main.py` | None | No |
| 1.2.2 | Apply CSRF protection to all mutation endpoints | `worker/src/routes/*.py` (all 22 files) | 1.2.1 | No |

#### Task 1.2.1 Details
```
File: worker/src/main.py
Line: 115

Current:
  content={"detail": str(exc)}

Change to:
  content={"detail": "An internal error occurred. Please try again."}

Also add logging (if logging available):
  print(f"[ERROR] {request.method} {request.url}: {exc}")
```

#### Task 1.2.2 Details
```
Files: All worker/src/routes/*.py

For each file, find all @router.post, @router.put, @router.delete, @router.patch
that use Depends(require_auth) and change to Depends(require_csrf)

EXCEPT:
  - auth.py: POST /logout can stay require_auth (already logged in)
  - auth.py: POST /refresh needs auth but not CSRF (token exchange)

Files to update:
  - admin.py
  - blocks.py
  - category_profiles.py
  - chat.py
  - collection.py
  - comments.py
  - friends.py
  - interests.py
  - marketplace.py
  - messages.py
  - moderation.py
  - notifications.py
  - posts.py
  - profile.py
  - upload.py
  - votes.py
  - wishlist.py

Also fix duplicate imports: require_auth, require_auth -> require_auth
```

### Wave 1.3: Race Conditions (PARALLEL)

| Task ID | Description | Files | Dependencies | Parallel |
|---------|-------------|-------|--------------|----------|
| 1.3.1 | Add polling guard to prevent overlapping requests | `frontend/js/profile-messages.js` | None | Yes |
| 1.3.2 | Fix comment deletion race condition | `worker/src/routes/comments.py` | None | Yes |

#### Task 1.3.1 Details
```
File: frontend/js/profile-messages.js
Lines: 46-62

Add a guard flag:

// Add to module state
isPolling: false,

// Modify polling function
async pollForUpdates() {
  if (this.isPolling) return;
  this.isPolling = true;
  try {
    await ProfileFriends.loadFriendRequests();
    await ProfileFriends.loadFriends();
    await this.loadUnreadCount();
  } finally {
    this.isPolling = false;
  }
}
```

#### Task 1.3.2 Details
```
File: worker/src/routes/comments.py
Lines: 423-447

Combine count and delete into single operation or use transaction.
Option: Delete with RETURNING and count result rows.
```

### Wave 1.4: Validation & Testing

| Task ID | Description | Files | Dependencies | Parallel |
|---------|-------------|-------|--------------|----------|
| 1.4.1 | Manual XSS testing - attempt to inject script tags | All fixed files | 1.1.1, 1.1.2, 1.1.3 | No |
| 1.4.2 | CSRF validation - verify tokens required | API endpoints | 1.2.2 | No |
| 1.4.3 | Deploy and smoke test Phase 1 | All | 1.4.1, 1.4.2 | No |

---

## Phase 2: DRY Compliance

> **Goal**: Eliminate code duplication, especially the 1500+ lines of inline CSS
> **Prerequisite**: Phase 1 complete
> **Validation**: No duplicate CSS blocks, CSS files properly linked

### Wave 2.1: CSS Extraction (PARALLEL)

| Task ID | Description | Files | Dependencies | Parallel |
|---------|-------------|-------|--------------|----------|
| 2.1.1 | Extract admin.html inline CSS to admin.css | `frontend/admin.html`, `frontend/css/admin.css` (new) | None | Yes |
| 2.1.2 | Extract landing.html inline CSS to landing.css | `frontend/landing.html`, `frontend/css/landing.css` (new) | None | Yes |
| 2.1.3 | Create legal.css from privacy/terms shared styles | `frontend/css/legal.css` (new), `privacy.html`, `terms.html` | None | Yes |
| 2.1.4 | Extract public.html inline CSS to public.css | `frontend/public.html`, `frontend/css/public.css` (new) | None | Yes |
| 2.1.5 | Extract 404.html inline CSS to error.css | `frontend/404.html`, `frontend/css/error.css` (new) | None | Yes |
| 2.1.6 | Extract index.html inline CSS (extend auth.css) | `frontend/index.html`, `frontend/css/auth.css` | None | Yes |

#### Task 2.1.1 Details
```
1. Create frontend/css/admin.css
2. Move lines 17-560 from admin.html to admin.css
3. Add <link rel="stylesheet" href="css/admin.css"> to admin.html <head>
4. Remove <style> block from admin.html
5. Verify all selectors still work
```

#### Task 2.1.3 Details (Shared Legal CSS)
```
1. Create frontend/css/legal.css
2. Extract common styles from privacy.html (lines 16-207)
3. Update privacy.html: remove <style>, add <link>
4. Update terms.html: remove <style>, add <link>
5. Merge any terms.html-specific styles into legal.css
```

### Wave 2.2: CSS Consolidation (SEQUENTIAL)

| Task ID | Description | Files | Dependencies | Parallel |
|---------|-------------|-------|--------------|----------|
| 2.2.1 | Merge duplicate .card selector definitions | `frontend/style.css` | 2.1.* | No |
| 2.2.2 | Merge duplicate .main-tabs definitions | `frontend/css/forums.css` | 2.1.* | No |
| 2.2.3 | Consolidate CSS variables to single :root | `frontend/style.css`, `frontend/css/profile.css` | 2.2.1, 2.2.2 | No |
| 2.2.4 | Remove duplicate @keyframes spin | `frontend/css/auth.css`, `frontend/css/profile.css` | 2.2.3 | No |

#### Task 2.2.1 Details
```
File: frontend/style.css
Lines: 204, 220 (and around 301, 318 for .vinyl)

Find all duplicate selector definitions and merge into single declarations.
Keep the more complete version, add any missing properties from the other.
```

### Wave 2.3: Backend DRY Fixes (PARALLEL)

| Task ID | Description | Files | Dependencies | Parallel |
|---------|-------------|-------|--------------|----------|
| 2.3.1 | Remove duplicate imports across all route files | All `worker/src/routes/*.py` | None | Yes |
| 2.3.2 | Remove unused import json | `worker/src/routes/search.py` | None | Yes |
| 2.3.3 | Remove backwards compat alias | `worker/src/routes/posts.py` | None | Yes |

#### Task 2.3.1 Details
```
Files with duplicate imports to fix:
- posts.py:10 - remove duplicate require_auth
- comments.py:9 - remove duplicate require_auth
- admin.py:8 - remove duplicate require_auth
- messages.py:9 - remove duplicate require_auth
- marketplace.py:14 - check for duplicates

Pattern: from routes.auth import require_auth, require_auth
Fix to: from routes.auth import require_auth
```

### Wave 2.4: Validation

| Task ID | Description | Files | Dependencies | Parallel |
|---------|-------------|-------|--------------|----------|
| 2.4.1 | Visual regression test all pages | All HTML | 2.1.*, 2.2.* | No |
| 2.4.2 | Verify CSS specificity unchanged | All CSS | 2.2.* | No |
| 2.4.3 | Deploy and smoke test Phase 2 | All | 2.4.1, 2.4.2 | No |

---

## Phase 3: SOLID Refactoring

> **Goal**: Improve code architecture by splitting god objects and reducing coupling
> **Prerequisite**: Phase 2 complete
> **Validation**: Each module has single responsibility, clean imports

### Wave 3.1: Chat Service Split (SEQUENTIAL)

| Task ID | Description | Files | Dependencies | Parallel |
|---------|-------------|-------|--------------|----------|
| 3.1.1 | Create services directory structure | `worker/src/services/` | None | No |
| 3.1.2 | Extract Discogs API handling to service | `worker/src/services/discogs_api.py` (new) | 3.1.1 | No |
| 3.1.3 | Extract Pokemon TCG API to service | `worker/src/services/pokemon_api.py` (new) | 3.1.1 | No |
| 3.1.4 | Extract Scryfall API to service | `worker/src/services/scryfall_api.py` (new) | 3.1.1 | No |
| 3.1.5 | Extract RAWG API to service | `worker/src/services/rawg_api.py` (new) | 3.1.1 | No |
| 3.1.6 | Refactor chat.py to use service modules | `worker/src/routes/chat.py` | 3.1.2-3.1.5 | No |

#### Task 3.1.2 Details
```
1. Create worker/src/services/discogs_api.py
2. Move Discogs-related functions from chat.py:
   - search_discogs()
   - get_discogs_release()
   - Any Discogs-specific parsing
3. Export as module functions or class
4. Update chat.py to import from services.discogs_api
```

### Wave 3.2: Email Template Refactor (SEQUENTIAL)

| Task ID | Description | Files | Dependencies | Parallel |
|---------|-------------|-------|--------------|----------|
| 3.2.1 | Create generic send_notification_email function | `worker/src/services/email.py` | None | No |
| 3.2.2 | Refactor individual notification functions to use generic | `worker/src/services/email.py` | 3.2.1 | No |
| 3.2.3 | Update all callers of email functions | All routes that send email | 3.2.2 | No |

#### Task 3.2.1 Details
```
Create a single function:
async def send_notification_email(
    env,
    notification_type: str,  # 'friend_request', 'message', 'offer', etc.
    recipient_user_id: int,
    context: dict  # Template-specific data
) -> bool:
    # Check notification enabled
    # Get recipient email
    # Select template based on type
    # Send via Resend API

Replace 7 similar functions with calls to this one.
```

### Wave 3.3: Frontend Module Fixes (PARALLEL)

| Task ID | Description | Files | Dependencies | Parallel |
|---------|-------------|-------|--------------|----------|
| 3.3.1 | Fix friends.js method references to use Utils | `frontend/js/modules/friends.js` | None | Yes |
| 3.3.2 | Fix messages.js profile reference | `frontend/js/modules/messages.js` | None | Yes |
| 3.3.3 | Fix search.js getCurrentUser reference | `frontend/js/modules/search.js` | None | Yes |
| 3.3.4 | Fix marketplace.js implicit event global | `frontend/js/modules/marketplace.js` | None | Yes |

### Wave 3.4: Validation

| Task ID | Description | Files | Dependencies | Parallel |
|---------|-------------|-------|--------------|----------|
| 3.4.1 | Test all chat API integrations | Chat functionality | 3.1.6 | No |
| 3.4.2 | Test all email notifications | Email system | 3.2.3 | No |
| 3.4.3 | Test frontend module functions | JS modules | 3.3.* | No |
| 3.4.4 | Deploy and smoke test Phase 3 | All | 3.4.1-3.4.3 | No |

---

## Phase 4: Code Quality & O&O Compliance

> **Goal**: Improve readability, remove dead code, add constants
> **Prerequisite**: Phase 3 complete
> **Validation**: No magic numbers, descriptive variable names, no unused code

### Wave 4.1: Extract Constants (PARALLEL)

| Task ID | Description | Files | Dependencies | Parallel |
|---------|-------------|-------|--------------|----------|
| 4.1.1 | Create backend constants file and extract magic numbers | `worker/src/constants.py` (new), routes | None | Yes |
| 4.1.2 | Extract frontend magic numbers to CONFIG | `frontend/js/config.js`, JS files | None | Yes |

#### Task 4.1.1 Details
```
Create worker/src/constants.py:
MAX_SHOWCASE_ITEMS = 8
MAX_MESSAGE_LENGTH = 1000
MAX_BIO_LENGTH = 2000
COMMENT_MAX_DEPTH = 3
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 50
RATE_LIMIT_WINDOW_SECONDS = 60
# etc.

Update usages in:
- profile.py:377 - showcase limit
- messages.py:197-198 - message length
- comments.py:16 - already has MAX_DEPTH, good
```

#### Task 4.1.2 Details
```
Add to frontend/js/config.js:
const CONFIG = {
  // ... existing
  POLLING_INTERVAL_MS: 5000,
  DEBOUNCE_MS: 300,
  MIN_SEARCH_LENGTH: 2,
  MAX_SEARCH_RESULTS: 5,
  // etc.
};

Update usages in:
- search.js:8-10
- profile-messages.js:62
- modules/messages.js:47
```

### Wave 4.2: Variable Naming Fixes (PARALLEL)

| Task ID | Description | Files | Dependencies | Parallel |
|---------|-------------|-------|--------------|----------|
| 4.2.1 | Fix single-letter variables in chat.js | `frontend/js/modules/chat.js` | None | Yes |
| 4.2.2 | Fix abbreviated variables in messages.js | `frontend/js/modules/messages.js` | None | Yes |
| 4.2.3 | Fix abbreviated variables in profile-messages.js | `frontend/js/profile-messages.js` | None | Yes |
| 4.2.4 | Fix single-letter variables in marketplace.js | `frontend/js/modules/marketplace.js` | None | Yes |

#### Task 4.2.1 Details
```
File: frontend/js/modules/chat.js
Line: 35 (and similar)

Find: .map(a => ...)
Replace with: .map(album => ...) or appropriate name based on context
```

### Wave 4.3: YAGNI Cleanup (PARALLEL)

| Task ID | Description | Files | Dependencies | Parallel |
|---------|-------------|-------|--------------|----------|
| 4.3.1 | Remove unused backwards compat alias | `worker/src/routes/posts.py` | None | Yes |
| 4.3.2 | Remove unused import json | `worker/src/routes/search.py` | None | Yes |
| 4.3.3 | Remove unused utility classes from admin.html | `frontend/admin.html` | None | Yes |

### Wave 4.4: Deprecated API Fixes (PARALLEL)

| Task ID | Description | Files | Dependencies | Parallel |
|---------|-------------|-------|--------------|----------|
| 4.4.1 | Replace datetime.utcnow() with timezone-aware | `worker/src/routes/auth.py` | None | Yes |
| 4.4.2 | Move imports from inside functions to module level | `worker/src/routes/auth.py`, `rate_limit.py` | None | Yes |

#### Task 4.4.1 Details
```
File: worker/src/routes/auth.py
Lines: 58-59

Current:
  "exp": datetime.utcnow() + timedelta(days=7),
  "iat": datetime.utcnow()

Change to:
  "exp": datetime.now(timezone.utc) + timedelta(days=7),
  "iat": datetime.now(timezone.utc)

Ensure timezone is imported: from datetime import datetime, timedelta, timezone
```

### Wave 4.5: Final Validation

| Task ID | Description | Files | Dependencies | Parallel |
|---------|-------------|-------|--------------|----------|
| 4.5.1 | Run linter on all Python files | Backend | 4.1.1, 4.3.*, 4.4.* | No |
| 4.5.2 | Run linter on all JavaScript files | Frontend | 4.1.2, 4.2.*, 4.3.3 | No |
| 4.5.3 | Full application smoke test | All | 4.5.1, 4.5.2 | No |
| 4.5.4 | Deploy Phase 4 and final verification | All | 4.5.3 | No |

---

## Task Dependency Graph

```
Phase 1 (Security)
├── Wave 1.1 (XSS) ─────────────────────────────────────────┐
│   ├── 1.1.1 (templates)     ─┐                            │
│   ├── 1.1.2 (public.html)   ─┼─ PARALLEL                  │
│   └── 1.1.3 (admin.html)    ─┘                            │
├── Wave 1.2 (Backend) ─────────────────────────────────────┤
│   ├── 1.2.1 (exception)     ─→ 1.2.2 (CSRF)    SEQUENTIAL │
├── Wave 1.3 (Race) ────────────────────────────────────────┤
│   ├── 1.3.1 (polling)       ─┐                            │
│   └── 1.3.2 (comments)      ─┘ PARALLEL                   │
└── Wave 1.4 (Validate) ────────────────────────────────────┘
    └── 1.4.1, 1.4.2, 1.4.3   ─→ SEQUENTIAL after all above

Phase 2 (DRY) ──────── AFTER Phase 1 complete ──────────────
├── Wave 2.1 (CSS Extract) ─────────────────────────────────┐
│   ├── 2.1.1-2.1.6           ─→ ALL PARALLEL               │
├── Wave 2.2 (CSS Consolidate) ─────────────────────────────┤
│   └── 2.2.1 → 2.2.2 → 2.2.3 → 2.2.4  SEQUENTIAL           │
├── Wave 2.3 (Backend DRY) ─────────────────────────────────┤
│   ├── 2.3.1-2.3.3           ─→ ALL PARALLEL               │
└── Wave 2.4 (Validate) ────────────────────────────────────┘

Phase 3 (SOLID) ──────── AFTER Phase 2 complete ────────────
├── Wave 3.1 (Chat Split) ──────────────────────────────────┐
│   └── 3.1.1 → 3.1.2-3.1.5 (parallel) → 3.1.6  MIXED       │
├── Wave 3.2 (Email) ───────────────────────────────────────┤
│   └── 3.2.1 → 3.2.2 → 3.2.3           SEQUENTIAL          │
├── Wave 3.3 (Frontend Modules) ────────────────────────────┤
│   ├── 3.3.1-3.3.4           ─→ ALL PARALLEL               │
└── Wave 3.4 (Validate) ────────────────────────────────────┘

Phase 4 (Quality) ──────── AFTER Phase 3 complete ──────────
├── Wave 4.1 (Constants)    ─→ PARALLEL                     │
├── Wave 4.2 (Naming)       ─→ PARALLEL                     │
├── Wave 4.3 (YAGNI)        ─→ PARALLEL                     │
├── Wave 4.4 (Deprecated)   ─→ PARALLEL                     │
└── Wave 4.5 (Validate)     ─→ SEQUENTIAL                   │
```

---

## Execution Summary

| Phase | Total Tasks | Parallel Batches | Sequential Tasks |
|-------|-------------|------------------|------------------|
| Phase 1 | 10 | 2 (3+2 tasks) | 5 |
| Phase 2 | 14 | 2 (6+3 tasks) | 5 |
| Phase 3 | 14 | 1 (4 tasks) | 10 |
| Phase 4 | 14 | 4 (2+4+3+2 tasks) | 3 |
| **Total** | **52** | **9 batches** | **23 sequential** |

---

## Quick Reference: First Tasks to Execute

### Wave 1.1 (Can start immediately, parallel):
- Task 1.1.1: Fix XSS in templates/index.js
- Task 1.1.2: Fix XSS in public.html
- Task 1.1.3: Fix XSS in admin.html

### Wave 1.2 (Start after any 1.1 task, sequential):
- Task 1.2.1: Fix exception handler in main.py
- Task 1.2.2: Apply CSRF to all routes (after 1.2.1)

### Wave 1.3 (Can start immediately, parallel):
- Task 1.3.1: Add polling guard to profile-messages.js
- Task 1.3.2: Fix comment deletion race in comments.py
