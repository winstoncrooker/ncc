"""
Voting API routes
Upvote/downvote posts and comments
"""

from fastapi import APIRouter, Request, HTTPException, Depends
from pydantic import BaseModel
from datetime import datetime
import math
from .auth import require_auth

router = APIRouter()

# Epoch for hot score calculation (Jan 1, 2024)
EPOCH = datetime(2024, 1, 1).timestamp()


def calculate_hot_score(upvotes: int, downvotes: int, created_at: str) -> float:
    """
    Calculate hot score with stronger vote weighting.
    Higher upvotes = more visibility, with some time decay.
    """
    score = upvotes - downvotes
    # Multiply vote component by 2 for stronger vote influence
    order = math.log10(max(abs(score), 1)) * 2
    sign = 1 if score > 0 else -1 if score < 0 else 0

    try:
        if isinstance(created_at, str):
            dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            seconds = dt.timestamp() - EPOCH
        else:
            seconds = created_at - EPOCH
    except Exception:
        seconds = 0

    # Increased divisor (180000 = ~50 hours) so time matters less than votes
    return round(sign * order + seconds / 180000, 7)


class VoteRequest(BaseModel):
    """Vote request - provide either post_id OR comment_id"""
    post_id: int | None = None
    comment_id: int | None = None
    value: int  # 1 = upvote, -1 = downvote


class VoteResponse(BaseModel):
    """Vote response with updated counts"""
    success: bool
    vote_value: int | None  # Current user's vote (1, -1, or None if removed)
    upvote_count: int
    downvote_count: int
    hot_score: float | None = None  # Only for posts


@router.post("")
async def vote(
    request: Request,
    body: VoteRequest,
    user_id: int = Depends(require_auth)
) -> VoteResponse:
    """
    Vote on a post or comment.
    - value = 1: upvote
    - value = -1: downvote
    - Voting the same value again removes the vote
    - Voting opposite value changes the vote
    """
    env = request.scope["env"]

    if body.value not in [1, -1]:
        raise HTTPException(status_code=400, detail="Vote value must be 1 or -1")

    if not body.post_id and not body.comment_id:
        raise HTTPException(status_code=400, detail="Must provide post_id or comment_id")

    if body.post_id and body.comment_id:
        raise HTTPException(status_code=400, detail="Provide only one of post_id or comment_id")

    try:
        if body.post_id:
            return await vote_on_post(env, user_id, body.post_id, body.value)
        else:
            return await vote_on_comment(env, user_id, body.comment_id, body.value)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error voting: {str(e)}")


async def vote_on_post(env, user_id: int, post_id: int, value: int) -> VoteResponse:
    """Handle voting on a post."""

    # Get post
    post = await env.DB.prepare(
        "SELECT id, upvote_count, downvote_count, created_at FROM forum_posts WHERE id = ?"
    ).bind(post_id).first()

    if post and hasattr(post, 'to_py'):
        post = post.to_py()

    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    # Check existing vote
    existing = await env.DB.prepare(
        "SELECT id, value FROM votes WHERE user_id = ? AND post_id = ?"
    ).bind(user_id, post_id).first()

    if existing and hasattr(existing, 'to_py'):
        existing = existing.to_py()

    upvotes = post["upvote_count"]
    downvotes = post["downvote_count"]

    if existing:
        old_value = existing["value"]

        if old_value == value:
            # Same vote = remove vote
            await env.DB.prepare(
                "DELETE FROM votes WHERE id = ?"
            ).bind(existing["id"]).run()

            if value == 1:
                upvotes -= 1
            else:
                downvotes -= 1

            new_vote = None

        else:
            # Different vote = change vote
            await env.DB.prepare(
                "UPDATE votes SET value = ? WHERE id = ?"
            ).bind(value, existing["id"]).run()

            if old_value == 1:
                upvotes -= 1
            else:
                downvotes -= 1

            if value == 1:
                upvotes += 1
            else:
                downvotes += 1

            new_vote = value

    else:
        # New vote
        await env.DB.prepare(
            "INSERT INTO votes (user_id, post_id, value) VALUES (?, ?, ?)"
        ).bind(user_id, post_id, value).run()

        if value == 1:
            upvotes += 1
        else:
            downvotes += 1

        new_vote = value

    # Update post counts and hot score
    hot_score = calculate_hot_score(upvotes, downvotes, post["created_at"])

    await env.DB.prepare(
        """UPDATE forum_posts
           SET upvote_count = ?, downvote_count = ?, hot_score = ?
           WHERE id = ?"""
    ).bind(upvotes, downvotes, hot_score, post_id).run()

    return VoteResponse(
        success=True,
        vote_value=new_vote,
        upvote_count=upvotes,
        downvote_count=downvotes,
        hot_score=hot_score
    )


async def vote_on_comment(env, user_id: int, comment_id: int, value: int) -> VoteResponse:
    """Handle voting on a comment."""

    # Get comment
    comment = await env.DB.prepare(
        "SELECT id, upvote_count, downvote_count FROM forum_comments WHERE id = ?"
    ).bind(comment_id).first()

    if comment and hasattr(comment, 'to_py'):
        comment = comment.to_py()

    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    # Check existing vote
    existing = await env.DB.prepare(
        "SELECT id, value FROM votes WHERE user_id = ? AND comment_id = ?"
    ).bind(user_id, comment_id).first()

    if existing and hasattr(existing, 'to_py'):
        existing = existing.to_py()

    upvotes = comment["upvote_count"]
    downvotes = comment["downvote_count"]

    if existing:
        old_value = existing["value"]

        if old_value == value:
            # Same vote = remove vote
            await env.DB.prepare(
                "DELETE FROM votes WHERE id = ?"
            ).bind(existing["id"]).run()

            if value == 1:
                upvotes -= 1
            else:
                downvotes -= 1

            new_vote = None

        else:
            # Different vote = change vote
            await env.DB.prepare(
                "UPDATE votes SET value = ? WHERE id = ?"
            ).bind(value, existing["id"]).run()

            if old_value == 1:
                upvotes -= 1
            else:
                downvotes -= 1

            if value == 1:
                upvotes += 1
            else:
                downvotes += 1

            new_vote = value

    else:
        # New vote
        await env.DB.prepare(
            "INSERT INTO votes (user_id, comment_id, value) VALUES (?, ?, ?)"
        ).bind(user_id, comment_id, value).run()

        if value == 1:
            upvotes += 1
        else:
            downvotes += 1

        new_vote = value

    # Update comment counts
    await env.DB.prepare(
        """UPDATE forum_comments
           SET upvote_count = ?, downvote_count = ?
           WHERE id = ?"""
    ).bind(upvotes, downvotes, comment_id).run()

    return VoteResponse(
        success=True,
        vote_value=new_vote,
        upvote_count=upvotes,
        downvote_count=downvotes,
        hot_score=None
    )


@router.delete("/post/{post_id}")
async def remove_post_vote(
    request: Request,
    post_id: int,
    user_id: int = Depends(require_auth)
) -> VoteResponse:
    """Remove vote from a post."""
    env = request.scope["env"]

    try:
        # Get existing vote
        existing = await env.DB.prepare(
            "SELECT id, value FROM votes WHERE user_id = ? AND post_id = ?"
        ).bind(user_id, post_id).first()

        if existing and hasattr(existing, 'to_py'):
            existing = existing.to_py()

        if not existing:
            # No vote to remove, return current counts
            post = await env.DB.prepare(
                "SELECT upvote_count, downvote_count, hot_score FROM forum_posts WHERE id = ?"
            ).bind(post_id).first()

            if post and hasattr(post, 'to_py'):
                post = post.to_py()

            if not post:
                raise HTTPException(status_code=404, detail="Post not found")

            return VoteResponse(
                success=True,
                vote_value=None,
                upvote_count=post["upvote_count"],
                downvote_count=post["downvote_count"],
                hot_score=post["hot_score"]
            )

        # Delete vote
        await env.DB.prepare(
            "DELETE FROM votes WHERE id = ?"
        ).bind(existing["id"]).run()

        # Update post counts
        old_value = existing["value"]

        post = await env.DB.prepare(
            "SELECT upvote_count, downvote_count, created_at FROM forum_posts WHERE id = ?"
        ).bind(post_id).first()

        if post and hasattr(post, 'to_py'):
            post = post.to_py()

        upvotes = post["upvote_count"]
        downvotes = post["downvote_count"]

        if old_value == 1:
            upvotes -= 1
        else:
            downvotes -= 1

        hot_score = calculate_hot_score(upvotes, downvotes, post["created_at"])

        await env.DB.prepare(
            """UPDATE forum_posts
               SET upvote_count = ?, downvote_count = ?, hot_score = ?
               WHERE id = ?"""
        ).bind(upvotes, downvotes, hot_score, post_id).run()

        return VoteResponse(
            success=True,
            vote_value=None,
            upvote_count=upvotes,
            downvote_count=downvotes,
            hot_score=hot_score
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error removing vote: {str(e)}")


@router.delete("/comment/{comment_id}")
async def remove_comment_vote(
    request: Request,
    comment_id: int,
    user_id: int = Depends(require_auth)
) -> VoteResponse:
    """Remove vote from a comment."""
    env = request.scope["env"]

    try:
        # Get existing vote
        existing = await env.DB.prepare(
            "SELECT id, value FROM votes WHERE user_id = ? AND comment_id = ?"
        ).bind(user_id, comment_id).first()

        if existing and hasattr(existing, 'to_py'):
            existing = existing.to_py()

        if not existing:
            # No vote to remove
            comment = await env.DB.prepare(
                "SELECT upvote_count, downvote_count FROM forum_comments WHERE id = ?"
            ).bind(comment_id).first()

            if comment and hasattr(comment, 'to_py'):
                comment = comment.to_py()

            if not comment:
                raise HTTPException(status_code=404, detail="Comment not found")

            return VoteResponse(
                success=True,
                vote_value=None,
                upvote_count=comment["upvote_count"],
                downvote_count=comment["downvote_count"]
            )

        # Delete vote
        await env.DB.prepare(
            "DELETE FROM votes WHERE id = ?"
        ).bind(existing["id"]).run()

        # Update comment counts
        old_value = existing["value"]

        comment = await env.DB.prepare(
            "SELECT upvote_count, downvote_count FROM forum_comments WHERE id = ?"
        ).bind(comment_id).first()

        if comment and hasattr(comment, 'to_py'):
            comment = comment.to_py()

        upvotes = comment["upvote_count"]
        downvotes = comment["downvote_count"]

        if old_value == 1:
            upvotes -= 1
        else:
            downvotes -= 1

        await env.DB.prepare(
            """UPDATE forum_comments
               SET upvote_count = ?, downvote_count = ?
               WHERE id = ?"""
        ).bind(upvotes, downvotes, comment_id).run()

        return VoteResponse(
            success=True,
            vote_value=None,
            upvote_count=upvotes,
            downvote_count=downvotes
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error removing vote: {str(e)}")
