"""
User profile CRUD routes for Niche Collector Connector
"""

import json
from fastapi import APIRouter, Request, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional

from routes.auth import require_auth, require_auth
from utils.conversions import to_python_value

router = APIRouter()

# Limits
MAX_SHOWCASE_ITEMS_PER_CATEGORY = 8

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
    featured_category_id: Optional[int] = None


class ProfileUpdate(BaseModel):
    """Profile update request"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    bio: Optional[str] = Field(None, max_length=2000)
    pronouns: Optional[str] = Field(None, max_length=50)
    background_image: Optional[str] = Field(None, max_length=2000)
    location: Optional[str] = Field(None, max_length=100)
    external_links: Optional[dict] = None
    featured_category_id: Optional[int] = None  # Category to show on profile preview


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
    tags: Optional[str] = None


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
                      location, external_links, created_at, privacy_settings,
                      featured_category_id
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
            privacy=privacy,
            featured_category_id=to_python_value(user.get("featured_category_id"))
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
    Uses atomic UPDATE with uniqueness check in WHERE clause to prevent race conditions.
    """
    env = request.scope["env"]

    try:
        # Build update query dynamically
        updates = []
        values = []
        name_being_updated = body.name is not None and body.name.strip()

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
        if body.featured_category_id is not None:
            # Allow setting to 0 or null to clear, otherwise validate category exists
            if body.featured_category_id > 0:
                category = await env.DB.prepare(
                    "SELECT id FROM categories WHERE id = ?"
                ).bind(body.featured_category_id).first()
                if not category:
                    raise HTTPException(status_code=400, detail="Invalid category")
            updates.append("featured_category_id = ?")
            values.append(body.featured_category_id if body.featured_category_id > 0 else None)

        if updates:
            if name_being_updated:
                # Use atomic UPDATE with uniqueness subquery check to prevent race conditions
                # The NOT EXISTS check ensures no other user has this name at UPDATE time
                query = f"""UPDATE users SET {', '.join(updates)}
                           WHERE id = ?
                           AND NOT EXISTS (
                               SELECT 1 FROM users
                               WHERE name = ? COLLATE NOCASE AND id != ?
                           )
                           RETURNING id"""
                values.append(user_id)
                values.append(body.name.strip())
                values.append(user_id)

                result = await env.DB.prepare(query).bind(*values).first()

                if not result:
                    # Either user doesn't exist or name is taken
                    # Check which case it is
                    user_exists = await env.DB.prepare(
                        "SELECT id FROM users WHERE id = ?"
                    ).bind(user_id).first()

                    if not user_exists:
                        raise HTTPException(status_code=404, detail="User not found")
                    else:
                        raise HTTPException(status_code=400, detail="This name is already taken")
            else:
                # No name update - simple update
                query = f"UPDATE users SET {', '.join(updates)} WHERE id = ?"
                values.append(user_id)
                await env.DB.prepare(query).bind(*values).run()

        # Return updated profile
        return await get_profile(request, user_id)
    except HTTPException:
        raise
    except Exception as e:
        # Handle unique constraint violation from the database index as a fallback
        error_message = str(e).lower()
        if "unique" in error_message and "name" in error_message:
            raise HTTPException(status_code=400, detail="This name is already taken")
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
                """SELECT s.id, s.collection_id, s.position, s.notes, c.artist, c.album, c.cover, c.year, c.tags
                   FROM showcase_albums s
                   JOIN collections c ON s.collection_id = c.id
                   WHERE s.user_id = ? AND c.category_id = ?
                   ORDER BY s.position ASC"""
            ).bind(user_id, category_id).all()
        else:
            results = await env.DB.prepare(
                """SELECT s.id, s.collection_id, s.position, s.notes, c.artist, c.album, c.cover, c.year, c.tags
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
                notes=to_python_value(row.get("notes")),
                tags=to_python_value(row.get("tags"))
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
    Limits showcase to 8 albums max per category.
    Uses INSERT ON CONFLICT to prevent race conditions with duplicate adds.
    """
    env = request.scope["env"]

    try:
        # Verify album belongs to user and get its category
        album = await env.DB.prepare(
            "SELECT id, artist, album, cover, year, category_id, tags FROM collections WHERE id = ? AND user_id = ?"
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

        if count and count["count"] >= MAX_SHOWCASE_ITEMS_PER_CATEGORY:
            raise HTTPException(status_code=400, detail=f"Showcase limit reached (max {MAX_SHOWCASE_ITEMS_PER_CATEGORY} items per category)")

        # Use INSERT ON CONFLICT to atomically insert or detect existing entry
        # The UNIQUE(user_id, collection_id) constraint handles race conditions
        # We use a subquery to calculate position atomically
        result = await env.DB.prepare(
            """INSERT INTO showcase_albums (user_id, collection_id, position)
               VALUES (?, ?, (SELECT COALESCE(MAX(position), -1) + 1 FROM showcase_albums WHERE user_id = ?))
               ON CONFLICT(user_id, collection_id) DO NOTHING
               RETURNING id, position"""
        ).bind(user_id, body.collection_id, user_id).first()

        if result and hasattr(result, 'to_py'):
            result = result.to_py()

        if not result:
            # ON CONFLICT DO NOTHING means it already exists
            raise HTTPException(status_code=400, detail="Album already in showcase")

        return ShowcaseAlbum(
            id=result["id"],
            collection_id=body.collection_id,
            position=result["position"],
            artist=album["artist"],
            album=album["album"],
            cover=to_python_value(album.get("cover")),
            year=to_python_value(album.get("year")),
            tags=to_python_value(album.get("tags"))
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
    Uses single atomic SQL UPDATE with CASE WHEN to prevent race conditions.
    """
    env = request.scope["env"]

    try:
        if not body.album_ids:
            return await get_showcase(request, user_id)

        # Validate all IDs are integers to prevent injection
        validated_ids = []
        for sid in body.album_ids:
            try:
                validated_ids.append(int(sid))
            except (ValueError, TypeError):
                raise HTTPException(status_code=400, detail="Invalid showcase ID")

        # Build a single atomic UPDATE using CASE WHEN for all positions
        # This ensures all position updates happen in a single statement
        case_clauses = []
        for position, showcase_id in enumerate(validated_ids):
            case_clauses.append(f"WHEN id = {int(showcase_id)} THEN {position}")

        case_statement = " ".join(case_clauses)

        # Create the list of IDs for the IN clause (already validated as integers)
        id_list = ", ".join(str(sid) for sid in validated_ids)

        # Single atomic UPDATE that sets all positions at once
        await env.DB.prepare(
            f"""UPDATE showcase_albums
               SET position = CASE {case_statement} END
               WHERE user_id = ? AND id IN ({id_list})"""
        ).bind(user_id).run()

        # Return updated showcase
        return await get_showcase(request, user_id)
    except HTTPException:
        raise
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

        # Update notes - use empty string for NULL to avoid D1 type errors
        notes_value = body.notes if body.notes else ""
        await env.DB.prepare(
            "UPDATE showcase_albums SET notes = ? WHERE id = ? AND user_id = ?"
        ).bind(notes_value, showcase_id, user_id).run()

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


# ============================================================================
# Public Profile Endpoints (No authentication required)
# ============================================================================

class PublicProfileResponse(BaseModel):
    """Public profile response - limited info based on privacy settings"""
    id: int
    name: Optional[str] = None
    picture: Optional[str] = None
    bio: Optional[str] = None
    pronouns: Optional[str] = None
    background_image: Optional[str] = None
    location: Optional[str] = None
    external_links: Optional[ExternalLinks] = None
    member_since: Optional[str] = None
    showcase: list[dict] = []
    collection_count: int = 0
    featured_category_id: Optional[int] = None
    featured_category_name: Optional[str] = None
    featured_category_slug: Optional[str] = None


class PublicShowcaseItem(BaseModel):
    """Showcase item for public profile"""
    id: int
    artist: str
    album: str
    cover: Optional[str] = None
    year: Optional[int] = None
    notes: Optional[str] = None


@router.get("/public/{user_id}")
async def get_public_profile(
    request: Request,
    user_id: int
) -> PublicProfileResponse:
    """
    Get public profile of a user.
    No authentication required.
    Only returns data if user's profile_visibility is set to 'public'.
    """
    env = request.scope["env"]

    try:
        # Get user with privacy settings
        user = await env.DB.prepare(
            """SELECT id, name, picture, bio, pronouns, background_image,
                      location, external_links, created_at, privacy_settings,
                      featured_category_id
               FROM users WHERE id = ?"""
        ).bind(user_id).first()

        if user and hasattr(user, 'to_py'):
            user = user.to_py()

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Check privacy settings
        privacy = parse_privacy_settings(to_python_value(user.get("privacy_settings")))

        if privacy.profile_visibility != "public":
            raise HTTPException(
                status_code=403,
                detail="This profile is not public"
            )

        # Get featured category info
        featured_category_id = to_python_value(user.get("featured_category_id"))
        featured_category_name = None
        featured_category_slug = None

        if featured_category_id:
            category = await env.DB.prepare(
                "SELECT name, slug FROM categories WHERE id = ?"
            ).bind(featured_category_id).first()
            if category and hasattr(category, 'to_py'):
                category = category.to_py()
            if category:
                featured_category_name = to_python_value(category.get("name"))
                featured_category_slug = to_python_value(category.get("slug"))

        # Get showcase if privacy allows
        showcase = []
        if privacy.show_showcase:
            if featured_category_id:
                showcase_results = await env.DB.prepare(
                    """SELECT s.id, c.artist, c.album, c.cover, c.year, s.notes
                       FROM showcase_albums s
                       JOIN collections c ON s.collection_id = c.id
                       WHERE s.user_id = ? AND c.category_id = ?
                       ORDER BY s.position ASC
                       LIMIT 8"""
                ).bind(user_id, featured_category_id).all()
            else:
                showcase_results = await env.DB.prepare(
                    """SELECT s.id, c.artist, c.album, c.cover, c.year, s.notes
                       FROM showcase_albums s
                       JOIN collections c ON s.collection_id = c.id
                       WHERE s.user_id = ?
                       ORDER BY s.position ASC
                       LIMIT 8"""
                ).bind(user_id).all()

            for row in showcase_results.results:
                if hasattr(row, 'to_py'):
                    row = row.to_py()
                showcase.append({
                    "id": row["id"],
                    "artist": row["artist"],
                    "album": row["album"],
                    "cover": to_python_value(row.get("cover")),
                    "year": to_python_value(row.get("year")),
                    "notes": to_python_value(row.get("notes"))
                })

        # Get collection count if privacy allows
        collection_count = 0
        if privacy.show_collection:
            if featured_category_id:
                count_result = await env.DB.prepare(
                    "SELECT COUNT(*) as count FROM collections WHERE user_id = ? AND category_id = ?"
                ).bind(user_id, featured_category_id).first()
            else:
                count_result = await env.DB.prepare(
                    "SELECT COUNT(*) as count FROM collections WHERE user_id = ?"
                ).bind(user_id).first()

            if count_result and hasattr(count_result, 'to_py'):
                count_result = count_result.to_py()
            collection_count = count_result["count"] if count_result else 0

        external_links = parse_external_links(to_python_value(user.get("external_links")))

        return PublicProfileResponse(
            id=user["id"],
            name=to_python_value(user.get("name")),
            picture=to_python_value(user.get("picture")),
            bio=to_python_value(user.get("bio")),
            pronouns=to_python_value(user.get("pronouns")),
            background_image=to_python_value(user.get("background_image")),
            location=to_python_value(user.get("location")),
            external_links=external_links,
            member_since=str(user["created_at"]) if to_python_value(user.get("created_at")) else None,
            showcase=showcase,
            collection_count=collection_count,
            featured_category_id=featured_category_id,
            featured_category_name=featured_category_name,
            featured_category_slug=featured_category_slug
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching public profile: {str(e)}")


@router.get("/public/{user_id}/showcase")
async def get_public_showcase(
    request: Request,
    user_id: int,
    category_id: Optional[int] = None
) -> list[dict]:
    """
    Get public showcase of a user.
    No authentication required.
    Only returns data if user's profile is public and show_showcase is true.
    """
    env = request.scope["env"]

    try:
        # Check privacy settings
        user = await env.DB.prepare(
            "SELECT privacy_settings FROM users WHERE id = ?"
        ).bind(user_id).first()

        if user and hasattr(user, 'to_py'):
            user = user.to_py()

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        privacy = parse_privacy_settings(to_python_value(user.get("privacy_settings")))

        if privacy.profile_visibility != "public":
            raise HTTPException(status_code=403, detail="This profile is not public")

        if not privacy.show_showcase:
            raise HTTPException(status_code=403, detail="Showcase is not public")

        # Get showcase
        if category_id:
            results = await env.DB.prepare(
                """SELECT s.id, c.artist, c.album, c.cover, c.year, s.notes
                   FROM showcase_albums s
                   JOIN collections c ON s.collection_id = c.id
                   WHERE s.user_id = ? AND c.category_id = ?
                   ORDER BY s.position ASC"""
            ).bind(user_id, category_id).all()
        else:
            results = await env.DB.prepare(
                """SELECT s.id, c.artist, c.album, c.cover, c.year, s.notes
                   FROM showcase_albums s
                   JOIN collections c ON s.collection_id = c.id
                   WHERE s.user_id = ?
                   ORDER BY s.position ASC"""
            ).bind(user_id).all()

        showcase = []
        for row in results.results:
            if hasattr(row, 'to_py'):
                row = row.to_py()
            showcase.append({
                "id": row["id"],
                "artist": row["artist"],
                "album": row["album"],
                "cover": to_python_value(row.get("cover")),
                "year": to_python_value(row.get("year")),
                "notes": to_python_value(row.get("notes"))
            })

        return showcase
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching public showcase: {str(e)}")
