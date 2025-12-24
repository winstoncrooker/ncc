"""
User profile CRUD routes for Niche Collector Connector
"""

import json
from fastapi import APIRouter, Request, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional

from routes.auth import require_auth
from utils.conversions import to_python_value

router = APIRouter()

# Default privacy settings
DEFAULT_PRIVACY = {
    "profile_visibility": "public",  # public, friends_only, private
    "show_collection": True,
    "show_showcase": True,
    "searchable": True
}


class PrivacySettings(BaseModel):
    """User privacy settings"""
    profile_visibility: str = "public"  # public, friends_only, private
    show_collection: bool = True
    show_showcase: bool = True
    searchable: bool = True


class ExternalLinks(BaseModel):
    """External account links - supports any social platform"""
    model_config = {"extra": "allow"}  # Allow any additional fields

    # Common platforms (optional, can add any)
    instagram: Optional[str] = None
    tiktok: Optional[str] = None
    twitter: Optional[str] = None
    youtube: Optional[str] = None
    facebook: Optional[str] = None
    threads: Optional[str] = None
    bluesky: Optional[str] = None
    mastodon: Optional[str] = None
    twitch: Optional[str] = None
    discord: Optional[str] = None
    spotify: Optional[str] = None
    soundcloud: Optional[str] = None
    bandcamp: Optional[str] = None
    linkedin: Optional[str] = None
    pinterest: Optional[str] = None
    reddit: Optional[str] = None
    website: Optional[str] = None
    # Legacy fields
    discogs: Optional[str] = None
    ebay: Optional[str] = None
    tcgplayer: Optional[str] = None
    pcgs: Optional[str] = None
    psa: Optional[str] = None


class ProfileResponse(BaseModel):
    """User profile response"""
    id: int
    email: str
    name: Optional[str] = None
    picture: Optional[str] = None
    bio: Optional[str] = None
    pronouns: Optional[str] = None
    background_image: Optional[str] = None
    location: Optional[str] = None
    external_links: Optional[ExternalLinks] = None
    created_at: Optional[str] = None
    privacy: Optional[PrivacySettings] = None


class ProfileUpdate(BaseModel):
    """Profile update request"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    bio: Optional[str] = Field(None, max_length=2000)
    pronouns: Optional[str] = Field(None, max_length=50)
    background_image: Optional[str] = Field(None, max_length=2000)
    location: Optional[str] = Field(None, max_length=100)
    external_links: Optional[dict] = None


class ShowcaseAlbum(BaseModel):
    """Album in showcase"""
    id: int
    collection_id: int
    position: int
    artist: str
    album: str
    cover: Optional[str] = None
    year: Optional[int] = None
    notes: Optional[str] = None


class ShowcaseAdd(BaseModel):
    """Add album to showcase"""
    collection_id: int


class ShowcaseReorder(BaseModel):
    """Reorder showcase albums"""
    album_ids: list[int]  # List of showcase album IDs in new order


class ShowcaseNotesUpdate(BaseModel):
    """Update showcase item notes"""
    notes: Optional[str] = Field(None, max_length=500)


def parse_privacy_settings(privacy_json: str | None) -> PrivacySettings:
    """Parse privacy settings JSON, returning defaults if invalid"""
    if not privacy_json:
        return PrivacySettings(**DEFAULT_PRIVACY)
    try:
        data = json.loads(privacy_json)
        return PrivacySettings(**{**DEFAULT_PRIVACY, **data})
    except (json.JSONDecodeError, TypeError):
        return PrivacySettings(**DEFAULT_PRIVACY)


def parse_external_links(links_json: str | None) -> ExternalLinks | None:
    """Parse external links JSON into ExternalLinks model"""
    if not links_json:
        return None
    try:
        links_dict = json.loads(links_json)
        return ExternalLinks(**links_dict) if links_dict else None
    except (json.JSONDecodeError, TypeError):
        return None


@router.get("/me")
async def get_profile(
    request: Request,
    user_id: int = Depends(require_auth)
) -> ProfileResponse:
    """
    Get current user's profile.
    Requires authentication.
    """
    env = request.scope["env"]

    try:
        user = await env.DB.prepare(
            """SELECT id, email, name, picture, bio, pronouns, background_image,
                      location, external_links, created_at, privacy_settings
               FROM users WHERE id = ?"""
        ).bind(user_id).first()

        if user and hasattr(user, 'to_py'):
            user = user.to_py()

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        privacy = parse_privacy_settings(to_python_value(user.get("privacy_settings")))
        external_links = parse_external_links(to_python_value(user.get("external_links")))

        return ProfileResponse(
            id=user["id"],
            email=user["email"],
            name=to_python_value(user.get("name")),
            picture=to_python_value(user.get("picture")),
            bio=to_python_value(user.get("bio")),
            pronouns=to_python_value(user.get("pronouns")),
            background_image=to_python_value(user.get("background_image")),
            location=to_python_value(user.get("location")),
            external_links=external_links,
            created_at=str(user["created_at"]) if to_python_value(user.get("created_at")) else None,
            privacy=privacy
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching profile: {str(e)}")


@router.put("/me")
async def update_profile(
    request: Request,
    body: ProfileUpdate,
    user_id: int = Depends(require_auth)
) -> ProfileResponse:
    """
    Update current user's profile.
    Requires authentication.
    """
    env = request.scope["env"]

    try:
        # Check name uniqueness if name is being updated
        if body.name is not None and body.name.strip():
            existing = await env.DB.prepare(
                "SELECT id FROM users WHERE name = ? AND id != ?"
            ).bind(body.name.strip(), user_id).first()

            if existing:
                raise HTTPException(status_code=400, detail="This name is already taken")

        # Build update query dynamically
        updates = []
        values = []

        if body.name is not None:
            updates.append("name = ?")
            values.append(body.name.strip() if body.name else body.name)
        if body.bio is not None:
            updates.append("bio = ?")
            values.append(body.bio)
        if body.pronouns is not None:
            updates.append("pronouns = ?")
            values.append(body.pronouns)
        if body.background_image is not None:
            updates.append("background_image = ?")
            values.append(body.background_image)
        if body.location is not None:
            updates.append("location = ?")
            values.append(body.location)
        if body.external_links is not None:
            updates.append("external_links = ?")
            values.append(json.dumps(body.external_links))

        if updates:
            query = f"UPDATE users SET {', '.join(updates)} WHERE id = ?"
            values.append(user_id)
            await env.DB.prepare(query).bind(*values).run()

        # Return updated profile
        return await get_profile(request, user_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating profile: {str(e)}")


@router.get("/me/showcase")
async def get_showcase(
    request: Request,
    category_id: Optional[int] = None,
    user_id: int = Depends(require_auth)
) -> list[ShowcaseAlbum]:
    """
    Get user's showcase albums.
    Returns featured albums for profile display, optionally filtered by category.
    """
    env = request.scope["env"]

    try:
        if category_id:
            results = await env.DB.prepare(
                """SELECT s.id, s.collection_id, s.position, s.notes, c.artist, c.album, c.cover, c.year
                   FROM showcase_albums s
                   JOIN collections c ON s.collection_id = c.id
                   WHERE s.user_id = ? AND c.category_id = ?
                   ORDER BY s.position ASC"""
            ).bind(user_id, category_id).all()
        else:
            results = await env.DB.prepare(
                """SELECT s.id, s.collection_id, s.position, s.notes, c.artist, c.album, c.cover, c.year
                   FROM showcase_albums s
                   JOIN collections c ON s.collection_id = c.id
                   WHERE s.user_id = ?
                   ORDER BY s.position ASC"""
            ).bind(user_id).all()

        albums = []
        for row in results.results:
            # Convert JS proxy row to Python dict
            if hasattr(row, 'to_py'):
                row = row.to_py()
            albums.append(ShowcaseAlbum(
                id=row["id"],
                collection_id=row["collection_id"],
                position=row["position"],
                artist=row["artist"],
                album=row["album"],
                cover=to_python_value(row.get("cover")),
                year=to_python_value(row.get("year")),
                notes=to_python_value(row.get("notes"))
            ))

        return albums
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching showcase: {str(e)}")


@router.post("/me/showcase")
async def add_to_showcase(
    request: Request,
    body: ShowcaseAdd,
    user_id: int = Depends(require_auth)
) -> ShowcaseAlbum:
    """
    Add album to showcase.
    Limits showcase to 8 albums max.
    """
    env = request.scope["env"]

    try:
        # Verify album belongs to user and get its category
        album = await env.DB.prepare(
            "SELECT id, artist, album, cover, year, category_id FROM collections WHERE id = ? AND user_id = ?"
        ).bind(body.collection_id, user_id).first()

        if album and hasattr(album, 'to_py'):
            album = album.to_py()

        if not album:
            raise HTTPException(status_code=404, detail="Album not found in your collection")

        # Get the category_id for this item
        category_id = album.get("category_id")

        # Check showcase limit PER CATEGORY (8 per category)
        if category_id:
            count = await env.DB.prepare(
                """SELECT COUNT(*) as count FROM showcase_albums s
                   JOIN collections c ON s.collection_id = c.id
                   WHERE s.user_id = ? AND c.category_id = ?"""
            ).bind(user_id, category_id).first()
        else:
            count = await env.DB.prepare(
                "SELECT COUNT(*) as count FROM showcase_albums WHERE user_id = ?"
            ).bind(user_id).first()

        if count and hasattr(count, 'to_py'):
            count = count.to_py()

        if count and count["count"] >= 8:
            raise HTTPException(status_code=400, detail="Showcase limit reached (max 8 items per category)")

        # Check if already in showcase
        existing = await env.DB.prepare(
            "SELECT id FROM showcase_albums WHERE user_id = ? AND collection_id = ?"
        ).bind(user_id, body.collection_id).first()

        if existing:
            raise HTTPException(status_code=400, detail="Album already in showcase")

        # Get next position
        max_pos = await env.DB.prepare(
            "SELECT COALESCE(MAX(position), -1) as max_pos FROM showcase_albums WHERE user_id = ?"
        ).bind(user_id).first()

        if max_pos and hasattr(max_pos, 'to_py'):
            max_pos = max_pos.to_py()

        next_pos = (max_pos["max_pos"] if max_pos else -1) + 1

        # Insert into showcase
        result = await env.DB.prepare(
            """INSERT INTO showcase_albums (user_id, collection_id, position)
               VALUES (?, ?, ?) RETURNING id"""
        ).bind(user_id, body.collection_id, next_pos).first()

        if result and hasattr(result, 'to_py'):
            result = result.to_py()

        return ShowcaseAlbum(
            id=result["id"],
            collection_id=body.collection_id,
            position=next_pos,
            artist=album["artist"],
            album=album["album"],
            cover=to_python_value(album["cover"]),
            year=to_python_value(album["year"])
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error adding to showcase: {str(e)}")


@router.delete("/me/showcase/{showcase_id}")
async def remove_from_showcase(
    request: Request,
    showcase_id: int,
    user_id: int = Depends(require_auth)
) -> dict:
    """
    Remove album from showcase.
    """
    env = request.scope["env"]

    try:
        # Verify ownership
        existing = await env.DB.prepare(
            "SELECT id FROM showcase_albums WHERE id = ? AND user_id = ?"
        ).bind(showcase_id, user_id).first()

        if not existing:
            raise HTTPException(status_code=404, detail="Showcase album not found")

        await env.DB.prepare(
            "DELETE FROM showcase_albums WHERE id = ? AND user_id = ?"
        ).bind(showcase_id, user_id).run()

        return {"status": "removed", "id": showcase_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error removing from showcase: {str(e)}")


@router.put("/me/showcase/reorder")
async def reorder_showcase(
    request: Request,
    body: ShowcaseReorder,
    user_id: int = Depends(require_auth)
) -> list[ShowcaseAlbum]:
    """
    Reorder showcase albums.
    Pass list of showcase album IDs in desired order.
    Uses single SQL statement to prevent race conditions.
    """
    env = request.scope["env"]

    try:
        if not body.album_ids:
            return await get_showcase(request, user_id)

        # Build a single UPDATE with CASE statement for atomic reorder
        # This prevents inconsistent state if the operation is interrupted
        case_parts = []
        for position, showcase_id in enumerate(body.album_ids):
            case_parts.append(f"WHEN id = {int(showcase_id)} THEN {position}")

        case_statement = " ".join(case_parts)
        id_list = ", ".join(str(int(sid)) for sid in body.album_ids)

        await env.DB.prepare(
            f"""UPDATE showcase_albums
                SET position = CASE {case_statement} END
                WHERE id IN ({id_list}) AND user_id = ?"""
        ).bind(user_id).run()

        # Return updated showcase
        return await get_showcase(request, user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reordering showcase: {str(e)}")


@router.put("/me/showcase/{showcase_id}/notes")
async def update_showcase_notes(
    request: Request,
    showcase_id: int,
    body: ShowcaseNotesUpdate,
    user_id: int = Depends(require_auth)
) -> ShowcaseAlbum:
    """
    Update notes for a showcase item.
    """
    env = request.scope["env"]

    try:
        # Verify ownership
        existing = await env.DB.prepare(
            "SELECT id FROM showcase_albums WHERE id = ? AND user_id = ?"
        ).bind(showcase_id, user_id).first()

        if not existing:
            raise HTTPException(status_code=404, detail="Showcase item not found")

        # Update notes
        await env.DB.prepare(
            "UPDATE showcase_albums SET notes = ? WHERE id = ? AND user_id = ?"
        ).bind(body.notes, showcase_id, user_id).run()

        # Return updated item
        result = await env.DB.prepare(
            """SELECT s.id, s.collection_id, s.position, s.notes, c.artist, c.album, c.cover, c.year
               FROM showcase_albums s
               JOIN collections c ON s.collection_id = c.id
               WHERE s.id = ?"""
        ).bind(showcase_id).first()

        if result and hasattr(result, 'to_py'):
            result = result.to_py()

        return ShowcaseAlbum(
            id=result["id"],
            collection_id=result["collection_id"],
            position=result["position"],
            artist=result["artist"],
            album=result["album"],
            cover=to_python_value(result.get("cover")),
            year=to_python_value(result.get("year")),
            notes=to_python_value(result.get("notes"))
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating showcase notes: {str(e)}")


@router.get("/me/privacy")
async def get_privacy_settings(
    request: Request,
    user_id: int = Depends(require_auth)
) -> PrivacySettings:
    """
    Get current user's privacy settings.
    """
    env = request.scope["env"]

    try:
        result = await env.DB.prepare(
            "SELECT privacy_settings FROM users WHERE id = ?"
        ).bind(user_id).first()

        if result and hasattr(result, 'to_py'):
            result = result.to_py()

        if not result:
            raise HTTPException(status_code=404, detail="User not found")

        return parse_privacy_settings(to_python_value(result.get("privacy_settings")))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching privacy settings: {str(e)}")


@router.put("/me/privacy")
async def update_privacy_settings(
    request: Request,
    body: PrivacySettings,
    user_id: int = Depends(require_auth)
) -> PrivacySettings:
    """
    Update current user's privacy settings.
    """
    env = request.scope["env"]

    # Validate profile_visibility
    valid_visibility = ["public", "friends_only", "private"]
    if body.profile_visibility not in valid_visibility:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid profile_visibility. Must be one of: {valid_visibility}"
        )

    try:
        privacy_json = json.dumps({
            "profile_visibility": body.profile_visibility,
            "show_collection": body.show_collection,
            "show_showcase": body.show_showcase,
            "searchable": body.searchable
        })

        await env.DB.prepare(
            "UPDATE users SET privacy_settings = ? WHERE id = ?"
        ).bind(privacy_json, user_id).run()

        return body
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating privacy settings: {str(e)}")
