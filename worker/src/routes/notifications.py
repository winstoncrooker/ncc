"""
Notification settings routes for Niche Collector Connector
Manage email notification preferences
"""

from fastapi import APIRouter, Request, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from routes.auth import require_auth, require_csrf
from utils.conversions import to_python_value

router = APIRouter()


class NotificationSettings(BaseModel):
    """User notification preferences"""
    email_friend_requests: bool = True
    email_messages: bool = True
    email_forum_replies: bool = True
    email_offers: bool = True
    email_sales: bool = True


class UpdateNotificationSettings(BaseModel):
    """Partial update for notification settings"""
    email_friend_requests: Optional[bool] = None
    email_messages: Optional[bool] = None
    email_forum_replies: Optional[bool] = None
    email_offers: Optional[bool] = None
    email_sales: Optional[bool] = None


@router.get("/settings")
async def get_notification_settings(
    request: Request,
    user_id: int = Depends(require_auth)
) -> NotificationSettings:
    """
    Get current user's notification preferences.
    Returns defaults if no settings exist yet.
    """
    env = request.scope["env"]

    try:
        result = await env.DB.prepare(
            """SELECT email_friend_requests, email_messages, email_forum_replies,
                      email_offers, email_sales
               FROM notification_settings WHERE user_id = ?"""
        ).bind(user_id).first()

        if result and hasattr(result, 'to_py'):
            result = result.to_py()

        if not result:
            # Return defaults - all enabled
            return NotificationSettings()

        return NotificationSettings(
            email_friend_requests=bool(to_python_value(result.get("email_friend_requests", 1))),
            email_messages=bool(to_python_value(result.get("email_messages", 1))),
            email_forum_replies=bool(to_python_value(result.get("email_forum_replies", 1))),
            email_offers=bool(to_python_value(result.get("email_offers", 1))),
            email_sales=bool(to_python_value(result.get("email_sales", 1)))
        )

    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Error fetching settings: {str(error)}")


@router.put("/settings")
async def update_notification_settings(
    request: Request,
    body: UpdateNotificationSettings,
    user_id: int = Depends(require_csrf)
) -> NotificationSettings:
    """
    Update notification preferences.
    Supports partial updates - only provided fields will be changed.
    """
    env = request.scope["env"]

    try:
        # Check if settings exist
        existing = await env.DB.prepare(
            "SELECT user_id FROM notification_settings WHERE user_id = ?"
        ).bind(user_id).first()

        if existing and hasattr(existing, 'to_py'):
            existing = existing.to_py()

        # Build update fields from non-None values
        update_fields = {}
        if body.email_friend_requests is not None:
            update_fields["email_friend_requests"] = 1 if body.email_friend_requests else 0
        if body.email_messages is not None:
            update_fields["email_messages"] = 1 if body.email_messages else 0
        if body.email_forum_replies is not None:
            update_fields["email_forum_replies"] = 1 if body.email_forum_replies else 0
        if body.email_offers is not None:
            update_fields["email_offers"] = 1 if body.email_offers else 0
        if body.email_sales is not None:
            update_fields["email_sales"] = 1 if body.email_sales else 0

        if not existing:
            # Insert new settings with defaults + updates
            defaults = {
                "email_friend_requests": 1,
                "email_messages": 1,
                "email_forum_replies": 1,
                "email_offers": 1,
                "email_sales": 1
            }
            defaults.update(update_fields)

            await env.DB.prepare(
                """INSERT INTO notification_settings
                   (user_id, email_friend_requests, email_messages, email_forum_replies,
                    email_offers, email_sales)
                   VALUES (?, ?, ?, ?, ?, ?)"""
            ).bind(
                user_id,
                defaults["email_friend_requests"],
                defaults["email_messages"],
                defaults["email_forum_replies"],
                defaults["email_offers"],
                defaults["email_sales"]
            ).run()
        elif update_fields:
            # Update existing settings
            set_clause = ", ".join([f"{k} = ?" for k in update_fields.keys()])
            values = list(update_fields.values()) + [user_id]

            await env.DB.prepare(
                f"UPDATE notification_settings SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?"
            ).bind(*values).run()

        # Return current settings
        return await get_notification_settings(request, user_id)

    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Error updating settings: {str(error)}")
