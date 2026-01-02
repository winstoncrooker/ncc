"""
Vinyl Vault API - Cloudflare Worker Entry Point
FastAPI application with ASGI adapter for Workers runtime
"""

from workers import WorkerEntrypoint
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import asgi

from routes import discogs, chat, auth, collection, profile, upload, friends, messages
from routes import categories, interests, posts, comments, votes, category_profiles, admin, wishlist, search, blocks, moderation, notifications, marketplace, trending

# Create FastAPI app with OpenAPI documentation
app = FastAPI(
    title="Niche Collector Connector API",
    version="3.0.0",
    description="""
## Niche Collector Connector API

A social platform API for collectors of vinyl records, trading cards, cars, sneakers, watches, comics, video games, and coins.

### Features
- **Authentication**: Google OAuth2 with JWT tokens
- **Profiles**: User profiles with bios, pronouns, and category-specific showcases
- **Collections**: Manage collectibles with Discogs integration for vinyl
- **Social**: Friends, messaging, and forums
- **AI Assistant**: Chat-based collection management

### Authentication
Most endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```
    """,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    openapi_tags=[
        {"name": "auth", "description": "Authentication and user management"},
        {"name": "profile", "description": "User profile operations"},
        {"name": "collection", "description": "Collection management"},
        {"name": "discogs", "description": "Discogs API integration"},
        {"name": "friends", "description": "Friend requests and management"},
        {"name": "messages", "description": "Direct messaging"},
        {"name": "posts", "description": "Forum posts"},
        {"name": "comments", "description": "Post comments"},
        {"name": "votes", "description": "Upvotes and downvotes"},
        {"name": "categories", "description": "Collection categories"},
        {"name": "interests", "description": "Interest groups"},
        {"name": "chat", "description": "AI chat assistant"},
        {"name": "uploads", "description": "Image uploads"},
        {"name": "admin", "description": "Admin operations"},
        {"name": "search", "description": "Global search across users, collections, and posts"},
        {"name": "blocks", "description": "User blocking for privacy and safety"},
        {"name": "moderation", "description": "Content moderation and reporting"},
        {"name": "notifications", "description": "Email notification preferences"},
        {"name": "marketplace", "description": "Buy, sell, and trade collectibles"},
        {"name": "trending", "description": "Trending posts and featured collectors"},
    ]
)

# Production origins - restrict to known frontend domains
ALLOWED_ORIGINS = [
    "https://niche-collector.pages.dev",
    "https://niche-collector-connector.pages.dev",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]

# CORS middleware - NOTE: Custom @app.middleware("http") causes crashes in CF Workers Python
# Using CORSMiddleware class instead
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With", "X-CSRF-Token"],
)


def get_cors_origin(request: Request) -> str:
    """Get appropriate CORS origin header based on request origin"""
    origin = request.headers.get("origin", "")
    if origin in ALLOWED_ORIGINS:
        return origin
    return "https://niche-collector.pages.dev"


def get_cors_headers(request: Request) -> dict:
    """Get CORS headers for a request"""
    return {
        "Access-Control-Allow-Origin": get_cors_origin(request),
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
        "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, Origin, X-Requested-With, X-CSRF-Token",
        "Access-Control-Allow-Credentials": "true",
    }


# Exception handlers with CORS headers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=get_cors_headers(request)
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    # Log the actual error for debugging (visible in Cloudflare logs)
    print(f"[ERROR] {request.method} {request.url.path}: {type(exc).__name__}: {exc}")
    # Return generic message to prevent information leakage
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal error occurred. Please try again."},
        headers=get_cors_headers(request)
    )


# Include routers
app.include_router(discogs.router, prefix="/api/discogs", tags=["discogs"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(collection.router, prefix="/api/collection", tags=["collection"])
app.include_router(profile.router, prefix="/api/profile", tags=["profile"])
app.include_router(upload.router, prefix="/api/uploads", tags=["uploads"])
app.include_router(friends.router, prefix="/api/friends", tags=["friends"])
app.include_router(messages.router, prefix="/api/messages", tags=["messages"])
app.include_router(categories.router, prefix="/api/categories", tags=["categories"])
app.include_router(interests.router, prefix="/api/interests", tags=["interests"])
app.include_router(posts.router, prefix="/api/posts", tags=["posts"])
app.include_router(comments.router, prefix="/api", tags=["comments"])
app.include_router(votes.router, prefix="/api/votes", tags=["votes"])
app.include_router(category_profiles.router, prefix="/api/profile", tags=["category_profiles"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(wishlist.router, prefix="/api/wishlist", tags=["wishlist"])
app.include_router(search.router, prefix="/api/search", tags=["search"])
app.include_router(blocks.router, prefix="/api/users", tags=["blocks"])
app.include_router(moderation.router, prefix="/api/reports", tags=["moderation"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["notifications"])
app.include_router(marketplace.router, prefix="/api/marketplace", tags=["marketplace"])
app.include_router(trending.router, prefix="/api/trending", tags=["trending"])


@app.get("/")
async def root():
    """Root redirect - send users to the frontend"""
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="https://niche-collector.pages.dev")


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "service": "niche-collector-api", "version": "3.0.0"}


@app.get("/api/cache/stats")
async def cache_stats(request: Request):
    """Get R2 cache statistics"""
    env = request.scope["env"]
    return {
        "status": "ok",
        "bucket": "vinyl-vault-cache",
        "note": "Use R2 dashboard for detailed statistics"
    }


class Default(WorkerEntrypoint):
    """Cloudflare Worker entry point"""

    async def fetch(self, request):
        """Handle incoming HTTP requests"""
        return await asgi.fetch(app, request, self.env)
