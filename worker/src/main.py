"""
Vinyl Vault API - Cloudflare Worker Entry Point
FastAPI application with ASGI adapter for Workers runtime
"""

from workers import WorkerEntrypoint
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import asgi

from routes import discogs, chat, auth, collection, profile, upload

# Create FastAPI app
app = FastAPI(
    title="Niche Collector Connector API",
    version="3.0.0",
    description="API for vinyl collector profiles and collections"
)

# CORS middleware for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
)

# Include routers
app.include_router(discogs.router, prefix="/api/discogs", tags=["discogs"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(collection.router, prefix="/api/collection", tags=["collection"])
app.include_router(profile.router, prefix="/api/profile", tags=["profile"])
app.include_router(upload.router, prefix="/api/uploads", tags=["uploads"])


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "service": "niche-collector-api", "version": "3.0.0"}


@app.get("/api/cache/stats")
async def cache_stats(request: Request):
    """Get R2 cache statistics"""
    env = request.scope["env"]
    # R2 doesn't have a native list-all, so return basic info
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
