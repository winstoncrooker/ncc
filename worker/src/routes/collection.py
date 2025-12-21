"""
User collection CRUD and sync routes
"""

from fastapi import APIRouter, Request, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from routes.auth import require_auth, get_current_user

router = APIRouter()


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


class AlbumCreate(BaseModel):
    """Album creation request"""
    artist: str
    album: str
    genre: Optional[str] = None
    cover: Optional[str] = None
    price: Optional[float] = None
    discogs_id: Optional[int] = None
    year: Optional[int] = None


class AlbumUpdate(BaseModel):
    """Album update request"""
    artist: Optional[str] = None
    album: Optional[str] = None
    genre: Optional[str] = None
    cover: Optional[str] = None
    price: Optional[float] = None
    discogs_id: Optional[int] = None
    year: Optional[int] = None


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
    genres: dict[str, int]


@router.get("/")
async def get_collection(
    request: Request,
    user_id: int = Depends(require_auth)
) -> list[Album]:
    """
    Get user's complete collection.
    Requires authentication.
    """
    env = request.scope["env"]

    try:
        results = await env.DB.prepare(
            """SELECT id, artist, album, genre, cover, price, discogs_id, year
               FROM collections
               WHERE user_id = ?
               ORDER BY artist, album"""
        ).bind(user_id).all()

        albums = []
        for row in results.results:
            albums.append(Album(
                id=row["id"],
                artist=row["artist"],
                album=row["album"],
                genre=row["genre"],
                cover=row["cover"],
                price=row["price"],
                discogs_id=row["discogs_id"],
                year=row["year"]
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
        # Check for duplicate
        existing = await env.DB.prepare(
            """SELECT id FROM collections
               WHERE user_id = ? AND LOWER(artist) = LOWER(?) AND LOWER(album) = LOWER(?)"""
        ).bind(user_id, body.artist, body.album).first()

        if existing:
            raise HTTPException(status_code=400, detail="Album already in collection")

        result = await env.DB.prepare(
            """INSERT INTO collections (user_id, artist, album, genre, cover, price, discogs_id, year)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)
               RETURNING id"""
        ).bind(
            user_id, body.artist, body.album, body.genre,
            body.cover, body.price, body.discogs_id, body.year
        ).first()

        return Album(
            id=result["id"],
            artist=body.artist,
            album=body.album,
            genre=body.genre,
            cover=body.cover,
            price=body.price,
            discogs_id=body.discogs_id,
            year=body.year
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

        if updates:
            updates.append("updated_at = CURRENT_TIMESTAMP")
            query = f"UPDATE collections SET {', '.join(updates)} WHERE id = ? AND user_id = ?"
            values.extend([album_id, user_id])

            await env.DB.prepare(query).bind(*values).run()

        # Fetch updated record
        updated = await env.DB.prepare(
            "SELECT * FROM collections WHERE id = ?"
        ).bind(album_id).first()

        return Album(
            id=updated["id"],
            artist=updated["artist"],
            album=updated["album"],
            genre=updated["genre"],
            cover=updated["cover"],
            price=updated["price"],
            discogs_id=updated["discogs_id"],
            year=updated["year"]
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
            if row["genre"]:
                genres[row["genre"]] = row["count"]

        return CollectionStats(
            total_albums=totals["count"] or 0,
            total_value=totals["total_value"] or 0.0,
            genres=genres
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching stats: {str(e)}")
