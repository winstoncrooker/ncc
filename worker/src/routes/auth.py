"""
Google OAuth2 Authentication routes
"""

from fastapi import APIRouter, Request, HTTPException, Depends, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
import jwt
import httpx
import urllib.parse
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

router = APIRouter()
security = HTTPBearer(auto_error=False)

# Google OAuth2 endpoints
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"


class TokenResponse(BaseModel):
    """JWT token response with CSRF token for state-changing requests"""
    access_token: str
    csrf_token: str  # Must be sent in X-CSRF-Token header for POST/PUT/DELETE
    token_type: str = "bearer"
    user_id: int
    email: str
    name: str | None = None
    picture: str | None = None


class UserResponse(BaseModel):
    """Current user info with profile fields"""
    id: int
    email: str
    name: str | None = None
    picture: str | None = None
    bio: str | None = None
    pronouns: str | None = None
    background_image: str | None = None
    created_at: str | None = None


def create_token(user_id: int, email: str, secret: str) -> tuple[str, str]:
    """
    Create JWT token with embedded CSRF token.
    Returns tuple of (jwt_token, csrf_token).
    """
    csrf_token = secrets.token_urlsafe(32)
    payload = {
        "sub": str(user_id),  # Must be string for PyJWT
        "email": email,
        "csrf": csrf_token,  # Embed CSRF token in JWT for validation
        "exp": datetime.utcnow() + timedelta(days=7),
        "iat": datetime.utcnow()
    }
    return jwt.encode(payload, secret, algorithm="HS256"), csrf_token


def hash_token(token: str) -> str:
    """Hash a token for storage in blacklist"""
    return hashlib.sha256(token.encode()).hexdigest()


async def is_token_blacklisted(env, token: str) -> bool:
    """
    Check if a token is in the blacklist.

    SECURITY: This function is FAIL-CLOSED. If the database query fails for any reason,
    we treat the token as blacklisted (deny access). This prevents revoked tokens from
    being used if the database is temporarily unavailable.
    """
    try:
        token_hash = hash_token(token)
        result = await env.DB.prepare(
            "SELECT id FROM token_blacklist WHERE token_hash = ?"
        ).bind(token_hash).first()

        # Handle D1's JsNull - it's not Python None
        if result is None:
            return False
        # Convert JsProxy if needed
        if hasattr(result, 'to_py'):
            result = result.to_py()
        # If result is empty dict or None after conversion, not blacklisted
        if not result:
            return False
        return True
    except Exception as error:
        # FAIL-CLOSED: If we can't verify the token isn't blacklisted, deny access
        # This is a security-critical decision - better to temporarily deny valid tokens
        # than to allow potentially revoked tokens
        raise HTTPException(
            status_code=503,
            detail="Unable to verify token status. Please try again."
        )


async def blacklist_token(env, token: str, user_id: int, expires_at: int) -> None:
    """Add a token to the blacklist"""
    try:
        token_hash = hash_token(token)
        await env.DB.prepare(
            """INSERT OR IGNORE INTO token_blacklist (token_hash, user_id, expires_at)
               VALUES (?, ?, ?)"""
        ).bind(token_hash, user_id, expires_at).run()

        # Cleanup old expired tokens (1% chance)
        import random
        if random.random() < 0.01:
            now = int(datetime.now(timezone.utc).timestamp())
            await env.DB.prepare(
                "DELETE FROM token_blacklist WHERE expires_at < ?"
            ).bind(now).run()
    except Exception:
        pass  # Silently fail - logout should still succeed from client perspective


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security)
) -> int | None:
    """
    Get current user ID from JWT token.
    Returns None if no valid token provided.
    """
    if not credentials:
        return None

    env = request.scope["env"]
    token = credentials.credentials

    try:
        # Get secret - ensure it's a string
        secret = str(env.JWT_SECRET) if hasattr(env, 'JWT_SECRET') else None
        if not secret:
            raise HTTPException(status_code=500, detail="Server configuration error")

        # Check if token is blacklisted
        if await is_token_blacklisted(env, credentials.credentials):
            raise HTTPException(status_code=401, detail="Token has been revoked")

        # Decode the token
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"]
        )
        user_id = int(payload["sub"])  # Convert back from string
        return user_id
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail="Invalid token")


async def require_auth(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> int:
    """
    Require authentication - raises 401 if not authenticated.
    """
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication required")

    user_id = await get_current_user(request, credentials)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    return user_id


async def require_csrf(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    x_csrf_token: str | None = Header(None, alias="X-CSRF-Token")
) -> int:
    """
    Require both authentication AND CSRF token validation for state-changing requests.
    Use this dependency for POST, PUT, DELETE endpoints.

    SECURITY: The CSRF token is embedded in the JWT during login. The client must:
    1. Store the CSRF token received during login
    2. Send it in the X-CSRF-Token header for all state-changing requests
    3. The token in the header must match the token embedded in the JWT

    This provides defense-in-depth against CSRF attacks even if an attacker
    manages to trick a user into making authenticated requests.
    """
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication required")

    env = request.scope["env"]
    token = credentials.credentials

    try:
        # Get secret
        secret = str(env.JWT_SECRET) if hasattr(env, 'JWT_SECRET') else None
        if not secret:
            raise HTTPException(status_code=500, detail="Server configuration error")

        # Check if token is blacklisted
        if await is_token_blacklisted(env, token):
            raise HTTPException(status_code=401, detail="Token has been revoked")

        # Decode the token
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"]
        )

        user_id = int(payload["sub"])

        # Validate CSRF token
        jwt_csrf = payload.get("csrf")
        if not jwt_csrf:
            raise HTTPException(
                status_code=401,
                detail="Token missing CSRF protection. Please log in again."
            )

        if not x_csrf_token:
            raise HTTPException(
                status_code=403,
                detail="CSRF token required for this request"
            )

        # Constant-time comparison to prevent timing attacks
        if not secrets.compare_digest(jwt_csrf, x_csrf_token):
            raise HTTPException(
                status_code=403,
                detail="Invalid CSRF token"
            )

        return user_id

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail="Authentication error")


def get_redirect_uri(request: Request) -> str:
    """Get the OAuth callback URI based on the request origin"""
    # Check for X-Forwarded headers (common in proxied environments)
    forwarded_proto = request.headers.get("x-forwarded-proto", "https")
    forwarded_host = request.headers.get("x-forwarded-host")

    if forwarded_host:
        base_url = f"{forwarded_proto}://{forwarded_host}"
    else:
        # Fallback to request URL
        host = request.headers.get("host", "localhost:8787")
        scheme = "https" if "workers.dev" in host else "http"
        base_url = f"{scheme}://{host}"

    return f"{base_url}/api/auth/google/callback"


@router.get("/google")
async def google_login(request: Request, redirect_to: str = "/"):
    """
    Initiate Google OAuth2 login.
    Redirects user to Google's consent screen.
    """
    env = request.scope["env"]

    client_id = str(env.GOOGLE_CLIENT_ID) if hasattr(env, 'GOOGLE_CLIENT_ID') else None

    if not client_id:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")

    redirect_uri = get_redirect_uri(request)

    # Build OAuth URL
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account",
        "state": redirect_to  # Pass the redirect destination in state
    }

    auth_url = f"{GOOGLE_AUTH_URL}?{urllib.parse.urlencode(params)}"
    return RedirectResponse(url=auth_url)


@router.get("/google/callback")
async def google_callback(request: Request, code: str = None, error: str = None, state: str = "/"):
    """
    Handle Google OAuth2 callback.
    Exchanges code for tokens, creates/updates user, returns JWT.
    """
    env = request.scope["env"]

    if error:
        # Redirect to frontend with error
        return RedirectResponse(url=f"{state}?auth_error={error}")

    if not code:
        raise HTTPException(status_code=400, detail="No authorization code received")

    client_id = str(env.GOOGLE_CLIENT_ID) if hasattr(env, 'GOOGLE_CLIENT_ID') else None
    client_secret = str(env.GOOGLE_CLIENT_SECRET) if hasattr(env, 'GOOGLE_CLIENT_SECRET') else None

    if not client_id or not client_secret:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")

    redirect_uri = get_redirect_uri(request)

    try:
        async with httpx.AsyncClient() as client:
            # Exchange code for tokens
            token_response = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": redirect_uri
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=10.0
            )

            if token_response.status_code != 200:
                error_detail = token_response.text[:200]
                raise HTTPException(status_code=400, detail=f"Token exchange failed: {error_detail}")

            tokens = token_response.json()
            access_token = tokens.get("access_token")

            if not access_token:
                raise HTTPException(status_code=400, detail="No access token received")

            # Get user info from Google
            userinfo_response = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=10.0
            )

            if userinfo_response.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to get user info")

            google_user = userinfo_response.json()
            google_id = google_user.get("id")
            email = google_user.get("email")
            name = google_user.get("name")
            picture = google_user.get("picture")

            if not google_id or not email:
                raise HTTPException(status_code=400, detail="Invalid user info from Google")

        # Find or create user in database
        existing = await env.DB.prepare(
            "SELECT id, email, name, picture FROM users WHERE google_id = ?"
        ).bind(google_id).first()

        # Convert JsProxy to dict if needed
        if existing and hasattr(existing, 'to_py'):
            existing = existing.to_py()

        if existing:
            user_id = existing["id"]
            # Preserve custom name and picture - don't overwrite user's changes
            current_name = existing.get("name") or ""
            current_picture = existing.get("picture") or ""

            # Only use Google's name if user hasn't set one
            is_custom_name = current_name and current_name != name
            # Only use Google's picture if user hasn't uploaded a custom one
            is_custom_picture = current_picture and "googleusercontent.com" not in current_picture

            if is_custom_name and is_custom_picture:
                # Keep both custom name and picture - no update needed
                pass
            elif is_custom_name:
                # Keep custom name, update picture from Google
                await env.DB.prepare(
                    "UPDATE users SET picture = ? WHERE id = ?"
                ).bind(picture, user_id).run()
            elif is_custom_picture:
                # Keep custom picture, update name from Google
                await env.DB.prepare(
                    "UPDATE users SET name = ? WHERE id = ?"
                ).bind(name, user_id).run()
            else:
                # No custom data, use Google's
                await env.DB.prepare(
                    "UPDATE users SET name = ?, picture = ? WHERE id = ?"
                ).bind(name, picture, user_id).run()
        else:
            # Check if email already exists (from old password auth)
            email_user = await env.DB.prepare(
                "SELECT id FROM users WHERE email = ?"
            ).bind(email).first()

            if email_user and hasattr(email_user, 'to_py'):
                email_user = email_user.to_py()

            if email_user:
                # Link Google account to existing user
                user_id = email_user["id"]
                await env.DB.prepare(
                    "UPDATE users SET google_id = ?, name = ?, picture = ? WHERE id = ?"
                ).bind(google_id, name, picture, user_id).run()
            else:
                # Create new user - if name conflicts, leave blank for user to set later
                try:
                    result = await env.DB.prepare(
                        """INSERT INTO users (email, google_id, name, picture, password_hash)
                           VALUES (?, ?, ?, ?, '') RETURNING id"""
                    ).bind(email, google_id, name, picture).first()

                    if hasattr(result, 'to_py'):
                        result = result.to_py()

                    user_id = result["id"]
                except Exception as e:
                    if "UNIQUE constraint failed: users.name" in str(e):
                        # Name taken - create user without a name, they can set it later
                        result = await env.DB.prepare(
                            """INSERT INTO users (email, google_id, name, picture, password_hash)
                               VALUES (?, ?, NULL, ?, '') RETURNING id"""
                        ).bind(email, google_id, picture).first()

                        if hasattr(result, 'to_py'):
                            result = result.to_py()

                        user_id = result["id"]
                        name = None  # Clear name for redirect URL
                    else:
                        raise

        # Create JWT token with embedded CSRF token
        jwt_secret = str(env.JWT_SECRET) if hasattr(env, 'JWT_SECRET') else None
        if not jwt_secret:
            raise HTTPException(status_code=500, detail="JWT_SECRET not configured")
        token, csrf_token = create_token(user_id, email, jwt_secret)

        # Redirect to frontend with token and CSRF token
        # Frontend will extract tokens from URL and store them
        # CSRF token must be sent in X-CSRF-Token header for state-changing requests
        redirect_url = f"{state}?token={token}&csrf_token={csrf_token}&user_id={user_id}&email={urllib.parse.quote(email)}"
        if name:
            redirect_url += f"&name={urllib.parse.quote(name)}"
        if picture:
            redirect_url += f"&picture={urllib.parse.quote(picture)}"

        return RedirectResponse(url=redirect_url)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OAuth error: {str(e)}")


@router.get("/me")
async def get_me(
    request: Request,
    user_id: int = Depends(require_auth)
) -> UserResponse:
    """
    Get current user info.
    Requires authentication.
    """
    env = request.scope["env"]

    try:
        user = await env.DB.prepare(
            """SELECT id, email, name, picture, bio, pronouns, background_image, created_at
               FROM users WHERE id = ?"""
        ).bind(user_id).first()

        if user and hasattr(user, 'to_py'):
            user = user.to_py()

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        return UserResponse(
            id=user["id"],
            email=user["email"],
            name=user.get("name"),
            picture=user.get("picture"),
            bio=user.get("bio"),
            pronouns=user.get("pronouns"),
            background_image=user.get("background_image"),
            created_at=str(user["created_at"]) if user.get("created_at") else None
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching user: {str(e)}")


@router.post("/refresh")
async def refresh_token(
    request: Request,
    user_id: int = Depends(require_auth)
) -> TokenResponse:
    """
    Refresh JWT token.
    Returns new token with extended expiration.
    """
    env = request.scope["env"]

    try:
        user = await env.DB.prepare(
            "SELECT id, email, name, picture FROM users WHERE id = ?"
        ).bind(user_id).first()

        if user and hasattr(user, 'to_py'):
            user = user.to_py()

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        jwt_secret = str(env.JWT_SECRET) if hasattr(env, 'JWT_SECRET') else None
        if not jwt_secret:
            raise HTTPException(status_code=500, detail="JWT_SECRET not configured")
        token, csrf_token = create_token(user["id"], user["email"], jwt_secret)

        return TokenResponse(
            access_token=token,
            csrf_token=csrf_token,
            user_id=user["id"],
            email=user["email"],
            name=user.get("name"),
            picture=user.get("picture")
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error refreshing token: {str(e)}")


@router.post("/logout")
async def logout(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security)
):
    """
    Logout endpoint.
    Blacklists the current token so it can't be reused.
    Client should also clear stored token.
    """
    if credentials:
        env = request.scope["env"]
        try:
            # Decode token to get expiration time
            secret = str(env.JWT_SECRET) if hasattr(env, 'JWT_SECRET') else None
            if secret:
                payload = jwt.decode(
                    credentials.credentials,
                    secret,
                    algorithms=["HS256"],
                    options={"verify_exp": False}  # Allow expired tokens to be blacklisted
                )
                user_id = int(payload.get("sub", 0))
                exp = payload.get("exp", 0)

                # Add token to blacklist
                await blacklist_token(env, credentials.credentials, user_id, exp)
        except Exception:
            pass  # Logout should succeed even if blacklisting fails

    return {"status": "logged_out", "message": "Token invalidated"}
