"""
Forum Comments API routes
Nested comments with up to 3 levels of replies
"""

from fastapi import APIRouter, Request, HTTPException, Depends
from pydantic import BaseModel
from .auth import require_auth

router = APIRouter()

MAX_DEPTH = 3  # Maximum nesting depth


class CommentAuthor(BaseModel):
    """Comment author info"""
    id: int
    name: str | None = None
    picture: str | None = None


class CommentResponse(BaseModel):
    """Comment response with optional nested replies"""
    id: int
    post_id: int
    user_id: int
    author: CommentAuthor
    parent_comment_id: int | None = None
    body: str
    upvote_count: int = 0
    downvote_count: int = 0
    user_vote: int | None = None
    depth: int = 0
    replies: list["CommentResponse"] = []
    created_at: str


class CommentsListResponse(BaseModel):
    """List of comments with nested structure"""
    comments: list[CommentResponse]
    total_count: int


class CreateCommentRequest(BaseModel):
    """Create comment request"""
    body: str
    parent_comment_id: int | None = None


class UpdateCommentRequest(BaseModel):
    """Update comment request"""
    body: str


@router.get("/posts/{post_id}/comments")
async def get_comments(
    request: Request,
    post_id: int,
    user_id: int = Depends(require_auth)
) -> CommentsListResponse:
    """
    Get all comments for a post with nested structure.
    Returns up to 3 levels of nesting.
    """
    env = request.scope["env"]

    try:
        # Verify post exists
        post = await env.DB.prepare(
            "SELECT id FROM forum_posts WHERE id = ?"
        ).bind(post_id).first()

        if post and hasattr(post, 'to_py'):
            post = post.to_py()

        if not post:
            raise HTTPException(status_code=404, detail="Post not found")

        # Get all comments for the post with votes
        result = await env.DB.prepare(
            """SELECT c.id, c.post_id, c.user_id, c.parent_comment_id, c.body,
                      c.upvote_count, c.downvote_count, c.created_at,
                      u.name as author_name, u.picture as author_picture,
                      v.value as user_vote
               FROM forum_comments c
               JOIN users u ON c.user_id = u.id
               LEFT JOIN votes v ON v.comment_id = c.id AND v.user_id = ?
               WHERE c.post_id = ?
               ORDER BY c.created_at ASC"""
        ).bind(user_id, post_id).all()

        if hasattr(result, 'to_py'):
            result = result.to_py()

        rows = result.get("results", [])

        # Build nested structure
        comments_by_id = {}
        root_comments = []

        # First pass: create all comment objects
        for row in rows:
            comment = CommentResponse(
                id=row["id"],
                post_id=row["post_id"],
                user_id=row["user_id"],
                author=CommentAuthor(
                    id=row["user_id"],
                    name=row.get("author_name"),
                    picture=row.get("author_picture")
                ),
                parent_comment_id=row.get("parent_comment_id"),
                body=row["body"],
                upvote_count=row.get("upvote_count", 0),
                downvote_count=row.get("downvote_count", 0),
                user_vote=row.get("user_vote"),
                depth=0,
                replies=[],
                created_at=str(row["created_at"])
            )
            comments_by_id[row["id"]] = comment

        # Second pass: build tree structure
        for comment_id, comment in comments_by_id.items():
            if comment.parent_comment_id is None:
                root_comments.append(comment)
            else:
                parent = comments_by_id.get(comment.parent_comment_id)
                if parent:
                    comment.depth = parent.depth + 1
                    parent.replies.append(comment)
                else:
                    # Parent was deleted, show as root
                    root_comments.append(comment)

        return CommentsListResponse(
            comments=root_comments,
            total_count=len(rows)
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching comments: {str(e)}")


@router.post("/posts/{post_id}/comments")
async def create_comment(
    request: Request,
    post_id: int,
    body: CreateCommentRequest,
    user_id: int = Depends(require_auth)
) -> CommentResponse:
    """
    Create a comment on a post.
    Optionally provide parent_comment_id for replies (max 3 levels deep).
    """
    env = request.scope["env"]

    try:
        # Verify post exists and not locked
        post = await env.DB.prepare(
            "SELECT id, is_locked FROM forum_posts WHERE id = ?"
        ).bind(post_id).first()

        if post and hasattr(post, 'to_py'):
            post = post.to_py()

        if not post:
            raise HTTPException(status_code=404, detail="Post not found")

        if post.get("is_locked"):
            raise HTTPException(status_code=403, detail="Post is locked for comments")

        # If replying to a comment, check depth
        depth = 0
        if body.parent_comment_id:
            parent = await env.DB.prepare(
                "SELECT id, parent_comment_id FROM forum_comments WHERE id = ? AND post_id = ?"
            ).bind(body.parent_comment_id, post_id).first()

            if parent and hasattr(parent, 'to_py'):
                parent = parent.to_py()

            if not parent:
                raise HTTPException(status_code=404, detail="Parent comment not found")

            # Calculate depth by traversing up
            current_id = body.parent_comment_id
            while current_id:
                depth += 1
                if depth >= MAX_DEPTH:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Maximum comment depth of {MAX_DEPTH} reached"
                    )

                parent_check = await env.DB.prepare(
                    "SELECT parent_comment_id FROM forum_comments WHERE id = ?"
                ).bind(current_id).first()

                if parent_check and hasattr(parent_check, 'to_py'):
                    parent_check = parent_check.to_py()

                current_id = parent_check.get("parent_comment_id") if parent_check else None

        # Insert comment
        result = await env.DB.prepare(
            """INSERT INTO forum_comments (post_id, user_id, parent_comment_id, body)
               VALUES (?, ?, ?, ?)
               RETURNING id, created_at"""
        ).bind(post_id, user_id, body.parent_comment_id, body.body).first()

        if hasattr(result, 'to_py'):
            result = result.to_py()

        # Update post comment count
        await env.DB.prepare(
            "UPDATE forum_posts SET comment_count = comment_count + 1 WHERE id = ?"
        ).bind(post_id).run()

        # Get author info
        author = await env.DB.prepare(
            "SELECT id, name, picture FROM users WHERE id = ?"
        ).bind(user_id).first()

        if author and hasattr(author, 'to_py'):
            author = author.to_py()

        return CommentResponse(
            id=result["id"],
            post_id=post_id,
            user_id=user_id,
            author=CommentAuthor(
                id=user_id,
                name=author.get("name") if author else None,
                picture=author.get("picture") if author else None
            ),
            parent_comment_id=body.parent_comment_id,
            body=body.body,
            upvote_count=0,
            downvote_count=0,
            user_vote=None,
            depth=depth,
            replies=[],
            created_at=str(result["created_at"])
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating comment: {str(e)}")


@router.put("/comments/{comment_id}")
async def update_comment(
    request: Request,
    comment_id: int,
    body: UpdateCommentRequest,
    user_id: int = Depends(require_auth)
) -> CommentResponse:
    """Update a comment (own comments only)."""
    env = request.scope["env"]

    try:
        # Check ownership
        existing = await env.DB.prepare(
            """SELECT c.id, c.post_id, c.user_id, c.parent_comment_id, c.upvote_count,
                      c.downvote_count, c.created_at, p.is_locked
               FROM forum_comments c
               JOIN forum_posts p ON c.post_id = p.id
               WHERE c.id = ?"""
        ).bind(comment_id).first()

        if existing and hasattr(existing, 'to_py'):
            existing = existing.to_py()

        if not existing:
            raise HTTPException(status_code=404, detail="Comment not found")

        if existing["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not your comment")

        if existing.get("is_locked"):
            raise HTTPException(status_code=403, detail="Post is locked")

        # Update comment
        await env.DB.prepare(
            "UPDATE forum_comments SET body = ? WHERE id = ?"
        ).bind(body.body, comment_id).run()

        # Get author info
        author = await env.DB.prepare(
            "SELECT id, name, picture FROM users WHERE id = ?"
        ).bind(user_id).first()

        if author and hasattr(author, 'to_py'):
            author = author.to_py()

        return CommentResponse(
            id=comment_id,
            post_id=existing["post_id"],
            user_id=user_id,
            author=CommentAuthor(
                id=user_id,
                name=author.get("name") if author else None,
                picture=author.get("picture") if author else None
            ),
            parent_comment_id=existing.get("parent_comment_id"),
            body=body.body,
            upvote_count=existing.get("upvote_count", 0),
            downvote_count=existing.get("downvote_count", 0),
            user_vote=None,
            depth=0,
            replies=[],
            created_at=str(existing["created_at"])
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating comment: {str(e)}")


@router.delete("/comments/{comment_id}")
async def delete_comment(
    request: Request,
    comment_id: int,
    user_id: int = Depends(require_auth)
) -> dict:
    """Delete a comment (own comments only). Also deletes all replies."""
    env = request.scope["env"]

    try:
        # Check ownership and get post_id
        existing = await env.DB.prepare(
            "SELECT id, post_id, user_id FROM forum_comments WHERE id = ?"
        ).bind(comment_id).first()

        if existing and hasattr(existing, 'to_py'):
            existing = existing.to_py()

        if not existing:
            raise HTTPException(status_code=404, detail="Comment not found")

        if existing["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not your comment")

        # Count comments to delete (this comment + all descendants)
        # Using recursive CTE to count all descendants
        count_result = await env.DB.prepare(
            """WITH RECURSIVE descendants AS (
                 SELECT id FROM forum_comments WHERE id = ?
                 UNION ALL
                 SELECT c.id FROM forum_comments c
                 JOIN descendants d ON c.parent_comment_id = d.id
               )
               SELECT COUNT(*) as count FROM descendants"""
        ).bind(comment_id).first()

        if count_result and hasattr(count_result, 'to_py'):
            count_result = count_result.to_py()

        delete_count = count_result.get("count", 1) if count_result else 1

        # Delete comment (cascade will handle replies)
        await env.DB.prepare(
            "DELETE FROM forum_comments WHERE id = ?"
        ).bind(comment_id).run()

        # Update post comment count
        await env.DB.prepare(
            "UPDATE forum_posts SET comment_count = MAX(0, comment_count - ?) WHERE id = ?"
        ).bind(delete_count, existing["post_id"]).run()

        return {"success": True, "message": "Comment deleted", "deleted_count": delete_count}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting comment: {str(e)}")
