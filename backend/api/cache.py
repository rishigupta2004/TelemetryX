"""Cache module with Redis backend for optimal performance."""

from __future__ import annotations

import os
from typing import Any, Hashable, Optional, Tuple
from collections import OrderedDict
import time

_MAX_ENTRIES = int(os.getenv("TELEMETRYX_CACHE_MAX_ENTRIES", "256"))
_TTL_S = float(os.getenv("TELEMETRYX_CACHE_TTL_S", "60"))
# Compatibility cache kept for tests and as a local fallback mirror.
_CACHE: "OrderedDict[Tuple[Hashable, ...], tuple[float, Any]]" = OrderedDict()

# Import the Redis client module
try:
    from .redis_client import (
        cache_get as redis_cache_get,
        cache_set as redis_cache_set,
        cache_delete as redis_cache_delete,
        cache_exists as redis_cache_exists,
        get_redis_client,
        REDIS_TTL_SESSION,
        REDIS_TTL_TELEMETRY,
        REDIS_TTL_POSITIONS,
        REDIS_TTL_STATIC,
    )
except ImportError:
    # Fallback to in-memory cache if Redis is not available
    import logging
    logger = logging.getLogger(__name__)
    logger.warning("Redis not available, using in-memory cache fallback")

    def redis_cache_get(key: Tuple[Hashable, ...]) -> Optional[Any]:
        now = time.time()
        rec = _CACHE.get(key)
        if not rec:
            return None
        ts, value = rec
        if now - ts > _TTL_S:
            try:
                del _CACHE[key]
            except Exception:
                pass
            return None
        _CACHE.move_to_end(key)
        return value

    def redis_cache_set(
        key: Tuple[Hashable, ...], value: Any, ttl: Optional[int] = None
    ) -> bool:
        _CACHE[key] = (time.time(), value)
        _CACHE.move_to_end(key)
        while len(_CACHE) > _MAX_ENTRIES:
            _CACHE.popitem(last=False)
        return True

    def redis_cache_delete(key: Tuple[Hashable, ...]) -> bool:
        try:
            del _CACHE[key]
            return True
        except KeyError:
            return False

    def redis_cache_exists(key: Tuple[Hashable, ...]) -> bool:
        return key in _CACHE

    def get_redis_client() -> Optional[Any]:
        return None

    REDIS_TTL_SESSION = 60
    REDIS_TTL_TELEMETRY = 30
    REDIS_TTL_POSITIONS = 5
    REDIS_TTL_STATIC = 3600


__all__ = [
    "cache_get",
    "cache_set",
    "cache_delete",
    "cache_exists",
    "get_redis_client",
    "REDIS_TTL_SESSION",
    "REDIS_TTL_TELEMETRY",
    "REDIS_TTL_POSITIONS",
    "REDIS_TTL_STATIC",
]


def cache_get(key: Tuple[Hashable, ...]) -> Optional[Any]:
    """Get value from cache."""
    value = redis_cache_get(key)
    if value is not None:
        return value
    rec = _CACHE.get(key)
    if not rec:
        return None
    ts, local_value = rec
    if time.time() - ts > _TTL_S:
        _CACHE.pop(key, None)
        return None
    _CACHE.move_to_end(key)
    return local_value


def cache_set(key: Tuple[Hashable, ...], value: Any, ttl: Optional[int] = None) -> bool:
    """Set value in cache."""
    _CACHE[key] = (time.time(), value)
    _CACHE.move_to_end(key)
    while len(_CACHE) > _MAX_ENTRIES:
        _CACHE.popitem(last=False)
    redis_cache_set(key, value, ttl)
    return True


def cache_delete(key: Tuple[Hashable, ...]) -> bool:
    """Delete value from cache."""
    _CACHE.pop(key, None)
    return redis_cache_delete(key)


def cache_exists(key: Tuple[Hashable, ...]) -> bool:
    """Check if key exists in cache."""
    if key in _CACHE:
        return True
    return redis_cache_exists(key)
