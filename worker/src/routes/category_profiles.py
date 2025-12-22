"""
Category Profiles API routes
Per-category user profiles with custom fields and items
"""

from fastapi import APIRouter, Request, HTTPException, Depends, Query
from pydantic import BaseModel
import json
from .auth import require_auth, get_current_user

router = APIRouter()


def safe_value(val, default=None):
    """Convert JsNull/JsProxy to Python None, return value otherwise."""
    if val is None:
        return default
    type_str = str(type(val))
    if 'JsProxy' in type_str or 'JsNull' in type_str:
        return default
    return val


class CategoryProfileResponse(BaseModel):
    """Category-specific profile"""
    id: int
    user_id: int
    category_id: int
    category_slug: str
    category_name: str
    category_icon: str | None = None
    display_name: str | None = None
    bio: str | None = None
    avatar: str | None = None
    background_image: str | None = None
    custom_fields: dict = {}
    item_count: int = 0
    created_at: str
    updated_at: str


class CategoryProfilesListResponse(BaseModel):
    """List of user's category profiles"""
    profiles: list[CategoryProfileResponse]


class UpdateCategoryProfileRequest(BaseModel):
    """Update category profile request"""
    display_name: str | None = None
    bio: str | None = None
    avatar: str | None = None
    background_image: str | None = None
    custom_fields: dict | None = None


class CategoryItemResponse(BaseModel):
    """Category item (collection piece)"""
    id: int
    user_id: int
    category_id: int
    title: str
    subtitle: str | None = None
    description: str | None = None
    cover_image: str | None = None
    year: int | None = None
    external_id: str | None = None
    external_source: str | None = None
    purchase_price: float | None = None
    current_value: float | None = None
    condition: str | None = None
    metadata: dict = {}
    in_showcase: bool = False
    created_at: str
    updated_at: str


class CategoryItemsListResponse(BaseModel):
    """List of items in a category"""
    items: list[CategoryItemResponse]
    total_count: int


class CreateCategoryItemRequest(BaseModel):
    """Create item request"""
    category_id: int
    title: str
    subtitle: str | None = None
    description: str | None = None
    cover_image: str | None = None
    year: int | None = None
    external_id: str | None = None
    external_source: str | None = None
    purchase_price: float | None = None
    current_value: float | None = None
    condition: str | None = None
    metadata: dict = {}


class UpdateCategoryItemRequest(BaseModel):
    """Update item request"""
    title: str | None = None
    subtitle: str | None = None
    description: str | None = None
    cover_image: str | None = None
    year: int | None = None
    purchase_price: float | None = None
    current_value: float | None = None
    condition: str | None = None
    metadata: dict | None = None


@router.get("/categories")
async def get_my_category_profiles(
    request: Request,
    user_id: int = Depends(require_auth)
) -> CategoryProfilesListResponse:
    """Get all category profiles for current user."""
    env = request.scope["env"]

    try:
        result = await env.DB.prepare(
            """SELECT cp.id, cp.user_id, cp.category_id, cp.display_name, cp.bio,
                      cp.avatar, cp.background_image, cp.custom_fields, cp.item_count,
                      cp.created_at, cp.updated_at,
                      c.slug as category_slug, c.name as category_name, c.icon as category_icon
               FROM category_profiles cp
               JOIN categories c ON cp.category_id = c.id
               WHERE cp.user_id = ?
               ORDER BY c.name"""
        ).bind(user_id).all()

        if hasattr(result, 'to_py'):
            result = result.to_py()

        profiles = []
        for row in result.get("results", []):
            custom_fields = {}
            custom_fields_raw = safe_value(row.get("custom_fields"))
            if custom_fields_raw:
                try:
                    custom_fields = json.loads(custom_fields_raw)
                except Exception:
                    custom_fields = {}

            profiles.append(CategoryProfileResponse(
                id=row["id"],
                user_id=row["user_id"],
                category_id=row["category_id"],
                category_slug=row["category_slug"],
                category_name=row["category_name"],
                category_icon=safe_value(row.get("category_icon")),
                display_name=safe_value(row.get("display_name")),
                bio=safe_value(row.get("bio")),
                avatar=safe_value(row.get("avatar")),
                background_image=safe_value(row.get("background_image")),
                custom_fields=custom_fields,
                item_count=safe_value(row.get("item_count"), 0),
                created_at=str(row["created_at"]),
                updated_at=str(row["updated_at"])
            ))

        return CategoryProfilesListResponse(profiles=profiles)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching profiles: {str(e)}")


@router.get("/categories/{slug}")
async def get_category_profile(
    request: Request,
    slug: str,
    user_id: int = Depends(require_auth)
) -> CategoryProfileResponse:
    """Get category profile for current user. Creates if doesn't exist."""
    env = request.scope["env"]

    try:
        # Get category
        category = await env.DB.prepare(
            "SELECT id, slug, name, icon FROM categories WHERE slug = ?"
        ).bind(slug).first()

        if category and hasattr(category, 'to_py'):
            category = category.to_py()

        if not category:
            raise HTTPException(status_code=404, detail="Category not found")

        # Get or create profile
        profile = await env.DB.prepare(
            """SELECT id, user_id, category_id, display_name, bio, avatar,
                      background_image, custom_fields, item_count, created_at, updated_at
               FROM category_profiles
               WHERE user_id = ? AND category_id = ?"""
        ).bind(user_id, category["id"]).first()

        if profile and hasattr(profile, 'to_py'):
            profile = profile.to_py()

        if not profile:
            # Create new profile
            result = await env.DB.prepare(
                """INSERT INTO category_profiles (user_id, category_id)
                   VALUES (?, ?)
                   RETURNING id, created_at, updated_at"""
            ).bind(user_id, category["id"]).first()

            if hasattr(result, 'to_py'):
                result = result.to_py()

            return CategoryProfileResponse(
                id=result["id"],
                user_id=user_id,
                category_id=category["id"],
                category_slug=category["slug"],
                category_name=category["name"],
                category_icon=safe_value(category.get("icon")),
                display_name=None,
                bio=None,
                avatar=None,
                background_image=None,
                custom_fields={},
                item_count=0,
                created_at=str(result["created_at"]),
                updated_at=str(result["updated_at"])
            )

        custom_fields = {}
        custom_fields_raw = safe_value(profile.get("custom_fields"))
        if custom_fields_raw:
            try:
                custom_fields = json.loads(custom_fields_raw)
            except Exception:
                custom_fields = {}

        return CategoryProfileResponse(
            id=profile["id"],
            user_id=profile["user_id"],
            category_id=profile["category_id"],
            category_slug=category["slug"],
            category_name=category["name"],
            category_icon=safe_value(category.get("icon")),
            display_name=safe_value(profile.get("display_name")),
            bio=safe_value(profile.get("bio")),
            avatar=safe_value(profile.get("avatar")),
            background_image=safe_value(profile.get("background_image")),
            custom_fields=custom_fields,
            item_count=safe_value(profile.get("item_count"), 0),
            created_at=str(profile["created_at"]),
            updated_at=str(profile["updated_at"])
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching profile: {str(e)}")


@router.put("/categories/{slug}")
async def update_category_profile(
    request: Request,
    slug: str,
    body: UpdateCategoryProfileRequest,
    user_id: int = Depends(require_auth)
) -> CategoryProfileResponse:
    """Update category profile for current user."""
    env = request.scope["env"]

    try:
        # Get category
        category = await env.DB.prepare(
            "SELECT id, slug, name, icon FROM categories WHERE slug = ?"
        ).bind(slug).first()

        if category and hasattr(category, 'to_py'):
            category = category.to_py()

        if not category:
            raise HTTPException(status_code=404, detail="Category not found")

        # Get or create profile
        profile = await env.DB.prepare(
            "SELECT id FROM category_profiles WHERE user_id = ? AND category_id = ?"
        ).bind(user_id, category["id"]).first()

        if profile and hasattr(profile, 'to_py'):
            profile = profile.to_py()

        if not profile:
            # Create new profile with updates
            custom_fields_json = json.dumps(body.custom_fields) if body.custom_fields else "{}"

            result = await env.DB.prepare(
                """INSERT INTO category_profiles
                   (user_id, category_id, display_name, bio, avatar, background_image, custom_fields)
                   VALUES (?, ?, ?, ?, ?, ?, ?)
                   RETURNING id, created_at, updated_at"""
            ).bind(
                user_id, category["id"],
                body.display_name, body.bio, body.avatar,
                body.background_image, custom_fields_json
            ).first()

            if hasattr(result, 'to_py'):
                result = result.to_py()

            return CategoryProfileResponse(
                id=result["id"],
                user_id=user_id,
                category_id=category["id"],
                category_slug=category["slug"],
                category_name=category["name"],
                category_icon=category.get("icon"),
                display_name=body.display_name,
                bio=body.bio,
                avatar=body.avatar,
                background_image=body.background_image,
                custom_fields=body.custom_fields or {},
                item_count=0,
                created_at=str(result["created_at"]),
                updated_at=str(result["updated_at"])
            )

        # Build update
        updates = []
        params = []

        if body.display_name is not None:
            updates.append("display_name = ?")
            params.append(body.display_name)

        if body.bio is not None:
            updates.append("bio = ?")
            params.append(body.bio)

        if body.avatar is not None:
            updates.append("avatar = ?")
            params.append(body.avatar)

        if body.background_image is not None:
            updates.append("background_image = ?")
            params.append(body.background_image)

        if body.custom_fields is not None:
            updates.append("custom_fields = ?")
            params.append(json.dumps(body.custom_fields))

        if updates:
            updates.append("updated_at = CURRENT_TIMESTAMP")
            params.extend([user_id, category["id"]])

            await env.DB.prepare(
                f"""UPDATE category_profiles
                    SET {', '.join(updates)}
                    WHERE user_id = ? AND category_id = ?"""
            ).bind(*params).run()

        # Return updated profile
        return await get_category_profile(request, slug, user_id)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating profile: {str(e)}")


@router.get("/users/{target_user_id}/categories/{slug}")
async def get_user_category_profile(
    request: Request,
    target_user_id: int,
    slug: str,
    user_id: int = Depends(require_auth)
) -> CategoryProfileResponse:
    """View another user's category profile."""
    env = request.scope["env"]

    try:
        # Get category
        category = await env.DB.prepare(
            "SELECT id, slug, name, icon FROM categories WHERE slug = ?"
        ).bind(slug).first()

        if category and hasattr(category, 'to_py'):
            category = category.to_py()

        if not category:
            raise HTTPException(status_code=404, detail="Category not found")

        # Get profile
        profile = await env.DB.prepare(
            """SELECT id, user_id, category_id, display_name, bio, avatar,
                      background_image, custom_fields, item_count, created_at, updated_at
               FROM category_profiles
               WHERE user_id = ? AND category_id = ?"""
        ).bind(target_user_id, category["id"]).first()

        if profile and hasattr(profile, 'to_py'):
            profile = profile.to_py()

        if not profile:
            raise HTTPException(status_code=404, detail="User has no profile for this category")

        custom_fields = {}
        custom_fields_raw = safe_value(profile.get("custom_fields"))
        if custom_fields_raw:
            try:
                custom_fields = json.loads(custom_fields_raw)
            except Exception:
                custom_fields = {}

        return CategoryProfileResponse(
            id=profile["id"],
            user_id=profile["user_id"],
            category_id=profile["category_id"],
            category_slug=category["slug"],
            category_name=category["name"],
            category_icon=safe_value(category.get("icon")),
            display_name=safe_value(profile.get("display_name")),
            bio=safe_value(profile.get("bio")),
            avatar=safe_value(profile.get("avatar")),
            background_image=safe_value(profile.get("background_image")),
            custom_fields=custom_fields,
            item_count=safe_value(profile.get("item_count"), 0),
            created_at=str(profile["created_at"]),
            updated_at=str(profile["updated_at"])
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching profile: {str(e)}")


# Category Items endpoints

@router.get("/items")
async def get_my_items(
    request: Request,
    category: str | None = None,
    user_id: int = Depends(require_auth)
) -> CategoryItemsListResponse:
    """Get user's items, optionally filtered by category."""
    env = request.scope["env"]

    try:
        if category:
            # Get category ID
            cat = await env.DB.prepare(
                "SELECT id FROM categories WHERE slug = ?"
            ).bind(category).first()

            if cat and hasattr(cat, 'to_py'):
                cat = cat.to_py()

            if not cat:
                raise HTTPException(status_code=404, detail="Category not found")

            result = await env.DB.prepare(
                """SELECT ci.*, cs.id as showcase_id
                   FROM category_items ci
                   LEFT JOIN category_showcase cs ON ci.id = cs.item_id AND ci.user_id = cs.user_id
                   WHERE ci.user_id = ? AND ci.category_id = ?
                   ORDER BY ci.created_at DESC"""
            ).bind(user_id, cat["id"]).all()
        else:
            result = await env.DB.prepare(
                """SELECT ci.*, cs.id as showcase_id
                   FROM category_items ci
                   LEFT JOIN category_showcase cs ON ci.id = cs.item_id AND ci.user_id = cs.user_id
                   WHERE ci.user_id = ?
                   ORDER BY ci.created_at DESC"""
            ).bind(user_id).all()

        if hasattr(result, 'to_py'):
            result = result.to_py()

        items = []
        for row in result.get("results", []):
            metadata = {}
            metadata_raw = safe_value(row.get("metadata"))
            if metadata_raw:
                try:
                    metadata = json.loads(metadata_raw)
                except Exception:
                    metadata = {}

            items.append(CategoryItemResponse(
                id=row["id"],
                user_id=row["user_id"],
                category_id=row["category_id"],
                title=row["title"],
                subtitle=safe_value(row.get("subtitle")),
                description=safe_value(row.get("description")),
                cover_image=safe_value(row.get("cover_image")),
                year=safe_value(row.get("year")),
                external_id=safe_value(row.get("external_id")),
                external_source=safe_value(row.get("external_source")),
                purchase_price=safe_value(row.get("purchase_price")),
                current_value=safe_value(row.get("current_value")),
                condition=safe_value(row.get("condition")),
                metadata=metadata,
                in_showcase=safe_value(row.get("showcase_id")) is not None,
                created_at=str(row["created_at"]),
                updated_at=str(row["updated_at"])
            ))

        return CategoryItemsListResponse(
            items=items,
            total_count=len(items)
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching items: {str(e)}")


@router.post("/items")
async def create_item(
    request: Request,
    body: CreateCategoryItemRequest,
    user_id: int = Depends(require_auth)
) -> CategoryItemResponse:
    """Add an item to a category collection."""
    env = request.scope["env"]

    try:
        # Verify category exists
        category = await env.DB.prepare(
            "SELECT id FROM categories WHERE id = ?"
        ).bind(body.category_id).first()

        if category and hasattr(category, 'to_py'):
            category = category.to_py()

        if not category:
            raise HTTPException(status_code=404, detail="Category not found")

        metadata_json = json.dumps(body.metadata) if body.metadata else "{}"

        result = await env.DB.prepare(
            """INSERT INTO category_items
               (user_id, category_id, title, subtitle, description, cover_image,
                year, external_id, external_source, purchase_price, current_value,
                condition, metadata)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               RETURNING id, created_at, updated_at"""
        ).bind(
            user_id, body.category_id, body.title, body.subtitle, body.description,
            body.cover_image, body.year, body.external_id, body.external_source,
            body.purchase_price, body.current_value, body.condition, metadata_json
        ).first()

        if hasattr(result, 'to_py'):
            result = result.to_py()

        # Update item count on category profile
        await env.DB.prepare(
            """UPDATE category_profiles
               SET item_count = item_count + 1, updated_at = CURRENT_TIMESTAMP
               WHERE user_id = ? AND category_id = ?"""
        ).bind(user_id, body.category_id).run()

        return CategoryItemResponse(
            id=result["id"],
            user_id=user_id,
            category_id=body.category_id,
            title=body.title,
            subtitle=body.subtitle,
            description=body.description,
            cover_image=body.cover_image,
            year=body.year,
            external_id=body.external_id,
            external_source=body.external_source,
            purchase_price=body.purchase_price,
            current_value=body.current_value,
            condition=body.condition,
            metadata=body.metadata,
            in_showcase=False,
            created_at=str(result["created_at"]),
            updated_at=str(result["updated_at"])
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating item: {str(e)}")


@router.put("/items/{item_id}")
async def update_item(
    request: Request,
    item_id: int,
    body: UpdateCategoryItemRequest,
    user_id: int = Depends(require_auth)
) -> CategoryItemResponse:
    """Update an item."""
    env = request.scope["env"]

    try:
        # Check ownership
        existing = await env.DB.prepare(
            "SELECT * FROM category_items WHERE id = ?"
        ).bind(item_id).first()

        if existing and hasattr(existing, 'to_py'):
            existing = existing.to_py()

        if not existing:
            raise HTTPException(status_code=404, detail="Item not found")

        if existing["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not your item")

        # Build update
        updates = []
        params = []

        if body.title is not None:
            updates.append("title = ?")
            params.append(body.title)

        if body.subtitle is not None:
            updates.append("subtitle = ?")
            params.append(body.subtitle)

        if body.description is not None:
            updates.append("description = ?")
            params.append(body.description)

        if body.cover_image is not None:
            updates.append("cover_image = ?")
            params.append(body.cover_image)

        if body.year is not None:
            updates.append("year = ?")
            params.append(body.year)

        if body.purchase_price is not None:
            updates.append("purchase_price = ?")
            params.append(body.purchase_price)

        if body.current_value is not None:
            updates.append("current_value = ?")
            params.append(body.current_value)

        if body.condition is not None:
            updates.append("condition = ?")
            params.append(body.condition)

        if body.metadata is not None:
            updates.append("metadata = ?")
            params.append(json.dumps(body.metadata))

        if updates:
            updates.append("updated_at = CURRENT_TIMESTAMP")
            params.append(item_id)

            await env.DB.prepare(
                f"UPDATE category_items SET {', '.join(updates)} WHERE id = ?"
            ).bind(*params).run()

        # Return updated item
        updated = await env.DB.prepare(
            """SELECT ci.*, cs.id as showcase_id
               FROM category_items ci
               LEFT JOIN category_showcase cs ON ci.id = cs.item_id AND ci.user_id = cs.user_id
               WHERE ci.id = ?"""
        ).bind(item_id).first()

        if updated and hasattr(updated, 'to_py'):
            updated = updated.to_py()

        metadata = {}
        metadata_raw = safe_value(updated.get("metadata"))
        if metadata_raw:
            try:
                metadata = json.loads(metadata_raw)
            except Exception:
                metadata = {}

        return CategoryItemResponse(
            id=updated["id"],
            user_id=updated["user_id"],
            category_id=updated["category_id"],
            title=updated["title"],
            subtitle=safe_value(updated.get("subtitle")),
            description=safe_value(updated.get("description")),
            cover_image=safe_value(updated.get("cover_image")),
            year=safe_value(updated.get("year")),
            external_id=safe_value(updated.get("external_id")),
            external_source=safe_value(updated.get("external_source")),
            purchase_price=safe_value(updated.get("purchase_price")),
            current_value=safe_value(updated.get("current_value")),
            condition=safe_value(updated.get("condition")),
            metadata=metadata,
            in_showcase=safe_value(updated.get("showcase_id")) is not None,
            created_at=str(updated["created_at"]),
            updated_at=str(updated["updated_at"])
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating item: {str(e)}")


@router.delete("/items/{item_id}")
async def delete_item(
    request: Request,
    item_id: int,
    user_id: int = Depends(require_auth)
) -> dict:
    """Delete an item."""
    env = request.scope["env"]

    try:
        # Check ownership
        existing = await env.DB.prepare(
            "SELECT user_id, category_id FROM category_items WHERE id = ?"
        ).bind(item_id).first()

        if existing and hasattr(existing, 'to_py'):
            existing = existing.to_py()

        if not existing:
            raise HTTPException(status_code=404, detail="Item not found")

        if existing["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not your item")

        # Delete item (cascade removes from showcase)
        await env.DB.prepare(
            "DELETE FROM category_items WHERE id = ?"
        ).bind(item_id).run()

        # Update item count
        await env.DB.prepare(
            """UPDATE category_profiles
               SET item_count = MAX(0, item_count - 1), updated_at = CURRENT_TIMESTAMP
               WHERE user_id = ? AND category_id = ?"""
        ).bind(user_id, existing["category_id"]).run()

        return {"success": True, "message": "Item deleted"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting item: {str(e)}")
