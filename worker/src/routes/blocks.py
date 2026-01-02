"""
User blocking routes for Niche Collector Connector
Block/unblock users for privacy and safety
"""

from fastapi import APIRouter, Request, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from routes.auth import require_auth, require_csrf
from utils.conversions import to_python_value

router = APIRouter()


class BlockedUser(BaseModel):
    """Blocked user response"""
    id: int
    user_id: int
    name: Optional[str] = None
    picture: Optional[str] = None
    blocked_at: str


class BlockResponse(BaseModel):
    """Block action response"""
    status: str
    blocked_user_id: int


async def is_blocked(env, user_id: int, target_id: int) -> bool:
    """
    Check if there is a block relationship between two users.
    Returns True if either user has blocked the other.
    This is a bi-directional check for maximum privacy.
    """
    result = await env.DB.prepare(
        """SELECT id FROM blocked_users
           WHERE (blocker_id = ? AND blocked_id = ?)
              OR (blocker_id = ? AND blocked_id = ?)
           LIMIT 1"""
    ).bind(user_id, target_id, target_id, user_id).first()

    if result and hasattr(result, 'to_py'):
        result = result.to_py()

    return bool(result)


async def get_blocked_user_ids(env, user_id: int) -> set:
    """
    Get set of user IDs that should be filtered out for a user.
    Includes both users the current user has blocked AND users who have blocked them.
    """
    results = await env.DB.prepare(
        """SELECT blocker_id, blocked_id FROM blocked_users
           WHERE blocker_id = ? OR blocked_id = ?"""
    ).bind(user_id, user_id).all()

    if hasattr(results, 'to_py'):
        results = results.to_py()

    blocked_ids = set()
    for row in results.get("results", []):
        if row["blocker_id"] == user_id:
            blocked_ids.add(row["blocked_id"])
        else:
            blocked_ids.add(row["blocker_id"])

    return blocked_ids


@router.post("/{target_id}/block")
async def block_user(
    request: Request,
    target_id: int,
    user_id: int = Depends(require_csrf)
) -> BlockResponse:
    """
    Block a user.
    Blocking effects:
    - Blocked user cannot send you messages
    - Blocked user cannot send friend requests
    - Their posts/comments are hidden from your feed
    - They cannot see your profile
    """
    env = request.scope["env"]

    try:
        # Cannot block yourself
        if target_id == user_id:
            raise HTTPException(status_code=400, detail="You cannot block yourself")

        # Check if target user exists
        target = await env.DB.prepare(
            "SELECT id FROM users WHERE id = ?"
        ).bind(target_id).first()

        if target and hasattr(target, 'to_py'):
            target = target.to_py()

        if not target:
            raise HTTPException(status_code=404, detail="User not found")

        # Check if already blocked
        existing = await env.DB.prepare(
            "SELECT id FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?"
        ).bind(user_id, target_id).first()

        if existing and hasattr(existing, 'to_py'):
            existing = existing.to_py()

        if existing:
            return BlockResponse(status="already_blocked", blocked_user_id=target_id)

        # Insert block record
        await env.DB.prepare(
            "INSERT INTO blocked_users (blocker_id, blocked_id) VALUES (?, ?)"
        ).bind(user_id, target_id).run()

        # Remove any existing friendship in both directions
        await env.DB.prepare(
            """DELETE FROM friends
               WHERE (user_id = ? AND friend_id = ?)
                  OR (user_id = ? AND friend_id = ?)"""
        ).bind(user_id, target_id, target_id, user_id).run()

        # Cancel any pending friend requests in both directions
        await env.DB.prepare(
            """DELETE FROM friend_requests
               WHERE ((sender_id = ? AND recipient_id = ?)
                  OR (sender_id = ? AND recipient_id = ?))
               AND status = 'pending'"""
        ).bind(user_id, target_id, target_id, user_id).run()

        return BlockResponse(status="blocked", blocked_user_id=target_id)

    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Error blocking user: {str(error)}")


@router.delete("/{target_id}/block")
async def unblock_user(
    request: Request,
    target_id: int,
    user_id: int = Depends(require_csrf)
) -> BlockResponse:
    """
    Unblock a user.
    """
    env = request.scope["env"]

    try:
        # Check if block exists
        existing = await env.DB.prepare(
            "SELECT id FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?"
        ).bind(user_id, target_id).first()

        if existing and hasattr(existing, 'to_py'):
            existing = existing.to_py()

        if not existing:
            return BlockResponse(status="not_blocked", blocked_user_id=target_id)

        # Remove block
        await env.DB.prepare(
            "DELETE FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?"
        ).bind(user_id, target_id).run()

        return BlockResponse(status="unblocked", blocked_user_id=target_id)

    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Error unblocking user: {str(error)}")


@router.get("/blocked")
async def get_blocked_users(
    request: Request,
    user_id: int = Depends(require_auth)
) -> list[BlockedUser]:
    """
    Get list of users you have blocked.
    """
    env = request.scope["env"]

    try:
        results = await env.DB.prepare(
            """SELECT b.id, b.blocked_id as user_id, b.created_at as blocked_at,
                      u.name, u.picture
               FROM blocked_users b
               JOIN users u ON u.id = b.blocked_id
               WHERE b.blocker_id = ?
               ORDER BY b.created_at DESC"""
        ).bind(user_id).all()

        if hasattr(results, 'to_py'):
            results = results.to_py()

        blocked = []
        for row in results.get("results", []):
            blocked.append(BlockedUser(
                id=row["id"],
                user_id=row["user_id"],
                name=to_python_value(row.get("name")),
                picture=to_python_value(row.get("picture")),
                blocked_at=str(row["blocked_at"])
            ))

        return blocked

    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Error fetching blocked users: {str(error)}")


@router.get("/check/{target_id}")
async def check_block_status(
    request: Request,
    target_id: int,
    user_id: int = Depends(require_auth)
) -> dict:
    """
    Check if a block relationship exists with a user.
    Returns whether you have blocked them OR they have blocked you.
    """
    env = request.scope["env"]

    try:
        # Check if I blocked them
        i_blocked = await env.DB.prepare(
            "SELECT id FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?"
        ).bind(user_id, target_id).first()

        if i_blocked and hasattr(i_blocked, 'to_py'):
            i_blocked = i_blocked.to_py()

        # Check if they blocked me
        they_blocked = await env.DB.prepare(
            "SELECT id FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?"
        ).bind(target_id, user_id).first()

        if they_blocked and hasattr(they_blocked, 'to_py'):
            they_blocked = they_blocked.to_py()

        return {
            "is_blocked": bool(i_blocked or they_blocked),
            "i_blocked_them": bool(i_blocked),
            "they_blocked_me": bool(they_blocked)
        }

    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Error checking block status: {str(error)}")
