"""Integration tests for API client"""

import pytest
import pytest_asyncio
from app.services.api.client import APIClient, APIConfig


class TestAPIClient:
    """Test API Client integration"""

    @pytest_asyncio.fixture
    async def client(self):
        """Create API client for testing"""
        config = APIConfig(base_url="http://localhost:8000")
        client = APIClient(config)
        yield client
        await client.close()

    @pytest.mark.asyncio
    async def test_client_context_manager(self):
        """Test async context manager"""
        config = APIConfig(base_url="http://localhost:8000")

        async with APIClient(config) as client:
            assert client._client is not None

    @pytest.mark.asyncio
    async def test_health_check_offline(self, client):
        """Test health check when server is offline"""
        # Should return False when server is not running
        result = await client.health_check()
        assert result is False


class TestCaching:
    """Test caching layers"""

    def test_memory_cache(self):
        """Test memory cache operations"""
        from app.services.cache.memory_cache import MemoryCache

        cache = MemoryCache(max_size_mb=100)

        # Set and get
        cache.set("key1", {"data": "value"})
        result = cache.get("key1")
        assert result == {"data": "value"}

        # Non-existent key
        assert cache.get("nonexistent") is None

        # Delete
        cache.delete("key1")
        assert cache.get("key1") is None

        # Stats
        stats = cache.get_stats()
        assert "entries" in stats
        assert "size_mb" in stats
