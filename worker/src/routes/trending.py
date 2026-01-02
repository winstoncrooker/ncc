"""
Trending API routes for Niche Collector Connector
Hot posts and active/featured collectors
"""

from fastapi import APIRouter, Request, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional
import json

from routes.auth import require_auth
from utils.conversions import to_python_value

router = APIRouter()


class TrendingPostAuthor(BaseModel):
    """Author info for trending post"""
    id: int
    name: Optional[str] = None
    picture: Optional[str] = None


class TrendingPost(BaseModel):
    """Trending post response"""
    id: int
    user_id: int
    author: TrendingPostAuthor
    category_id: int
    category_slug: Optional[str] = None
    category_name: Optional[str] = None
    post_type: str
    title: str
    body: str
    images: list[str] = []
    upvote_count: int = 0
    downvote_count: int = 0
    comment_count: int = 0
    hot_score: float = 0
    created_at: str


class TrendingPostsResponse(BaseModel):
    """Trending posts response with pagination"""
    posts: list[TrendingPost]
    cursor: Optional[str] = None
    has_more: bool


class FeaturedCollector(BaseModel):
    """Featured/active collector"""
    id: int
    name: Optional[str] = None
    picture: Optional[str] = None
    bio: Optional[str] = None
    pronouns: Optional[str] = None
    collection_count: int = 0
    post_count: int = 0
    comment_count: int = 0
    activity_score: float = 0
    featured_category_id: Optional[int] = None
    featured_category_name: Optional[str] = None
    featured_category_slug: Optional[str] = None


class FeaturedCollectorsResponse(BaseModel):
    """Featured collectors response"""
    collectors: list[FeaturedCollector]


@router.get("/posts")
async def get_trending_posts(
    request: Request,
    category: Optional[str] = None,
    limit: int = Query(10, ge=1, le=50),
    cursor: Optional[str] = None,
    user_id: int = Depends(require_auth)
) -> TrendingPostsResponse:
    """
    Get trending/hot posts across the platform.
    Uses hot_score algorithm for ranking.
    Optional category filter by slug.
    """
    env = request.scope["env"]

    try:
        conditions = []
        params = []

        # Filter by category if specified
        if category:
            cat = await env.DB.prepare(
                "SELECT id FROM categories WHERE slug = ?"
            ).bind(category).first()
            if cat and hasattr(cat, 'to_py'):
                cat = cat.to_py()
            if cat:
                conditions.append("p.category_id = ?")
                params.append(cat["id"])

        # Cursor pagination using hot_score
        if cursor:
            try:
                conditions.append("p.hot_score < ?")
                params.append(float(cursor))
            except ValueError:
                pass

        where_clause = " AND ".join(conditions) if conditions else "1=1"

        # Query trending posts ordered by hot_score
        query = f"""
            SELECT p.id, p.user_id, p.category_id, p.post_type,
                   p.title, p.body, p.images, p.upvote_count, p.downvote_count,
                   p.comment_count, p.hot_score, p.created_at,
                   u.name as author_name, u.picture as author_picture,
                   c.slug as category_slug, c.name as category_name
            FROM forum_posts p
            JOIN users u ON p.user_id = u.id
            JOIN categories c ON p.category_id = c.id
            WHERE {where_clause}
            ORDER BY p.hot_score DESC, p.created_at DESC
            LIMIT ?
        """

        params.append(limit + 1)

        result = await env.DB.prepare(query).bind(*params).all()

        if hasattr(result, 'to_py'):
            result = result.to_py()

        rows = result.get("results", [])
        has_more = len(rows) > limit
        posts_data = rows[:limit]

        posts = []
        for row in posts_data:
            images = []
            images_val = to_python_value(row.get("images"))
            if images_val:
                try:
                    images = json.loads(images_val)
                except Exception:
                    images = []

            posts.append(TrendingPost(
                id=row["id"],
                user_id=row["user_id"],
                author=TrendingPostAuthor(
                    id=row["user_id"],
                    name=to_python_value(row.get("author_name")),
                    picture=to_python_value(row.get("author_picture"))
                ),
                category_id=row["category_id"],
                category_slug=to_python_value(row.get("category_slug")),
                category_name=to_python_value(row.get("category_name")),
                post_type=row["post_type"],
                title=row["title"],
                body=row["body"],
                images=images,
                upvote_count=to_python_value(row.get("upvote_count"), 0),
                downvote_count=to_python_value(row.get("downvote_count"), 0),
                comment_count=to_python_value(row.get("comment_count"), 0),
                hot_score=to_python_value(row.get("hot_score"), 0),
                created_at=str(row["created_at"])
            ))

        # Calculate next cursor
        next_cursor = None
        if has_more and posts:
            next_cursor = str(posts[-1].hot_score)

        return TrendingPostsResponse(
            posts=posts,
            cursor=next_cursor,
            has_more=has_more
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching trending posts: {str(e)}")


@router.get("/users")
async def get_featured_collectors(
    request: Request,
    category: Optional[str] = None,
    limit: int = Query(10, ge=1, le=50),
    user_id: int = Depends(require_auth)
) -> FeaturedCollectorsResponse:
    """
    Get featured/active collectors.
    Ranked by activity score (posts + comments in last 30 days).
    Only includes users with public profiles.
    """
    env = request.scope["env"]

    try:
        # Build category filter if specified
        category_filter = ""
        params = []

        if category:
            cat = await env.DB.prepare(
                "SELECT id FROM categories WHERE slug = ?"
            ).bind(category).first()
            if cat and hasattr(cat, 'to_py'):
                cat = cat.to_py()
            if cat:
                category_filter = "AND (c.category_id = ? OR ui.category_id = ?)"
                params.extend([cat["id"], cat["id"]])

        # Query active users with activity metrics
        # Activity score = posts in last 30 days * 2 + comments in last 30 days
        query = f"""
            SELECT
                u.id,
                u.name,
                u.picture,
                u.bio,
                u.pronouns,
                u.privacy_settings,
                u.featured_category_id,
                (SELECT COUNT(*) FROM collections WHERE user_id = u.id) as collection_count,
                (SELECT COUNT(*) FROM forum_posts
                 WHERE user_id = u.id
                 AND created_at > datetime('now', '-30 days')) as post_count,
                (SELECT COUNT(*) FROM forum_comments
                 WHERE user_id = u.id
                 AND created_at > datetime('now', '-30 days')) as comment_count
            FROM users u
            LEFT JOIN user_interests ui ON u.id = ui.user_id
            LEFT JOIN collections c ON u.id = c.user_id
            WHERE u.name IS NOT NULL
            AND json_extract(u.privacy_settings, '$.profile_visibility') = 'public'
            {category_filter}
            GROUP BY u.id
            HAVING (post_count + comment_count) > 0
            ORDER BY (post_count * 2 + comment_count) DESC
            LIMIT ?
        """

        params.append(limit)

        result = await env.DB.prepare(query).bind(*params).all()

        if hasattr(result, 'to_py'):
            result = result.to_py()

        collectors = []
        for row in result.get("results", []):
            post_count = to_python_value(row.get("post_count"), 0)
            comment_count = to_python_value(row.get("comment_count"), 0)
            activity_score = post_count * 2 + comment_count

            # Get featured category info if set
            featured_category_id = to_python_value(row.get("featured_category_id"))
            featured_category_name = None
            featured_category_slug = None

            if featured_category_id:
                cat_result = await env.DB.prepare(
                    "SELECT name, slug FROM categories WHERE id = ?"
                ).bind(featured_category_id).first()
                if cat_result and hasattr(cat_result, 'to_py'):
                    cat_result = cat_result.to_py()
                if cat_result:
                    featured_category_name = to_python_value(cat_result.get("name"))
                    featured_category_slug = to_python_value(cat_result.get("slug"))

            collectors.append(FeaturedCollector(
                id=row["id"],
                name=to_python_value(row.get("name")),
                picture=to_python_value(row.get("picture")),
                bio=to_python_value(row.get("bio")),
                pronouns=to_python_value(row.get("pronouns")),
                collection_count=to_python_value(row.get("collection_count"), 0),
                post_count=post_count,
                comment_count=comment_count,
                activity_score=activity_score,
                featured_category_id=featured_category_id,
                featured_category_name=featured_category_name,
                featured_category_slug=featured_category_slug
            ))

        return FeaturedCollectorsResponse(collectors=collectors)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching featured collectors: {str(e)}")


@router.get("/stats")
async def get_trending_stats(
    request: Request,
    user_id: int = Depends(require_auth)
) -> dict:
    """
    Get platform-wide trending statistics.
    """
    env = request.scope["env"]

    try:
        # Get total posts in last 24 hours
        posts_24h = await env.DB.prepare(
            """SELECT COUNT(*) as count FROM forum_posts
               WHERE created_at > datetime('now', '-1 day')"""
        ).first()
        if posts_24h and hasattr(posts_24h, 'to_py'):
            posts_24h = posts_24h.to_py()

        # Get total comments in last 24 hours
        comments_24h = await env.DB.prepare(
            """SELECT COUNT(*) as count FROM forum_comments
               WHERE created_at > datetime('now', '-1 day')"""
        ).first()
        if comments_24h and hasattr(comments_24h, 'to_py'):
            comments_24h = comments_24h.to_py()

        # Get active users in last 24 hours
        active_users = await env.DB.prepare(
            """SELECT COUNT(DISTINCT user_id) as count FROM (
                   SELECT user_id FROM forum_posts WHERE created_at > datetime('now', '-1 day')
                   UNION
                   SELECT user_id FROM forum_comments WHERE created_at > datetime('now', '-1 day')
               )"""
        ).first()
        if active_users and hasattr(active_users, 'to_py'):
            active_users = active_users.to_py()

        # Get top category by posts in last 7 days
        top_category = await env.DB.prepare(
            """SELECT c.name, c.slug, COUNT(p.id) as post_count
               FROM forum_posts p
               JOIN categories c ON p.category_id = c.id
               WHERE p.created_at > datetime('now', '-7 days')
               GROUP BY c.id
               ORDER BY post_count DESC
               LIMIT 1"""
        ).first()
        if top_category and hasattr(top_category, 'to_py'):
            top_category = top_category.to_py()

        return {
            "posts_24h": posts_24h["count"] if posts_24h else 0,
            "comments_24h": comments_24h["count"] if comments_24h else 0,
            "active_users_24h": active_users["count"] if active_users else 0,
            "top_category": {
                "name": to_python_value(top_category.get("name")) if top_category else None,
                "slug": to_python_value(top_category.get("slug")) if top_category else None,
                "post_count": top_category["post_count"] if top_category else 0
            } if top_category else None
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching trending stats: {str(e)}")
