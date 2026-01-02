"""
Email notification service using Resend API
Handles all transactional email sending for Niche Collector Connector
"""

import json
from typing import Optional
import httpx


# Resend API endpoint
RESEND_API_URL = "https://api.resend.com/emails"

# From address (must be verified in Resend)
FROM_EMAIL = "Niche Collector <notifications@niche-collector.com>"
FROM_EMAIL_NO_REPLY = "Niche Collector <noreply@niche-collector.com>"


class NotificationType:
    """Notification type constants matching database columns"""
    FRIEND_REQUEST = "friend_request"
    FRIEND_ACCEPTED = "friend_accepted"
    MESSAGE = "message"
    FORUM_REPLY = "forum_reply"
    OFFER_RECEIVED = "offer_received"
    OFFER_RESPONSE = "offer_response"
    TRANSACTION_COMPLETE = "transaction_complete"


# Map notification types to settings columns
NOTIFICATION_TO_SETTING = {
    NotificationType.FRIEND_REQUEST: "email_friend_requests",
    NotificationType.FRIEND_ACCEPTED: "email_friend_requests",
    NotificationType.MESSAGE: "email_messages",
    NotificationType.FORUM_REPLY: "email_forum_replies",
    NotificationType.OFFER_RECEIVED: "email_offers",
    NotificationType.OFFER_RESPONSE: "email_offers",
    NotificationType.TRANSACTION_COMPLETE: "email_sales",
}


def get_email_template(notification_type: str, data: dict) -> dict:
    """
    Generate email subject and HTML body for each notification type.
    Returns dict with 'subject' and 'html' keys.
    """
    templates = {
        NotificationType.FRIEND_REQUEST: {
            "subject": f"{data.get('sender_name', 'Someone')} wants to connect with you!",
            "html": f"""
                <div style="font-family: 'Montserrat', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0e0e0e; color: #fff; padding: 40px 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #1db954; font-family: 'Orbitron', sans-serif; margin: 0;">NCC</h1>
                        <p style="color: #888; margin: 5px 0;">Niche Collector Connector</p>
                    </div>
                    <div style="background: #1a1a1a; border-radius: 12px; padding: 30px; margin-bottom: 20px;">
                        <h2 style="margin-top: 0; color: #fff;">New Friend Request!</h2>
                        <p style="color: #ccc; line-height: 1.6;">
                            <strong style="color: #1db954;">{data.get('sender_name', 'Someone')}</strong> wants to connect with you on Niche Collector Connector.
                        </p>
                        <div style="text-align: center; margin-top: 30px;">
                            <a href="https://niche-collector.pages.dev/profile.html"
                               style="display: inline-block; background: #1db954; color: #000; text-decoration: none; padding: 12px 30px; border-radius: 25px; font-weight: 600;">
                                View Request
                            </a>
                        </div>
                    </div>
                    <p style="color: #666; font-size: 12px; text-align: center;">
                        You can manage your notification preferences in your profile settings.
                    </p>
                </div>
            """
        },
        NotificationType.FRIEND_ACCEPTED: {
            "subject": f"{data.get('friend_name', 'Someone')} accepted your friend request!",
            "html": f"""
                <div style="font-family: 'Montserrat', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0e0e0e; color: #fff; padding: 40px 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #1db954; font-family: 'Orbitron', sans-serif; margin: 0;">NCC</h1>
                        <p style="color: #888; margin: 5px 0;">Niche Collector Connector</p>
                    </div>
                    <div style="background: #1a1a1a; border-radius: 12px; padding: 30px; margin-bottom: 20px;">
                        <h2 style="margin-top: 0; color: #fff;">You're Now Connected!</h2>
                        <p style="color: #ccc; line-height: 1.6;">
                            <strong style="color: #1db954;">{data.get('friend_name', 'Someone')}</strong> accepted your friend request.
                            You can now message them and see their full collection!
                        </p>
                        <div style="text-align: center; margin-top: 30px;">
                            <a href="https://niche-collector.pages.dev/profile.html"
                               style="display: inline-block; background: #1db954; color: #000; text-decoration: none; padding: 12px 30px; border-radius: 25px; font-weight: 600;">
                                View Profile
                            </a>
                        </div>
                    </div>
                    <p style="color: #666; font-size: 12px; text-align: center;">
                        You can manage your notification preferences in your profile settings.
                    </p>
                </div>
            """
        },
        NotificationType.MESSAGE: {
            "subject": f"New message from {data.get('sender_name', 'Someone')}",
            "html": f"""
                <div style="font-family: 'Montserrat', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0e0e0e; color: #fff; padding: 40px 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #1db954; font-family: 'Orbitron', sans-serif; margin: 0;">NCC</h1>
                        <p style="color: #888; margin: 5px 0;">Niche Collector Connector</p>
                    </div>
                    <div style="background: #1a1a1a; border-radius: 12px; padding: 30px; margin-bottom: 20px;">
                        <h2 style="margin-top: 0; color: #fff;">New Message</h2>
                        <p style="color: #ccc; line-height: 1.6;">
                            <strong style="color: #1db954;">{data.get('sender_name', 'Someone')}</strong> sent you a message:
                        </p>
                        <div style="background: #2a2a2a; border-radius: 8px; padding: 15px; margin: 15px 0; border-left: 3px solid #1db954;">
                            <p style="color: #fff; margin: 0; font-style: italic;">
                                "{data.get('message_preview', '...')}"
                            </p>
                        </div>
                        <div style="text-align: center; margin-top: 30px;">
                            <a href="https://niche-collector.pages.dev/profile.html"
                               style="display: inline-block; background: #1db954; color: #000; text-decoration: none; padding: 12px 30px; border-radius: 25px; font-weight: 600;">
                                Reply Now
                            </a>
                        </div>
                    </div>
                    <p style="color: #666; font-size: 12px; text-align: center;">
                        You can manage your notification preferences in your profile settings.
                    </p>
                </div>
            """
        },
        NotificationType.FORUM_REPLY: {
            "subject": f"{data.get('author_name', 'Someone')} replied to your post",
            "html": f"""
                <div style="font-family: 'Montserrat', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0e0e0e; color: #fff; padding: 40px 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #1db954; font-family: 'Orbitron', sans-serif; margin: 0;">NCC</h1>
                        <p style="color: #888; margin: 5px 0;">Niche Collector Connector</p>
                    </div>
                    <div style="background: #1a1a1a; border-radius: 12px; padding: 30px; margin-bottom: 20px;">
                        <h2 style="margin-top: 0; color: #fff;">New Reply</h2>
                        <p style="color: #ccc; line-height: 1.6;">
                            <strong style="color: #1db954;">{data.get('author_name', 'Someone')}</strong> replied to your post
                            "<strong>{data.get('post_title', 'your post')}</strong>":
                        </p>
                        <div style="background: #2a2a2a; border-radius: 8px; padding: 15px; margin: 15px 0; border-left: 3px solid #1db954;">
                            <p style="color: #fff; margin: 0;">
                                "{data.get('comment_preview', '...')}"
                            </p>
                        </div>
                        <div style="text-align: center; margin-top: 30px;">
                            <a href="https://niche-collector.pages.dev/profile.html"
                               style="display: inline-block; background: #1db954; color: #000; text-decoration: none; padding: 12px 30px; border-radius: 25px; font-weight: 600;">
                                View Reply
                            </a>
                        </div>
                    </div>
                    <p style="color: #666; font-size: 12px; text-align: center;">
                        You can manage your notification preferences in your profile settings.
                    </p>
                </div>
            """
        },
        NotificationType.OFFER_RECEIVED: {
            "subject": f"New offer on your listing: {data.get('item_title', 'your item')}",
            "html": f"""
                <div style="font-family: 'Montserrat', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0e0e0e; color: #fff; padding: 40px 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #1db954; font-family: 'Orbitron', sans-serif; margin: 0;">NCC</h1>
                        <p style="color: #888; margin: 5px 0;">Niche Collector Connector</p>
                    </div>
                    <div style="background: #1a1a1a; border-radius: 12px; padding: 30px; margin-bottom: 20px;">
                        <h2 style="margin-top: 0; color: #fff;">New Offer Received!</h2>
                        <p style="color: #ccc; line-height: 1.6;">
                            <strong style="color: #1db954;">{data.get('buyer_name', 'Someone')}</strong> made an offer on your listing:
                        </p>
                        <div style="background: #2a2a2a; border-radius: 8px; padding: 20px; margin: 15px 0; text-align: center;">
                            <p style="color: #888; margin: 0 0 10px 0; font-size: 14px;">{data.get('item_title', 'Item')}</p>
                            <p style="color: #1db954; margin: 0; font-size: 24px; font-weight: 600;">
                                ${data.get('offer_amount', '0.00')}
                            </p>
                        </div>
                        <div style="text-align: center; margin-top: 30px;">
                            <a href="https://niche-collector.pages.dev/profile.html"
                               style="display: inline-block; background: #1db954; color: #000; text-decoration: none; padding: 12px 30px; border-radius: 25px; font-weight: 600;">
                                Review Offer
                            </a>
                        </div>
                    </div>
                    <p style="color: #666; font-size: 12px; text-align: center;">
                        You can manage your notification preferences in your profile settings.
                    </p>
                </div>
            """
        },
        NotificationType.OFFER_RESPONSE: {
            "subject": f"Your offer was {data.get('status', 'responded to')}",
            "html": f"""
                <div style="font-family: 'Montserrat', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0e0e0e; color: #fff; padding: 40px 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #1db954; font-family: 'Orbitron', sans-serif; margin: 0;">NCC</h1>
                        <p style="color: #888; margin: 5px 0;">Niche Collector Connector</p>
                    </div>
                    <div style="background: #1a1a1a; border-radius: 12px; padding: 30px; margin-bottom: 20px;">
                        <h2 style="margin-top: 0; color: #fff;">Offer Update</h2>
                        <p style="color: #ccc; line-height: 1.6;">
                            Your offer of <strong style="color: #1db954;">${data.get('offer_amount', '0.00')}</strong> on
                            "<strong>{data.get('item_title', 'the item')}</strong>" was
                            <strong style="color: {'#1db954' if data.get('status') == 'accepted' else '#ff4444'};">{data.get('status', 'updated')}</strong>.
                        </p>
                        {'<p style="color: #1db954; text-align: center; font-size: 18px; margin: 20px 0;">The seller will be in touch soon!</p>' if data.get('status') == 'accepted' else ''}
                        <div style="text-align: center; margin-top: 30px;">
                            <a href="https://niche-collector.pages.dev/profile.html"
                               style="display: inline-block; background: #1db954; color: #000; text-decoration: none; padding: 12px 30px; border-radius: 25px; font-weight: 600;">
                                View Details
                            </a>
                        </div>
                    </div>
                    <p style="color: #666; font-size: 12px; text-align: center;">
                        You can manage your notification preferences in your profile settings.
                    </p>
                </div>
            """
        },
        NotificationType.TRANSACTION_COMPLETE: {
            "subject": f"Transaction complete: {data.get('item_title', 'your item')}",
            "html": f"""
                <div style="font-family: 'Montserrat', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0e0e0e; color: #fff; padding: 40px 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #1db954; font-family: 'Orbitron', sans-serif; margin: 0;">NCC</h1>
                        <p style="color: #888; margin: 5px 0;">Niche Collector Connector</p>
                    </div>
                    <div style="background: #1a1a1a; border-radius: 12px; padding: 30px; margin-bottom: 20px;">
                        <h2 style="margin-top: 0; color: #1db954; text-align: center;">Transaction Complete!</h2>
                        <div style="background: #2a2a2a; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
                            <p style="color: #fff; margin: 0 0 10px 0; font-size: 18px;">{data.get('item_title', 'Item')}</p>
                            <p style="color: #1db954; margin: 0; font-size: 28px; font-weight: 600;">
                                ${data.get('amount', '0.00')}
                            </p>
                        </div>
                        <p style="color: #ccc; line-height: 1.6; text-align: center;">
                            Thank you for using Niche Collector Connector!
                        </p>
                    </div>
                    <p style="color: #666; font-size: 12px; text-align: center;">
                        You can manage your notification preferences in your profile settings.
                    </p>
                </div>
            """
        },
    }

    return templates.get(notification_type, {
        "subject": "Notification from Niche Collector",
        "html": "<p>You have a new notification.</p>"
    })


async def check_notification_enabled(env, user_id: int, notification_type: str) -> bool:
    """
    Check if a user has enabled a specific notification type.
    Returns True if enabled, False if disabled.
    Defaults to True if no settings exist yet.
    """
    setting_column = NOTIFICATION_TO_SETTING.get(notification_type)
    if not setting_column:
        return True  # Unknown type, allow by default

    try:
        result = await env.DB.prepare(
            f"SELECT {setting_column} FROM notification_settings WHERE user_id = ?"
        ).bind(user_id).first()

        if result and hasattr(result, 'to_py'):
            result = result.to_py()

        if not result:
            return True  # No settings = all enabled by default

        return bool(result.get(setting_column, 1))
    except Exception:
        return True  # On error, default to enabled


async def get_user_email(env, user_id: int) -> Optional[str]:
    """Get a user's email address from the database"""
    try:
        result = await env.DB.prepare(
            "SELECT email FROM users WHERE id = ?"
        ).bind(user_id).first()

        if result and hasattr(result, 'to_py'):
            result = result.to_py()

        return result.get("email") if result else None
    except Exception:
        return None


async def send_notification_email(
    env,
    recipient_user_id: int,
    notification_type: str,
    data: dict
) -> bool:
    """
    Send a notification email to a user.

    Args:
        env: Cloudflare Worker environment (contains secrets and DB)
        recipient_user_id: The user ID to send the email to
        notification_type: One of NotificationType constants
        data: Template data dict for the email content

    Returns:
        True if email was sent successfully, False otherwise
    """
    # Check if user has this notification type enabled
    if not await check_notification_enabled(env, recipient_user_id, notification_type):
        return False  # User disabled this notification type

    # Get user's email
    recipient_email = await get_user_email(env, recipient_user_id)
    if not recipient_email:
        return False

    # Get API key from environment
    api_key = getattr(env, 'RESEND_API_KEY', None)
    if not api_key:
        # No API key configured - silently skip (development mode)
        print(f"[Email] Skipping notification (no RESEND_API_KEY): {notification_type} to user {recipient_user_id}")
        return False

    # Get email template
    template = get_email_template(notification_type, data)

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                RESEND_API_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "from": FROM_EMAIL_NO_REPLY,
                    "to": [recipient_email],
                    "subject": template["subject"],
                    "html": template["html"]
                },
                timeout=10.0
            )

            if response.status_code in (200, 201):
                print(f"[Email] Sent {notification_type} notification to user {recipient_user_id}")
                return True
            else:
                print(f"[Email] Failed to send: {response.status_code} - {response.text}")
                return False

    except Exception as error:
        print(f"[Email] Error sending notification: {str(error)}")
        return False


async def send_friend_request_notification(env, recipient_id: int, sender_name: str) -> bool:
    """Send notification for new friend request"""
    return await send_notification_email(
        env,
        recipient_id,
        NotificationType.FRIEND_REQUEST,
        {"sender_name": sender_name}
    )


async def send_friend_accepted_notification(env, sender_id: int, friend_name: str) -> bool:
    """Send notification when friend request is accepted"""
    return await send_notification_email(
        env,
        sender_id,
        NotificationType.FRIEND_ACCEPTED,
        {"friend_name": friend_name}
    )


async def send_message_notification(
    env,
    recipient_id: int,
    sender_name: str,
    message_preview: str
) -> bool:
    """Send notification for new message"""
    # Truncate message preview
    preview = message_preview[:100] + "..." if len(message_preview) > 100 else message_preview
    return await send_notification_email(
        env,
        recipient_id,
        NotificationType.MESSAGE,
        {"sender_name": sender_name, "message_preview": preview}
    )


async def send_forum_reply_notification(
    env,
    post_author_id: int,
    replier_name: str,
    post_title: str,
    comment_preview: str
) -> bool:
    """Send notification for forum reply"""
    preview = comment_preview[:150] + "..." if len(comment_preview) > 150 else comment_preview
    return await send_notification_email(
        env,
        post_author_id,
        NotificationType.FORUM_REPLY,
        {
            "author_name": replier_name,
            "post_title": post_title,
            "comment_preview": preview
        }
    )


async def send_offer_notification(
    env,
    seller_id: int,
    buyer_name: str,
    item_title: str,
    offer_amount: str
) -> bool:
    """Send notification for new offer on listing"""
    return await send_notification_email(
        env,
        seller_id,
        NotificationType.OFFER_RECEIVED,
        {
            "buyer_name": buyer_name,
            "item_title": item_title,
            "offer_amount": offer_amount
        }
    )


async def send_offer_response_notification(
    env,
    buyer_id: int,
    item_title: str,
    offer_amount: str,
    status: str  # "accepted" or "rejected"
) -> bool:
    """Send notification for offer response"""
    return await send_notification_email(
        env,
        buyer_id,
        NotificationType.OFFER_RESPONSE,
        {
            "item_title": item_title,
            "offer_amount": offer_amount,
            "status": status
        }
    )


async def send_transaction_complete_notification(
    env,
    user_id: int,
    item_title: str,
    amount: str
) -> bool:
    """Send notification for completed transaction"""
    return await send_notification_email(
        env,
        user_id,
        NotificationType.TRANSACTION_COMPLETE,
        {
            "item_title": item_title,
            "amount": amount
        }
    )
