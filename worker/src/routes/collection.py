"""
User collection CRUD and sync routes
"""

from fastapi import APIRouter, Request, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from routes.auth import require_auth, get_current_user

router = APIRouter()


def to_python_value(val, expected_type=None):
    """Convert JsNull/undefined to Python None, with optional type coercion"""
    if val is None or (hasattr(val, '__class__') and ('JsNull' in str(type(val)) or 'JsUndefined' in str(type(val)))):
        return None
    return val


class Album(BaseModel):
    """Album in user's collection"""
    id: Optional[int] = None
    artist: str
    album: str
    genre: Optional[str] = None
    cover: Optional[str] = None
    price: Optional[float] = None
    discogs_id: Optional[int] = None
    year: Optional[int] = None
    category_id: Optional[int] = None
    tags: Optional[str] = None  # Comma-separated: "for_trade,grail,sealed"
    condition: Optional[str] = None
    notes: Optional[str] = None


class AlbumCreate(BaseModel):
    """Album creation request"""
    artist: str
    album: str
    genre: Optional[str] = None
    cover: Optional[str] = None
    price: Optional[float] = None
    discogs_id: Optional[int] = None
    year: Optional[int] = None
    category_id: Optional[int] = None
    tags: Optional[str] = None
    condition: Optional[str] = None
    notes: Optional[str] = None


class AlbumUpdate(BaseModel):
    """Album update request"""
    artist: Optional[str] = None
    album: Optional[str] = None
    genre: Optional[str] = None
    cover: Optional[str] = None
    price: Optional[float] = None
    discogs_id: Optional[int] = None
    year: Optional[int] = None
    tags: Optional[str] = None
    condition: Optional[str] = None
    notes: Optional[str] = None


class SyncRequest(BaseModel):
    """Sync request for offline-to-online merge"""
    albums: list[Album] = []
    deleted_ids: list[int] = []
    last_sync: Optional[str] = None


class SyncResponse(BaseModel):
    """Sync response"""
    albums: list[Album]
    synced_at: str


class CollectionStats(BaseModel):
    """Collection statistics"""
    total_albums: int
    total_value: float
    total_showcase: int = 0
    genres: dict[str, int]
    category_breakdown: dict[int, int] = {}  # category_id -> count


@router.get("/")
async def get_collection(
    request: Request,
    category_id: Optional[int] = None,
    user_id: int = Depends(require_auth)
) -> list[Album]:
    """
    Get user's collection, optionally filtered by category.
    Requires authentication.
    """
    env = request.scope["env"]

    try:
        if category_id:
            results = await env.DB.prepare(
                """SELECT id, artist, album, genre, cover, price, discogs_id, year, category_id, tags, condition, notes
                   FROM collections
                   WHERE user_id = ? AND category_id = ?
                   ORDER BY artist, album"""
            ).bind(user_id, category_id).all()
        else:
            results = await env.DB.prepare(
                """SELECT id, artist, album, genre, cover, price, discogs_id, year, category_id, tags, condition, notes
                   FROM collections
                   WHERE user_id = ?
                   ORDER BY artist, album"""
            ).bind(user_id).all()

        albums = []
        for row in results.results:
            # Convert JS proxy row to Python dict
            if hasattr(row, 'to_py'):
                row = row.to_py()
            albums.append(Album(
                id=row["id"],
                artist=row["artist"],
                album=row["album"],
                genre=to_python_value(row.get("genre")),
                cover=to_python_value(row.get("cover")),
                price=to_python_value(row.get("price")),
                discogs_id=to_python_value(row.get("discogs_id")),
                year=to_python_value(row.get("year")),
                category_id=to_python_value(row.get("category_id")),
                tags=to_python_value(row.get("tags")),
                condition=to_python_value(row.get("condition")),
                notes=to_python_value(row.get("notes"))
            ))

        return albums
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching collection: {str(e)}")


@router.post("/")
async def add_album(
    request: Request,
    body: AlbumCreate,
    user_id: int = Depends(require_auth)
) -> Album:
    """
    Add album to user's collection.
    Requires authentication.
    """
    env = request.scope["env"]

    if not body.artist or not body.album:
        raise HTTPException(status_code=400, detail="Artist and album required")

    try:
        # Check for duplicate (within same category if provided)
        if body.category_id:
            existing = await env.DB.prepare(
                """SELECT id FROM collections
                   WHERE user_id = ? AND LOWER(artist) = LOWER(?) AND LOWER(album) = LOWER(?) AND category_id = ?"""
            ).bind(user_id, body.artist, body.album, body.category_id).first()
        else:
            existing = await env.DB.prepare(
                """SELECT id FROM collections
                   WHERE user_id = ? AND LOWER(artist) = LOWER(?) AND LOWER(album) = LOWER(?)"""
            ).bind(user_id, body.artist, body.album).first()

        if existing:
            raise HTTPException(status_code=400, detail="Album already in collection")

        # Build dynamic query for optional fields
        # D1 has issues with None/null values, so we only include fields that have values
        fields = ["user_id", "artist", "album"]
        values = [user_id, body.artist, body.album]

        if body.genre:
            fields.append("genre")
            values.append(body.genre)
        if body.cover:
            fields.append("cover")
            values.append(body.cover)
        if body.price is not None:
            fields.append("price")
            values.append(body.price)
        if body.discogs_id is not None:
            fields.append("discogs_id")
            values.append(body.discogs_id)
        if body.year is not None:
            fields.append("year")
            values.append(body.year)
        if body.category_id is not None:
            fields.append("category_id")
            values.append(body.category_id)
        if body.tags:
            fields.append("tags")
            values.append(body.tags)
        if body.condition:
            fields.append("condition")
            values.append(body.condition)
        if body.notes:
            fields.append("notes")
            values.append(body.notes)

        placeholders = ", ".join(["?" for _ in fields])
        field_names = ", ".join(fields)

        print(f"[Collection] Adding album: {body.artist} - {body.album} (category: {body.category_id})")
        print(f"[Collection] Fields: {field_names}, Values: {values}")

        result = await env.DB.prepare(
            f"INSERT INTO collections ({field_names}) VALUES ({placeholders}) RETURNING id"
        ).bind(*values).first()

        if result and hasattr(result, 'to_py'):
            result = result.to_py()

        return Album(
            id=result["id"],
            artist=body.artist,
            album=body.album,
            genre=body.genre,
            cover=body.cover,
            price=body.price,
            discogs_id=body.discogs_id,
            year=body.year,
            category_id=body.category_id
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error adding album: {str(e)}")


@router.put("/{album_id}")
async def update_album(
    request: Request,
    album_id: int,
    body: AlbumUpdate,
    user_id: int = Depends(require_auth)
) -> Album:
    """
    Update album in user's collection.
    Requires authentication.
    """
    env = request.scope["env"]

    try:
        # Verify ownership
        existing = await env.DB.prepare(
            "SELECT * FROM collections WHERE id = ? AND user_id = ?"
        ).bind(album_id, user_id).first()

        if not existing:
            raise HTTPException(status_code=404, detail="Album not found")

        # Build update query dynamically
        updates = []
        values = []

        if body.artist is not None:
            updates.append("artist = ?")
            values.append(body.artist)
        if body.album is not None:
            updates.append("album = ?")
            values.append(body.album)
        if body.genre is not None:
            updates.append("genre = ?")
            values.append(body.genre)
        if body.cover is not None:
            updates.append("cover = ?")
            values.append(body.cover)
        if body.price is not None:
            updates.append("price = ?")
            values.append(body.price)
        if body.discogs_id is not None:
            updates.append("discogs_id = ?")
            values.append(body.discogs_id)
        if body.year is not None:
            updates.append("year = ?")
            values.append(body.year)
        # For tags, notes, condition - always update if provided (even if null/empty)
        # Using __fields_set__ to detect which fields were explicitly sent in request
        fields_set = body.__fields_set__ if hasattr(body, '__fields_set__') else set()

        if 'tags' in fields_set or body.tags is not None:
            updates.append("tags = ?")
            # Convert empty string to null
            values.append(body.tags if body.tags else None)
        if 'condition' in fields_set or body.condition is not None:
            updates.append("condition = ?")
            values.append(body.condition if body.condition else None)
        if 'notes' in fields_set or body.notes is not None:
            updates.append("notes = ?")
            values.append(body.notes if body.notes else None)

        if updates:
            updates.append("updated_at = CURRENT_TIMESTAMP")
            query = f"UPDATE collections SET {', '.join(updates)} WHERE id = ? AND user_id = ?"
            values.extend([album_id, user_id])

            await env.DB.prepare(query).bind(*values).run()

        # Fetch updated record
        updated = await env.DB.prepare(
            "SELECT * FROM collections WHERE id = ?"
        ).bind(album_id).first()

        if updated and hasattr(updated, 'to_py'):
            updated = updated.to_py()

        return Album(
            id=updated["id"],
            artist=updated["artist"],
            album=updated["album"],
            genre=to_python_value(updated["genre"]),
            cover=to_python_value(updated["cover"]),
            price=to_python_value(updated["price"]),
            discogs_id=to_python_value(updated["discogs_id"]),
            year=to_python_value(updated["year"])
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating album: {str(e)}")


@router.delete("/{album_id}")
async def delete_album(
    request: Request,
    album_id: int,
    user_id: int = Depends(require_auth)
) -> dict:
    """
    Delete album from user's collection.
    Also removes from showcase if present.
    Requires authentication.
    """
    env = request.scope["env"]

    try:
        # Verify ownership
        existing = await env.DB.prepare(
            "SELECT id FROM collections WHERE id = ? AND user_id = ?"
        ).bind(album_id, user_id).first()

        if not existing:
            raise HTTPException(status_code=404, detail="Album not found")

        # Delete from showcase first (D1 doesn't enforce foreign keys)
        await env.DB.prepare(
            "DELETE FROM showcase_albums WHERE collection_id = ? AND user_id = ?"
        ).bind(album_id, user_id).run()

        # Delete from collection
        await env.DB.prepare(
            "DELETE FROM collections WHERE id = ? AND user_id = ?"
        ).bind(album_id, user_id).run()

        return {"status": "deleted", "id": album_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting album: {str(e)}")


@router.post("/sync")
async def sync_collection(
    request: Request,
    body: SyncRequest,
    user_id: int = Depends(require_auth)
) -> SyncResponse:
    """
    Sync offline changes with server.
    Handles adds, updates, and deletes in a single request.
    Returns the complete updated collection.
    """
    env = request.scope["env"]
    from datetime import datetime

    try:
        # Process deletions first
        for album_id in body.deleted_ids:
            await env.DB.prepare(
                "DELETE FROM collections WHERE id = ? AND user_id = ?"
            ).bind(album_id, user_id).run()

        # Process albums (upsert)
        for album in body.albums:
            if album.id:
                # Update existing
                await env.DB.prepare(
                    """UPDATE collections
                       SET artist = ?, album = ?, genre = ?, cover = ?, price = ?,
                           discogs_id = ?, year = ?, updated_at = CURRENT_TIMESTAMP
                       WHERE id = ? AND user_id = ?"""
                ).bind(
                    album.artist, album.album, album.genre, album.cover, album.price,
                    album.discogs_id, album.year, album.id, user_id
                ).run()
            else:
                # Check for existing by artist/album (case-insensitive)
                existing = await env.DB.prepare(
                    """SELECT id FROM collections
                       WHERE user_id = ? AND LOWER(artist) = LOWER(?) AND LOWER(album) = LOWER(?)"""
                ).bind(user_id, album.artist, album.album).first()

                if existing:
                    # Update existing
                    await env.DB.prepare(
                        """UPDATE collections
                           SET genre = ?, cover = ?, price = ?, discogs_id = ?, year = ?,
                               updated_at = CURRENT_TIMESTAMP
                           WHERE id = ?"""
                    ).bind(
                        album.genre, album.cover, album.price,
                        album.discogs_id, album.year, existing["id"]
                    ).run()
                else:
                    # Insert new
                    await env.DB.prepare(
                        """INSERT INTO collections
                           (user_id, artist, album, genre, cover, price, discogs_id, year)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?)"""
                    ).bind(
                        user_id, album.artist, album.album, album.genre,
                        album.cover, album.price, album.discogs_id, album.year
                    ).run()

        # Get updated collection
        albums = await get_collection(request, user_id)

        return SyncResponse(
            albums=albums,
            synced_at=datetime.utcnow().isoformat()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sync error: {str(e)}")


@router.get("/stats")
async def get_stats(
    request: Request,
    user_id: int = Depends(require_auth)
) -> CollectionStats:
    """
    Get collection statistics.
    Requires authentication.
    """
    env = request.scope["env"]

    try:
        # Get total count and value
        totals = await env.DB.prepare(
            """SELECT COUNT(*) as count, COALESCE(SUM(price), 0) as total_value
               FROM collections WHERE user_id = ?"""
        ).bind(user_id).first()

        if totals and hasattr(totals, 'to_py'):
            totals = totals.to_py()

        # Get genre breakdown
        genres_result = await env.DB.prepare(
            """SELECT genre, COUNT(*) as count
               FROM collections
               WHERE user_id = ? AND genre IS NOT NULL
               GROUP BY genre
               ORDER BY count DESC"""
        ).bind(user_id).all()

        genres = {}
        for row in genres_result.results:
            if hasattr(row, 'to_py'):
                row = row.to_py()
            genre_val = to_python_value(row.get("genre"))
            if genre_val:
                genres[genre_val] = row["count"]

        # Get category breakdown
        category_result = await env.DB.prepare(
            """SELECT category_id, COUNT(*) as count
               FROM collections
               WHERE user_id = ? AND category_id IS NOT NULL
               GROUP BY category_id"""
        ).bind(user_id).all()

        category_breakdown = {}
        for row in category_result.results:
            if hasattr(row, 'to_py'):
                row = row.to_py()
            cat_id = to_python_value(row.get("category_id"))
            if cat_id is not None:
                category_breakdown[int(cat_id)] = row["count"]

        # Get total showcase count across all categories
        showcase_result = await env.DB.prepare(
            "SELECT COUNT(*) as count FROM showcase_albums WHERE user_id = ?"
        ).bind(user_id).first()
        if showcase_result and hasattr(showcase_result, 'to_py'):
            showcase_result = showcase_result.to_py()
        total_showcase = showcase_result.get("count", 0) or 0 if showcase_result else 0

        return CollectionStats(
            total_albums=totals["count"] or 0 if totals else 0,
            total_value=totals["total_value"] or 0.0 if totals else 0.0,
            total_showcase=total_showcase,
            genres=genres,
            category_breakdown=category_breakdown
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching stats: {str(e)}")
