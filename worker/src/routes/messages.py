"""
Messaging routes for Niche Collector Connector
"""

from fastapi import APIRouter, Request, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from routes.auth import require_auth, require_auth
from routes.blocks import is_blocked
from utils.conversions import to_python_value
from services.email import send_message_notification

router = APIRouter()

# Limits
MAX_MESSAGE_LENGTH = 1000


class Message(BaseModel):
    """Message response"""
    id: int
    sender_id: int
    recipient_id: int
    sender_name: Optional[str] = None
    sender_picture: Optional[str] = None
    content: str
    read_at: Optional[str] = None
    created_at: str
    is_mine: bool = False


class SendMessageRequest(BaseModel):
    """Send message request"""
    recipient_id: int
    content: str


class ConversationPreview(BaseModel):
    """Conversation preview for inbox"""
    user_id: int
    user_name: Optional[str] = None
    user_picture: Optional[str] = None
    last_message: str
    last_message_at: str
    unread_count: int
    is_last_mine: bool = False


class UnreadCount(BaseModel):
    """Unread message count"""
    count: int


@router.get("/")
async def get_conversations(
    request: Request,
    user_id: int = Depends(require_auth)
) -> list[ConversationPreview]:
    """
    Get list of conversations (inbox).
    Returns latest message from each conversation partner.
    """
    env = request.scope["env"]

    try:
        # Get all unique conversation partners with their latest message
        # This is a complex query to get the latest message per conversation
        results = await env.DB.prepare(
            """
            WITH conversation_partners AS (
                SELECT DISTINCT
                    CASE
                        WHEN sender_id = ? THEN recipient_id
                        ELSE sender_id
                    END as partner_id
                FROM messages
                WHERE sender_id = ? OR recipient_id = ?
            ),
            latest_messages AS (
                SELECT
                    cp.partner_id,
                    m.id,
                    m.sender_id,
                    m.content,
                    m.read_at,
                    m.created_at,
                    ROW_NUMBER() OVER (PARTITION BY cp.partner_id ORDER BY m.created_at DESC) as rn
                FROM conversation_partners cp
                JOIN messages m ON (
                    (m.sender_id = ? AND m.recipient_id = cp.partner_id) OR
                    (m.sender_id = cp.partner_id AND m.recipient_id = ?)
                )
            )
            SELECT
                lm.partner_id as user_id,
                u.name as user_name,
                u.picture as user_picture,
                lm.content as last_message,
                lm.created_at as last_message_at,
                lm.sender_id,
                (
                    SELECT COUNT(*) FROM messages
                    WHERE sender_id = lm.partner_id
                    AND recipient_id = ?
                    AND read_at IS NULL
                ) as unread_count
            FROM latest_messages lm
            JOIN users u ON u.id = lm.partner_id
            WHERE lm.rn = 1
            ORDER BY lm.created_at DESC
            """
        ).bind(user_id, user_id, user_id, user_id, user_id, user_id).all()

        conversations = []
        for row in results.results:
            if hasattr(row, 'to_py'):
                row = row.to_py()
            conversations.append(ConversationPreview(
                user_id=row["user_id"],
                user_name=to_python_value(row.get("user_name")),
                user_picture=to_python_value(row.get("user_picture")),
                last_message=row["last_message"][:100] if row["last_message"] else "",
                last_message_at=str(row["last_message_at"]),
                unread_count=row["unread_count"] or 0,
                is_last_mine=row["sender_id"] == user_id
            ))

        return conversations
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching conversations: {str(e)}")


@router.get("/conversation/{partner_id}")
async def get_conversation(
    request: Request,
    partner_id: int,
    user_id: int = Depends(require_auth)
) -> list[Message]:
    """
    Get all messages with a specific user.
    """
    env = request.scope["env"]

    try:
        results = await env.DB.prepare(
            """SELECT m.id, m.sender_id, m.recipient_id, m.content, m.read_at, m.created_at,
                      u.name as sender_name, u.picture as sender_picture
               FROM messages m
               JOIN users u ON u.id = m.sender_id
               WHERE (m.sender_id = ? AND m.recipient_id = ?)
                  OR (m.sender_id = ? AND m.recipient_id = ?)
               ORDER BY m.created_at ASC"""
        ).bind(user_id, partner_id, partner_id, user_id).all()

        messages = []
        for row in results.results:
            if hasattr(row, 'to_py'):
                row = row.to_py()
            messages.append(Message(
                id=row["id"],
                sender_id=row["sender_id"],
                recipient_id=row["recipient_id"],
                sender_name=to_python_value(row.get("sender_name")),
                sender_picture=to_python_value(row.get("sender_picture")),
                content=row["content"],
                read_at=str(row["read_at"]) if to_python_value(row.get("read_at")) else None,
                created_at=str(row["created_at"]),
                is_mine=row["sender_id"] == user_id
            ))

        # Mark unread messages from partner as read
        await env.DB.prepare(
            """UPDATE messages
               SET read_at = CURRENT_TIMESTAMP
               WHERE sender_id = ? AND recipient_id = ? AND read_at IS NULL"""
        ).bind(partner_id, user_id).run()

        return messages
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching conversation: {str(e)}")


@router.post("/")
async def send_message(
    request: Request,
    body: SendMessageRequest,
    user_id: int = Depends(require_auth)
) -> Message:
    """
    Send a message to a user.
    You must be following the recipient to message them.
    """
    env = request.scope["env"]

    try:
        if not body.content or not body.content.strip():
            raise HTTPException(status_code=400, detail="Message content is required")

        if len(body.content) > MAX_MESSAGE_LENGTH:
            raise HTTPException(status_code=400, detail=f"Message too long (max {MAX_MESSAGE_LENGTH} characters)")

        # Can't message yourself
        if body.recipient_id == user_id:
            raise HTTPException(status_code=400, detail="You cannot message yourself")

        # Check recipient exists
        recipient = await env.DB.prepare(
            "SELECT id, name FROM users WHERE id = ?"
        ).bind(body.recipient_id).first()

        if recipient and hasattr(recipient, 'to_py'):
            recipient = recipient.to_py()

        if not recipient:
            raise HTTPException(status_code=404, detail="Recipient not found")

        # Check if blocked (either direction)
        if await is_blocked(env, user_id, body.recipient_id):
            raise HTTPException(status_code=403, detail="Unable to send message to this user")

        # Check if you follow them (required to message)
        following = await env.DB.prepare(
            "SELECT id FROM friends WHERE user_id = ? AND friend_id = ?"
        ).bind(user_id, body.recipient_id).first()

        if not following:
            raise HTTPException(status_code=403, detail="You must follow this user to send them a message")

        # Get sender info
        sender = await env.DB.prepare(
            "SELECT name, picture FROM users WHERE id = ?"
        ).bind(user_id).first()

        if sender and hasattr(sender, 'to_py'):
            sender = sender.to_py()

        # Insert message
        result = await env.DB.prepare(
            """INSERT INTO messages (sender_id, recipient_id, content)
               VALUES (?, ?, ?) RETURNING id, created_at"""
        ).bind(user_id, body.recipient_id, body.content.strip()).first()

        if result and hasattr(result, 'to_py'):
            result = result.to_py()

        # Send email notification to recipient (non-blocking)
        sender_name = to_python_value(sender.get("name")) if sender else "Someone"
        try:
            await send_message_notification(env, body.recipient_id, sender_name, body.content.strip())
        except Exception:
            pass  # Don't fail the request if email fails

        return Message(
            id=result["id"],
            sender_id=user_id,
            recipient_id=body.recipient_id,
            sender_name=to_python_value(sender.get("name")) if sender else None,
            sender_picture=to_python_value(sender.get("picture")) if sender else None,
            content=body.content.strip(),
            read_at=None,
            created_at=str(result["created_at"]),
            is_mine=True
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error sending message: {str(e)}")


@router.put("/{message_id}/read")
async def mark_as_read(
    request: Request,
    message_id: int,
    user_id: int = Depends(require_auth)
) -> dict:
    """
    Mark a message as read.
    Only the recipient can mark a message as read.
    """
    env = request.scope["env"]

    try:
        # Check message exists and user is recipient
        message = await env.DB.prepare(
            "SELECT id, recipient_id, read_at FROM messages WHERE id = ?"
        ).bind(message_id).first()

        if message and hasattr(message, 'to_py'):
            message = message.to_py()

        if not message:
            raise HTTPException(status_code=404, detail="Message not found")

        if message["recipient_id"] != user_id:
            raise HTTPException(status_code=403, detail="You can only mark your own received messages as read")

        if message["read_at"]:
            return {"status": "already_read", "id": message_id}

        await env.DB.prepare(
            "UPDATE messages SET read_at = CURRENT_TIMESTAMP WHERE id = ?"
        ).bind(message_id).run()

        return {"status": "marked_read", "id": message_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error marking message as read: {str(e)}")


@router.get("/unread-count")
async def get_unread_count(
    request: Request,
    user_id: int = Depends(require_auth)
) -> UnreadCount:
    """
    Get total unread message count.
    """
    env = request.scope["env"]

    try:
        result = await env.DB.prepare(
            "SELECT COUNT(*) as count FROM messages WHERE recipient_id = ? AND read_at IS NULL"
        ).bind(user_id).first()

        if result and hasattr(result, 'to_py'):
            result = result.to_py()

        return UnreadCount(count=result["count"] if result else 0)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching unread count: {str(e)}")
