"""
Discogs API proxy with R2 caching

Flow for client-side Discogs (Worker blocked by Cloudflare):
1. Client calls GET /api/discogs/cache/check?artist=X&album=Y
2. If cached, Worker returns cached data
3. If not cached, client fetches from Discogs directly
4. Client calls POST /api/discogs/cache/store with the data to cache
"""

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
import hashlib
import json
import base64
import urllib.parse
import js
from pyodide.ffi import to_js

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


class CacheCheckResponse(BaseModel):
    """Response from cache check"""
    cached: bool
    cache_key: str
    data: AlbumSearchResult | None = None


class CacheStoreRequest(BaseModel):
    """Request to store album data in cache"""
    artist: str
    album: str
    discogs_id: int | None = None
    title: str | None = None
    year: int | None = None
    cover_url: str | None = None
    price: float | None = None
    # Base64 encoded image data (optional)
    image_data: str | None = None
    image_type: str = "jpg"


class CacheStoreResponse(BaseModel):
    """Response from cache store"""
    success: bool
    cache_key: str
    cover_path: str | None = None


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
    except Exception as e:
        print(f"[Discogs] Cache read error for {cache_key}: {type(e).__name__}: {e}")
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
    except Exception as e:
        print(f"[Discogs] Cache write error for {cache_key}: {type(e).__name__}: {e}")


async def cache_image(env, url: str, cache_key: str) -> str | None:
    """Return the original image URL - R2 caching is disabled for reliability"""
    # Just return the original Discogs URL directly
    # The browser can load images from Discogs without CORS issues
    return url


@router.get("/search")
async def search_album(
    request: Request,
    artist: str,
    album: str,
    refresh: bool = False
) -> AlbumSearchResult:
    """
    Search Discogs for an album and cache results in R2.
    Returns cover image URL and price if available.
    Use refresh=true to bypass cache and fetch fresh data.
    """
    env = request.scope["env"]

    if not artist or not album:
        raise HTTPException(status_code=400, detail="Artist and album required")

    cache_key = get_cache_key(artist, album)

    # Check cache first (unless refresh is requested)
    if not refresh:
        cached_data = await get_cached_data(env, cache_key)
        if cached_data:
            # Set cached flag to True (overwrite the False that was saved)
            cached_data['cached'] = True
            return AlbumSearchResult(**cached_data)

    # Search Discogs using js.fetch (bypasses Cloudflare blocking)
    try:
        # Get secrets (convert from JsProxy if needed)
        discogs_key = None
        discogs_secret = None
        try:
            if hasattr(env, 'DISCOGS_KEY'):
                discogs_key = str(env.DISCOGS_KEY)
            if hasattr(env, 'DISCOGS_SECRET'):
                discogs_secret = str(env.DISCOGS_SECRET)
        except Exception as e:
            print(f"[Discogs] Error getting secrets: {e}")
            raise HTTPException(status_code=500, detail=f"Error accessing Discogs credentials: {str(e)}")

        if not discogs_key or not discogs_secret:
            print(f"[Discogs] Missing credentials - key: {bool(discogs_key)}, secret: {bool(discogs_secret)}")
            raise HTTPException(status_code=500, detail="Discogs credentials not configured")

        query = f"{artist} {album}"
        encoded_query = urllib.parse.quote(query, safe='')
        url = f"{DISCOGS_API}/database/search?q={encoded_query}&type=release&key={discogs_key}&secret={discogs_secret}"

        print(f"[Discogs] Searching: {artist} - {album}")
        print(f"[Discogs] URL: {DISCOGS_API}/database/search?q={encoded_query}&type=release")

        headers = to_js({
            "User-Agent": "NicheCollectorConnector/1.0 +https://niche-collector.pages.dev"
        })

        print(f"[Discogs] Making API request...")
        response = await js.fetch(url, to_js({"headers": headers}))
        print(f"[Discogs] Response status: {response.status}")

        if response.status != 200:
            text = await response.text()
            print(f"[Discogs] API error {response.status}: {text[:500]}")
            raise HTTPException(
                status_code=response.status,
                detail=f"Discogs API error: {response.status} - {text[:200]}"
            )

        # Parse JSON response
        print(f"[Discogs] Parsing JSON response...")
        json_data = await response.json()

        # Handle both JsProxy and dict cases
        if hasattr(json_data, 'to_py'):
            print(f"[Discogs] Converting JsProxy to Python dict...")
            data = json_data.to_py()
        else:
            print(f"[Discogs] Response is already a dict or dict-like...")
            data = dict(json_data) if json_data else {}

        print(f"[Discogs] Data type: {type(data)}, keys: {list(data.keys()) if isinstance(data, dict) else 'N/A'}")

        results = data.get("results", [])
        print(f"[Discogs] Found {len(results)} results")

        if not results:
            raise HTTPException(status_code=404, detail="Album not found on Discogs")

        # Find best match
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

        print(f"[Discogs] Best match: {best_match.get('title', 'Unknown')}")

        # Get cover image
        cover_url = best_match.get("cover_image") or best_match.get("thumb")
        print(f"[Discogs] Cover URL: {cover_url[:100] if cover_url else 'None'}...")

        try:
            local_cover = await cache_image(env, cover_url, cache_key)
            print(f"[Discogs] Local cover: {local_cover[:100] if local_cover else 'None'}...")
        except Exception as img_err:
            print(f"[Discogs] Error caching image: {type(img_err).__name__}: {str(img_err)}")
            local_cover = cover_url  # Fall back to original URL

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
        try:
            await save_cached_data(env, cache_key, result.model_dump())
            print(f"[Discogs] Result cached successfully")
        except Exception as cache_err:
            print(f"[Discogs] Error caching result (non-fatal): {str(cache_err)}")

        return result

    except HTTPException:
        raise
    except Exception as e:
        # Provide more context in error messages
        import traceback
        error_msg = f"Discogs search error: {type(e).__name__}: {str(e)}"
        print(f"[Discogs] EXCEPTION: {error_msg}")
        print(f"[Discogs] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=error_msg)


@router.get("/price/{release_id}")
async def get_price(request: Request, release_id: int) -> PriceResult:
    """
    Get price for a specific Discogs release.
    Tries price suggestions first, then falls back to lowest_price.
    """
    env = request.scope["env"]

    # Get secrets (convert from JsProxy if needed)
    discogs_key = str(env.DISCOGS_KEY) if hasattr(env, 'DISCOGS_KEY') else None
    discogs_secret = str(env.DISCOGS_SECRET) if hasattr(env, 'DISCOGS_SECRET') else None

    if not discogs_key or not discogs_secret:
        return PriceResult(price=None)

    try:
        headers = to_js({
            "User-Agent": "NicheCollectorConnector/1.0 +https://niche-collector.pages.dev"
        })

        # Try price suggestions first
        url = f"{DISCOGS_API}/marketplace/price_suggestions/{release_id}?key={discogs_key}&secret={discogs_secret}"
        response = await js.fetch(url, to_js({"headers": headers}))

        if response.status == 200:
            data = (await response.json()).to_py()
            if data.get("Very Good Plus (VG+)"):
                return PriceResult(price=data["Very Good Plus (VG+)"]["value"])
            elif data.get("Very Good (VG)"):
                return PriceResult(price=data["Very Good (VG)"]["value"])

        # Fallback: get lowest price from release
        url = f"{DISCOGS_API}/releases/{release_id}?key={discogs_key}&secret={discogs_secret}"
        response = await js.fetch(url, to_js({"headers": headers}))

        if response.status == 200:
            data = (await response.json()).to_py()
            return PriceResult(price=data.get("lowest_price"))

        return PriceResult(price=None)

    except Exception:
        return PriceResult(price=None)


@router.get("/cache/check")
async def check_cache(
    request: Request,
    artist: str,
    album: str
) -> CacheCheckResponse:
    """
    Check if album data exists in cache.
    Client should call this first before fetching from Discogs.
    """
    env = request.scope["env"]

    if not artist or not album:
        raise HTTPException(status_code=400, detail="Artist and album required")

    cache_key = get_cache_key(artist, album)

    # Check cache
    cached_data = await get_cached_data(env, cache_key)

    if cached_data:
        # Update cached flag before creating response
        cached_data["cached"] = True
        return CacheCheckResponse(
            cached=True,
            cache_key=cache_key,
            data=AlbumSearchResult(**cached_data)
        )

    return CacheCheckResponse(
        cached=False,
        cache_key=cache_key,
        data=None
    )


@router.post("/cache/store")
async def store_cache(
    request: Request,
    body: CacheStoreRequest
) -> CacheStoreResponse:
    """
    Store album data and optionally image in cache.
    Client calls this after fetching from Discogs directly.

    If image_data is provided (base64 encoded), it will be stored in R2.
    Otherwise, cover_url will be stored as-is.
    """
    env = request.scope["env"]

    if not body.artist or not body.album:
        raise HTTPException(status_code=400, detail="Artist and album required")

    cache_key = get_cache_key(body.artist, body.album)
    cover_path = None

    # Store image if provided
    if body.image_data and hasattr(env, 'CACHE') and env.CACHE is not None:
        try:
            # Decode base64 image
            image_bytes = base64.b64decode(body.image_data)

            # Determine path and content type
            ext = body.image_type.lower()
            if ext not in ["jpg", "jpeg", "png", "gif", "webp"]:
                ext = "jpg"

            local_path = f"images/{cache_key}.{ext}"
            content_type = f"image/{ext}" if ext != "jpg" else "image/jpeg"

            # Store in R2
            await env.CACHE.put(
                local_path,
                image_bytes,
                httpMetadata={"contentType": content_type}
            )

            cover_path = f"/api/discogs/cache/{local_path}"

        except Exception as e:
            # If image storage fails, continue with URL
            cover_path = body.cover_url

    # Build album data
    album_data = AlbumSearchResult(
        id=body.discogs_id,
        title=body.title or f"{body.artist} - {body.album}",
        year=body.year,
        cover=cover_path or body.cover_url,
        cover_original=body.cover_url,
        price=body.price,
        cached=False  # Will be True when retrieved
    )

    # Store in cache
    try:
        await save_cached_data(env, cache_key, album_data.model_dump())

        return CacheStoreResponse(
            success=True,
            cache_key=cache_key,
            cover_path=cover_path
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to store cache: {str(e)}")


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
    except Exception as e:
        print(f"[Discogs] Error serving cached image {path}: {type(e).__name__}: {e}")

    raise HTTPException(status_code=404, detail="Image not found")
