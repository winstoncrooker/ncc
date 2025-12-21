"""
JWT Authentication routes
"""

from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
import jwt
import hashlib
from datetime import datetime, timedelta

router = APIRouter()
security = HTTPBearer(auto_error=False)


class RegisterRequest(BaseModel):
    """User registration request"""
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    """User login request"""
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """JWT token response"""
    access_token: str
    token_type: str = "bearer"
    user_id: int
    email: str


class UserResponse(BaseModel):
    """Current user info"""
    id: int
    email: str
    created_at: str | None = None


def hash_password(password: str) -> str:
    """
    Hash password using SHA-256.
    Note: In production, consider using argon2 if available in Pyodide.
    """
    # Add a simple salt based on the password length for basic security
    salted = f"vinyl_vault_{len(password)}_{password}"
    return hashlib.sha256(salted.encode()).hexdigest()


def verify_password(password: str, hashed: str) -> bool:
    """Verify password against hash"""
    return hash_password(password) == hashed


def create_token(user_id: int, email: str, secret: str) -> str:
    """Create JWT token"""
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.utcnow() + timedelta(days=7),
        "iat": datetime.utcnow()
    }
    return jwt.encode(payload, secret, algorithm="HS256")


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
    try:
        payload = jwt.decode(
            credentials.credentials,
            env.JWT_SECRET,
            algorithms=["HS256"]
        )
        return payload["sub"]
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
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


@router.post("/register")
async def register(request: Request, body: RegisterRequest) -> TokenResponse:
    """
    Register a new user.
    Returns JWT token on success.
    """
    env = request.scope["env"]

    # Validate password
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    # Check if email already exists
    try:
        existing = await env.DB.prepare(
            "SELECT id FROM users WHERE email = ?"
        ).bind(body.email).first()

        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    # Create user
    try:
        hashed = hash_password(body.password)
        result = await env.DB.prepare(
            "INSERT INTO users (email, password_hash) VALUES (?, ?) RETURNING id"
        ).bind(body.email, hashed).first()

        user_id = result["id"]
        token = create_token(user_id, body.email, env.JWT_SECRET)

        return TokenResponse(
            access_token=token,
            user_id=user_id,
            email=body.email
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create user: {str(e)}")


@router.post("/login")
async def login(request: Request, body: LoginRequest) -> TokenResponse:
    """
    Login with email and password.
    Returns JWT token on success.
    """
    env = request.scope["env"]

    try:
        user = await env.DB.prepare(
            "SELECT id, email, password_hash FROM users WHERE email = ?"
        ).bind(body.email).first()

        if not user:
            raise HTTPException(status_code=401, detail="Invalid email or password")

        if not verify_password(body.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")

        token = create_token(user["id"], user["email"], env.JWT_SECRET)

        return TokenResponse(
            access_token=token,
            user_id=user["id"],
            email=user["email"]
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Login error: {str(e)}")


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
            "SELECT id, email, created_at FROM users WHERE id = ?"
        ).bind(user_id).first()

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        return UserResponse(
            id=user["id"],
            email=user["email"],
            created_at=str(user["created_at"]) if user["created_at"] else None
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
            "SELECT id, email FROM users WHERE id = ?"
        ).bind(user_id).first()

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        token = create_token(user["id"], user["email"], env.JWT_SECRET)

        return TokenResponse(
            access_token=token,
            user_id=user["id"],
            email=user["email"]
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error refreshing token: {str(e)}")
