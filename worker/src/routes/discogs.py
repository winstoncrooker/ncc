"""
Discogs API proxy with R2 caching
"""

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
import httpx
import hashlib
import json

router = APIRouter()

DISCOGS_API = "https://api.discogs.com"


class AlbumSearchResult(BaseModel):
    """Album search result from Discogs"""
    id: int | None = None
    title: str | None = None
    year: int | None = None
    cover: str | None = None
    cover_original: str | None = None
    price: float | None = None
    cached: bool = False


class PriceResult(BaseModel):
    """Price lookup result"""
    price: float | None = None


def get_cache_key(artist: str, album: str) -> str:
    """Generate a consistent cache key for an album"""
    key = f"{artist.lower().strip()}_{album.lower().strip()}"
    return hashlib.md5(key.encode()).hexdigest()


async def get_cached_data(env, cache_key: str) -> dict | None:
    """Get cached album data from R2 if it exists"""
    # Check if R2 is available
    if not hasattr(env, 'CACHE') or env.CACHE is None:
        return None
    try:
        obj = await env.CACHE.get(f"data/{cache_key}.json")
        if obj:
            text = await obj.text()
            return json.loads(text)
    except Exception:
        pass
    return None


async def save_cached_data(env, cache_key: str, data: dict) -> None:
    """Save album data to R2 cache"""
    # Check if R2 is available
    if not hasattr(env, 'CACHE') or env.CACHE is None:
        return
    try:
        await env.CACHE.put(
            f"data/{cache_key}.json",
            json.dumps(data),
            httpMetadata={"contentType": "application/json"}
        )
    except Exception:
        pass


async def cache_image(env, url: str, cache_key: str) -> str | None:
    """Download and cache image in R2, return local path or original URL"""
    if not url:
        return None

    # If R2 not available, return original URL
    if not hasattr(env, 'CACHE') or env.CACHE is None:
        return url

    # Determine extension
    ext = "jpg"
    if ".png" in url.lower():
        ext = "png"
    elif ".gif" in url.lower():
        ext = "gif"

    local_path = f"images/{cache_key}.{ext}"

    # Check if already cached
    try:
        existing = await env.CACHE.head(local_path)
        if existing:
            return f"/cache/{local_path}"
    except Exception:
        pass

    # Download and cache
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                url,
                headers={"User-Agent": "VinylVault/2.0"},
                timeout=10.0
            )
            if response.status_code == 200:
                content_type = f"image/{ext}"
                await env.CACHE.put(
                    local_path,
                    response.content,
                    httpMetadata={"contentType": content_type}
                )
                return f"/cache/{local_path}"
    except Exception:
        pass

    # Fallback to original URL
    return url


@router.get("/search")
async def search_album(
    request: Request,
    artist: str,
    album: str
) -> AlbumSearchResult:
    """
    Search Discogs for an album and cache results in R2.
    Returns cover image URL and price if available.
    """
    env = request.scope["env"]

    if not artist or not album:
        raise HTTPException(status_code=400, detail="Artist and album required")

    cache_key = get_cache_key(artist, album)

    # Check cache first
    cached = await get_cached_data(env, cache_key)
    if cached:
        return AlbumSearchResult(**cached, cached=True)

    # Search Discogs
    try:
        async with httpx.AsyncClient() as client:
            query = f"{artist} {album}"
            response = await client.get(
                f"{DISCOGS_API}/database/search",
                params={
                    "q": query,
                    "type": "release",
                    "key": env.DISCOGS_KEY,
                    "secret": env.DISCOGS_SECRET
                },
                headers={"User-Agent": "VinylVault/2.0"},
                timeout=10.0
            )

            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Discogs API error: {response.status_code}"
                )

            data = response.json()

            if not data.get("results"):
                raise HTTPException(status_code=404, detail="Album not found")

            # Find best match
            results = data["results"]
            best_match = None
            artist_lower = artist.lower()
            album_lower = album.lower()

            for r in results:
                title_lower = r.get("title", "").lower()
                if artist_lower in title_lower and album_lower in title_lower:
                    best_match = r
                    break

            if not best_match:
                best_match = results[0]

            # Get cover image
            cover_url = best_match.get("cover_image") or best_match.get("thumb")
            local_cover = await cache_image(env, cover_url, cache_key)

            # Get price (separate request to avoid rate limits in main search)
            price = None
            release_id = best_match.get("id")

            result = AlbumSearchResult(
                id=release_id,
                title=best_match.get("title"),
                year=best_match.get("year"),
                cover=local_cover or cover_url,
                cover_original=cover_url,
                price=price
            )

            # Cache the result
            await save_cached_data(env, cache_key, result.model_dump())

            return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/price/{release_id}")
async def get_price(request: Request, release_id: int) -> PriceResult:
    """
    Get price for a specific Discogs release.
    Tries price suggestions first, then falls back to lowest_price.
    """
    env = request.scope["env"]

    try:
        async with httpx.AsyncClient() as client:
            # Try price suggestions first
            response = await client.get(
                f"{DISCOGS_API}/marketplace/price_suggestions/{release_id}",
                params={
                    "key": env.DISCOGS_KEY,
                    "secret": env.DISCOGS_SECRET
                },
                headers={"User-Agent": "VinylVault/2.0"},
                timeout=10.0
            )

            if response.status_code == 200:
                data = response.json()
                if data.get("Very Good Plus (VG+)"):
                    return PriceResult(price=data["Very Good Plus (VG+)"]["value"])
                elif data.get("Very Good (VG)"):
                    return PriceResult(price=data["Very Good (VG)"]["value"])

            # Fallback: get lowest price from release
            response = await client.get(
                f"{DISCOGS_API}/releases/{release_id}",
                params={
                    "key": env.DISCOGS_KEY,
                    "secret": env.DISCOGS_SECRET
                },
                headers={"User-Agent": "VinylVault/2.0"},
                timeout=10.0
            )

            if response.status_code == 200:
                data = response.json()
                return PriceResult(price=data.get("lowest_price"))

            return PriceResult(price=None)

    except Exception:
        return PriceResult(price=None)


@router.get("/cache/{path:path}")
async def serve_cached_image(request: Request, path: str):
    """Serve cached images from R2"""
    env = request.scope["env"]

    try:
        obj = await env.CACHE.get(path)
        if obj:
            # Return the object with appropriate headers
            from starlette.responses import Response
            body = await obj.arrayBuffer()
            content_type = obj.httpMetadata.get("contentType", "application/octet-stream")
            return Response(content=bytes(body), media_type=content_type)
    except Exception:
        pass

    raise HTTPException(status_code=404, detail="Image not found")
