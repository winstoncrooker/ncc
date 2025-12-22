"""
Forum Posts API routes
CRUD for posts and aggregated feed with hot ranking
"""

from fastapi import APIRouter, Request, HTTPException, Depends, Query
from pydantic import BaseModel
from datetime import datetime
import math
import json
from .auth import require_auth

router = APIRouter()


def safe_value(val, default=None):
    """Convert JsNull/JsProxy to Python None, return value otherwise."""
    if val is None:
        return default
    type_str = str(type(val))
    if 'JsProxy' in type_str or 'JsNull' in type_str:
        return default
    return val

# Epoch for hot score calculation (Jan 1, 2024)
EPOCH = datetime(2024, 1, 1).timestamp()


def calculate_hot_score(upvotes: int, downvotes: int, created_at: str) -> float:
    """
    Calculate Reddit-style hot score.
    Higher scores = more visibility in feed.
    """
    score = upvotes - downvotes
    order = math.log10(max(abs(score), 1))
    sign = 1 if score > 0 else -1 if score < 0 else 0

    # Parse created_at timestamp
    try:
        if isinstance(created_at, str):
            dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            seconds = dt.timestamp() - EPOCH
        else:
            seconds = created_at - EPOCH
    except Exception:
        seconds = 0

    # ~12.5 hour half-life
    return round(sign * order + seconds / 45000, 7)


class PostAuthor(BaseModel):
    """Post author info"""
    id: int
    name: str | None = None
    picture: str | None = None


class PostResponse(BaseModel):
    """Forum post response"""
    id: int
    user_id: int
    author: PostAuthor
    category_id: int
    category_slug: str | None = None
    category_name: str | None = None
    interest_group_id: int | None = None
    interest_group_name: str | None = None
    post_type: str
    title: str
    body: str
    images: list[str] = []
    upvote_count: int = 0
    downvote_count: int = 0
    comment_count: int = 0
    hot_score: float = 0
    is_pinned: bool = False
    is_locked: bool = False
    user_vote: int | None = None
    is_saved: bool = False
    created_at: str
    updated_at: str


class FeedResponse(BaseModel):
    """Paginated feed response"""
    posts: list[PostResponse]
    cursor: str | None = None
    has_more: bool


class CreatePostRequest(BaseModel):
    """Create post request"""
    category_id: int
    interest_group_id: int | None = None
    post_type: str = "discussion"
    title: str
    body: str
    images: list[str] = []


class UpdatePostRequest(BaseModel):
    """Update post request"""
    title: str | None = None
    body: str | None = None
    images: list[str] | None = None


@router.get("/feed")
async def get_feed(
    request: Request,
    sort: str = Query("hot", regex="^(hot|new|top)$"),
    category: str | None = None,
    interest_group_id: int | None = None,
    post_type: str | None = None,
    cursor: str | None = None,
    limit: int = Query(20, ge=1, le=50),
    user_id: int = Depends(require_auth)
) -> FeedResponse:
    """
    Get aggregated feed from user's joined interests.
    Supports hot/new/top sorting and filtering.
    """
    env = request.scope["env"]

    try:
        # Build base query conditions
        conditions = []
        params = []

        # Filter by user's interests if no specific category
        if not category and not interest_group_id:
            # Get user's joined categories and groups
            interests = await env.DB.prepare(
                """SELECT category_id, interest_group_id FROM user_interests WHERE user_id = ?"""
            ).bind(user_id).all()

            if hasattr(interests, 'to_py'):
                interests = interests.to_py()

            category_ids = []
            group_ids = []
            for row in interests.get("results", []):
                if row.get("category_id"):
                    category_ids.append(row["category_id"])
                if row.get("interest_group_id"):
                    group_ids.append(row["interest_group_id"])

            if category_ids or group_ids:
                interest_conditions = []
                if category_ids:
                    placeholders = ",".join(["?" for _ in category_ids])
                    interest_conditions.append(f"p.category_id IN ({placeholders})")
                    params.extend(category_ids)
                if group_ids:
                    placeholders = ",".join(["?" for _ in group_ids])
                    interest_conditions.append(f"p.interest_group_id IN ({placeholders})")
                    params.extend(group_ids)
                conditions.append(f"({' OR '.join(interest_conditions)})")

        # Filter by specific category
        if category:
            cat = await env.DB.prepare(
                "SELECT id FROM categories WHERE slug = ?"
            ).bind(category).first()
            if cat and hasattr(cat, 'to_py'):
                cat = cat.to_py()
            if cat:
                conditions.append("p.category_id = ?")
                params.append(cat["id"])

        # Filter by interest group
        if interest_group_id:
            conditions.append("p.interest_group_id = ?")
            params.append(interest_group_id)

        # Filter by post type
        if post_type:
            conditions.append("p.post_type = ?")
            params.append(post_type)

        # Cursor pagination
        if cursor:
            if sort == "hot":
                conditions.append("p.hot_score < ?")
                params.append(float(cursor))
            elif sort == "new":
                conditions.append("p.created_at < ?")
                params.append(cursor)
            elif sort == "top":
                conditions.append("(p.upvote_count - p.downvote_count) < ?")
                params.append(int(cursor))

        # Build ORDER BY
        order_by = {
            "hot": "p.hot_score DESC, p.created_at DESC",
            "new": "p.created_at DESC",
            "top": "(p.upvote_count - p.downvote_count) DESC, p.created_at DESC"
        }.get(sort, "p.hot_score DESC")

        # Build WHERE clause
        where = " AND ".join(conditions) if conditions else "1=1"

        # Query posts
        query = f"""
            SELECT p.id, p.user_id, p.category_id, p.interest_group_id, p.post_type,
                   p.title, p.body, p.images, p.upvote_count, p.downvote_count,
                   p.comment_count, p.hot_score, p.is_pinned, p.is_locked,
                   p.created_at, p.updated_at,
                   u.name as author_name, u.picture as author_picture,
                   c.slug as category_slug, c.name as category_name,
                   ig.name as interest_group_name,
                   v.value as user_vote,
                   CASE WHEN sp.id IS NOT NULL THEN 1 ELSE 0 END as is_saved
            FROM forum_posts p
            JOIN users u ON p.user_id = u.id
            JOIN categories c ON p.category_id = c.id
            LEFT JOIN interest_groups ig ON p.interest_group_id = ig.id
            LEFT JOIN votes v ON v.post_id = p.id AND v.user_id = ?
            LEFT JOIN saved_posts sp ON sp.post_id = p.id AND sp.user_id = ?
            WHERE {where}
            ORDER BY p.is_pinned DESC, {order_by}
            LIMIT ?
        """

        # Add user_id for vote/saved joins at the beginning
        all_params = [user_id, user_id] + params + [limit + 1]

        result = await env.DB.prepare(query).bind(*all_params).all()

        if hasattr(result, 'to_py'):
            result = result.to_py()

        rows = result.get("results", [])
        has_more = len(rows) > limit
        posts_data = rows[:limit]

        posts = []
        for row in posts_data:
            images = []
            images_val = safe_value(row.get("images"))
            if images_val:
                try:
                    images = json.loads(images_val)
                except Exception:
                    images = []

            posts.append(PostResponse(
                id=row["id"],
                user_id=row["user_id"],
                author=PostAuthor(
                    id=row["user_id"],
                    name=safe_value(row.get("author_name")),
                    picture=safe_value(row.get("author_picture"))
                ),
                category_id=row["category_id"],
                category_slug=safe_value(row.get("category_slug")),
                category_name=safe_value(row.get("category_name")),
                interest_group_id=safe_value(row.get("interest_group_id")),
                interest_group_name=safe_value(row.get("interest_group_name")),
                post_type=row["post_type"],
                title=row["title"],
                body=row["body"],
                images=images,
                upvote_count=safe_value(row.get("upvote_count"), 0),
                downvote_count=safe_value(row.get("downvote_count"), 0),
                comment_count=safe_value(row.get("comment_count"), 0),
                hot_score=safe_value(row.get("hot_score"), 0),
                is_pinned=bool(safe_value(row.get("is_pinned"), 0)),
                is_locked=bool(safe_value(row.get("is_locked"), 0)),
                user_vote=safe_value(row.get("user_vote")),
                is_saved=bool(safe_value(row.get("is_saved"), 0)),
                created_at=str(row["created_at"]),
                updated_at=str(row["updated_at"])
            ))

        # Calculate cursor for next page
        next_cursor = None
        if has_more and posts:
            last_post = posts[-1]
            if sort == "hot":
                next_cursor = str(last_post.hot_score)
            elif sort == "new":
                next_cursor = last_post.created_at
            elif sort == "top":
                next_cursor = str(last_post.upvote_count - last_post.downvote_count)

        return FeedResponse(
            posts=posts,
            cursor=next_cursor,
            has_more=has_more
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching feed: {str(e)}")


@router.get("/{post_id}")
async def get_post(
    request: Request,
    post_id: int,
    user_id: int = Depends(require_auth)
) -> PostResponse:
    """Get a single post by ID."""
    env = request.scope["env"]

    try:
        result = await env.DB.prepare(
            """SELECT p.id, p.user_id, p.category_id, p.interest_group_id, p.post_type,
                      p.title, p.body, p.images, p.upvote_count, p.downvote_count,
                      p.comment_count, p.hot_score, p.is_pinned, p.is_locked,
                      p.created_at, p.updated_at,
                      u.name as author_name, u.picture as author_picture,
                      c.slug as category_slug, c.name as category_name,
                      ig.name as interest_group_name,
                      v.value as user_vote,
                      CASE WHEN sp.id IS NOT NULL THEN 1 ELSE 0 END as is_saved
               FROM forum_posts p
               JOIN users u ON p.user_id = u.id
               JOIN categories c ON p.category_id = c.id
               LEFT JOIN interest_groups ig ON p.interest_group_id = ig.id
               LEFT JOIN votes v ON v.post_id = p.id AND v.user_id = ?
               LEFT JOIN saved_posts sp ON sp.post_id = p.id AND sp.user_id = ?
               WHERE p.id = ?"""
        ).bind(user_id, user_id, post_id).first()

        if result and hasattr(result, 'to_py'):
            result = result.to_py()

        if not result:
            raise HTTPException(status_code=404, detail="Post not found")

        images = []
        images_val = safe_value(result.get("images"))
        if images_val:
            try:
                images = json.loads(images_val)
            except Exception:
                images = []

        return PostResponse(
            id=result["id"],
            user_id=result["user_id"],
            author=PostAuthor(
                id=result["user_id"],
                name=safe_value(result.get("author_name")),
                picture=safe_value(result.get("author_picture"))
            ),
            category_id=result["category_id"],
            category_slug=safe_value(result.get("category_slug")),
            category_name=safe_value(result.get("category_name")),
            interest_group_id=safe_value(result.get("interest_group_id")),
            interest_group_name=safe_value(result.get("interest_group_name")),
            post_type=result["post_type"],
            title=result["title"],
            body=result["body"],
            images=images,
            upvote_count=safe_value(result.get("upvote_count"), 0),
            downvote_count=safe_value(result.get("downvote_count"), 0),
            comment_count=safe_value(result.get("comment_count"), 0),
            hot_score=safe_value(result.get("hot_score"), 0),
            is_pinned=bool(safe_value(result.get("is_pinned"), 0)),
            is_locked=bool(safe_value(result.get("is_locked"), 0)),
            user_vote=safe_value(result.get("user_vote")),
            is_saved=bool(safe_value(result.get("is_saved"), 0)),
            created_at=str(result["created_at"]),
            updated_at=str(result["updated_at"])
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching post: {str(e)}")


@router.post("")
async def create_post(
    request: Request,
    body: CreatePostRequest,
    user_id: int = Depends(require_auth)
) -> PostResponse:
    """Create a new forum post."""
    env = request.scope["env"]

    # Validate post type
    valid_types = ["discussion", "showcase", "wtt_wts", "question", "poll", "event"]
    if body.post_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid post type. Must be one of: {valid_types}")

    try:
        # Verify category exists
        category = await env.DB.prepare(
            "SELECT id, slug, name FROM categories WHERE id = ?"
        ).bind(body.category_id).first()

        if category and hasattr(category, 'to_py'):
            category = category.to_py()

        if not category:
            raise HTTPException(status_code=404, detail="Category not found")

        # Verify interest group if provided
        interest_group_name = None
        if body.interest_group_id:
            group = await env.DB.prepare(
                "SELECT id, name FROM interest_groups WHERE id = ? AND category_id = ?"
            ).bind(body.interest_group_id, body.category_id).first()

            if group and hasattr(group, 'to_py'):
                group = group.to_py()

            if not group:
                raise HTTPException(status_code=404, detail="Interest group not found")

            interest_group_name = group["name"]

        # Calculate initial hot score
        hot_score = calculate_hot_score(0, 0, datetime.utcnow().isoformat())

        # Insert post
        images_json = json.dumps(body.images) if body.images else "[]"

        result = await env.DB.prepare(
            """INSERT INTO forum_posts
               (user_id, category_id, interest_group_id, post_type, title, body, images, hot_score)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)
               RETURNING id, created_at, updated_at"""
        ).bind(
            user_id, body.category_id, body.interest_group_id,
            body.post_type, body.title, body.body, images_json, hot_score
        ).first()

        if hasattr(result, 'to_py'):
            result = result.to_py()

        # Update post count if in an interest group
        if body.interest_group_id:
            await env.DB.prepare(
                "UPDATE interest_groups SET post_count = post_count + 1 WHERE id = ?"
            ).bind(body.interest_group_id).run()

        # Get author info
        author = await env.DB.prepare(
            "SELECT id, name, picture FROM users WHERE id = ?"
        ).bind(user_id).first()

        if author and hasattr(author, 'to_py'):
            author = author.to_py()

        return PostResponse(
            id=result["id"],
            user_id=user_id,
            author=PostAuthor(
                id=user_id,
                name=safe_value(author.get("name")) if author else None,
                picture=safe_value(author.get("picture")) if author else None
            ),
            category_id=body.category_id,
            category_slug=category["slug"],
            category_name=category["name"],
            interest_group_id=body.interest_group_id,  # Already a Python value from Pydantic
            interest_group_name=interest_group_name,    # Already a Python value
            post_type=body.post_type,
            title=body.title,
            body=body.body,
            images=body.images or [],
            upvote_count=0,
            downvote_count=0,
            comment_count=0,
            hot_score=hot_score,
            is_pinned=False,
            is_locked=False,
            user_vote=None,
            is_saved=False,
            created_at=str(result["created_at"]),
            updated_at=str(result["updated_at"])
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating post: {str(e)}")


@router.put("/{post_id}")
async def update_post(
    request: Request,
    post_id: int,
    body: UpdatePostRequest,
    user_id: int = Depends(require_auth)
) -> PostResponse:
    """Update an existing post (own posts only)."""
    env = request.scope["env"]

    try:
        # Check ownership
        existing = await env.DB.prepare(
            "SELECT user_id, is_locked FROM forum_posts WHERE id = ?"
        ).bind(post_id).first()

        if existing and hasattr(existing, 'to_py'):
            existing = existing.to_py()

        if not existing:
            raise HTTPException(status_code=404, detail="Post not found")

        if existing["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not your post")

        if existing.get("is_locked"):
            raise HTTPException(status_code=403, detail="Post is locked")

        # Build update
        updates = []
        params = []

        if body.title is not None:
            updates.append("title = ?")
            params.append(body.title)

        if body.body is not None:
            updates.append("body = ?")
            params.append(body.body)

        if body.images is not None:
            updates.append("images = ?")
            params.append(json.dumps(body.images))

        if not updates:
            raise HTTPException(status_code=400, detail="No updates provided")

        updates.append("updated_at = CURRENT_TIMESTAMP")
        params.append(post_id)

        await env.DB.prepare(
            f"UPDATE forum_posts SET {', '.join(updates)} WHERE id = ?"
        ).bind(*params).run()

        # Return updated post
        return await get_post(request, post_id, user_id)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating post: {str(e)}")


@router.delete("/{post_id}")
async def delete_post(
    request: Request,
    post_id: int,
    user_id: int = Depends(require_auth)
) -> dict:
    """Delete a post (own posts only)."""
    env = request.scope["env"]

    try:
        # Check ownership
        existing = await env.DB.prepare(
            "SELECT user_id, interest_group_id FROM forum_posts WHERE id = ?"
        ).bind(post_id).first()

        if existing and hasattr(existing, 'to_py'):
            existing = existing.to_py()

        if not existing:
            raise HTTPException(status_code=404, detail="Post not found")

        if existing["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not your post")

        # Delete post (cascade will handle comments, votes, saves)
        await env.DB.prepare(
            "DELETE FROM forum_posts WHERE id = ?"
        ).bind(post_id).run()

        # Update post count if was in an interest group
        if existing.get("interest_group_id"):
            await env.DB.prepare(
                "UPDATE interest_groups SET post_count = MAX(0, post_count - 1) WHERE id = ?"
            ).bind(existing["interest_group_id"]).run()

        return {"success": True, "message": "Post deleted"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting post: {str(e)}")


@router.post("/{post_id}/save")
async def save_post(
    request: Request,
    post_id: int,
    user_id: int = Depends(require_auth)
) -> dict:
    """Save/bookmark a post."""
    env = request.scope["env"]

    try:
        # Check post exists
        existing = await env.DB.prepare(
            "SELECT id FROM forum_posts WHERE id = ?"
        ).bind(post_id).first()

        if existing and hasattr(existing, 'to_py'):
            existing = existing.to_py()

        if not existing:
            raise HTTPException(status_code=404, detail="Post not found")

        # Check if already saved
        saved = await env.DB.prepare(
            "SELECT id FROM saved_posts WHERE user_id = ? AND post_id = ?"
        ).bind(user_id, post_id).first()

        if saved and hasattr(saved, 'to_py'):
            saved = saved.to_py()

        if saved:
            return {"success": True, "saved": True, "message": "Already saved"}

        # Save post
        await env.DB.prepare(
            "INSERT INTO saved_posts (user_id, post_id) VALUES (?, ?)"
        ).bind(user_id, post_id).run()

        return {"success": True, "saved": True, "message": "Post saved"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving post: {str(e)}")


@router.delete("/{post_id}/save")
async def unsave_post(
    request: Request,
    post_id: int,
    user_id: int = Depends(require_auth)
) -> dict:
    """Remove a post from saved."""
    env = request.scope["env"]

    try:
        await env.DB.prepare(
            "DELETE FROM saved_posts WHERE user_id = ? AND post_id = ?"
        ).bind(user_id, post_id).run()

        return {"success": True, "saved": False, "message": "Post unsaved"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error unsaving post: {str(e)}")
