"""
Tests for API routes
"""

import pytest
from unittest.mock import MagicMock, AsyncMock, patch


class TestAuthRoutes:
    """Tests for authentication routes"""

    @pytest.mark.asyncio
    async def test_require_auth_no_header(self, mock_request):
        """Test auth requirement with no Authorization header"""
        from routes.auth import require_auth
        from fastapi import HTTPException

        mock_request.headers = {}

        with pytest.raises(HTTPException) as exc_info:
            await require_auth(mock_request)

        assert exc_info.value.status_code == 401
        assert "Authorization header missing" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_require_auth_invalid_format(self, mock_request):
        """Test auth requirement with invalid header format"""
        from routes.auth import require_auth
        from fastapi import HTTPException

        mock_request.headers = {"authorization": "InvalidToken"}

        with pytest.raises(HTTPException) as exc_info:
            await require_auth(mock_request)

        assert exc_info.value.status_code == 401


class TestProfileRoutes:
    """Tests for profile routes"""

    @pytest.mark.asyncio
    async def test_profile_response_model(self, sample_user):
        """Test ProfileResponse model validation"""
        from routes.profile import ProfileResponse

        profile = ProfileResponse(**sample_user)
        assert profile.id == 1
        assert profile.email == "test@example.com"
        assert profile.name == "Test User"

    def test_profile_update_model(self):
        """Test ProfileUpdate model validation"""
        from routes.profile import ProfileUpdate

        update = ProfileUpdate(name="New Name", bio="New bio")
        assert update.name == "New Name"
        assert update.bio == "New bio"
        assert update.pronouns is None

    def test_showcase_album_model(self, sample_collection_item):
        """Test ShowcaseAlbum model"""
        from routes.profile import ShowcaseAlbum

        album = ShowcaseAlbum(
            id=1,
            collection_id=1,
            position=0,
            artist="Test Artist",
            album="Test Album",
            cover="https://example.com/cover.jpg",
            year=2024
        )
        assert album.position == 0
        assert album.artist == "Test Artist"


class TestCollectionRoutes:
    """Tests for collection routes"""

    def test_collection_create_model(self):
        """Test CollectionCreate model validation"""
        from routes.collection import CollectionCreate

        item = CollectionCreate(
            artist="Artist Name",
            album="Album Name",
            year=2024
        )
        assert item.artist == "Artist Name"
        assert item.album == "Album Name"
        assert item.year == 2024

    def test_collection_update_model(self):
        """Test CollectionUpdate model with partial data"""
        from routes.collection import CollectionUpdate

        update = CollectionUpdate(artist="New Artist")
        assert update.artist == "New Artist"
        assert update.album is None


class TestChatRoutes:
    """Tests for AI chat routes"""

    def test_chat_request_model(self):
        """Test ChatRequest model validation"""
        from routes.chat import ChatRequest

        request = ChatRequest(
            message="Hello, AI!",
            history=[
                {"role": "user", "content": "Hi"},
                {"role": "assistant", "content": "Hello!"}
            ]
        )
        assert request.message == "Hello, AI!"
        assert len(request.history) == 2


class TestFriendsRoutes:
    """Tests for friends routes"""

    def test_friend_request_model(self):
        """Test FriendRequest model"""
        from routes.friends import FriendRequest

        request = FriendRequest(user_id=123)
        assert request.user_id == 123


class TestMessagesRoutes:
    """Tests for messaging routes"""

    def test_send_message_model(self):
        """Test SendMessage model validation"""
        from routes.messages import SendMessage

        msg = SendMessage(
            recipient_id=123,
            content="Hello, friend!"
        )
        assert msg.recipient_id == 123
        assert msg.content == "Hello, friend!"
