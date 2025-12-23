"""
Pytest configuration and fixtures for NCC API tests
"""

import pytest
from unittest.mock import MagicMock, AsyncMock


@pytest.fixture
def mock_env():
    """Create a mock Cloudflare Workers environment"""
    env = MagicMock()

    # Mock D1 database
    db_mock = MagicMock()
    db_mock.prepare = MagicMock(return_value=db_mock)
    db_mock.bind = MagicMock(return_value=db_mock)
    db_mock.first = AsyncMock(return_value=None)
    db_mock.all = AsyncMock(return_value=MagicMock(results=[]))
    db_mock.run = AsyncMock(return_value=None)
    env.DB = db_mock

    # Mock R2 bucket
    r2_mock = MagicMock()
    r2_mock.get = AsyncMock(return_value=None)
    r2_mock.put = AsyncMock(return_value=None)
    env.CACHE_BUCKET = r2_mock

    # Mock secrets
    env.GOOGLE_CLIENT_ID = "test-client-id"
    env.GOOGLE_CLIENT_SECRET = "test-client-secret"
    env.JWT_SECRET = "test-jwt-secret"
    env.DISCOGS_KEY = "test-discogs-key"
    env.DISCOGS_SECRET = "test-discogs-secret"
    env.TOGETHER_API_KEY = "test-together-key"

    return env


@pytest.fixture
def mock_request(mock_env):
    """Create a mock FastAPI request with environment"""
    request = MagicMock()
    request.scope = {"env": mock_env}
    request.headers = {}
    request.client = MagicMock(host="127.0.0.1")
    request.state = MagicMock()
    return request


@pytest.fixture
def sample_user():
    """Sample user data for testing"""
    return {
        "id": 1,
        "email": "test@example.com",
        "name": "Test User",
        "picture": "https://example.com/pic.jpg",
        "bio": "Test bio",
        "pronouns": "they/them",
        "google_id": "google-123",
        "created_at": "2024-01-01 00:00:00"
    }


@pytest.fixture
def sample_collection_item():
    """Sample collection item for testing"""
    return {
        "id": 1,
        "user_id": 1,
        "artist": "Test Artist",
        "album": "Test Album",
        "genre": "Rock",
        "cover": "https://example.com/cover.jpg",
        "price": 25.99,
        "discogs_id": 12345,
        "year": 2024,
        "category_id": 1,
        "created_at": "2024-01-01 00:00:00"
    }


@pytest.fixture
def auth_headers():
    """Sample authorization headers"""
    return {"Authorization": "Bearer test-token"}
