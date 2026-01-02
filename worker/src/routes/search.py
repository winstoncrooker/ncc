"""
Global Search API routes
Search across users, collections, and forum posts
"""

from fastapi import APIRouter, Request, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Optional

from routes.auth import require_auth
from utils.conversions import to_python_value, convert_row

router = APIRouter()


class UserSearchResult(BaseModel):
    """User search result"""
    id: int
    name: Optional[str] = None
    picture: Optional[str] = None
    bio: Optional[str] = None
    match_field: str = "name"  # Which field matched


class CollectionSearchResult(BaseModel):
    """Collection item search result"""
    id: int
    user_id: int
    user_name: Optional[str] = None
    artist: str
    album: str
    cover: Optional[str] = None
    year: Optional[int] = None
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    match_field: str = "album"


class PostSearchResult(BaseModel):
    """Forum post search result"""
    id: int
    user_id: int
    author_name: Optional[str] = None
    author_picture: Optional[str] = None
    title: str
    body_preview: str  # First 150 chars
    category_id: int
    category_name: Optional[str] = None
    category_slug: Optional[str] = None
    upvote_count: int = 0
    comment_count: int = 0
    created_at: str
    match_field: str = "title"


class SearchResponse(BaseModel):
    """Global search response"""
    users: list[UserSearchResult] = []
    collections: list[CollectionSearchResult] = []
    posts: list[PostSearchResult] = []
    total_count: int = 0
    query: str


@router.get("")
async def search(
    request: Request,
    q: str = Query(..., min_length=1, max_length=100, description="Search query"),
    type: str = Query("all", regex="^(all|users|collections|posts)$", description="Result type filter"),
    category: Optional[str] = Query(None, description="Category slug filter"),
    limit: int = Query(20, ge=1, le=50, description="Results per type"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    user_id: int = Depends(require_auth)
) -> SearchResponse:
    """
    Search across users, collections, and forum posts.

    - **q**: Search query (required, 1-100 chars)
    - **type**: Filter by type (all, users, collections, posts)
    - **category**: Filter by category slug
    - **limit**: Max results per type (1-50, default 20)
    - **offset**: Pagination offset (default 0)

    Returns results grouped by type with relevance-based ordering.
    Exact matches are prioritized over partial matches.
    """
    env = request.scope["env"]

    # Normalize search query
    query = q.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Search query is required")

    # Prepare search patterns for LIKE
    exact_pattern = query
    like_pattern = f"%{query}%"

    results = SearchResponse(query=query)
    total_count = 0

    # Get category ID if filtering by category
    category_id = None
    if category:
        cat_result = await env.DB.prepare(
            "SELECT id FROM categories WHERE slug = ?"
        ).bind(category).first()
        if cat_result:
            cat_result = convert_row(cat_result)
            category_id = cat_result.get("id") if cat_result else None

    try:
        # Search Users
        if type in ("all", "users"):
            users = await search_users(env, like_pattern, exact_pattern, limit, offset, user_id)
            results.users = users
            total_count += len(users)

        # Search Collections
        if type in ("all", "collections"):
            collections = await search_collections(env, like_pattern, exact_pattern, category_id, limit, offset)
            results.collections = collections
            total_count += len(collections)

        # Search Posts
        if type in ("all", "posts"):
            posts = await search_posts(env, like_pattern, exact_pattern, category_id, limit, offset)
            results.posts = posts
            total_count += len(posts)

        results.total_count = total_count
        return results

    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Search error: {str(error)}")


async def search_users(
    env,
    like_pattern: str,
    exact_pattern: str,
    limit: int,
    offset: int,
    current_user_id: int
) -> list[UserSearchResult]:
    """
    Search users by name or bio.
    Respects privacy settings (searchable flag).
    Orders by exact match first, then by name.
    """
    # Query users who are searchable (privacy_settings->searchable = true or null/default)
    query = """
        SELECT id, name, picture, bio,
               CASE
                   WHEN LOWER(name) = LOWER(?) THEN 1
                   WHEN LOWER(name) LIKE LOWER(?) THEN 2
                   WHEN LOWER(bio) LIKE LOWER(?) THEN 3
                   ELSE 4
               END as relevance,
               CASE
                   WHEN LOWER(name) LIKE LOWER(?) THEN 'name'
                   ELSE 'bio'
               END as match_field
        FROM users
        WHERE id != ?
          AND (LOWER(name) LIKE LOWER(?) OR LOWER(bio) LIKE LOWER(?))
          AND (
              privacy_settings IS NULL
              OR json_extract(privacy_settings, '$.searchable') IS NULL
              OR json_extract(privacy_settings, '$.searchable') = 1
              OR json_extract(privacy_settings, '$.searchable') = true
          )
        ORDER BY relevance ASC, name ASC
        LIMIT ? OFFSET ?
    """

    result = await env.DB.prepare(query).bind(
        exact_pattern,  # For exact match scoring
        like_pattern,   # For partial name match scoring
        like_pattern,   # For bio match scoring
        like_pattern,   # For match_field detection
        current_user_id,  # Exclude self
        like_pattern,   # WHERE name LIKE
        like_pattern,   # WHERE bio LIKE
        limit,
        offset
    ).all()

    users = []
    for row in result.results:
        row = convert_row(row)
        users.append(UserSearchResult(
            id=row["id"],
            name=to_python_value(row.get("name")),
            picture=to_python_value(row.get("picture")),
            bio=truncate_text(to_python_value(row.get("bio")), 100),
            match_field=to_python_value(row.get("match_field"), "name")
        ))

    return users


async def search_collections(
    env,
    like_pattern: str,
    exact_pattern: str,
    category_id: Optional[int],
    limit: int,
    offset: int
) -> list[CollectionSearchResult]:
    """
    Search collection items by artist or album.
    Orders by exact match first, then by artist/album.
    """
    base_query = """
        SELECT c.id, c.user_id, c.artist, c.album, c.cover, c.year, c.category_id,
               u.name as user_name,
               cat.name as category_name,
               CASE
                   WHEN LOWER(c.album) = LOWER(?) THEN 1
                   WHEN LOWER(c.artist) = LOWER(?) THEN 2
                   WHEN LOWER(c.album) LIKE LOWER(?) THEN 3
                   WHEN LOWER(c.artist) LIKE LOWER(?) THEN 4
                   ELSE 5
               END as relevance,
               CASE
                   WHEN LOWER(c.artist) LIKE LOWER(?) THEN 'artist'
                   ELSE 'album'
               END as match_field
        FROM collections c
        JOIN users u ON c.user_id = u.id
        LEFT JOIN categories cat ON c.category_id = cat.id
        WHERE (LOWER(c.artist) LIKE LOWER(?) OR LOWER(c.album) LIKE LOWER(?))
    """

    params = [
        exact_pattern,  # album exact
        exact_pattern,  # artist exact
        like_pattern,   # album partial
        like_pattern,   # artist partial
        like_pattern,   # match_field
        like_pattern,   # WHERE artist
        like_pattern,   # WHERE album
    ]

    if category_id:
        base_query += " AND c.category_id = ?"
        params.append(category_id)

    base_query += " ORDER BY relevance ASC, c.artist ASC, c.album ASC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    result = await env.DB.prepare(base_query).bind(*params).all()

    collections = []
    for row in result.results:
        row = convert_row(row)
        collections.append(CollectionSearchResult(
            id=row["id"],
            user_id=row["user_id"],
            user_name=to_python_value(row.get("user_name")),
            artist=row["artist"],
            album=row["album"],
            cover=to_python_value(row.get("cover")),
            year=to_python_value(row.get("year")),
            category_id=to_python_value(row.get("category_id")),
            category_name=to_python_value(row.get("category_name")),
            match_field=to_python_value(row.get("match_field"), "album")
        ))

    return collections


async def search_posts(
    env,
    like_pattern: str,
    exact_pattern: str,
    category_id: Optional[int],
    limit: int,
    offset: int
) -> list[PostSearchResult]:
    """
    Search forum posts by title or body content.
    Orders by exact match first, then by hot score.
    """
    base_query = """
        SELECT p.id, p.user_id, p.title, p.body, p.category_id,
               p.upvote_count, p.comment_count, p.created_at,
               u.name as author_name, u.picture as author_picture,
               c.name as category_name, c.slug as category_slug,
               CASE
                   WHEN LOWER(p.title) = LOWER(?) THEN 1
                   WHEN LOWER(p.title) LIKE LOWER(?) THEN 2
                   WHEN LOWER(p.body) LIKE LOWER(?) THEN 3
                   ELSE 4
               END as relevance,
               CASE
                   WHEN LOWER(p.title) LIKE LOWER(?) THEN 'title'
                   ELSE 'body'
               END as match_field
        FROM forum_posts p
        JOIN users u ON p.user_id = u.id
        JOIN categories c ON p.category_id = c.id
        WHERE (LOWER(p.title) LIKE LOWER(?) OR LOWER(p.body) LIKE LOWER(?))
    """

    params = [
        exact_pattern,  # title exact
        like_pattern,   # title partial
        like_pattern,   # body partial
        like_pattern,   # match_field
        like_pattern,   # WHERE title
        like_pattern,   # WHERE body
    ]

    if category_id:
        base_query += " AND p.category_id = ?"
        params.append(category_id)

    base_query += " ORDER BY relevance ASC, p.hot_score DESC, p.created_at DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    result = await env.DB.prepare(base_query).bind(*params).all()

    posts = []
    for row in result.results:
        row = convert_row(row)
        body = to_python_value(row.get("body"), "")
        posts.append(PostSearchResult(
            id=row["id"],
            user_id=row["user_id"],
            author_name=to_python_value(row.get("author_name")),
            author_picture=to_python_value(row.get("author_picture")),
            title=row["title"],
            body_preview=truncate_text(body, 150),
            category_id=row["category_id"],
            category_name=to_python_value(row.get("category_name")),
            category_slug=to_python_value(row.get("category_slug")),
            upvote_count=to_python_value(row.get("upvote_count"), 0),
            comment_count=to_python_value(row.get("comment_count"), 0),
            created_at=str(row["created_at"]),
            match_field=to_python_value(row.get("match_field"), "title")
        ))

    return posts


def truncate_text(text: str | None, max_length: int) -> str:
    """Truncate text to max_length with ellipsis if needed"""
    if not text:
        return ""
    if len(text) <= max_length:
        return text
    return text[:max_length - 3].rstrip() + "..."
