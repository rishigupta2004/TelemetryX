from __future__ import annotations

import os
import time
from collections import OrderedDict
from typing import Any, Hashable, Optional, Tuple

_MAX_ENTRIES = int(os.getenv("TELEMETRYX_CACHE_MAX_ENTRIES", "64"))
_TTL_S = float(os.getenv("TELEMETRYX_CACHE_TTL_S", "300"))

_CACHE: "OrderedDict[Tuple[Hashable, ...], tuple[float, Any]]" = OrderedDict()


def cache_get(key: Tuple[Hashable, ...]) -> Optional[Any]:
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


def cache_set(key: Tuple[Hashable, ...], value: Any) -> Any:
    _CACHE[key] = (time.time(), value)
    _CACHE.move_to_end(key)
    while len(_CACHE) > _MAX_ENTRIES:
        _CACHE.popitem(last=False)
    return value

