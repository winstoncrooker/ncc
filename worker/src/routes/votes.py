"""
Voting API routes
Upvote/downvote posts and comments
"""

from fastapi import APIRouter, Request, HTTPException, Depends
from pydantic import BaseModel
from .auth import require_auth
from utils.scoring import calculate_hot_score
from utils.conversions import convert_row

router = APIRouter()


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
    """Handle voting on a post using atomic SQL operations to prevent race conditions."""

    # Get post (for created_at needed for hot score)
    post = await env.DB.prepare(
        "SELECT id, upvote_count, downvote_count, created_at FROM forum_posts WHERE id = ?"
    ).bind(post_id).first()

    post = convert_row(post)

    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    # Get existing vote to determine the action
    existing = await env.DB.prepare(
        "SELECT id, value FROM votes WHERE user_id = ? AND post_id = ?"
    ).bind(user_id, post_id).first()

    existing = convert_row(existing)

    # Determine action and deltas atomically
    upvote_delta = 0
    downvote_delta = 0
    new_vote = None

    if existing:
        old_value = existing["value"]

        if old_value == value:
            # Same vote = remove vote using atomic DELETE with WHERE clause
            result = await env.DB.prepare(
                "DELETE FROM votes WHERE user_id = ? AND post_id = ? AND value = ? RETURNING id"
            ).bind(user_id, post_id, value).first()

            if result:
                # Vote was actually deleted - apply deltas
                if value == 1:
                    upvote_delta = -1
                else:
                    downvote_delta = -1
                new_vote = None
            else:
                # Vote was already changed/deleted by concurrent request - refetch state
                current = await env.DB.prepare(
                    "SELECT value FROM votes WHERE user_id = ? AND post_id = ?"
                ).bind(user_id, post_id).first()
                current = convert_row(current)
                new_vote = current["value"] if current else None
        else:
            # Different vote = change vote atomically with old value check
            result = await env.DB.prepare(
                "UPDATE votes SET value = ? WHERE user_id = ? AND post_id = ? AND value = ? RETURNING id"
            ).bind(value, user_id, post_id, old_value).first()

            if result:
                # Vote was actually updated - apply deltas
                if old_value == 1:
                    upvote_delta = -1
                else:
                    downvote_delta = -1

                if value == 1:
                    upvote_delta += 1
                else:
                    downvote_delta += 1

                new_vote = value
            else:
                # Vote was already changed by concurrent request - refetch state
                current = await env.DB.prepare(
                    "SELECT value FROM votes WHERE user_id = ? AND post_id = ?"
                ).bind(user_id, post_id).first()
                current = convert_row(current)
                new_vote = current["value"] if current else None
    else:
        # New vote - use INSERT ON CONFLICT to handle concurrent inserts
        result = await env.DB.prepare(
            """INSERT INTO votes (user_id, post_id, value)
               VALUES (?, ?, ?)
               ON CONFLICT(user_id, post_id) DO UPDATE SET value = excluded.value
               RETURNING id, value"""
        ).bind(user_id, post_id, value).first()

        result = convert_row(result)
        if result:
            new_vote = result["value"]
            if value == 1:
                upvote_delta = 1
            else:
                downvote_delta = 1

    # Only update counts if we actually changed something
    if upvote_delta != 0 or downvote_delta != 0:
        # Atomic update of post counts using SQL arithmetic with floor constraint
        await env.DB.prepare(
            """UPDATE forum_posts
               SET upvote_count = MAX(0, upvote_count + ?),
                   downvote_count = MAX(0, downvote_count + ?)
               WHERE id = ?"""
        ).bind(upvote_delta, downvote_delta, post_id).run()

    # Fetch updated counts to calculate hot score
    updated_post = await env.DB.prepare(
        "SELECT upvote_count, downvote_count, created_at FROM forum_posts WHERE id = ?"
    ).bind(post_id).first()

    updated_post = convert_row(updated_post)

    upvotes = updated_post["upvote_count"]
    downvotes = updated_post["downvote_count"]
    hot_score = calculate_hot_score(upvotes, downvotes, updated_post["created_at"])

    # Update hot score
    await env.DB.prepare(
        "UPDATE forum_posts SET hot_score = ? WHERE id = ?"
    ).bind(hot_score, post_id).run()

    return VoteResponse(
        success=True,
        vote_value=new_vote,
        upvote_count=upvotes,
        downvote_count=downvotes,
        hot_score=hot_score
    )


async def vote_on_comment(env, user_id: int, comment_id: int, value: int) -> VoteResponse:
    """Handle voting on a comment using atomic SQL operations to prevent race conditions."""

    # Get comment
    comment = await env.DB.prepare(
        "SELECT id, upvote_count, downvote_count FROM forum_comments WHERE id = ?"
    ).bind(comment_id).first()

    comment = convert_row(comment)

    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    # Get existing vote to determine the action
    existing = await env.DB.prepare(
        "SELECT id, value FROM votes WHERE user_id = ? AND comment_id = ?"
    ).bind(user_id, comment_id).first()

    existing = convert_row(existing)

    # Determine action and deltas atomically
    upvote_delta = 0
    downvote_delta = 0
    new_vote = None

    if existing:
        old_value = existing["value"]

        if old_value == value:
            # Same vote = remove vote using atomic DELETE with WHERE clause
            result = await env.DB.prepare(
                "DELETE FROM votes WHERE user_id = ? AND comment_id = ? AND value = ? RETURNING id"
            ).bind(user_id, comment_id, value).first()

            if result:
                # Vote was actually deleted - apply deltas
                if value == 1:
                    upvote_delta = -1
                else:
                    downvote_delta = -1
                new_vote = None
            else:
                # Vote was already changed/deleted by concurrent request - refetch state
                current = await env.DB.prepare(
                    "SELECT value FROM votes WHERE user_id = ? AND comment_id = ?"
                ).bind(user_id, comment_id).first()
                current = convert_row(current)
                new_vote = current["value"] if current else None
        else:
            # Different vote = change vote atomically with old value check
            result = await env.DB.prepare(
                "UPDATE votes SET value = ? WHERE user_id = ? AND comment_id = ? AND value = ? RETURNING id"
            ).bind(value, user_id, comment_id, old_value).first()

            if result:
                # Vote was actually updated - apply deltas
                if old_value == 1:
                    upvote_delta = -1
                else:
                    downvote_delta = -1

                if value == 1:
                    upvote_delta += 1
                else:
                    downvote_delta += 1

                new_vote = value
            else:
                # Vote was already changed by concurrent request - refetch state
                current = await env.DB.prepare(
                    "SELECT value FROM votes WHERE user_id = ? AND comment_id = ?"
                ).bind(user_id, comment_id).first()
                current = convert_row(current)
                new_vote = current["value"] if current else None
    else:
        # New vote - use INSERT ON CONFLICT to handle concurrent inserts
        result = await env.DB.prepare(
            """INSERT INTO votes (user_id, comment_id, value)
               VALUES (?, ?, ?)
               ON CONFLICT(user_id, comment_id) DO UPDATE SET value = excluded.value
               RETURNING id, value"""
        ).bind(user_id, comment_id, value).first()

        result = convert_row(result)
        if result:
            new_vote = result["value"]
            if value == 1:
                upvote_delta = 1
            else:
                downvote_delta = 1

    # Only update counts if we actually changed something
    if upvote_delta != 0 or downvote_delta != 0:
        # Atomic update of comment counts using SQL arithmetic with floor constraint
        await env.DB.prepare(
            """UPDATE forum_comments
               SET upvote_count = MAX(0, upvote_count + ?),
                   downvote_count = MAX(0, downvote_count + ?)
               WHERE id = ?"""
        ).bind(upvote_delta, downvote_delta, comment_id).run()

    # Fetch updated counts
    updated_comment = await env.DB.prepare(
        "SELECT upvote_count, downvote_count FROM forum_comments WHERE id = ?"
    ).bind(comment_id).first()

    updated_comment = convert_row(updated_comment)

    return VoteResponse(
        success=True,
        vote_value=new_vote,
        upvote_count=updated_comment["upvote_count"],
        downvote_count=updated_comment["downvote_count"],
        hot_score=None
    )


@router.delete("/post/{post_id}")
async def remove_post_vote(
    request: Request,
    post_id: int,
    user_id: int = Depends(require_auth)
) -> VoteResponse:
    """Remove vote from a post using atomic SQL operations."""
    env = request.scope["env"]

    try:
        # Atomically delete and get the value that was deleted
        deleted = await env.DB.prepare(
            "DELETE FROM votes WHERE user_id = ? AND post_id = ? RETURNING value"
        ).bind(user_id, post_id).first()

        deleted = convert_row(deleted)

        if not deleted:
            # No vote to remove, return current counts
            post = await env.DB.prepare(
                "SELECT upvote_count, downvote_count, hot_score FROM forum_posts WHERE id = ?"
            ).bind(post_id).first()

            post = convert_row(post)

            if not post:
                raise HTTPException(status_code=404, detail="Post not found")

            return VoteResponse(
                success=True,
                vote_value=None,
                upvote_count=post["upvote_count"],
                downvote_count=post["downvote_count"],
                hot_score=post["hot_score"]
            )

        # Vote was deleted - apply deltas based on the value that was deleted
        old_value = deleted["value"]
        upvote_delta = -1 if old_value == 1 else 0
        downvote_delta = -1 if old_value == -1 else 0

        # Atomic update of post counts using SQL arithmetic with floor constraint
        await env.DB.prepare(
            """UPDATE forum_posts
               SET upvote_count = MAX(0, upvote_count + ?),
                   downvote_count = MAX(0, downvote_count + ?)
               WHERE id = ?"""
        ).bind(upvote_delta, downvote_delta, post_id).run()

        # Fetch updated counts to calculate hot score
        updated_post = await env.DB.prepare(
            "SELECT upvote_count, downvote_count, created_at FROM forum_posts WHERE id = ?"
        ).bind(post_id).first()

        updated_post = convert_row(updated_post)

        upvotes = updated_post["upvote_count"]
        downvotes = updated_post["downvote_count"]
        hot_score = calculate_hot_score(upvotes, downvotes, updated_post["created_at"])

        # Update hot score
        await env.DB.prepare(
            "UPDATE forum_posts SET hot_score = ? WHERE id = ?"
        ).bind(hot_score, post_id).run()

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
    """Remove vote from a comment using atomic SQL operations."""
    env = request.scope["env"]

    try:
        # Atomically delete and get the value that was deleted
        deleted = await env.DB.prepare(
            "DELETE FROM votes WHERE user_id = ? AND comment_id = ? RETURNING value"
        ).bind(user_id, comment_id).first()

        deleted = convert_row(deleted)

        if not deleted:
            # No vote to remove
            comment = await env.DB.prepare(
                "SELECT upvote_count, downvote_count FROM forum_comments WHERE id = ?"
            ).bind(comment_id).first()

            comment = convert_row(comment)

            if not comment:
                raise HTTPException(status_code=404, detail="Comment not found")

            return VoteResponse(
                success=True,
                vote_value=None,
                upvote_count=comment["upvote_count"],
                downvote_count=comment["downvote_count"]
            )

        # Vote was deleted - apply deltas based on the value that was deleted
        old_value = deleted["value"]
        upvote_delta = -1 if old_value == 1 else 0
        downvote_delta = -1 if old_value == -1 else 0

        # Atomic update of comment counts using SQL arithmetic with floor constraint
        await env.DB.prepare(
            """UPDATE forum_comments
               SET upvote_count = MAX(0, upvote_count + ?),
                   downvote_count = MAX(0, downvote_count + ?)
               WHERE id = ?"""
        ).bind(upvote_delta, downvote_delta, comment_id).run()

        # Fetch updated counts
        updated_comment = await env.DB.prepare(
            "SELECT upvote_count, downvote_count FROM forum_comments WHERE id = ?"
        ).bind(comment_id).first()

        updated_comment = convert_row(updated_comment)

        return VoteResponse(
            success=True,
            vote_value=None,
            upvote_count=updated_comment["upvote_count"],
            downvote_count=updated_comment["downvote_count"]
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error removing vote: {str(e)}")
