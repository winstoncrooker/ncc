"""
Content Moderation API routes
Reports, moderation actions, and user warnings
"""

from fastapi import APIRouter, Request, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Literal
from .auth import require_auth, require_csrf
from .admin import check_admin, get_admin_emails

router = APIRouter()


def to_python(val):
    """Convert JsNull/JsProxy to Python None"""
    if val is None:
        return None
    type_str = str(type(val))
    if 'JsProxy' in type_str or 'JsNull' in type_str:
        return None
    return val


# =============================================================================
# Request/Response Models
# =============================================================================

class CreateReportRequest(BaseModel):
    """Create a report request"""
    content_type: Literal['post', 'comment', 'listing', 'profile', 'message']
    content_id: int
    reason: Literal['spam', 'harassment', 'inappropriate', 'scam', 'other']
    details: str | None = Field(None, max_length=1000)


class ReportResponse(BaseModel):
    """Report response"""
    id: int
    reporter_id: int
    reporter_name: str | None = None
    reporter_email: str | None = None
    content_type: str
    content_id: int
    content_preview: str | None = None
    content_author_id: int | None = None
    content_author_name: str | None = None
    reason: str
    details: str | None = None
    status: str
    reviewed_by: int | None = None
    reviewed_by_name: str | None = None
    reviewed_at: str | None = None
    created_at: str


class ReportsListResponse(BaseModel):
    """List of reports"""
    reports: list[ReportResponse]
    total: int


class UpdateReportRequest(BaseModel):
    """Update report status"""
    status: Literal['reviewed', 'actioned', 'dismissed']


class ModerationActionRequest(BaseModel):
    """Take moderation action"""
    report_id: int | None = None
    action_type: Literal['warn', 'hide', 'delete', 'suspend', 'ban']
    target_user_id: int
    reason: str = Field(..., min_length=1, max_length=500)


class ModerationActionResponse(BaseModel):
    """Moderation action response"""
    id: int
    report_id: int | None = None
    action_type: str
    target_user_id: int
    target_user_name: str | None = None
    moderator_id: int
    moderator_name: str | None = None
    reason: str
    created_at: str


class UserWarningResponse(BaseModel):
    """User warning response"""
    id: int
    user_id: int
    warning_type: str
    message: str
    issued_by: int
    issued_by_name: str | None = None
    created_at: str


class UserModerationHistoryResponse(BaseModel):
    """User moderation history"""
    user_id: int
    user_name: str | None = None
    user_email: str | None = None
    warnings: list[UserWarningResponse]
    actions: list[ModerationActionResponse]
    report_count: int


# =============================================================================
# User Routes (authenticated users can submit reports)
# =============================================================================

@router.post("")
async def create_report(
    request: Request,
    body: CreateReportRequest,
    user_id: int = Depends(require_csrf)
) -> dict:
    """
    Submit a report on content.
    Any authenticated user can report posts, comments, profiles, etc.
    """
    env = request.scope["env"]

    try:
        # Validate content exists based on type
        content_exists = False
        if body.content_type == 'post':
            result = await env.DB.prepare(
                "SELECT id FROM forum_posts WHERE id = ?"
            ).bind(body.content_id).first()
            content_exists = result is not None
        elif body.content_type == 'comment':
            result = await env.DB.prepare(
                "SELECT id FROM forum_comments WHERE id = ?"
            ).bind(body.content_id).first()
            content_exists = result is not None
        elif body.content_type == 'profile':
            result = await env.DB.prepare(
                "SELECT id FROM users WHERE id = ?"
            ).bind(body.content_id).first()
            content_exists = result is not None
        elif body.content_type == 'message':
            result = await env.DB.prepare(
                "SELECT id FROM messages WHERE id = ?"
            ).bind(body.content_id).first()
            content_exists = result is not None
        elif body.content_type == 'listing':
            # Future: check listings table
            # For now, allow listing reports
            content_exists = True

        if not content_exists:
            raise HTTPException(status_code=404, detail=f"{body.content_type.title()} not found")

        # Check if user already reported this content
        existing = await env.DB.prepare(
            """SELECT id FROM reports
               WHERE reporter_id = ? AND content_type = ? AND content_id = ?
               AND status = 'pending'"""
        ).bind(user_id, body.content_type, body.content_id).first()

        if existing:
            if hasattr(existing, 'to_py'):
                existing = existing.to_py()
            if existing:
                raise HTTPException(status_code=400, detail="You have already reported this content")

        # Create the report
        result = await env.DB.prepare(
            """INSERT INTO reports (reporter_id, content_type, content_id, reason, details)
               VALUES (?, ?, ?, ?, ?)
               RETURNING id, created_at"""
        ).bind(user_id, body.content_type, body.content_id, body.reason, body.details).first()

        if result and hasattr(result, 'to_py'):
            result = result.to_py()

        if not result:
            raise HTTPException(status_code=500, detail="Failed to create report")

        return {
            "success": True,
            "message": "Report submitted successfully. Our team will review it shortly.",
            "report_id": result["id"]
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating report: {str(e)}")


# =============================================================================
# Admin Routes (admin only)
# =============================================================================

@router.get("/admin")
async def list_reports(
    request: Request,
    status: str | None = None,
    content_type: str | None = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user_id: int = Depends(require_auth)
) -> ReportsListResponse:
    """
    List reports (admin only).
    Supports filtering by status and content_type.
    """
    env = request.scope["env"]
    await check_admin(env, user_id)

    try:
        # Build query conditions
        conditions = []
        params = []

        if status:
            conditions.append("r.status = ?")
            params.append(status)

        if content_type:
            conditions.append("r.content_type = ?")
            params.append(content_type)

        where_clause = " AND ".join(conditions) if conditions else "1=1"

        # Get total count
        count_result = await env.DB.prepare(
            f"SELECT COUNT(*) as count FROM reports r WHERE {where_clause}"
        ).bind(*params).first()

        if count_result and hasattr(count_result, 'to_py'):
            count_result = count_result.to_py()
        total = count_result.get("count", 0) if count_result else 0

        # Get reports with reporter and reviewer info
        result = await env.DB.prepare(
            f"""SELECT r.id, r.reporter_id, r.content_type, r.content_id,
                       r.reason, r.details, r.status, r.reviewed_by, r.reviewed_at, r.created_at,
                       u.name as reporter_name, u.email as reporter_email,
                       rv.name as reviewer_name
                FROM reports r
                LEFT JOIN users u ON r.reporter_id = u.id
                LEFT JOIN users rv ON r.reviewed_by = rv.id
                WHERE {where_clause}
                ORDER BY r.created_at DESC
                LIMIT ? OFFSET ?"""
        ).bind(*params, limit, offset).all()

        if hasattr(result, 'to_py'):
            result = result.to_py()

        reports = []
        for row in result.get("results", []):
            # Get content preview and author info
            content_preview = None
            content_author_id = None
            content_author_name = None

            if row["content_type"] == "post":
                post = await env.DB.prepare(
                    """SELECT p.title, p.body, p.user_id, u.name as author_name
                       FROM forum_posts p
                       LEFT JOIN users u ON p.user_id = u.id
                       WHERE p.id = ?"""
                ).bind(row["content_id"]).first()
                if post and hasattr(post, 'to_py'):
                    post = post.to_py()
                if post:
                    title = post.get("title", "")[:50]
                    body = post.get("body", "")[:100]
                    content_preview = f"{title}: {body}..."
                    content_author_id = to_python(post.get("user_id"))
                    content_author_name = to_python(post.get("author_name"))

            elif row["content_type"] == "comment":
                comment = await env.DB.prepare(
                    """SELECT c.body, c.user_id, u.name as author_name
                       FROM forum_comments c
                       LEFT JOIN users u ON c.user_id = u.id
                       WHERE c.id = ?"""
                ).bind(row["content_id"]).first()
                if comment and hasattr(comment, 'to_py'):
                    comment = comment.to_py()
                if comment:
                    content_preview = comment.get("body", "")[:150] + "..."
                    content_author_id = to_python(comment.get("user_id"))
                    content_author_name = to_python(comment.get("author_name"))

            elif row["content_type"] == "profile":
                profile = await env.DB.prepare(
                    "SELECT id, name, email FROM users WHERE id = ?"
                ).bind(row["content_id"]).first()
                if profile and hasattr(profile, 'to_py'):
                    profile = profile.to_py()
                if profile:
                    content_preview = f"Profile: {to_python(profile.get('name')) or to_python(profile.get('email'))}"
                    content_author_id = to_python(profile.get("id"))
                    content_author_name = to_python(profile.get("name"))

            elif row["content_type"] == "message":
                message = await env.DB.prepare(
                    """SELECT m.body, m.sender_id, u.name as sender_name
                       FROM messages m
                       LEFT JOIN users u ON m.sender_id = u.id
                       WHERE m.id = ?"""
                ).bind(row["content_id"]).first()
                if message and hasattr(message, 'to_py'):
                    message = message.to_py()
                if message:
                    content_preview = message.get("body", "")[:150] + "..."
                    content_author_id = to_python(message.get("sender_id"))
                    content_author_name = to_python(message.get("sender_name"))

            reports.append(ReportResponse(
                id=row["id"],
                reporter_id=row["reporter_id"],
                reporter_name=to_python(row.get("reporter_name")),
                reporter_email=to_python(row.get("reporter_email")),
                content_type=row["content_type"],
                content_id=row["content_id"],
                content_preview=content_preview,
                content_author_id=content_author_id,
                content_author_name=content_author_name,
                reason=row["reason"],
                details=to_python(row.get("details")),
                status=row["status"],
                reviewed_by=to_python(row.get("reviewed_by")),
                reviewed_by_name=to_python(row.get("reviewer_name")),
                reviewed_at=str(row["reviewed_at"]) if to_python(row.get("reviewed_at")) else None,
                created_at=str(row["created_at"])
            ))

        return ReportsListResponse(reports=reports, total=total)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching reports: {str(e)}")


@router.put("/admin/{report_id}")
async def update_report(
    request: Request,
    report_id: int,
    body: UpdateReportRequest,
    user_id: int = Depends(require_csrf)
) -> dict:
    """
    Update report status (admin only).
    """
    env = request.scope["env"]
    await check_admin(env, user_id)

    try:
        # Check report exists
        existing = await env.DB.prepare(
            "SELECT id FROM reports WHERE id = ?"
        ).bind(report_id).first()

        if existing and hasattr(existing, 'to_py'):
            existing = existing.to_py()

        if not existing:
            raise HTTPException(status_code=404, detail="Report not found")

        # Update status
        await env.DB.prepare(
            """UPDATE reports
               SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
               WHERE id = ?"""
        ).bind(body.status, user_id, report_id).run()

        return {"success": True, "message": f"Report marked as {body.status}"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating report: {str(e)}")


@router.post("/admin/action")
async def take_moderation_action(
    request: Request,
    body: ModerationActionRequest,
    user_id: int = Depends(require_csrf)
) -> ModerationActionResponse:
    """
    Take a moderation action on a user (admin only).
    Supports: warn, hide, delete, suspend, ban.
    """
    env = request.scope["env"]
    await check_admin(env, user_id)

    try:
        # Validate target user exists
        target = await env.DB.prepare(
            "SELECT id, name FROM users WHERE id = ?"
        ).bind(body.target_user_id).first()

        if target and hasattr(target, 'to_py'):
            target = target.to_py()

        if not target:
            raise HTTPException(status_code=404, detail="Target user not found")

        # Don't allow actions on admins
        admin_emails = get_admin_emails(env)
        target_email_result = await env.DB.prepare(
            "SELECT email FROM users WHERE id = ?"
        ).bind(body.target_user_id).first()

        if target_email_result and hasattr(target_email_result, 'to_py'):
            target_email_result = target_email_result.to_py()

        if target_email_result:
            target_email = target_email_result.get("email", "")
            if target_email and target_email.lower().strip() in [e.lower().strip() for e in admin_emails]:
                raise HTTPException(status_code=403, detail="Cannot take moderation action on admin users")

        # Handle special actions
        if body.action_type == 'warn':
            # Create a warning record
            await env.DB.prepare(
                """INSERT INTO user_warnings (user_id, warning_type, message, issued_by)
                   VALUES (?, 'moderation', ?, ?)"""
            ).bind(body.target_user_id, body.reason, user_id).run()

        elif body.action_type == 'delete':
            # If report is associated with a post/comment, delete it
            if body.report_id:
                report = await env.DB.prepare(
                    "SELECT content_type, content_id FROM reports WHERE id = ?"
                ).bind(body.report_id).first()

                if report and hasattr(report, 'to_py'):
                    report = report.to_py()

                if report:
                    if report["content_type"] == "post":
                        await env.DB.prepare(
                            "DELETE FROM forum_posts WHERE id = ?"
                        ).bind(report["content_id"]).run()
                    elif report["content_type"] == "comment":
                        await env.DB.prepare(
                            "DELETE FROM forum_comments WHERE id = ?"
                        ).bind(report["content_id"]).run()

        elif body.action_type == 'suspend':
            # Add suspension flag to user (future: add suspended_until column)
            # For now, just log the action
            pass

        elif body.action_type == 'ban':
            # Delete user's content and mark as banned (future: add is_banned column)
            # For now, just log the action
            pass

        # Log the moderation action
        result = await env.DB.prepare(
            """INSERT INTO moderation_actions (report_id, action_type, target_user_id, moderator_id, reason)
               VALUES (?, ?, ?, ?, ?)
               RETURNING id, created_at"""
        ).bind(body.report_id, body.action_type, body.target_user_id, user_id, body.reason).first()

        if result and hasattr(result, 'to_py'):
            result = result.to_py()

        # Update report status if linked
        if body.report_id:
            await env.DB.prepare(
                """UPDATE reports
                   SET status = 'actioned', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
                   WHERE id = ?"""
            ).bind(user_id, body.report_id).run()

        # Get moderator name
        moderator = await env.DB.prepare(
            "SELECT name FROM users WHERE id = ?"
        ).bind(user_id).first()

        if moderator and hasattr(moderator, 'to_py'):
            moderator = moderator.to_py()

        return ModerationActionResponse(
            id=result["id"],
            report_id=body.report_id,
            action_type=body.action_type,
            target_user_id=body.target_user_id,
            target_user_name=to_python(target.get("name")),
            moderator_id=user_id,
            moderator_name=to_python(moderator.get("name")) if moderator else None,
            reason=body.reason,
            created_at=str(result["created_at"])
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error taking moderation action: {str(e)}")


@router.get("/admin/users/{target_user_id}/history")
async def get_user_moderation_history(
    request: Request,
    target_user_id: int,
    user_id: int = Depends(require_auth)
) -> UserModerationHistoryResponse:
    """
    Get a user's moderation history (admin only).
    Shows warnings, actions taken, and report count.
    """
    env = request.scope["env"]
    await check_admin(env, user_id)

    try:
        # Get user info
        user = await env.DB.prepare(
            "SELECT id, name, email FROM users WHERE id = ?"
        ).bind(target_user_id).first()

        if user and hasattr(user, 'to_py'):
            user = user.to_py()

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Get warnings
        warnings_result = await env.DB.prepare(
            """SELECT w.id, w.user_id, w.warning_type, w.message, w.issued_by, w.created_at,
                      u.name as issuer_name
               FROM user_warnings w
               LEFT JOIN users u ON w.issued_by = u.id
               WHERE w.user_id = ?
               ORDER BY w.created_at DESC"""
        ).bind(target_user_id).all()

        if hasattr(warnings_result, 'to_py'):
            warnings_result = warnings_result.to_py()

        warnings = [
            UserWarningResponse(
                id=row["id"],
                user_id=row["user_id"],
                warning_type=row["warning_type"],
                message=row["message"],
                issued_by=row["issued_by"],
                issued_by_name=to_python(row.get("issuer_name")),
                created_at=str(row["created_at"])
            )
            for row in warnings_result.get("results", [])
        ]

        # Get moderation actions
        actions_result = await env.DB.prepare(
            """SELECT a.id, a.report_id, a.action_type, a.target_user_id, a.moderator_id, a.reason, a.created_at,
                      u.name as target_name, m.name as mod_name
               FROM moderation_actions a
               LEFT JOIN users u ON a.target_user_id = u.id
               LEFT JOIN users m ON a.moderator_id = m.id
               WHERE a.target_user_id = ?
               ORDER BY a.created_at DESC"""
        ).bind(target_user_id).all()

        if hasattr(actions_result, 'to_py'):
            actions_result = actions_result.to_py()

        actions = [
            ModerationActionResponse(
                id=row["id"],
                report_id=to_python(row.get("report_id")),
                action_type=row["action_type"],
                target_user_id=row["target_user_id"],
                target_user_name=to_python(row.get("target_name")),
                moderator_id=row["moderator_id"],
                moderator_name=to_python(row.get("mod_name")),
                reason=row["reason"],
                created_at=str(row["created_at"])
            )
            for row in actions_result.get("results", [])
        ]

        # Get report count (how many times this user's content has been reported)
        report_count_result = await env.DB.prepare(
            """SELECT COUNT(*) as count FROM reports r
               WHERE (r.content_type = 'profile' AND r.content_id = ?)
                  OR (r.content_type = 'post' AND r.content_id IN (SELECT id FROM forum_posts WHERE user_id = ?))
                  OR (r.content_type = 'comment' AND r.content_id IN (SELECT id FROM forum_comments WHERE user_id = ?))"""
        ).bind(target_user_id, target_user_id, target_user_id).first()

        if report_count_result and hasattr(report_count_result, 'to_py'):
            report_count_result = report_count_result.to_py()

        report_count = report_count_result.get("count", 0) if report_count_result else 0

        return UserModerationHistoryResponse(
            user_id=target_user_id,
            user_name=to_python(user.get("name")),
            user_email=to_python(user.get("email")),
            warnings=warnings,
            actions=actions,
            report_count=report_count
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching user history: {str(e)}")
