# Vinyl Vault: Cloudflare Workers Python Refactor Plan

**Created**: 2025-12-21
**Status**: PENDING USER APPROVAL
**Target**: Migrate from Flask to Cloudflare Workers with FastAPI + Pywrangler

---

## Research Summary

### Sources
- [Python Workers Documentation](https://developers.cloudflare.com/workers/languages/python/)
- [FastAPI on Workers](https://developers.cloudflare.com/workers/languages/python/packages/fastapi/)
- [Python Packages Support](https://developers.cloudflare.com/workers/languages/python/packages/)
- [Pywrangler Changelog](https://developers.cloudflare.com/changelog/2025-12-08-python-pywrangler/)
- [D1 Database API](https://developers.cloudflare.com/d1/worker-api/d1-database/)
- [R2 Storage](https://developers.cloudflare.com/r2/)
- [Python Workers Examples](https://github.com/cloudflare/python-workers-examples)

### Key Constraints

| Constraint | Impact on Project |
|------------|-------------------|
| **Beta status** | Must add `python_workers` compatibility flag |
| **HTTP clients** | Must use `httpx` (async) instead of `requests` |
| **No threading/multiprocessing** | Not applicable (we don't use these) |
| **No file system writes** | Cache must move to R2 storage |
| **No `requests` library** | Refactor all HTTP calls to `httpx` |
| **ASGI required** | FastAPI works natively via `asgi.fetch()` |
| **Memory snapshots** | Top-level imports are snapshotted (fast cold starts) |

### Supported Packages We Need

| Package | Status | Notes |
|---------|--------|-------|
| `fastapi` | ✅ Supported | Native ASGI support |
| `pydantic` | ✅ Supported | Used by FastAPI |
| `httpx` | ✅ Supported | Replaces `requests` |
| `PyJWT` | ✅ Pure Python | Should work |
| `bcrypt` | ⚠️ Check needed | May need `passlib` alternative |
| `python-dotenv` | ❌ Not needed | Use Workers environment variables |

### Unsupported Standard Library Modules (Not Used by Us)

```
curses, dbm, ensurepip, fcntl, grp, idlelib, lib2to3,
msvcrt, pwd, resource, syslog, termios, tkinter,
turtle.py, turtledemo, venv, winreg, winsound
```

---

## Architecture Changes

### Current Architecture (Flask)

```
┌─────────────────────────────────────────────────────┐
│                   Browser                            │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│              Flask Server (localhost:5001)           │
│  ┌─────────────────────────────────────────────┐    │
│  │ Static Files (HTML, CSS, JS, record.js)     │    │
│  └─────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────┐    │
│  │ /api/discogs/search → Discogs API           │    │
│  │ /api/discogs/price  → Discogs API           │    │
│  └─────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────┐    │
│  │ Local File Cache (./cache/images, ./data)   │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

### Target Architecture (Cloudflare)

```
┌─────────────────────────────────────────────────────┐
│                   Browser                            │
└─────────────────────┬───────────────────────────────┘
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
┌─────────────────────┐  ┌────────────────────────────┐
│  Cloudflare Pages   │  │  Cloudflare Worker (Python) │
│  ─────────────────  │  │  ───────────────────────── │
│  Static Assets:     │  │  FastAPI + ASGI            │
│  • HTML files       │  │                            │
│  • CSS files        │  │  Routes:                   │
│  • JS files         │  │  • /api/discogs/search     │
│  • record.js        │  │  • /api/discogs/price      │
│  • manifest.json    │  │  • /api/chat               │
│  • sw.js            │  │  • /api/auth/*             │
│                     │  │  • /api/collection/*       │
└─────────────────────┘  └─────────────┬──────────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    ▼                  ▼                  ▼
           ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
           │ Cloudflare   │   │ Cloudflare   │   │   External   │
           │     D1       │   │     R2       │   │    APIs      │
           │  (SQLite)    │   │  (Storage)   │   │              │
           │ ──────────── │   │ ──────────── │   │ • Discogs    │
           │ • users      │   │ • album      │   │ • Together   │
           │ • collections│   │   covers     │   │              │
           │ • sync_queue │   │ • cache      │   │              │
           └──────────────┘   └──────────────┘   └──────────────┘
```

---

## File Structure After Refactor

```
Website/
├── frontend/                    # Cloudflare Pages (static)
│   ├── index.html
│   ├── genre.html
│   ├── album.html
│   ├── stats.html
│   ├── mycollection.html
│   ├── manifest.json
│   ├── sw.js
│   ├── record.js
│   ├── style.css
│   ├── components/
│   │   └── nav.js
│   ├── js/
│   │   ├── collection.js
│   │   ├── discogs.js
│   │   ├── chat.js
│   │   └── sync.js
│   └── css/
│       └── mycollection.css
│
├── worker/                      # Cloudflare Worker (Python)
│   ├── src/
│   │   ├── main.py             # FastAPI app + WorkerEntrypoint
│   │   ├── routes/
│   │   │   ├── __init__.py
│   │   │   ├── discogs.py      # Discogs proxy endpoints
│   │   │   ├── chat.py         # Together.ai proxy
│   │   │   ├── auth.py         # JWT authentication
│   │   │   └── collection.py   # User collection CRUD
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── discogs_client.py  # httpx-based Discogs client
│   │   │   ├── together_client.py # httpx-based Together client
│   │   │   └── cache.py           # R2 caching logic
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── user.py         # Pydantic user models
│   │   │   └── album.py        # Pydantic album models
│   │   └── utils/
│   │       ├── __init__.py
│   │       ├── auth.py         # JWT helpers
│   │       └── hash.py         # Password hashing
│   ├── pyproject.toml          # Python dependencies
│   ├── wrangler.toml           # Worker configuration
│   └── .dev.vars               # Local development secrets
│
├── migrations/                  # D1 database migrations
│   ├── 0001_initial.sql
│   └── 0002_sync_queue.sql
│
├── CLAUDE.md
├── BACKLOG.md
├── IMPLEMENTATION_PLAN.md
├── REFACTOR.md
└── .gitignore
```

---

## Detailed Refactoring Steps

### Phase 1: Project Setup & Tooling

#### 1.1 Install Prerequisites
```bash
# Install uv (Python package manager)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Verify Node.js installed
node --version  # Required for wrangler

# Install pywrangler globally
uv tool install workers-py
```

#### 1.2 Initialize Worker Project
```bash
mkdir -p worker
cd worker
uv run pywrangler init --template fastapi
```

#### 1.3 Configure wrangler.toml
```toml
name = "vinyl-vault-api"
main = "src/main.py"
compatibility_date = "2025-12-21"
compatibility_flags = ["python_workers"]

[vars]
ENVIRONMENT = "production"

# D1 Database binding
[[d1_databases]]
binding = "DB"
database_name = "vinyl-vault"
database_id = "<generated-after-creation>"

# R2 Storage binding
[[r2_buckets]]
binding = "CACHE"
bucket_name = "vinyl-vault-cache"

# Secrets (set via wrangler secret put)
# DISCOGS_KEY
# DISCOGS_SECRET
# TOGETHER_API_KEY
# JWT_SECRET
```

#### 1.4 Configure pyproject.toml
```toml
[project]
name = "vinyl-vault-worker"
version = "1.0.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115.0",
    "pydantic>=2.0.0",
    "httpx>=0.27.0",
    "PyJWT>=2.8.0",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src"]

[dependency-groups]
dev = ["workers-py"]
```

---

### Phase 2: Core Worker Implementation

#### 2.1 Main Entry Point (src/main.py)
```python
from workers import WorkerEntrypoint
from fastapi import FastAPI, Request
import asgi

from routes import discogs, chat, auth, collection

app = FastAPI(title="Vinyl Vault API")

# Include routers
app.include_router(discogs.router, prefix="/api/discogs", tags=["discogs"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(collection.router, prefix="/api/collection", tags=["collection"])


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "vinyl-vault-api"}


class Default(WorkerEntrypoint):
    async def fetch(self, request):
        return await asgi.fetch(app, request, self.env)
```

#### 2.2 Discogs Route (src/routes/discogs.py)
```python
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
import httpx
import hashlib

router = APIRouter()


class AlbumSearchResult(BaseModel):
    id: int | None
    title: str | None
    year: int | None
    cover: str | None
    price: float | None
    cached: bool = False


@router.get("/search")
async def search_album(
    request: Request,
    artist: str,
    album: str
) -> AlbumSearchResult:
    env = request.scope["env"]

    # Check R2 cache first
    cache_key = hashlib.md5(f"{artist.lower()}_{album.lower()}".encode()).hexdigest()

    cached = await env.CACHE.get(f"data/{cache_key}.json")
    if cached:
        import json
        return AlbumSearchResult(**json.loads(await cached.text()), cached=True)

    # Fetch from Discogs
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://api.discogs.com/database/search",
            params={
                "q": f"{artist} {album}",
                "type": "release",
                "key": env.DISCOGS_KEY,
                "secret": env.DISCOGS_SECRET
            },
            headers={"User-Agent": "VinylVault/2.0"}
        )

        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code)

        data = response.json()
        if not data.get("results"):
            raise HTTPException(status_code=404, detail="Album not found")

        best = data["results"][0]

        # Cache cover image in R2
        cover_url = best.get("cover_image")
        local_cover = None
        if cover_url:
            img_response = await client.get(cover_url)
            if img_response.status_code == 200:
                await env.CACHE.put(
                    f"images/{cache_key}.jpg",
                    img_response.content,
                    httpMetadata={"contentType": "image/jpeg"}
                )
                local_cover = f"/cache/images/{cache_key}.jpg"

        result = AlbumSearchResult(
            id=best.get("id"),
            title=best.get("title"),
            year=best.get("year"),
            cover=local_cover or cover_url,
            price=None  # Fetch separately to avoid rate limits
        )

        # Cache result
        import json
        await env.CACHE.put(
            f"data/{cache_key}.json",
            json.dumps(result.model_dump())
        )

        return result
```

#### 2.3 Auth Route (src/routes/auth.py)
```python
from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
import jwt
import hashlib
from datetime import datetime, timedelta

router = APIRouter()
security = HTTPBearer()


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


def hash_password(password: str) -> str:
    # Simple hash for Workers (bcrypt not available)
    # Consider argon2-cffi if available in Pyodide
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed


def create_token(user_id: int, secret: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.utcnow() + timedelta(days=7),
        "iat": datetime.utcnow()
    }
    return jwt.encode(payload, secret, algorithm="HS256")


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    env = request.scope["env"]
    try:
        payload = jwt.decode(
            credentials.credentials,
            env.JWT_SECRET,
            algorithms=["HS256"]
        )
        return payload["sub"]
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


@router.post("/register")
async def register(request: Request, body: RegisterRequest) -> TokenResponse:
    env = request.scope["env"]

    # Check if user exists
    existing = await env.DB.prepare(
        "SELECT id FROM users WHERE email = ?"
    ).bind(body.email).first()

    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create user
    hashed = hash_password(body.password)
    result = await env.DB.prepare(
        "INSERT INTO users (email, password_hash) VALUES (?, ?) RETURNING id"
    ).bind(body.email, hashed).first()

    token = create_token(result["id"], env.JWT_SECRET)
    return TokenResponse(access_token=token)


@router.post("/login")
async def login(request: Request, body: LoginRequest) -> TokenResponse:
    env = request.scope["env"]

    user = await env.DB.prepare(
        "SELECT id, password_hash FROM users WHERE email = ?"
    ).bind(body.email).first()

    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_token(user["id"], env.JWT_SECRET)
    return TokenResponse(access_token=token)
```

#### 2.4 Collection Route (src/routes/collection.py)
```python
from fastapi import APIRouter, Request, Depends
from pydantic import BaseModel
from typing import List, Optional
from pyodide.ffi import to_js

from .auth import get_current_user

router = APIRouter()


class Album(BaseModel):
    id: Optional[int] = None
    artist: str
    album: str
    genre: Optional[str] = None
    cover: Optional[str] = None
    price: Optional[float] = None


class SyncRequest(BaseModel):
    albums: List[Album]
    deleted_ids: List[int] = []
    last_sync: Optional[str] = None


@router.get("/")
async def get_collection(
    request: Request,
    user_id: int = Depends(get_current_user)
) -> List[Album]:
    env = request.scope["env"]

    results = await env.DB.prepare(
        "SELECT * FROM collections WHERE user_id = ? ORDER BY artist, album"
    ).bind(user_id).all()

    return [Album(**row) for row in results["results"]]


@router.post("/sync")
async def sync_collection(
    request: Request,
    body: SyncRequest,
    user_id: int = Depends(get_current_user)
) -> List[Album]:
    env = request.scope["env"]

    # Delete removed albums
    if body.deleted_ids:
        for album_id in body.deleted_ids:
            await env.DB.prepare(
                "DELETE FROM collections WHERE id = ? AND user_id = ?"
            ).bind(album_id, user_id).run()

    # Upsert albums
    for album in body.albums:
        if album.id:
            # Update existing
            await env.DB.prepare("""
                UPDATE collections
                SET artist = ?, album = ?, genre = ?, cover = ?, price = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND user_id = ?
            """).bind(
                album.artist, album.album, album.genre,
                album.cover, album.price, album.id, user_id
            ).run()
        else:
            # Insert new
            await env.DB.prepare("""
                INSERT INTO collections (user_id, artist, album, genre, cover, price)
                VALUES (?, ?, ?, ?, ?, ?)
            """).bind(
                user_id, album.artist, album.album,
                album.genre, album.cover, album.price
            ).run()

    # Return updated collection
    return await get_collection(request, user_id)
```

---

### Phase 3: Database Setup

#### 3.1 Create D1 Database
```bash
# Create database
wrangler d1 create vinyl-vault

# Note the database_id and add to wrangler.toml
```

#### 3.2 Initial Migration (migrations/0001_initial.sql)
```sql
-- Users table
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Collections table
CREATE TABLE collections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    artist TEXT NOT NULL,
    album TEXT NOT NULL,
    genre TEXT,
    cover TEXT,
    price REAL,
    discogs_id INTEGER,
    year INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Index for faster queries
CREATE INDEX idx_collections_user ON collections(user_id);
CREATE INDEX idx_collections_artist ON collections(artist);
```

#### 3.3 Run Migration
```bash
wrangler d1 execute vinyl-vault --file=migrations/0001_initial.sql
```

---

### Phase 4: R2 Storage Setup

#### 4.1 Create R2 Bucket
```bash
wrangler r2 bucket create vinyl-vault-cache
```

#### 4.2 Public Access for Images
Configure public access in Cloudflare dashboard or via:
```bash
wrangler r2 bucket sippy enable vinyl-vault-cache
```

---

### Phase 5: Frontend Updates

#### 5.1 Update API Base URL
```javascript
// js/config.js
const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:8787'  // Local worker dev
    : 'https://vinyl-vault-api.<your-subdomain>.workers.dev';
```

#### 5.2 Update Discogs Client (js/discogs.js)
```javascript
// Remove direct Discogs calls, use Worker proxy
async function searchAlbum(artist, album) {
    const response = await fetch(
        `${API_BASE}/api/discogs/search?artist=${encodeURIComponent(artist)}&album=${encodeURIComponent(album)}`
    );
    if (!response.ok) throw new Error('Search failed');
    return response.json();
}
```

#### 5.3 Update Chat Client (js/chat.js)
```javascript
// Remove Together.ai key, use Worker proxy
async function sendMessage(message, collection) {
    const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({ message, collection })
    });
    return response.json();
}
```

---

### Phase 6: Deployment

#### 6.1 Set Secrets
```bash
cd worker

# Set API credentials
wrangler secret put DISCOGS_KEY
wrangler secret put DISCOGS_SECRET
wrangler secret put TOGETHER_API_KEY
wrangler secret put JWT_SECRET
```

#### 6.2 Deploy Worker
```bash
uv run pywrangler deploy
```

#### 6.3 Deploy Frontend to Pages
```bash
cd frontend
npx wrangler pages deploy . --project-name=vinyl-vault
```

#### 6.4 Configure Custom Domain (Optional)
```bash
wrangler pages project add-domain vinyl-vault yourdomain.com
```

---

## Migration Checklist

### Before Migration
- [ ] Backup current `server.py` and all files
- [ ] Export any cached data from local `./cache` directory
- [ ] Document current Discogs rate limit usage

### Worker Setup
- [ ] Install uv and Node.js
- [ ] Install pywrangler
- [ ] Initialize worker project
- [ ] Configure wrangler.toml with bindings
- [ ] Create D1 database and run migrations
- [ ] Create R2 bucket

### Code Migration
- [ ] Port Flask routes to FastAPI routes
- [ ] Replace `requests` with `httpx`
- [ ] Implement JWT authentication
- [ ] Update cache logic to use R2
- [ ] Test all endpoints locally with `pywrangler dev`

### Frontend Updates
- [ ] Extract shared nav component
- [ ] Split mycollection.html into modules
- [ ] Update API base URLs
- [ ] Remove hardcoded API keys
- [ ] Add auth token handling
- [ ] Test against local worker

### Deployment
- [ ] Set all secrets via wrangler
- [ ] Deploy worker
- [ ] Deploy frontend to Pages
- [ ] Verify all routes work
- [ ] Test collection sync
- [ ] Monitor for errors

### Cleanup
- [ ] Remove old `server.py`
- [ ] Remove legacy HTML pages
- [ ] Update CLAUDE.md with new architecture
- [ ] Archive or delete test_*.py files

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Beta instability | Medium | Medium | Keep Flask as fallback |
| Package not supported | Low | High | Verify all packages before starting |
| Cold start latency | Low | Low | Memory snapshots help significantly |
| D1 transaction limits | Medium | Medium | Use batch operations |
| R2 storage costs | Low | Low | Free tier is generous (10GB) |

---

## Cost Estimate (Cloudflare Free Tier)

| Resource | Free Tier | Expected Usage |
|----------|-----------|----------------|
| Workers requests | 100K/day | Well under |
| Workers CPU time | 10ms/request | FastAPI fits |
| D1 reads | 5M/day | Well under |
| D1 writes | 100K/day | Well under |
| D1 storage | 5GB | Plenty |
| R2 storage | 10GB | Plenty |
| R2 operations | 10M/month | Well under |
| Pages requests | Unlimited | N/A |

**Conclusion**: Project should run entirely on free tier.

---

## Open Questions

1. **Password hashing**: Is SHA-256 acceptable, or should we investigate argon2-cffi availability in Pyodide?

2. **Existing localStorage collections**: Should we provide a one-time migration path for users who have data in localStorage before auth is implemented?

3. **Rate limiting**: Should we implement our own rate limiting on the Worker, or rely on Cloudflare's built-in protections?

4. **CORS configuration**: Do we need specific CORS headers for the API, or will same-origin (both on Cloudflare) suffice?

---

**Status**: Plan finalized, awaiting user approval before implementation.
