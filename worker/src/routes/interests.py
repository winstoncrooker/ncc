"""
User Interests API routes
Manages user membership in categories and interest groups
"""

from fastapi import APIRouter, Request, HTTPException, Depends
from pydantic import BaseModel
from .auth import require_auth, require_auth
from utils.conversions import to_python_value as safe_value

router = APIRouter()


class UserInterestResponse(BaseModel):
    """User interest membership"""
    id: int
    category_id: int | None = None
    category_slug: str | None = None
    category_name: str | None = None
    category_icon: str | None = None
    interest_group_id: int | None = None
    interest_group_slug: str | None = None
    interest_group_name: str | None = None
    notify_all: bool = True


class UserInterestsListResponse(BaseModel):
    """List of user interests"""
    interests: list[UserInterestResponse]
    has_interests: bool


class JoinInterestRequest(BaseModel):
    """Request to join category or interest group"""
    category_id: int | None = None
    interest_group_id: int | None = None


class JoinInterestResponse(BaseModel):
    """Response after joining"""
    success: bool
    message: str
    interest: UserInterestResponse | None = None


@router.get("/me")
async def get_my_interests(
    request: Request,
    user_id: int = Depends(require_auth)
) -> UserInterestsListResponse:
    """
    Get current user's joined interests (categories and groups).
    """
    env = request.scope["env"]

    try:
        # Note: category can come from either ui.category_id (direct category membership)
        # or from ig.category_id (when user joins a group within a category)
        result = await env.DB.prepare(
            """SELECT ui.id, ui.interest_group_id, ui.notify_all,
                      COALESCE(ui.category_id, ig.category_id) as category_id,
                      COALESCE(c.slug, gc.slug) as category_slug,
                      COALESCE(c.name, gc.name) as category_name,
                      COALESCE(c.icon, gc.icon) as category_icon,
                      ig.slug as group_slug, ig.name as group_name
               FROM user_interests ui
               LEFT JOIN categories c ON ui.category_id = c.id
               LEFT JOIN interest_groups ig ON ui.interest_group_id = ig.id
               LEFT JOIN categories gc ON ig.category_id = gc.id
               WHERE ui.user_id = ?
               ORDER BY COALESCE(c.name, gc.name), ig.name"""
        ).bind(user_id).all()

        if hasattr(result, 'to_py'):
            result = result.to_py()

        interests = []
        for row in result.get("results", []):
            interests.append(UserInterestResponse(
                id=row["id"],
                category_id=safe_value(row.get("category_id")),
                category_slug=safe_value(row.get("category_slug")),
                category_name=safe_value(row.get("category_name")),
                category_icon=safe_value(row.get("category_icon")),
                interest_group_id=safe_value(row.get("interest_group_id")),
                interest_group_slug=safe_value(row.get("group_slug")),
                interest_group_name=safe_value(row.get("group_name")),
                notify_all=bool(safe_value(row.get("notify_all"), 1))
            ))

        return UserInterestsListResponse(
            interests=interests,
            has_interests=len(interests) > 0
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching interests: {str(e)}")


@router.post("/join")
async def join_interest(
    request: Request,
    body: JoinInterestRequest,
    user_id: int = Depends(require_auth)
) -> JoinInterestResponse:
    """
    Join a category or interest group.
    Provide either category_id OR interest_group_id (not both).
    """
    env = request.scope["env"]

    if not body.category_id and not body.interest_group_id:
        raise HTTPException(status_code=400, detail="Must provide category_id or interest_group_id")

    if body.category_id and body.interest_group_id:
        raise HTTPException(status_code=400, detail="Provide only one of category_id or interest_group_id")

    try:
        if body.category_id:
            # Join category
            category = await env.DB.prepare(
                "SELECT id, slug, name, icon FROM categories WHERE id = ?"
            ).bind(body.category_id).first()

            if category and hasattr(category, 'to_py'):
                category = category.to_py()

            if not category:
                raise HTTPException(status_code=404, detail="Category not found")

            # Check if already joined
            existing = await env.DB.prepare(
                "SELECT id FROM user_interests WHERE user_id = ? AND category_id = ?"
            ).bind(user_id, body.category_id).first()

            if existing and hasattr(existing, 'to_py'):
                existing = existing.to_py()

            if existing:
                return JoinInterestResponse(
                    success=False,
                    message="Already joined this category"
                )

            # Insert membership
            result = await env.DB.prepare(
                """INSERT INTO user_interests (user_id, category_id, notify_all)
                   VALUES (?, ?, 1) RETURNING id"""
            ).bind(user_id, body.category_id).first()

            if hasattr(result, 'to_py'):
                result = result.to_py()

            return JoinInterestResponse(
                success=True,
                message=f"Joined {category['name']}",
                interest=UserInterestResponse(
                    id=result["id"],
                    category_id=body.category_id,
                    category_slug=category["slug"],
                    category_name=category["name"],
                    category_icon=safe_value(category.get("icon")),
                    notify_all=True
                )
            )

        else:
            # Join interest group
            group = await env.DB.prepare(
                """SELECT ig.id, ig.slug, ig.name, ig.category_id,
                          c.slug as category_slug, c.name as category_name, c.icon as category_icon
                   FROM interest_groups ig
                   JOIN categories c ON ig.category_id = c.id
                   WHERE ig.id = ?"""
            ).bind(body.interest_group_id).first()

            if group and hasattr(group, 'to_py'):
                group = group.to_py()

            if not group:
                raise HTTPException(status_code=404, detail="Interest group not found")

            # Check if already joined
            existing = await env.DB.prepare(
                "SELECT id FROM user_interests WHERE user_id = ? AND interest_group_id = ?"
            ).bind(user_id, body.interest_group_id).first()

            if existing and hasattr(existing, 'to_py'):
                existing = existing.to_py()

            if existing:
                return JoinInterestResponse(
                    success=False,
                    message="Already joined this group"
                )

            # Insert membership
            result = await env.DB.prepare(
                """INSERT INTO user_interests (user_id, interest_group_id, notify_all)
                   VALUES (?, ?, 1) RETURNING id"""
            ).bind(user_id, body.interest_group_id).first()

            if hasattr(result, 'to_py'):
                result = result.to_py()

            # Update member count
            await env.DB.prepare(
                "UPDATE interest_groups SET member_count = member_count + 1 WHERE id = ?"
            ).bind(body.interest_group_id).run()

            return JoinInterestResponse(
                success=True,
                message=f"Joined {group['name']}",
                interest=UserInterestResponse(
                    id=result["id"],
                    category_id=group["category_id"],
                    category_slug=group["category_slug"],
                    category_name=group["category_name"],
                    category_icon=safe_value(group.get("category_icon")),
                    interest_group_id=body.interest_group_id,
                    interest_group_slug=group["slug"],
                    interest_group_name=group["name"],
                    notify_all=True
                )
            )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error joining interest: {str(e)}")


@router.post("/leave/{interest_id}")
async def leave_interest(
    request: Request,
    interest_id: int,
    user_id: int = Depends(require_auth)
) -> dict:
    """
    Leave a category or interest group.
    """
    env = request.scope["env"]

    try:
        # Get the interest to check ownership and get group ID for count update
        interest = await env.DB.prepare(
            "SELECT id, user_id, interest_group_id FROM user_interests WHERE id = ?"
        ).bind(interest_id).first()

        if interest and hasattr(interest, 'to_py'):
            interest = interest.to_py()

        if not interest:
            raise HTTPException(status_code=404, detail="Interest not found")

        if interest["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not your interest")

        # Delete the membership
        await env.DB.prepare(
            "DELETE FROM user_interests WHERE id = ?"
        ).bind(interest_id).run()

        # Update member count if it was a group
        if interest.get("interest_group_id"):
            await env.DB.prepare(
                "UPDATE interest_groups SET member_count = MAX(0, member_count - 1) WHERE id = ?"
            ).bind(interest["interest_group_id"]).run()

        return {"success": True, "message": "Left successfully"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error leaving interest: {str(e)}")


@router.post("/batch-join")
async def batch_join_interests(
    request: Request,
    body: list[JoinInterestRequest],
    user_id: int = Depends(require_auth)
) -> dict:
    """
    Join multiple categories/groups at once (for onboarding).
    """
    env = request.scope["env"]

    joined = []
    errors = []

    for item in body:
        try:
            if item.category_id:
                # Check if not already joined
                existing = await env.DB.prepare(
                    "SELECT id FROM user_interests WHERE user_id = ? AND category_id = ?"
                ).bind(user_id, item.category_id).first()

                if existing and hasattr(existing, 'to_py'):
                    existing = existing.to_py()

                if not existing:
                    await env.DB.prepare(
                        "INSERT INTO user_interests (user_id, category_id, notify_all) VALUES (?, ?, 1)"
                    ).bind(user_id, item.category_id).run()
                    joined.append({"category_id": item.category_id})

            elif item.interest_group_id:
                existing = await env.DB.prepare(
                    "SELECT id FROM user_interests WHERE user_id = ? AND interest_group_id = ?"
                ).bind(user_id, item.interest_group_id).first()

                if existing and hasattr(existing, 'to_py'):
                    existing = existing.to_py()

                if not existing:
                    await env.DB.prepare(
                        "INSERT INTO user_interests (user_id, interest_group_id, notify_all) VALUES (?, ?, 1)"
                    ).bind(user_id, item.interest_group_id).run()

                    await env.DB.prepare(
                        "UPDATE interest_groups SET member_count = member_count + 1 WHERE id = ?"
                    ).bind(item.interest_group_id).run()

                    joined.append({"interest_group_id": item.interest_group_id})

        except Exception as e:
            errors.append({"item": item.model_dump(), "error": str(e)})

    return {
        "success": len(errors) == 0,
        "joined_count": len(joined),
        "joined": joined,
        "errors": errors
    }
