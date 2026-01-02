"""
Admin API routes
User listing, analytics, and moderation for admin purposes
"""

from fastapi import APIRouter, Request, HTTPException, Depends, Query
from pydantic import BaseModel
from .auth import require_auth, require_auth

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


class AnalyticsResponse(BaseModel):
    """Admin analytics data"""
    total_users: int
    total_collections: int
    total_posts: int
    total_comments: int
    users_last_7_days: int
    users_last_30_days: int
    posts_last_7_days: int
    top_categories: list[dict]
    collection_stats: dict


class PostAuthor(BaseModel):
    """Post author info for moderation"""
    id: int
    name: str | None = None
    email: str | None = None


class ModPostItem(BaseModel):
    """Post item for moderation list"""
    id: int
    title: str
    body: str
    author: PostAuthor
    category_name: str | None = None
    post_type: str
    upvote_count: int = 0
    downvote_count: int = 0
    comment_count: int = 0
    is_pinned: bool = False
    is_locked: bool = False
    created_at: str | None = None


class ModPostsResponse(BaseModel):
    """List of posts for moderation"""
    posts: list[ModPostItem]
    total: int


class ModCommentItem(BaseModel):
    """Comment item for moderation list"""
    id: int
    post_id: int
    post_title: str
    body: str
    author: PostAuthor
    upvote_count: int = 0
    downvote_count: int = 0
    created_at: str | None = None


class ModCommentsResponse(BaseModel):
    """List of comments for moderation"""
    comments: list[ModCommentItem]
    total: int


# Admin emails are read from environment variable ADMIN_EMAILS (comma-separated)
# Fallback to empty list if not set (no admins)
def get_admin_emails(env) -> list[str]:
    """Get admin emails from environment variable."""
    if hasattr(env, 'ADMIN_EMAILS'):
        return [e.strip() for e in str(env.ADMIN_EMAILS).split(',') if e.strip()]
    return []


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
        admin_emails = get_admin_emails(env)
        admin_emails_lower = [e.lower().strip() for e in admin_emails]

        if email_lower not in admin_emails_lower:
            raise HTTPException(status_code=403, detail=f"Admin access required - email '{email_lower}' not in admin list")

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

        def to_python(val):
            """Convert JsNull to None"""
            if val is None or (hasattr(val, '__class__') and 'JsNull' in str(type(val))):
                return None
            return val

        users = []
        for row in rows:
            users.append(UserListItem(
                id=row["id"],
                email=to_python(row.get("email")),
                name=to_python(row.get("name")),
                picture=to_python(row.get("picture")),
                created_at=str(row.get("created_at")) if to_python(row.get("created_at")) else None
            ))

        return UserListResponse(
            users=users,
            total=len(users)
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching users: {str(e)}")


async def check_admin(env, user_id: int):
    """Check if user is admin, raise 403 if not"""
    admin_check = await env.DB.prepare(
        "SELECT email FROM users WHERE id = ?"
    ).bind(user_id).first()

    if admin_check and hasattr(admin_check, 'to_py'):
        admin_check = admin_check.to_py()

    if not admin_check:
        raise HTTPException(status_code=403, detail="Admin access required")

    email = admin_check.get("email", "") if isinstance(admin_check, dict) else None
    admin_emails = get_admin_emails(env)
    if not email or email.lower().strip() not in [e.lower().strip() for e in admin_emails]:
        raise HTTPException(status_code=403, detail="Admin access required")


@router.get("/analytics")
async def get_analytics(
    request: Request,
    user_id: int = Depends(require_auth)
) -> AnalyticsResponse:
    """
    Get platform analytics (admin only).
    Returns user counts, collection stats, post activity.
    """
    env = request.scope["env"]
    await check_admin(env, user_id)

    def to_int(val):
        if val is None or (hasattr(val, '__class__') and 'JsNull' in str(type(val))):
            return 0
        return int(val) if val else 0

    try:
        # Total users
        total_users_result = await env.DB.prepare(
            "SELECT COUNT(*) as count FROM users"
        ).first()
        if total_users_result and hasattr(total_users_result, 'to_py'):
            total_users_result = total_users_result.to_py()
        total_users = to_int(total_users_result.get("count")) if total_users_result else 0

        # Total collections
        total_collections_result = await env.DB.prepare(
            "SELECT COUNT(*) as count FROM collections"
        ).first()
        if total_collections_result and hasattr(total_collections_result, 'to_py'):
            total_collections_result = total_collections_result.to_py()
        total_collections = to_int(total_collections_result.get("count")) if total_collections_result else 0

        # Total posts
        total_posts_result = await env.DB.prepare(
            "SELECT COUNT(*) as count FROM forum_posts"
        ).first()
        if total_posts_result and hasattr(total_posts_result, 'to_py'):
            total_posts_result = total_posts_result.to_py()
        total_posts = to_int(total_posts_result.get("count")) if total_posts_result else 0

        # Total comments
        total_comments_result = await env.DB.prepare(
            "SELECT COUNT(*) as count FROM forum_comments"
        ).first()
        if total_comments_result and hasattr(total_comments_result, 'to_py'):
            total_comments_result = total_comments_result.to_py()
        total_comments = to_int(total_comments_result.get("count")) if total_comments_result else 0

        # Users in last 7 days
        users_7d_result = await env.DB.prepare(
            "SELECT COUNT(*) as count FROM users WHERE created_at > datetime('now', '-7 days')"
        ).first()
        if users_7d_result and hasattr(users_7d_result, 'to_py'):
            users_7d_result = users_7d_result.to_py()
        users_7d = to_int(users_7d_result.get("count")) if users_7d_result else 0

        # Users in last 30 days
        users_30d_result = await env.DB.prepare(
            "SELECT COUNT(*) as count FROM users WHERE created_at > datetime('now', '-30 days')"
        ).first()
        if users_30d_result and hasattr(users_30d_result, 'to_py'):
            users_30d_result = users_30d_result.to_py()
        users_30d = to_int(users_30d_result.get("count")) if users_30d_result else 0

        # Posts in last 7 days
        posts_7d_result = await env.DB.prepare(
            "SELECT COUNT(*) as count FROM forum_posts WHERE created_at > datetime('now', '-7 days')"
        ).first()
        if posts_7d_result and hasattr(posts_7d_result, 'to_py'):
            posts_7d_result = posts_7d_result.to_py()
        posts_7d = to_int(posts_7d_result.get("count")) if posts_7d_result else 0

        # All categories by collection count (no limit)
        top_cats_result = await env.DB.prepare(
            """SELECT c.name, COUNT(col.id) as count
               FROM categories c
               LEFT JOIN collections col ON col.category_id = c.id
               GROUP BY c.id
               ORDER BY count DESC"""
        ).all()
        if hasattr(top_cats_result, 'to_py'):
            top_cats_result = top_cats_result.to_py()
        top_categories = [
            {"name": row.get("name", "Unknown"), "count": to_int(row.get("count"))}
            for row in top_cats_result.get("results", [])
        ]

        # Collection stats
        collection_stats_result = await env.DB.prepare(
            """SELECT
                 AVG(item_count) as avg_per_user,
                 MAX(item_count) as max_per_user
               FROM (SELECT user_id, COUNT(*) as item_count FROM collections GROUP BY user_id)"""
        ).first()
        if collection_stats_result and hasattr(collection_stats_result, 'to_py'):
            collection_stats_result = collection_stats_result.to_py()
        collection_stats = {
            "avg_per_user": round(float(collection_stats_result.get("avg_per_user") or 0), 1),
            "max_per_user": to_int(collection_stats_result.get("max_per_user"))
        } if collection_stats_result else {"avg_per_user": 0, "max_per_user": 0}

        return AnalyticsResponse(
            total_users=total_users,
            total_collections=total_collections,
            total_posts=total_posts,
            total_comments=total_comments,
            users_last_7_days=users_7d,
            users_last_30_days=users_30d,
            posts_last_7_days=posts_7d,
            top_categories=top_categories,
            collection_stats=collection_stats
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching analytics: {str(e)}")


def to_python(val):
    """Convert JsNull/JsProxy to Python None"""
    if val is None:
        return None
    type_str = str(type(val))
    if 'JsProxy' in type_str or 'JsNull' in type_str:
        return None
    return val


@router.get("/posts")
async def list_posts(
    request: Request,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user_id: int = Depends(require_auth)
) -> ModPostsResponse:
    """List all posts for moderation (admin only)."""
    env = request.scope["env"]
    await check_admin(env, user_id)

    try:
        # Get total count
        count_result = await env.DB.prepare(
            "SELECT COUNT(*) as count FROM forum_posts"
        ).first()
        if count_result and hasattr(count_result, 'to_py'):
            count_result = count_result.to_py()
        total = count_result.get("count", 0) if count_result else 0

        # Get posts with author info and calculate actual vote counts from votes table
        result = await env.DB.prepare(
            """SELECT p.id, p.title, p.body, p.post_type,
                      COALESCE(SUM(CASE WHEN v.value = 1 THEN 1 ELSE 0 END), 0) as upvote_count,
                      COALESCE(SUM(CASE WHEN v.value = -1 THEN 1 ELSE 0 END), 0) as downvote_count,
                      p.comment_count, p.is_pinned, p.is_locked, p.created_at,
                      u.id as author_id, u.name as author_name, u.email as author_email,
                      c.name as category_name
               FROM forum_posts p
               JOIN users u ON p.user_id = u.id
               LEFT JOIN categories c ON p.category_id = c.id
               LEFT JOIN votes v ON v.post_id = p.id
               GROUP BY p.id
               ORDER BY p.created_at DESC
               LIMIT ? OFFSET ?"""
        ).bind(limit, offset).all()

        if hasattr(result, 'to_py'):
            result = result.to_py()

        posts = []
        for row in result.get("results", []):
            posts.append(ModPostItem(
                id=row["id"],
                title=row["title"],
                body=row["body"][:200] + "..." if len(row["body"]) > 200 else row["body"],
                author=PostAuthor(
                    id=row["author_id"],
                    name=to_python(row.get("author_name")),
                    email=to_python(row.get("author_email"))
                ),
                category_name=to_python(row.get("category_name")),
                post_type=row["post_type"],
                upvote_count=row.get("upvote_count", 0) or 0,
                downvote_count=row.get("downvote_count", 0) or 0,
                comment_count=row.get("comment_count", 0) or 0,
                is_pinned=bool(row.get("is_pinned", 0)),
                is_locked=bool(row.get("is_locked", 0)),
                created_at=str(row["created_at"]) if row.get("created_at") else None
            ))

        return ModPostsResponse(posts=posts, total=total)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching posts: {str(e)}")


@router.delete("/posts/{post_id}")
async def delete_post(
    request: Request,
    post_id: int,
    user_id: int = Depends(require_auth)
) -> dict:
    """Delete any post (admin only)."""
    env = request.scope["env"]
    await check_admin(env, user_id)

    try:
        # Check post exists
        existing = await env.DB.prepare(
            "SELECT id, interest_group_id FROM forum_posts WHERE id = ?"
        ).bind(post_id).first()

        if existing and hasattr(existing, 'to_py'):
            existing = existing.to_py()

        if not existing:
            raise HTTPException(status_code=404, detail="Post not found")

        # Delete post (cascade handles comments, votes, saves)
        await env.DB.prepare(
            "DELETE FROM forum_posts WHERE id = ?"
        ).bind(post_id).run()

        # Update interest group post count if applicable
        if existing.get("interest_group_id"):
            await env.DB.prepare(
                "UPDATE interest_groups SET post_count = MAX(0, post_count - 1) WHERE id = ?"
            ).bind(existing["interest_group_id"]).run()

        return {"success": True, "message": "Post deleted"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting post: {str(e)}")


@router.put("/posts/{post_id}/pin")
async def toggle_pin_post(
    request: Request,
    post_id: int,
    user_id: int = Depends(require_auth)
) -> dict:
    """Toggle pin status on a post (admin only)."""
    env = request.scope["env"]
    await check_admin(env, user_id)

    try:
        # Get current state
        existing = await env.DB.prepare(
            "SELECT is_pinned FROM forum_posts WHERE id = ?"
        ).bind(post_id).first()

        if existing and hasattr(existing, 'to_py'):
            existing = existing.to_py()

        if not existing:
            raise HTTPException(status_code=404, detail="Post not found")

        new_state = 0 if existing.get("is_pinned") else 1

        await env.DB.prepare(
            "UPDATE forum_posts SET is_pinned = ? WHERE id = ?"
        ).bind(new_state, post_id).run()

        return {"success": True, "is_pinned": bool(new_state)}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error toggling pin: {str(e)}")


@router.put("/posts/{post_id}/lock")
async def toggle_lock_post(
    request: Request,
    post_id: int,
    user_id: int = Depends(require_auth)
) -> dict:
    """Toggle lock status on a post (admin only)."""
    env = request.scope["env"]
    await check_admin(env, user_id)

    try:
        # Get current state
        existing = await env.DB.prepare(
            "SELECT is_locked FROM forum_posts WHERE id = ?"
        ).bind(post_id).first()

        if existing and hasattr(existing, 'to_py'):
            existing = existing.to_py()

        if not existing:
            raise HTTPException(status_code=404, detail="Post not found")

        new_state = 0 if existing.get("is_locked") else 1

        await env.DB.prepare(
            "UPDATE forum_posts SET is_locked = ? WHERE id = ?"
        ).bind(new_state, post_id).run()

        return {"success": True, "is_locked": bool(new_state)}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error toggling lock: {str(e)}")


@router.get("/comments")
async def list_comments(
    request: Request,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user_id: int = Depends(require_auth)
) -> ModCommentsResponse:
    """List all comments for moderation (admin only)."""
    env = request.scope["env"]
    await check_admin(env, user_id)

    try:
        # Get total count
        count_result = await env.DB.prepare(
            "SELECT COUNT(*) as count FROM forum_comments"
        ).first()
        if count_result and hasattr(count_result, 'to_py'):
            count_result = count_result.to_py()
        total = count_result.get("count", 0) if count_result else 0

        # Get comments with author and post info, calculate actual vote counts
        result = await env.DB.prepare(
            """SELECT c.id, c.post_id, c.body, c.created_at,
                      COALESCE(SUM(CASE WHEN v.value = 1 THEN 1 ELSE 0 END), 0) as upvote_count,
                      COALESCE(SUM(CASE WHEN v.value = -1 THEN 1 ELSE 0 END), 0) as downvote_count,
                      u.id as author_id, u.name as author_name, u.email as author_email,
                      p.title as post_title
               FROM forum_comments c
               JOIN users u ON c.user_id = u.id
               JOIN forum_posts p ON c.post_id = p.id
               LEFT JOIN votes v ON v.comment_id = c.id
               GROUP BY c.id
               ORDER BY c.created_at DESC
               LIMIT ? OFFSET ?"""
        ).bind(limit, offset).all()

        if hasattr(result, 'to_py'):
            result = result.to_py()

        comments = []
        for row in result.get("results", []):
            comments.append(ModCommentItem(
                id=row["id"],
                post_id=row["post_id"],
                post_title=row.get("post_title", "Unknown post"),
                body=row["body"][:200] + "..." if len(row["body"]) > 200 else row["body"],
                author=PostAuthor(
                    id=row["author_id"],
                    name=to_python(row.get("author_name")),
                    email=to_python(row.get("author_email"))
                ),
                upvote_count=row.get("upvote_count", 0) or 0,
                downvote_count=row.get("downvote_count", 0) or 0,
                created_at=str(row["created_at"]) if row.get("created_at") else None
            ))

        return ModCommentsResponse(comments=comments, total=total)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching comments: {str(e)}")


@router.delete("/comments/{comment_id}")
async def delete_comment(
    request: Request,
    comment_id: int,
    user_id: int = Depends(require_auth)
) -> dict:
    """Delete any comment (admin only)."""
    env = request.scope["env"]
    await check_admin(env, user_id)

    try:
        # Get post_id for updating comment count
        existing = await env.DB.prepare(
            "SELECT post_id FROM forum_comments WHERE id = ?"
        ).bind(comment_id).first()

        if existing and hasattr(existing, 'to_py'):
            existing = existing.to_py()

        if not existing:
            raise HTTPException(status_code=404, detail="Comment not found")

        post_id = existing["post_id"]

        # Delete comment (cascade handles child comments and votes)
        await env.DB.prepare(
            "DELETE FROM forum_comments WHERE id = ?"
        ).bind(comment_id).run()

        # Update post comment count
        await env.DB.prepare(
            "UPDATE forum_posts SET comment_count = MAX(0, comment_count - 1) WHERE id = ?"
        ).bind(post_id).run()

        return {"success": True, "message": "Comment deleted"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting comment: {str(e)}")


class UserMembershipItem(BaseModel):
    """User membership in category or group"""
    interest_id: int
    category_id: int | None = None
    category_name: str | None = None
    category_icon: str | None = None
    group_id: int | None = None
    group_name: str | None = None


class UserMembershipsResponse(BaseModel):
    """User memberships response"""
    user_id: int
    memberships: list[UserMembershipItem]


@router.get("/users/{target_user_id}/memberships")
async def get_user_memberships(
    request: Request,
    target_user_id: int,
    user_id: int = Depends(require_auth)
) -> UserMembershipsResponse:
    """Get a user's category and group memberships (admin only)."""
    env = request.scope["env"]
    await check_admin(env, user_id)

    try:
        result = await env.DB.prepare(
            """SELECT ui.id as interest_id,
                      COALESCE(ui.category_id, ig.category_id) as category_id,
                      COALESCE(c.name, gc.name) as category_name,
                      COALESCE(c.icon, gc.icon) as category_icon,
                      ui.interest_group_id as group_id,
                      ig.name as group_name
               FROM user_interests ui
               LEFT JOIN categories c ON ui.category_id = c.id
               LEFT JOIN interest_groups ig ON ui.interest_group_id = ig.id
               LEFT JOIN categories gc ON ig.category_id = gc.id
               WHERE ui.user_id = ?
               ORDER BY COALESCE(c.name, gc.name), ig.name"""
        ).bind(target_user_id).all()

        if hasattr(result, 'to_py'):
            result = result.to_py()

        memberships = []
        for row in result.get("results", []):
            memberships.append(UserMembershipItem(
                interest_id=row["interest_id"],
                category_id=to_python(row.get("category_id")),
                category_name=to_python(row.get("category_name")),
                category_icon=to_python(row.get("category_icon")),
                group_id=to_python(row.get("group_id")),
                group_name=to_python(row.get("group_name"))
            ))

        return UserMembershipsResponse(
            user_id=target_user_id,
            memberships=memberships
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching memberships: {str(e)}")
