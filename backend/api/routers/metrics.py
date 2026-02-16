from fastapi import APIRouter, Request
from fastapi.responses import PlainTextResponse
from typing import Any, Deque, Dict
from collections import defaultdict, deque
import time
import math
import re
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

_counters: Dict[str, int] = {
    "http_requests_total": 0,
}
_timings_ms: Dict[str, float] = {
    "http_request_duration_ms_sum": 0.0,
}
_latency_samples: Dict[str, Deque[float]] = defaultdict(lambda: deque(maxlen=1000))
_payload_samples: Dict[str, Deque[int]] = defaultdict(lambda: deque(maxlen=1000))
_endpoint_latency_samples: Dict[str, Deque[float]] = defaultdict(lambda: deque(maxlen=1000))
_endpoint_payload_samples: Dict[str, Deque[int]] = defaultdict(lambda: deque(maxlen=1000))
_endpoint_row_samples: Dict[str, Deque[int]] = defaultdict(lambda: deque(maxlen=1000))
_endpoint_sample_counts: Dict[str, int] = defaultdict(int)

_KEY_ROUTE_PATTERNS = [
    (re.compile(r"^/api/v1/sessions/\d+/[^/]+/[^/]+/telemetry$"), "/api/v1/sessions/{year}/{race}/{session}/telemetry"),
    (re.compile(r"^/api/v1/sessions/\d+/[^/]+/[^/]+/positions$"), "/api/v1/sessions/{year}/{race}/{session}/positions"),
    (re.compile(r"^/api/v1/telemetry/\d+/[^/]+/stream$"), "/api/v1/telemetry/{year}/{round}/stream"),
    (re.compile(r"^/api/v1/positions/\d+/[^/]+/stream$"), "/api/v1/positions/{year}/{round}/stream"),
]


def _bucket_path(path: str) -> str:
    route = str(path or "")
    for pattern, bucket in _KEY_ROUTE_PATTERNS:
        if pattern.match(route):
            return bucket
    return route


def record_request(path: str, duration_ms: float, payload_bytes: int = 0) -> None:
    route = _bucket_path(path)
    _counters["http_requests_total"] = _counters.get("http_requests_total", 0) + 1
    key = f"http_requests_total{{path=\"{route}\"}}"
    _counters[key] = _counters.get(key, 0) + 1
    _timings_ms["http_request_duration_ms_sum"] = _timings_ms.get("http_request_duration_ms_sum", 0.0) + float(duration_ms)
    _latency_samples[route].append(float(duration_ms))
    _payload_samples[route].append(max(0, int(payload_bytes)))


def record_endpoint_sample(path: str, duration_ms: float, payload_bytes: int, row_count: int) -> None:
    route = _bucket_path(path)
    lat = float(duration_ms)
    size = max(0, int(payload_bytes))
    rows = max(0, int(row_count))
    _endpoint_latency_samples[route].append(lat)
    _endpoint_payload_samples[route].append(size)
    _endpoint_row_samples[route].append(rows)
    _endpoint_sample_counts[route] = int(_endpoint_sample_counts.get(route, 0)) + 1
    if _endpoint_sample_counts[route] % 50 == 0:
        lat_sorted = sorted(float(x) for x in _endpoint_latency_samples[route])
        size_sorted = sorted(float(x) for x in _endpoint_payload_samples[route])
        row_sorted = sorted(float(x) for x in _endpoint_row_samples[route])
        logger.info(
            "endpoint_metrics route=%s requests=%d latency_p50_ms=%.2f latency_p95_ms=%.2f payload_p50_bytes=%d payload_p95_bytes=%d rows_p50=%d rows_p95=%d",
            route,
            _endpoint_sample_counts[route],
            _percentile(lat_sorted, 50),
            _percentile(lat_sorted, 95),
            int(round(_percentile(size_sorted, 50))) if size_sorted else 0,
            int(round(_percentile(size_sorted, 95))) if size_sorted else 0,
            int(round(_percentile(row_sorted, 50))) if row_sorted else 0,
            int(round(_percentile(row_sorted, 95))) if row_sorted else 0,
        )


def _percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    if len(values) == 1:
        return float(values[0])
    rank = (len(values) - 1) * (max(0.0, min(100.0, p)) / 100.0)
    lo = int(math.floor(rank))
    hi = int(math.ceil(rank))
    if lo == hi:
        return float(values[lo])
    w = rank - lo
    return float(values[lo] * (1.0 - w) + values[hi] * w)


@router.get("/metrics")
async def metrics() -> PlainTextResponse:
    lines = []
    for k, v in sorted(_counters.items()):
        lines.append(f"{k} {v}")
    for k, v in sorted(_timings_ms.items()):
        lines.append(f"{k} {v}")
    return PlainTextResponse("\n".join(lines) + "\n")


@router.get("/debug/echo-timing")
async def echo_timing(request: Request) -> Dict[str, float]:
    start = time.time()
    await request.body()
    dur = (time.time() - start) * 1000
    return {"ms": dur}


@router.get("/metrics/performance")
async def performance_metrics() -> Dict[str, Any]:
    routes: Dict[str, Any] = {}
    all_paths = set(_latency_samples.keys()) | set(_endpoint_latency_samples.keys())
    for path in all_paths:
        lat_src = _endpoint_latency_samples.get(path) or _latency_samples.get(path, [])
        size_src = _endpoint_payload_samples.get(path) or _payload_samples.get(path, [])
        row_src = _endpoint_row_samples.get(path, [])
        lat = sorted(float(x) for x in lat_src)
        size = sorted(float(x) for x in size_src)
        rows = sorted(float(x) for x in row_src)
        routes[path] = {
            "requests": len(lat),
            "latency_ms": {
                "p50": round(_percentile(lat, 50), 2),
                "p95": round(_percentile(lat, 95), 2),
                "p99": round(_percentile(lat, 99), 2),
                "max": round(float(lat[-1]) if lat else 0.0, 2),
            },
            "payload_bytes": {
                "p50": int(round(_percentile(size, 50))) if size else 0,
                "p95": int(round(_percentile(size, 95))) if size else 0,
                "max": int(round(float(size[-1]))) if size else 0,
            },
            "payload_kb": {
                "p50": round(_percentile(size, 50) / 1024.0, 2) if size else 0.0,
                "p95": round(_percentile(size, 95) / 1024.0, 2) if size else 0.0,
                "max": round((float(size[-1]) / 1024.0) if size else 0.0, 2),
            },
            "row_count": {
                "p50": int(round(_percentile(rows, 50))) if rows else 0,
                "p95": int(round(_percentile(rows, 95))) if rows else 0,
                "max": int(round(float(rows[-1]))) if rows else 0,
            },
        }
    return routes


@router.get("/metrics/performance/summary")
async def performance_summary() -> Dict[str, Any]:
    routes = await performance_metrics()
    key_routes: Dict[str, Any] = {bucket: routes[bucket] for _, bucket in _KEY_ROUTE_PATTERNS if bucket in routes}
    return {"routes": routes, "key_routes": key_routes}
