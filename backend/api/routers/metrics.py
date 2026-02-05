from fastapi import APIRouter, Request
from fastapi.responses import PlainTextResponse
from typing import Dict
import time

router = APIRouter()

_counters: Dict[str, int] = {
    "http_requests_total": 0,
}
_timings_ms: Dict[str, float] = {
    "http_request_duration_ms_sum": 0.0,
}


def record_request(path: str, duration_ms: float) -> None:
    _counters["http_requests_total"] = _counters.get("http_requests_total", 0) + 1
    key = f"http_requests_total{{path=\"{path}\"}}"
    _counters[key] = _counters.get(key, 0) + 1
    _timings_ms["http_request_duration_ms_sum"] = _timings_ms.get("http_request_duration_ms_sum", 0.0) + float(duration_ms)


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

