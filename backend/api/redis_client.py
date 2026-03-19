"""Redis client module with connection pooling for caching."""

from __future__ import annotations

import json
import os
import time
from typing import Any, Optional, Tuple
from functools import wraps
import logging

import redis

logger = logging.getLogger(__name__)

# Default configuration
REDIS_ENABLED = str(os.getenv("REDIS_ENABLED", "1")).strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD") or None
REDIS_DB = int(os.getenv("REDIS_DB", "0"))
REDIS_POOL_MAX_CONNECTIONS = int(os.getenv("REDIS_POOL_MAX_CONNECTIONS", "20"))
REDIS_MAX_MEMORY_MB = int(os.getenv("REDIS_MAX_MEMORY_MB", "512"))
REDIS_TTL_SESSION = int(os.getenv("REDIS_TTL_SESSION", "60"))  # seconds
REDIS_TTL_TELEMETRY = int(os.getenv("REDIS_TTL_TELEMETRY", "30"))
REDIS_TTL_POSITIONS = int(os.getenv("REDIS_TTL_POSITIONS", "5"))
REDIS_TTL_STATIC = int(os.getenv("REDIS_TTL_STATIC", "3600"))
REDIS_CONNECT_RETRY_SECONDS = float(os.getenv("REDIS_CONNECT_RETRY_SECONDS", "15"))


class RedisConnectionPool:
    """Thread-safe Redis connection pool with singleton pattern."""

    _instance = None
    _client = None
    _initialized = False
    _last_attempt_ts = 0.0

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        self._client = None
        self._initialized = True

    def _create_client(self) -> Optional[redis.Redis]:
        """Create a new Redis client with connection pooling."""
        if not REDIS_ENABLED:
            return None
        try:
            from redis import ConnectionPool

            pool = ConnectionPool(
                host=REDIS_HOST,
                port=REDIS_PORT,
                password=REDIS_PASSWORD,
                db=REDIS_DB,
                max_connections=REDIS_POOL_MAX_CONNECTIONS,
                socket_timeout=5,
                socket_connect_timeout=5,
                retry_on_timeout=True,
                health_check_interval=30,
            )

            client = redis.Redis(
                connection_pool=pool,
                decode_responses=False,  # Keep as bytes for performance
            )

            # Test connection
            client.ping()

            return client
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}")
            return None

    @property
    def client(self) -> Optional[redis.Redis]:
        """Get Redis client (lazy initialization)."""
        if not REDIS_ENABLED:
            return None
        if self._client is None:
            now = time.time()
            if now - float(self._last_attempt_ts) < REDIS_CONNECT_RETRY_SECONDS:
                return None
            self._last_attempt_ts = now
            self._client = self._create_client()
        return self._client

    def close(self):
        """Close all connections."""
        if self._client:
            try:
                self._client.close()
            except Exception:
                pass
            self._client = None

    def clear_all(self) -> bool:
        """Clear all keys in current Redis DB (useful for testing)."""
        if not self._client:
            return False
        try:
            self._client.flushdb()
            return True
        except Exception:
            return False


# Singleton instance
redis_pool = RedisConnectionPool()


def get_redis_client() -> Optional[redis.Redis]:
    """Get the Redis client instance."""
    return redis_pool.client


def cache_set(
    key: Tuple[Hashable, ...],
    value: Any,
    ttl: Optional[int] = None,
) -> bool:
    """Set a value in Redis cache.

    Args:
        key: Cache key (will be serialized)
        value: Value to cache
        ttl: Time to live in seconds (default: REDIS_TTL_SESSION)

    Returns:
        True if successful, False otherwise
    """
    client = get_redis_client()
    if client is None:
        return False

    try:
        serialized_key = _serialize_key(key)
        serialized_value = _serialize_value(value)

        if ttl is None:
            ttl = REDIS_TTL_SESSION

        return bool(client.set(serialized_key, serialized_value, ex=ttl))
    except Exception:
        return False


def cache_get(key: Tuple[Hashable, ...]) -> Optional[Any]:
    """Get a value from Redis cache.

    Args:
        key: Cache key

    Returns:
        Cached value or None if not found/expired
    """
    client = get_redis_client()
    if client is None:
        return None

    try:
        serialized_key = _serialize_key(key)
        data = client.get(serialized_key)
        if data is None:
            return None
        return _deserialize_value(data)
    except Exception:
        return None


def cache_delete(key: Tuple[Hashable, ...]) -> bool:
    """Delete a value from Redis cache.

    Args:
        key: Cache key

    Returns:
        True if deleted, False otherwise
    """
    client = get_redis_client()
    if client is None:
        return False

    try:
        serialized_key = _serialize_key(key)
        return bool(client.delete(serialized_key))
    except Exception:
        return False


def cache_delete_pattern(pattern: str) -> int:
    """Delete all keys matching a pattern.

    Args:
        pattern: Redis key pattern (e.g., "session:*")

    Returns:
        Number of keys deleted
    """
    client = get_redis_client()
    if client is None:
        return 0

    try:
        keys = client.keys(pattern)
        if keys:
            return int(client.delete(*keys))
        return 0
    except Exception:
        return 0


def cache_exists(key: Tuple[Hashable, ...]) -> bool:
    """Check if a key exists in cache.

    Args:
        key: Cache key

    Returns:
        True if key exists and is not expired
    """
    client = get_redis_client()
    if client is None:
        return False

    try:
        serialized_key = _serialize_key(key)
        return bool(client.exists(serialized_key))
    except Exception:
        return False


def _serialize_key(key: Tuple[Hashable, ...]) -> bytes:
    """Serialize key tuple to bytes."""
    return f"telemetryx:{json.dumps(key)}".encode("utf-8")


def _serialize_value(value: Any) -> bytes:
    """Serialize value to bytes using MessagePack-like format."""
    try:
        import msgpack

        return msgpack.packb(value, use_bin_type=True)
    except ImportError:
        # Fallback to JSON
        return json.dumps(value, separators=(",", ":")).encode("utf-8")


def _deserialize_value(data: bytes) -> Any:
    """Deserialize bytes to value."""
    try:
        import msgpack

        return msgpack.unpackb(data, raw=False)
    except ImportError:
        return json.loads(data.decode("utf-8"))


def cache_wrapper(ttl: Optional[int] = None):
    """Decorator to cache function results."""

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Create cache key from function name and arguments
            cache_key = (func.__name__, str(args), str(sorted(kwargs.items())))

            # Try to get from cache
            cached = cache_get(cache_key)
            if cached is not None:
                return cached

            # Execute function
            result = func(*args, **kwargs)

            # Store in cache
            cache_set(cache_key, result, ttl)

            return result

        return wrapper

    return decorator
