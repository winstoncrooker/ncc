"""
Friends management routes for Niche Collector Connector
Friend request system with accept/reject flow
"""

from fastapi import APIRouter, Request, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from routes.auth import require_auth

router = APIRouter()


class FriendProfile(BaseModel):
    """Friend profile response"""
    id: int
    name: Optional[str] = None
    picture: Optional[str] = None
    bio: Optional[str] = None
    pronouns: Optional[str] = None
    friends_since: Optional[str] = None


class FriendRequest(BaseModel):
    """Friend request response"""
    id: int
    sender_id: int
    sender_name: Optional[str] = None
    sender_picture: Optional[str] = None
    recipient_id: int
    recipient_name: Optional[str] = None
    recipient_picture: Optional[str] = None
    status: str
    created_at: str


class SendFriendRequest(BaseModel):
    """Send friend request by name"""
    name: str


class RequestCount(BaseModel):
    """Pending request count"""
    count: int


class PublicProfile(BaseModel):
    """Public profile response with showcase"""
    id: int
    name: Optional[str] = None
    picture: Optional[str] = None
    bio: Optional[str] = None
    pronouns: Optional[str] = None
    background_image: Optional[str] = None
    is_friend: bool = False
    request_sent: bool = False
    request_received: bool = False
    request_id: Optional[int] = None
    showcase: list = []
    collection_count: int = 0


class ShowcaseAlbum(BaseModel):
    """Album in showcase"""
    id: int
    artist: str
    album: str
    cover: Optional[str] = None
    year: Optional[int] = None


def to_python_value(val):
    """Convert JsNull and other JS types to Python equivalents"""
    if val is None or (hasattr(val, '__class__') and 'JsNull' in str(type(val))):
        return None
    return val


@router.get("/")
async def get_friends(
    request: Request,
    user_id: int = Depends(require_auth)
) -> list[FriendProfile]:
    """
    Get list of mutual friends.
    Friends are users where both directions exist in the friends table.
    """
    env = request.scope["env"]

    try:
        results = await env.DB.prepare(
            """SELECT u.id, u.name, u.picture, u.bio, u.pronouns, f.created_at as friends_since
               FROM users u
               JOIN friends f ON u.id = f.friend_id
               WHERE f.user_id = ?
               ORDER BY f.created_at DESC"""
        ).bind(user_id).all()

        friends = []
        for row in results.results:
            if hasattr(row, 'to_py'):
                row = row.to_py()
            friends.append(FriendProfile(
                id=row["id"],
                name=to_python_value(row.get("name")),
                picture=to_python_value(row.get("picture")),
                bio=to_python_value(row.get("bio")),
                pronouns=to_python_value(row.get("pronouns")),
                friends_since=str(row["friends_since"]) if to_python_value(row.get("friends_since")) else None
            ))

        return friends
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching friends: {str(e)}")


@router.post("/request")
async def send_friend_request(
    request: Request,
    body: SendFriendRequest,
    user_id: int = Depends(require_auth)
) -> FriendRequest:
    """
    Send a friend request by exact name (case-sensitive).
    """
    env = request.scope["env"]

    try:
        if not body.name or not body.name.strip():
            raise HTTPException(status_code=400, detail="Name is required")

        # Find user by exact name (case-sensitive)
        target = await env.DB.prepare(
            "SELECT id, name, picture FROM users WHERE name = ?"
        ).bind(body.name.strip()).first()

        if target and hasattr(target, 'to_py'):
            target = target.to_py()

        if not target:
            raise HTTPException(status_code=404, detail="User not found")

        target_id = target["id"]

        # Can't add yourself
        if target_id == user_id:
            raise HTTPException(status_code=400, detail="You cannot send a request to yourself")

        # Check if already friends
        existing_friend = await env.DB.prepare(
            "SELECT id FROM friends WHERE user_id = ? AND friend_id = ?"
        ).bind(user_id, target_id).first()

        if existing_friend:
            raise HTTPException(status_code=400, detail="You are already friends with this user")

        # Check if request already exists (in either direction)
        existing_request = await env.DB.prepare(
            """SELECT id, sender_id, status FROM friend_requests
               WHERE ((sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?))
               AND status = 'pending'"""
        ).bind(user_id, target_id, target_id, user_id).first()

        if existing_request and hasattr(existing_request, 'to_py'):
            existing_request = existing_request.to_py()

        if existing_request:
            if existing_request["sender_id"] == user_id:
                raise HTTPException(status_code=400, detail="You already sent a request to this user")
            else:
                raise HTTPException(status_code=400, detail="This user already sent you a request - check your pending requests!")

        # Get sender info
        sender = await env.DB.prepare(
            "SELECT name, picture FROM users WHERE id = ?"
        ).bind(user_id).first()

        if sender and hasattr(sender, 'to_py'):
            sender = sender.to_py()

        # Create friend request
        result = await env.DB.prepare(
            """INSERT INTO friend_requests (sender_id, recipient_id, status)
               VALUES (?, ?, 'pending') RETURNING id, created_at"""
        ).bind(user_id, target_id).first()

        if result and hasattr(result, 'to_py'):
            result = result.to_py()

        return FriendRequest(
            id=result["id"],
            sender_id=user_id,
            sender_name=to_python_value(sender.get("name")) if sender else None,
            sender_picture=to_python_value(sender.get("picture")) if sender else None,
            recipient_id=target_id,
            recipient_name=to_python_value(target.get("name")),
            recipient_picture=to_python_value(target.get("picture")),
            status="pending",
            created_at=str(result["created_at"])
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error sending request: {str(e)}")


@router.get("/requests")
async def get_pending_requests(
    request: Request,
    user_id: int = Depends(require_auth)
) -> list[FriendRequest]:
    """
    Get pending friend requests received.
    """
    env = request.scope["env"]

    try:
        results = await env.DB.prepare(
            """SELECT fr.id, fr.sender_id, fr.recipient_id, fr.status, fr.created_at,
                      u.name as sender_name, u.picture as sender_picture
               FROM friend_requests fr
               JOIN users u ON u.id = fr.sender_id
               WHERE fr.recipient_id = ? AND fr.status = 'pending'
               ORDER BY fr.created_at DESC"""
        ).bind(user_id).all()

        requests = []
        for row in results.results:
            if hasattr(row, 'to_py'):
                row = row.to_py()
            requests.append(FriendRequest(
                id=row["id"],
                sender_id=row["sender_id"],
                sender_name=to_python_value(row.get("sender_name")),
                sender_picture=to_python_value(row.get("sender_picture")),
                recipient_id=row["recipient_id"],
                recipient_name=None,
                recipient_picture=None,
                status=row["status"],
                created_at=str(row["created_at"])
            ))

        return requests
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching requests: {str(e)}")


@router.get("/requests/sent")
async def get_sent_requests(
    request: Request,
    user_id: int = Depends(require_auth)
) -> list[FriendRequest]:
    """
    Get friend requests you sent that are pending.
    """
    env = request.scope["env"]

    try:
        results = await env.DB.prepare(
            """SELECT fr.id, fr.sender_id, fr.recipient_id, fr.status, fr.created_at,
                      u.name as recipient_name, u.picture as recipient_picture
               FROM friend_requests fr
               JOIN users u ON u.id = fr.recipient_id
               WHERE fr.sender_id = ? AND fr.status = 'pending'
               ORDER BY fr.created_at DESC"""
        ).bind(user_id).all()

        requests = []
        for row in results.results:
            if hasattr(row, 'to_py'):
                row = row.to_py()
            requests.append(FriendRequest(
                id=row["id"],
                sender_id=row["sender_id"],
                sender_name=None,
                sender_picture=None,
                recipient_id=row["recipient_id"],
                recipient_name=to_python_value(row.get("recipient_name")),
                recipient_picture=to_python_value(row.get("recipient_picture")),
                status=row["status"],
                created_at=str(row["created_at"])
            ))

        return requests
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching sent requests: {str(e)}")


@router.get("/requests/count")
async def get_request_count(
    request: Request,
    user_id: int = Depends(require_auth)
) -> RequestCount:
    """
    Get count of pending friend requests received.
    """
    env = request.scope["env"]

    try:
        result = await env.DB.prepare(
            "SELECT COUNT(*) as count FROM friend_requests WHERE recipient_id = ? AND status = 'pending'"
        ).bind(user_id).first()

        if result and hasattr(result, 'to_py'):
            result = result.to_py()

        return RequestCount(count=result["count"] if result else 0)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching request count: {str(e)}")


@router.post("/requests/{request_id}/accept")
async def accept_friend_request(
    request: Request,
    request_id: int,
    user_id: int = Depends(require_auth)
) -> dict:
    """
    Accept a friend request.
    Creates mutual friendship entries.
    """
    env = request.scope["env"]

    try:
        # Get the request
        fr = await env.DB.prepare(
            "SELECT id, sender_id, recipient_id, status FROM friend_requests WHERE id = ?"
        ).bind(request_id).first()

        if fr and hasattr(fr, 'to_py'):
            fr = fr.to_py()

        if not fr:
            raise HTTPException(status_code=404, detail="Friend request not found")

        if fr["recipient_id"] != user_id:
            raise HTTPException(status_code=403, detail="You can only accept requests sent to you")

        if fr["status"] != "pending":
            raise HTTPException(status_code=400, detail="This request has already been responded to")

        sender_id = fr["sender_id"]

        # Update request status
        await env.DB.prepare(
            "UPDATE friend_requests SET status = 'accepted', responded_at = CURRENT_TIMESTAMP WHERE id = ?"
        ).bind(request_id).run()

        # Create mutual friendship (both directions)
        await env.DB.prepare(
            "INSERT OR IGNORE INTO friends (user_id, friend_id) VALUES (?, ?)"
        ).bind(user_id, sender_id).run()

        await env.DB.prepare(
            "INSERT OR IGNORE INTO friends (user_id, friend_id) VALUES (?, ?)"
        ).bind(sender_id, user_id).run()

        return {"status": "accepted", "friend_id": sender_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error accepting request: {str(e)}")


@router.post("/requests/{request_id}/reject")
async def reject_friend_request(
    request: Request,
    request_id: int,
    user_id: int = Depends(require_auth)
) -> dict:
    """
    Reject a friend request.
    """
    env = request.scope["env"]

    try:
        # Get the request
        fr = await env.DB.prepare(
            "SELECT id, sender_id, recipient_id, status FROM friend_requests WHERE id = ?"
        ).bind(request_id).first()

        if fr and hasattr(fr, 'to_py'):
            fr = fr.to_py()

        if not fr:
            raise HTTPException(status_code=404, detail="Friend request not found")

        if fr["recipient_id"] != user_id:
            raise HTTPException(status_code=403, detail="You can only reject requests sent to you")

        if fr["status"] != "pending":
            raise HTTPException(status_code=400, detail="This request has already been responded to")

        # Update request status
        await env.DB.prepare(
            "UPDATE friend_requests SET status = 'rejected', responded_at = CURRENT_TIMESTAMP WHERE id = ?"
        ).bind(request_id).run()

        return {"status": "rejected", "request_id": request_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error rejecting request: {str(e)}")


@router.delete("/requests/{request_id}")
async def cancel_friend_request(
    request: Request,
    request_id: int,
    user_id: int = Depends(require_auth)
) -> dict:
    """
    Cancel a friend request you sent.
    """
    env = request.scope["env"]

    try:
        # Get the request
        fr = await env.DB.prepare(
            "SELECT id, sender_id, status FROM friend_requests WHERE id = ?"
        ).bind(request_id).first()

        if fr and hasattr(fr, 'to_py'):
            fr = fr.to_py()

        if not fr:
            raise HTTPException(status_code=404, detail="Friend request not found")

        if fr["sender_id"] != user_id:
            raise HTTPException(status_code=403, detail="You can only cancel requests you sent")

        if fr["status"] != "pending":
            raise HTTPException(status_code=400, detail="This request has already been responded to")

        # Delete the request
        await env.DB.prepare(
            "DELETE FROM friend_requests WHERE id = ?"
        ).bind(request_id).run()

        return {"status": "cancelled", "request_id": request_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error cancelling request: {str(e)}")


@router.delete("/{friend_id}")
async def remove_friend(
    request: Request,
    friend_id: int,
    user_id: int = Depends(require_auth)
) -> dict:
    """
    Unfriend a user (removes friendship in both directions).
    """
    env = request.scope["env"]

    try:
        # Check if friends
        existing = await env.DB.prepare(
            "SELECT id FROM friends WHERE user_id = ? AND friend_id = ?"
        ).bind(user_id, friend_id).first()

        if not existing:
            raise HTTPException(status_code=404, detail="You are not friends with this user")

        # Remove both directions
        await env.DB.prepare(
            "DELETE FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)"
        ).bind(user_id, friend_id, friend_id, user_id).run()

        return {"status": "unfriended", "id": friend_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error removing friend: {str(e)}")


@router.get("/search")
async def search_user(
    request: Request,
    name: str,
    user_id: int = Depends(require_auth)
) -> Optional[FriendProfile]:
    """
    Search for user by exact name (case-sensitive).
    Returns user profile if found, null if not.
    """
    env = request.scope["env"]

    try:
        if not name or not name.strip():
            raise HTTPException(status_code=400, detail="Name is required")

        user = await env.DB.prepare(
            "SELECT id, name, picture, bio, pronouns FROM users WHERE name = ?"
        ).bind(name.strip()).first()

        if user and hasattr(user, 'to_py'):
            user = user.to_py()

        if not user:
            return None

        return FriendProfile(
            id=user["id"],
            name=to_python_value(user.get("name")),
            picture=to_python_value(user.get("picture")),
            bio=to_python_value(user.get("bio")),
            pronouns=to_python_value(user.get("pronouns"))
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error searching user: {str(e)}")


@router.get("/user/{target_user_id}")
async def get_public_profile(
    request: Request,
    target_user_id: int,
    user_id: int = Depends(require_auth)
) -> PublicProfile:
    """
    Get public profile of a user with their showcase.
    """
    env = request.scope["env"]

    try:
        # Get user profile
        user = await env.DB.prepare(
            """SELECT id, name, picture, bio, pronouns, background_image
               FROM users WHERE id = ?"""
        ).bind(target_user_id).first()

        if user and hasattr(user, 'to_py'):
            user = user.to_py()

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Check if friends (mutual)
        is_friend = await env.DB.prepare(
            "SELECT id FROM friends WHERE user_id = ? AND friend_id = ?"
        ).bind(user_id, target_user_id).first()

        # Check for pending requests
        request_sent = None
        request_received = None
        request_id = None

        pending_request = await env.DB.prepare(
            """SELECT id, sender_id FROM friend_requests
               WHERE ((sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?))
               AND status = 'pending'"""
        ).bind(user_id, target_user_id, target_user_id, user_id).first()

        if pending_request and hasattr(pending_request, 'to_py'):
            pending_request = pending_request.to_py()

        if pending_request:
            request_id = pending_request["id"]
            if pending_request["sender_id"] == user_id:
                request_sent = True
            else:
                request_received = True

        # Get their showcase
        showcase_results = await env.DB.prepare(
            """SELECT s.id, c.artist, c.album, c.cover, c.year
               FROM showcase_albums s
               JOIN collections c ON s.collection_id = c.id
               WHERE s.user_id = ?
               ORDER BY s.position ASC"""
        ).bind(target_user_id).all()

        showcase = []
        for row in showcase_results.results:
            if hasattr(row, 'to_py'):
                row = row.to_py()
            showcase.append(ShowcaseAlbum(
                id=row["id"],
                artist=row["artist"],
                album=row["album"],
                cover=to_python_value(row.get("cover")),
                year=to_python_value(row.get("year"))
            ))

        # Get collection count
        count_result = await env.DB.prepare(
            "SELECT COUNT(*) as count FROM collections WHERE user_id = ?"
        ).bind(target_user_id).first()

        if count_result and hasattr(count_result, 'to_py'):
            count_result = count_result.to_py()

        collection_count = count_result["count"] if count_result else 0

        return PublicProfile(
            id=user["id"],
            name=to_python_value(user.get("name")),
            picture=to_python_value(user.get("picture")),
            bio=to_python_value(user.get("bio")),
            pronouns=to_python_value(user.get("pronouns")),
            background_image=to_python_value(user.get("background_image")),
            is_friend=bool(is_friend),
            request_sent=bool(request_sent),
            request_received=bool(request_received),
            request_id=request_id,
            showcase=[s.model_dump() for s in showcase],
            collection_count=collection_count
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching profile: {str(e)}")


@router.get("/user/{target_user_id}/collection")
async def get_user_collection(
    request: Request,
    target_user_id: int,
    user_id: int = Depends(require_auth)
) -> list[dict]:
    """
    Get a user's full collection.
    """
    env = request.scope["env"]

    try:
        results = await env.DB.prepare(
            """SELECT id, artist, album, cover, year
               FROM collections
               WHERE user_id = ?
               ORDER BY artist, album"""
        ).bind(target_user_id).all()

        collection = []
        for row in results.results:
            if hasattr(row, 'to_py'):
                row = row.to_py()
            collection.append({
                "id": row["id"],
                "artist": row["artist"],
                "album": row["album"],
                "cover": to_python_value(row.get("cover")),
                "year": to_python_value(row.get("year"))
            })

        return collection
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching collection: {str(e)}")
