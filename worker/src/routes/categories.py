"""
Categories API routes
Lists and retrieves collecting categories
"""

from fastapi import APIRouter, Request, HTTPException, Depends
from pydantic import BaseModel
from .auth import get_current_user

router = APIRouter()


def safe_value(val, default=None):
    """Convert JsNull/JsProxy to Python None, return value otherwise."""
    if val is None:
        return default
    type_str = str(type(val))
    if 'JsProxy' in type_str or 'JsNull' in type_str:
        return default
    return val


class InterestGroupResponse(BaseModel):
    """Interest group within a category"""
    id: int
    slug: str
    name: str
    description: str | None = None
    icon: str | None = None
    level: int
    parent_id: int | None = None
    member_count: int = 0
    post_count: int = 0


class CategoryResponse(BaseModel):
    """Category response model"""
    id: int
    slug: str
    name: str
    description: str | None = None
    icon: str | None = None
    color: str | None = None
    item_noun_singular: str
    item_noun_plural: str
    member_count: int = 0


class CategoryDetailResponse(CategoryResponse):
    """Detailed category with interest groups"""
    interest_groups: list[InterestGroupResponse] = []


class CategoriesListResponse(BaseModel):
    """List of categories"""
    categories: list[CategoryResponse]


@router.get("")
async def list_categories(request: Request) -> CategoriesListResponse:
    """
    List all collecting categories.
    No authentication required.
    """
    env = request.scope["env"]

    try:
        result = await env.DB.prepare(
            """SELECT c.id, c.slug, c.name, c.description, c.icon, c.color,
                      c.item_noun_singular, c.item_noun_plural,
                      (SELECT COUNT(DISTINCT user_id) FROM user_interests WHERE category_id = c.id) as member_count
               FROM categories c
               ORDER BY c.name"""
        ).all()

        if hasattr(result, 'to_py'):
            result = result.to_py()

        categories = []
        for row in result.get("results", []):
            categories.append(CategoryResponse(
                id=row["id"],
                slug=row["slug"],
                name=row["name"],
                description=row.get("description"),
                icon=row.get("icon"),
                color=row.get("color"),
                item_noun_singular=row["item_noun_singular"],
                item_noun_plural=row["item_noun_plural"],
                member_count=row.get("member_count", 0)
            ))

        return CategoriesListResponse(categories=categories)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching categories: {str(e)}")


@router.get("/{slug}")
async def get_category(
    request: Request,
    slug: str
) -> CategoryDetailResponse:
    """
    Get category details with interest groups.
    """
    env = request.scope["env"]

    try:
        # Get category
        category = await env.DB.prepare(
            """SELECT c.id, c.slug, c.name, c.description, c.icon, c.color,
                      c.item_noun_singular, c.item_noun_plural,
                      (SELECT COUNT(DISTINCT user_id) FROM user_interests WHERE category_id = c.id) as member_count
               FROM categories c
               WHERE c.slug = ?"""
        ).bind(slug).first()

        if category and hasattr(category, 'to_py'):
            category = category.to_py()

        if not category:
            raise HTTPException(status_code=404, detail="Category not found")

        # Get interest groups for this category
        groups_result = await env.DB.prepare(
            """SELECT id, slug, name, description, icon, level, parent_id, member_count, post_count
               FROM interest_groups
               WHERE category_id = ?
               ORDER BY level, name"""
        ).bind(category["id"]).all()

        if hasattr(groups_result, 'to_py'):
            groups_result = groups_result.to_py()

        groups = []
        for row in groups_result.get("results", []):
            groups.append(InterestGroupResponse(
                id=row["id"],
                slug=row["slug"],
                name=row["name"],
                description=safe_value(row.get("description")),
                icon=safe_value(row.get("icon")),
                level=row["level"],
                parent_id=safe_value(row.get("parent_id")),
                member_count=safe_value(row.get("member_count"), 0),
                post_count=safe_value(row.get("post_count"), 0)
            ))

        return CategoryDetailResponse(
            id=category["id"],
            slug=category["slug"],
            name=category["name"],
            description=category.get("description"),
            icon=category.get("icon"),
            color=category.get("color"),
            item_noun_singular=category["item_noun_singular"],
            item_noun_plural=category["item_noun_plural"],
            member_count=category.get("member_count", 0),
            interest_groups=groups
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching category: {str(e)}")


@router.get("/{slug}/interests")
async def get_category_interests(
    request: Request,
    slug: str,
    level: int | None = None
) -> list[InterestGroupResponse]:
    """
    Get all interest groups in a category.
    Optionally filter by level (1 = sub-groups, 2 = micro-communities).
    """
    env = request.scope["env"]

    try:
        # Get category ID
        category = await env.DB.prepare(
            "SELECT id FROM categories WHERE slug = ?"
        ).bind(slug).first()

        if category and hasattr(category, 'to_py'):
            category = category.to_py()

        if not category:
            raise HTTPException(status_code=404, detail="Category not found")

        # Build query
        if level is not None:
            groups_result = await env.DB.prepare(
                """SELECT id, slug, name, description, icon, level, parent_id, member_count, post_count
                   FROM interest_groups
                   WHERE category_id = ? AND level = ?
                   ORDER BY name"""
            ).bind(category["id"], level).all()
        else:
            groups_result = await env.DB.prepare(
                """SELECT id, slug, name, description, icon, level, parent_id, member_count, post_count
                   FROM interest_groups
                   WHERE category_id = ?
                   ORDER BY level, name"""
            ).bind(category["id"]).all()

        if hasattr(groups_result, 'to_py'):
            groups_result = groups_result.to_py()

        groups = []
        for row in groups_result.get("results", []):
            groups.append(InterestGroupResponse(
                id=row["id"],
                slug=row["slug"],
                name=row["name"],
                description=safe_value(row.get("description")),
                icon=safe_value(row.get("icon")),
                level=row["level"],
                parent_id=safe_value(row.get("parent_id")),
                member_count=safe_value(row.get("member_count"), 0),
                post_count=safe_value(row.get("post_count"), 0)
            ))

        return groups

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching interests: {str(e)}")
