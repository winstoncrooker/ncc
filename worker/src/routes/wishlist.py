"""
Wishlist / Currently Seeking routes
"""

from fastapi import APIRouter, Request, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional

from routes.auth import require_auth
from utils.conversions import to_python_value

router = APIRouter()


class WishlistItem(BaseModel):
    """Wishlist item"""
    id: Optional[int] = None
    category_id: int
    title: str
    description: Optional[str] = None
    artist: Optional[str] = None
    year: Optional[int] = None
    condition_wanted: Optional[str] = None
    max_price: Optional[float] = None
    priority: int = Field(0, ge=0, le=2)  # 0=low, 1=medium, 2=high
    is_found: bool = False
    created_at: Optional[str] = None


class WishlistCreate(BaseModel):
    """Create wishlist item"""
    category_id: int
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    artist: Optional[str] = Field(None, max_length=200)
    year: Optional[int] = Field(None, ge=1900, le=2100)
    condition_wanted: Optional[str] = Field(None, max_length=50)
    max_price: Optional[float] = Field(None, ge=0)
    priority: int = Field(0, ge=0, le=2)


class WishlistUpdate(BaseModel):
    """Update wishlist item"""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    artist: Optional[str] = Field(None, max_length=200)
    year: Optional[int] = Field(None, ge=1900, le=2100)
    condition_wanted: Optional[str] = Field(None, max_length=50)
    max_price: Optional[float] = Field(None, ge=0)
    priority: Optional[int] = Field(None, ge=0, le=2)
    is_found: Optional[bool] = None


@router.get("/")
async def get_wishlist(
    request: Request,
    category_id: Optional[int] = None,
    include_found: bool = False,
    user_id: int = Depends(require_auth)
) -> list[WishlistItem]:
    """Get user's wishlist items"""
    env = request.scope["env"]

    try:
        if category_id:
            query = """SELECT id, category_id, title, description, artist, year,
                              condition_wanted, max_price, priority, is_found, created_at
                       FROM wishlist
                       WHERE user_id = ? AND category_id = ?"""
            params = [user_id, category_id]
        else:
            query = """SELECT id, category_id, title, description, artist, year,
                              condition_wanted, max_price, priority, is_found, created_at
                       FROM wishlist
                       WHERE user_id = ?"""
            params = [user_id]

        if not include_found:
            query += " AND is_found = 0"

        query += " ORDER BY priority DESC, created_at DESC"

        results = await env.DB.prepare(query).bind(*params).all()

        items = []
        for row in results.results:
            if hasattr(row, 'to_py'):
                row = row.to_py()
            items.append(WishlistItem(
                id=row["id"],
                category_id=row["category_id"],
                title=row["title"],
                description=to_python_value(row.get("description")),
                artist=to_python_value(row.get("artist")),
                year=to_python_value(row.get("year")),
                condition_wanted=to_python_value(row.get("condition_wanted")),
                max_price=to_python_value(row.get("max_price")),
                priority=row.get("priority", 0),
                is_found=bool(row.get("is_found", 0)),
                created_at=str(row["created_at"]) if row.get("created_at") else None
            ))

        return items
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching wishlist: {str(e)}")


@router.post("/")
async def add_wishlist_item(
    request: Request,
    body: WishlistCreate,
    user_id: int = Depends(require_auth)
) -> WishlistItem:
    """Add item to wishlist"""
    env = request.scope["env"]

    try:
        # Build dynamic query to avoid D1 undefined type errors
        fields = ["user_id", "category_id", "title"]
        values = [user_id, body.category_id, body.title]

        if body.description:
            fields.append("description")
            values.append(body.description)
        if body.artist:
            fields.append("artist")
            values.append(body.artist)
        if body.year is not None:
            fields.append("year")
            values.append(body.year)
        if body.condition_wanted:
            fields.append("condition_wanted")
            values.append(body.condition_wanted)
        if body.max_price is not None:
            fields.append("max_price")
            values.append(body.max_price)
        if body.priority is not None:
            fields.append("priority")
            values.append(body.priority)

        placeholders = ", ".join(["?" for _ in fields])
        field_names = ", ".join(fields)

        result = await env.DB.prepare(
            f"INSERT INTO wishlist ({field_names}) VALUES ({placeholders}) RETURNING id, created_at"
        ).bind(*values).first()

        if hasattr(result, 'to_py'):
            result = result.to_py()

        return WishlistItem(
            id=result["id"],
            category_id=body.category_id,
            title=body.title,
            description=body.description,
            artist=body.artist,
            year=body.year,
            condition_wanted=body.condition_wanted,
            max_price=body.max_price,
            priority=body.priority or 0,
            is_found=False,
            created_at=str(result["created_at"]) if result.get("created_at") else None
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error adding to wishlist: {str(e)}")


@router.put("/{item_id}")
async def update_wishlist_item(
    request: Request,
    item_id: int,
    body: WishlistUpdate,
    user_id: int = Depends(require_auth)
) -> WishlistItem:
    """Update wishlist item"""
    env = request.scope["env"]

    try:
        # Verify ownership
        existing = await env.DB.prepare(
            "SELECT id FROM wishlist WHERE id = ? AND user_id = ?"
        ).bind(item_id, user_id).first()

        if not existing:
            raise HTTPException(status_code=404, detail="Wishlist item not found")

        # Build update query
        updates = []
        values = []

        if body.title is not None:
            updates.append("title = ?")
            values.append(body.title)
        if body.description is not None:
            updates.append("description = ?")
            values.append(body.description)
        if body.artist is not None:
            updates.append("artist = ?")
            values.append(body.artist)
        if body.year is not None:
            updates.append("year = ?")
            values.append(body.year)
        if body.condition_wanted is not None:
            updates.append("condition_wanted = ?")
            values.append(body.condition_wanted)
        if body.max_price is not None:
            updates.append("max_price = ?")
            values.append(body.max_price)
        if body.priority is not None:
            updates.append("priority = ?")
            values.append(body.priority)
        if body.is_found is not None:
            updates.append("is_found = ?")
            values.append(1 if body.is_found else 0)

        if updates:
            updates.append("updated_at = CURRENT_TIMESTAMP")
            query = f"UPDATE wishlist SET {', '.join(updates)} WHERE id = ? AND user_id = ?"
            values.extend([item_id, user_id])
            await env.DB.prepare(query).bind(*values).run()

        # Return updated item
        result = await env.DB.prepare(
            """SELECT id, category_id, title, description, artist, year,
                      condition_wanted, max_price, priority, is_found, created_at
               FROM wishlist WHERE id = ?"""
        ).bind(item_id).first()

        if hasattr(result, 'to_py'):
            result = result.to_py()

        return WishlistItem(
            id=result["id"],
            category_id=result["category_id"],
            title=result["title"],
            description=to_python_value(result.get("description")),
            artist=to_python_value(result.get("artist")),
            year=to_python_value(result.get("year")),
            condition_wanted=to_python_value(result.get("condition_wanted")),
            max_price=to_python_value(result.get("max_price")),
            priority=result.get("priority", 0),
            is_found=bool(result.get("is_found", 0)),
            created_at=str(result["created_at"]) if result.get("created_at") else None
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating wishlist: {str(e)}")


@router.delete("/{item_id}")
async def delete_wishlist_item(
    request: Request,
    item_id: int,
    user_id: int = Depends(require_auth)
):
    """Delete wishlist item"""
    env = request.scope["env"]

    try:
        result = await env.DB.prepare(
            "DELETE FROM wishlist WHERE id = ? AND user_id = ?"
        ).bind(item_id, user_id).run()

        return {"success": True, "message": "Item removed from wishlist"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting from wishlist: {str(e)}")
