"""
Rate limiting middleware for Cloudflare Workers
Uses D1 database to track request counts
"""

from fastapi import Request, HTTPException
from datetime import datetime, timezone
import hashlib


# Rate limit configuration
RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_MAX_REQUESTS = 60  # requests per window (1 per second average)
RATE_LIMIT_AUTH_MAX = 120  # higher limit for authenticated users


async def get_client_identifier(request: Request) -> str:
    """Get a unique identifier for the client (IP or user ID)"""
    # Try to get user_id from request state (set by auth middleware)
    user_id = getattr(request.state, 'user_id', None)
    if user_id:
        return f"user:{user_id}"

    # Fall back to IP address
    forwarded = request.headers.get("cf-connecting-ip") or request.headers.get("x-forwarded-for")
    if forwarded:
        ip = forwarded.split(",")[0].strip()
    else:
        ip = request.client.host if request.client else "unknown"

    return f"ip:{ip}"


async def check_rate_limit(request: Request) -> bool:
    """
    Check if the request should be rate limited.
    Returns True if allowed, raises HTTPException if rate limited.
    """
    env = request.scope.get("env")
    if not env or not hasattr(env, 'DB'):
        # No database available, allow request
        return True

    client_id = await get_client_identifier(request)
    # Hash the client ID to avoid storing raw IPs
    client_hash = hashlib.sha256(client_id.encode()).hexdigest()[:32]

    now = datetime.now(timezone.utc)
    window_start = int(now.timestamp()) - RATE_LIMIT_WINDOW

    try:
        # Count recent requests
        result = await env.DB.prepare(
            """SELECT COUNT(*) as count FROM rate_limits
               WHERE client_hash = ? AND timestamp > ?"""
        ).bind(client_hash, window_start).first()

        if result and hasattr(result, 'to_py'):
            result = result.to_py()

        count = result["count"] if result else 0

        # Determine limit based on authentication
        max_requests = RATE_LIMIT_AUTH_MAX if client_id.startswith("user:") else RATE_LIMIT_MAX_REQUESTS

        if count >= max_requests:
            raise HTTPException(
                status_code=429,
                detail="Rate limit exceeded. Please try again later."
            )

        # Record this request
        current_ts = int(now.timestamp())
        await env.DB.prepare(
            """INSERT INTO rate_limits (client_hash, timestamp) VALUES (?, ?)"""
        ).bind(client_hash, current_ts).run()

        # Cleanup old records (1% chance to avoid doing it every request)
        import random
        if random.random() < 0.01:
            await cleanup_old_records(env, window_start)

        return True

    except HTTPException:
        raise
    except Exception as e:
        # If rate limiting fails, allow the request but log error
        print(f"Rate limit check failed: {e}")
        return True


async def cleanup_old_records(env, window_start: int):
    """Remove old rate limit records"""
    try:
        await env.DB.prepare(
            "DELETE FROM rate_limits WHERE timestamp < ?"
        ).bind(window_start).run()
    except Exception as e:
        print(f"Rate limit cleanup failed: {e}")
