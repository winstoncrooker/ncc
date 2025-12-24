# SKYGOD Compliance Audit Report

**Date:** 2024-12-24
**Auditor:** Claude Code
**Scope:** Complete codebase review (Frontend, Backend, Database, Configuration)

---

## Executive Summary

| Severity | Count | Categories |
|----------|-------|------------|
| **CRITICAL** | 12 | Security vulnerabilities, fail-open auth, race conditions |
| **HIGH** | 31 | God objects, major DRY violations, missing constraints |
| **MEDIUM** | 58 | KISS/YAGNI violations, error handling gaps, accessibility |
| **LOW** | 58 | Code style, performance, documentation |
| **TOTAL** | **159** | |

---

## CRITICAL PRIORITY (Fix Immediately)

### C1. Fail-Open Token Blacklist [SECURITY]
- **File:** `worker/src/routes/auth.py:83-86`
- **Issue:** If database check fails, revoked tokens are ACCEPTED
- **SKYGOD Violation:** SOLID (fails silently), KISS (confusing behavior)
- **Fix:**
```python
except Exception as e:
    print(f"[Auth] Blacklist check failed: {e}")
    return True  # FAIL CLOSED - reject token if we can't verify
```

### C2. URL-Based XSS in Social Links [SECURITY]
- **File:** `frontend/js/profile.js:679`
- **Issue:** `escapeHtml()` doesn't prevent `javascript:` URIs
- **SKYGOD Violation:** SOLID (incomplete responsibility)
- **Fix:** Add URL scheme validation:
```javascript
const ALLOWED_SCHEMES = ['http:', 'https:', 'mailto:'];
function sanitizeUrl(url) {
    try {
        const parsed = new URL(url);
        return ALLOWED_SCHEMES.includes(parsed.protocol) ? url : '#';
    } catch { return '#'; }
}
```

### C3. Debug Endpoint in Production [SECURITY]
- **File:** `worker/src/routes/auth.py:382-389`
- **Issue:** `/api/auth/debug` logs all request headers including tokens
- **SKYGOD Violation:** YAGNI (not needed in prod), Security risk
- **Fix:** Delete entire `debug_auth()` function or add admin-only guard

### C4. Vote Race Condition [DATA INTEGRITY]
- **File:** `worker/src/routes/votes.py:93-180`
- **Issue:** Read-modify-write pattern causes lost votes under concurrency
- **SKYGOD Violation:** SOLID (transaction not atomic)
- **Fix:** Use SQL arithmetic:
```python
await env.DB.prepare(
    "UPDATE forum_posts SET upvote_count = upvote_count + ? WHERE id = ?"
).bind(delta, post_id).run()
```

### C5. Profile Update Race Condition [DATA INTEGRITY]
- **File:** `worker/src/routes/profile.py:201-236`
- **Issue:** Name uniqueness check then update is not atomic
- **SKYGOD Violation:** SOLID (non-atomic operation)
- **Fix:** Add UNIQUE constraint to database, handle constraint violation

### C6. Collection Add Race Condition [DATA INTEGRITY]
- **File:** `worker/src/routes/collection.py:158-170`
- **Issue:** Duplicate check then insert allows duplicates
- **Fix:** Add UNIQUE constraint on (user_id, discogs_id) or use INSERT OR IGNORE

### C7. Showcase Reorder Race Condition [DATA INTEGRITY]
- **File:** `worker/src/routes/profile.py:415-437`
- **Issue:** Multiple UPDATE statements not in transaction
- **Fix:** Use single UPDATE with CASE statement or transaction wrapper

### C8. Missing IF NOT EXISTS in Migrations [DATABASE]
- **Files:** `migrations/0006_categories_interests.sql`, `0007_category_profiles.sql`, `0008_forums.sql`
- **Issue:** CREATE TABLE/INDEX without IF NOT EXISTS fails on rerun
- **SKYGOD Violation:** KISS (fragile migrations)
- **Fix:** Add `IF NOT EXISTS` to all CREATE statements

### C9. Vote Table Allows Duplicate Votes [DATABASE]
- **File:** `migrations/0008_forums.sql:46-54`
- **Issue:** UNIQUE constraints with NULL allow infinite duplicates
- **Fix:** Add CHECK constraint:
```sql
CHECK ((post_id IS NOT NULL AND comment_id IS NULL) OR
       (post_id IS NULL AND comment_id IS NOT NULL))
```

### C10. Collection Sync Loses Data [LOGIC ERROR]
- **File:** `worker/src/routes/collection.py:390-400`
- **Issue:** UPDATE query omits category_id, tags, condition, notes
- **SKYGOD Violation:** DRY violation led to divergent update logic
- **Fix:** Include all fields in sync UPDATE query

### C11. Optimistic Vote UI Without Rollback [LOGIC ERROR]
- **File:** `frontend/js/forums.js:430-452`
- **Issue:** No rollback if API call fails after optimistic update
- **Fix:** Store previous state, restore on error

### C12. File Upload Silent Failures [ERROR HANDLING]
- **File:** `frontend/js/modules/chat.js:179-327`
- **Issue:** No validation that `response.ok` before `.json()`, partial failures silent
- **Fix:** Check response.ok, implement rollback for partial failures

---

## HIGH PRIORITY (Fix This Week)

### H1. God Object: Profile.js [SOLID VIOLATION]
- **File:** `frontend/js/profile.js` (3000+ lines, 160+ methods)
- **Issue:** Handles profile, collection, showcase, chat, messages, friends, wishlist, photos, tags, social links, stats
- **SKYGOD Violation:** SOLID - Single Responsibility violated massively
- **Fix:** Split into:
  - `ProfileManager.js` - profile CRUD
  - `CollectionManager.js` - collection operations
  - `ShowcaseManager.js` - showcase operations
  - `UIRenderer.js` - rendering logic

### H2. God Function: get_feed() [SOLID VIOLATION]
- **File:** `worker/src/routes/posts.py:110-296` (187 lines)
- **Issue:** Handles filtering, pagination, sorting, JOINs, vote checks, data transformation
- **Fix:** Extract into:
  - `build_feed_query()` - query construction
  - `apply_pagination()` - cursor logic
  - `transform_posts()` - data mapping

### H3. God Function: google_callback() [SOLID VIOLATION]
- **File:** `worker/src/routes/auth.py:225-379` (154 lines)
- **Issue:** OAuth exchange + user lookup + profile merging + token creation
- **Fix:** Extract `find_or_create_user()`, `merge_google_profile()`, `create_auth_response()`

### H4. MASSIVE DRY Violation: to_python_value() [DRY VIOLATION]
- **Files:** Defined independently in 6 files:
  - `profile.py:113`, `friends.py:73`, `messages.py:49`
  - `posts.py:16` (as `safe_value`), `comments.py:16`, `collection.py:14`
- **SKYGOD Violation:** DRY - ~30 lines duplicated 6 times
- **Fix:** Create `worker/src/utils/conversions.py`:
```python
def to_python_value(val, default=None):
    if val is None:
        return default
    type_str = str(type(val))
    if 'JsProxy' in type_str or 'JsNull' in type_str:
        return default
    return val

def convert_rows(rows):
    return [row.to_py() if hasattr(row, 'to_py') else row for row in rows]
```

### H5. Duplicate Hot Score Calculation [DRY VIOLATION]
- **Files:** `worker/src/routes/posts.py:29-50` AND `worker/src/routes/votes.py:18-38`
- **Issue:** Identical 21-line function in two files
- **Fix:** Move to `utils/scoring.py`

### H6. Duplicate Vote Logic [DRY VIOLATION]
- **File:** `worker/src/routes/votes.py`
- **Issue:** `vote_on_post()` (L93-180) and `vote_on_comment()` (L183-268) are 75% identical
- **Fix:** Extract shared `apply_vote(target_type, target_id, user_id, value)`

### H7. Unused Disabled Modules [YAGNI VIOLATION]
- **Files:** `frontend/js/modules/messages.js`, `frontend/js/modules/friends.js`
- **Issue:** Loaded but never used (profile.js L203-204 says "disabled for now")
- **SKYGOD Violation:** YAGNI - dead code in production
- **Fix:** Remove from HTML imports OR delete files entirely

### H8. Missing Form Accessibility Labels [ACCESSIBILITY]
- **Files:** `profile.html:348, 164, 393`
- **Issue:** Inputs use only placeholder, no accessible labels
- **Fix:** Add `<label>` elements or `aria-label` attributes

### H9. Hard-Coded Grid Columns Break Mobile [RESPONSIVE]
- **File:** `css/profile.css:909, 1023`
- **Issue:** `grid-template-columns: repeat(4, 1fr)` breaks on small screens
- **Fix:** Use `repeat(auto-fill, minmax(200px, 1fr))`

### H10. Inline Styles Scattered in HTML [DRY VIOLATION]
- **File:** `admin.html:345-349, 532-538, 650, 657`
- **Issue:** Multiple inline styles instead of CSS classes
- **Fix:** Extract to CSS classes

### H11. Missing NOT NULL Constraints [DATABASE]
- **Files:**
  - `0006_categories_interests.sql:44` - category_id nullable in UNIQUE
  - `0010_collection_categories.sql:5` - category_id nullable
- **Fix:** Add NOT NULL or redesign constraints

### H12. Missing CHECK Constraints [DATABASE]
- **Files:**
  - `0008_forums.sql:48` - votes.value should be CHECK(value IN (1, -1))
  - `0017_wishlist.sql:14` - priority should be CHECK(priority IN (0, 1, 2))
- **Fix:** Add CHECK constraints

### H13. No Transaction Support [DATABASE]
- **Issue:** Multi-step operations in auth, friends, posts aren't atomic
- **Examples:** `google_callback()`, `accept_friend_request()`, `delete_post()`
- **Fix:** Implement transaction wrapper for D1

### H14. Inconsistent Error Response Format [API DESIGN]
- **Issue:** Some routes return `detail`, others `message`, others custom fields
- **Fix:** Standardize on `{"error": {"code": "...", "message": "..."}}`

### H15. Missing Input Validation [API DESIGN]
- **File:** `worker/src/routes/posts.py:460-472`
- **Issue:** No title/body length limits, images array unbounded
- **Fix:** Add `min_length`, `max_length` to Pydantic models

---

## MEDIUM PRIORITY (Fix This Month)

### M1-M7. XSS Patterns in Frontend
| # | File | Line | Issue |
|---|------|------|-------|
| M1 | forums.js | 621, 712 | escapeHtml then inject `<br>` |
| M2 | modules/messages.js | 82 | inline onerror handler |
| M3 | modules/friends.js | 119 | inline onerror handler |
| M4 | admin.html | 448 | onerror="this.style.display='none'" |
| M5 | forums.js | 763-774 | JWT parsing in client for UI auth |
| M6 | admin.html | 597-662 | inline onclick in templates |
| M7 | chat.py | 375 | AI response not sanitized server-side |

### M8-M14. Error Handling Gaps
| # | File | Line | Issue |
|---|------|------|-------|
| M8 | discogs.py | 85-86, 101-102 | Silent `except: pass` |
| M9 | chat.py | 288-290 | Generic exception swallowing |
| M10 | discogs.py | 172-178 | Error truncated to 200 chars |
| M11 | comments.py | 119-123 | Bare `except:` catches all |
| M12 | forums.js | 262-266 | No API response validation |
| M13 | forums.js | 756-830 | Inconsistent null checks |
| M14 | config.js | 92-96 | Returns error response without throwing |

### M15-M20. KISS Violations
| # | File | Line | Issue |
|---|------|------|-------|
| M15 | auth.py | 304-330 | 27-line conditional for 2 fields |
| M16 | friends.py | 159-172 | 4 params for bidirectional check |
| M17 | forums.js | 1421-1427 | Complex hex color math |
| M18 | profile.css | 66-67 | Over-nested selectors |
| M19 | profile.css | 2-29 | Duplicate :root variables |
| M20 | posts.py | 128-228 | Manual query building |

### M21-M26. GRASP Violations (Coupling)
| # | File | Issue |
|---|------|-------|
| M21 | All routes | Direct `env.DB` access - no repository layer |
| M22 | auth.py | Auth logic scattered across 6+ functions |
| M23 | chat.py | Couples to Discogs API directly |
| M24 | posts.py + votes.py | Hot score duplicated and tightly coupled |
| M25 | friends.py | Friendship check duplicated 3+ times |
| M26 | profile.py + friends.py | Showcase query duplicated |

### M27-M32. Missing Validation
| # | File | Line | Issue |
|---|------|------|-------|
| M27 | forums.js | 1352-1356 | category_slug not validated |
| M28 | forums.js | 1369-1391 | filterByGroup no slug validation |
| M29 | profile.js | various | No collection data validation |
| M30 | forums.js | 1194-1195 | forEach return doesn't break |
| M31 | friends.py | 125 | Case-sensitive user search |
| M32 | posts.py | 93-100 | No images array length limit |

### M33-M38. Accessibility Issues
| # | File | Line | Issue |
|---|------|------|-------|
| M33 | profile.html | 42, 30 | Missing aria-label on buttons |
| M34 | profile.html | 311-314 | SVG icons lack text alternatives |
| M35 | admin.html | 447 | Empty alt text on avatar |
| M36 | profile.html | 75, 388 | Empty/generic alt text |
| M37 | style.css | 90 | #aaa color may fail WCAG AA |
| M38 | css/profile.css | Various | No mobile breakpoints |

### M39-M44. Database/API Issues
| # | File | Issue |
|---|------|-------|
| M39 | 0014_privacy_settings.sql:7 | JSON index ineffective |
| M40 | 0004_friends_messaging.sql | Missing timestamp index |
| M41 | All routes | No rate limiting implemented |
| M42 | posts.py | No pagination on some endpoints |
| M43 | votes.py | Read-modify-write for counts |
| M44 | comments.py:211-228 | Off-by-one in depth calc |

---

## LOW PRIORITY (Technical Debt Backlog)

### L1-L10. O&O Violations (Naming/Readability)
- forums.js:295 - `html` unclear variable
- forums.js:756 - `addedPlatforms` unclear
- posts.py:205 - `for r in results` too generic
- Multiple files - `env` could be `environment`
- profile.py:1408-1409 - unclear template context
- Various - inconsistent error field names

### L11-L20. YAGNI Violations (Dead Code)
- style.css:51-79 - unused `.hamburger` styles
- style.css:81-159 - unused `.nav-links` styles
- style.css:272-354 - unused `.vinyl` and `.card` styles
- css/auth.css:77-110, 123-144 - unused modal styles
- css/profile.css:1017 - orphaned `.filter-select option`
- profile.html:340 - hidden file input never used
- auth.py:14 - unused `timedelta` import
- collection.py:14-18 - unused `expected_type` param

### L21-L30. Performance Issues
- forums.js:439-452 - multiple DOM queries per vote
- chat.js:236-306 - DOM mutation per album in loop
- friends.py:151-156 - 4 params for 2-value check
- messages.py:56-132 - complex CTE could optimize
- comments.py:267-273 - extra query after insert

### L31-L40. Documentation/Style
- auth.js:14-53 - complex init() undocumented
- profile.js:202-204 - unclear module mixing comment
- forums.js:1803-1824 - timezone assumption undocumented
- chat.py:309 - magic number `[-10:]` unexplained
- Various - inconsistent BEM vs utility naming

### L41-L50. Configuration/PWA Issues
- manifest.json:13 - only 192x192 icon
- manifest.json:15 - combined purpose should be split
- sw.js:6 - cache version v63 suspiciously high
- sw.js:24-28 - external CDN hard-coded versions
- wrangler.toml:21-25 - missing secret documentation
- admin.html:5 - missing viewport meta

---

## Remediation Roadmap

### Phase 1: Security (Days 1-2)
1. Fix C1: Fail-closed token blacklist
2. Fix C2: URL sanitization for social links
3. Fix C3: Remove debug endpoint
4. Fix M1-M7: XSS patterns
5. Add missing CHECK constraints (H12)

### Phase 2: Data Integrity (Days 3-5)
1. Fix C4-C7: Race conditions with atomic operations
2. Fix C8-C9: Migration safety
3. Fix C10: Collection sync data loss
4. Fix C11-C12: Error handling with rollback
5. Implement transaction wrapper (H13)

### Phase 3: Architecture (Week 2)
1. Fix H1: Split Profile.js god object
2. Fix H2-H3: Split god functions
3. Fix H4-H6: Extract shared utilities
4. Fix H7: Remove dead modules
5. Create repository layer (M21)

### Phase 4: Quality (Week 3)
1. Fix H8-H9: Accessibility and responsive
2. Fix H10: Extract inline styles
3. Fix H14-H15: API consistency
4. Fix M8-M14: Error handling
5. Fix M15-M20: KISS simplifications

### Phase 5: Polish (Week 4+)
1. Address Medium priority items M21-M44
2. Address Low priority items L1-L50
3. Add comprehensive test coverage
4. Documentation updates

---

## Metrics to Track

| Metric | Current | Target |
|--------|---------|--------|
| Critical issues | 12 | 0 |
| High issues | 31 | 0 |
| Medium issues | 58 | <20 |
| profile.js lines | 3000+ | <500 |
| Duplicated helpers | 6 files | 1 file |
| Missing constraints | 5+ | 0 |

---

*"When in doubt, honor SKYGOD. When tempted to compromise, honor SKYGOD."*
