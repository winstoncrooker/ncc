"""
Admin API routes
Simple user listing for admin purposes
"""

from fastapi import APIRouter, Request, HTTPException, Depends
from pydantic import BaseModel
from .auth import require_auth

router = APIRouter()


class UserListItem(BaseModel):
    """User list item"""
    id: int
    email: str | None = None
    name: str | None = None
    picture: str | None = None
    created_at: str | None = None


class UserListResponse(BaseModel):
    """List of users"""
    users: list[UserListItem]
    total: int


# Admin emails (add your email here)
ADMIN_EMAILS = ["winstoncrooker@gmail.com", "christophercrooker@gmail.com"]


@router.get("/users")
async def list_users(
    request: Request,
    user_id: int = Depends(require_auth)
) -> UserListResponse:
    """
    List all users (admin only).
    Returns user IDs, emails, names, and creation dates.
    """
    env = request.scope["env"]

    # Check if user is admin
    try:
        admin_check = await env.DB.prepare(
            "SELECT email FROM users WHERE id = ?"
        ).bind(user_id).first()

        if admin_check and hasattr(admin_check, 'to_py'):
            admin_check = admin_check.to_py()

        if not admin_check:
            raise HTTPException(status_code=403, detail="Admin access required - user not found")

        # Get email safely using dict access
        email = None
        if isinstance(admin_check, dict):
            email = admin_check.get("email")
        elif hasattr(admin_check, '__getitem__'):
            try:
                email = admin_check["email"]
            except (KeyError, TypeError):
                pass

        if not email:
            raise HTTPException(status_code=403, detail="Admin access required - no email")

        email_lower = email.lower().strip()
        admin_emails_lower = [e.lower().strip() for e in ADMIN_EMAILS]

        if email_lower not in admin_emails_lower:
            raise HTTPException(status_code=403, detail="Admin access required - not authorized")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=403, detail=f"Admin access required - error: {str(e)}")

    try:
        result = await env.DB.prepare(
            """SELECT id, email, name, picture, created_at
               FROM users
               ORDER BY created_at DESC"""
        ).all()

        if hasattr(result, 'to_py'):
            result = result.to_py()

        rows = result.get("results", [])

        users = []
        for row in rows:
            users.append(UserListItem(
                id=row["id"],
                email=row.get("email"),
                name=row.get("name"),
                picture=row.get("picture"),
                created_at=str(row.get("created_at")) if row.get("created_at") else None
            ))

        return UserListResponse(
            users=users,
            total=len(users)
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching users: {str(e)}")
