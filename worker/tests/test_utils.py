"""
Tests for utility functions
"""

import pytest
from unittest.mock import MagicMock, AsyncMock


class TestRateLimiting:
    """Tests for rate limiting functionality"""

    @pytest.mark.asyncio
    async def test_get_client_identifier_with_user(self, mock_request):
        """Test client identifier extraction for authenticated user"""
        from utils.rate_limit import get_client_identifier

        mock_request.state.user_id = 123
        identifier = await get_client_identifier(mock_request)
        assert identifier == "user:123"

    @pytest.mark.asyncio
    async def test_get_client_identifier_with_ip(self, mock_request):
        """Test client identifier extraction for anonymous user"""
        from utils.rate_limit import get_client_identifier

        mock_request.state.user_id = None
        mock_request.headers = {"cf-connecting-ip": "1.2.3.4"}
        identifier = await get_client_identifier(mock_request)
        assert identifier == "ip:1.2.3.4"

    @pytest.mark.asyncio
    async def test_get_client_identifier_with_forwarded_ip(self, mock_request):
        """Test client identifier with X-Forwarded-For header"""
        from utils.rate_limit import get_client_identifier

        mock_request.state.user_id = None
        mock_request.headers = {"x-forwarded-for": "5.6.7.8, 1.2.3.4"}
        identifier = await get_client_identifier(mock_request)
        assert identifier == "ip:5.6.7.8"

    @pytest.mark.asyncio
    async def test_rate_limit_allows_request_under_limit(self, mock_request, mock_env):
        """Test that requests under the limit are allowed"""
        from utils.rate_limit import check_rate_limit

        # Mock database to return count under limit
        mock_env.DB.prepare.return_value.bind.return_value.first = AsyncMock(
            return_value={"count": 5}
        )
        mock_env.DB.prepare.return_value.bind.return_value.run = AsyncMock()

        result = await check_rate_limit(mock_request)
        assert result is True


class TestJsNullConversion:
    """Tests for JsNull/JsProxy conversion"""

    def test_to_python_value_with_none(self):
        """Test conversion of None values"""
        from routes.profile import to_python_value

        assert to_python_value(None) is None

    def test_to_python_value_with_string(self):
        """Test conversion of string values"""
        from routes.profile import to_python_value

        assert to_python_value("hello") == "hello"

    def test_to_python_value_with_number(self):
        """Test conversion of numeric values"""
        from routes.profile import to_python_value

        assert to_python_value(42) == 42
        assert to_python_value(3.14) == 3.14

    def test_to_python_value_with_jsnull_like(self):
        """Test conversion of JsNull-like objects"""
        from routes.profile import to_python_value

        # Create a mock object that looks like JsNull
        class JsNull:
            pass

        js_null = JsNull()
        assert to_python_value(js_null) is None
