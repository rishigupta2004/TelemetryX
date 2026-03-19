import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import os

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address
from api.routers import (
    seasons,
    races,
    drivers,
    laps,
    telemetry,
    models,
    features,
    positions,
    auth,
    streams,
    metrics,
    sessions,
    fia_documents,
    assets,
    insights,
)
from api.websocket import router as websocket_router
import time
from dotenv import load_dotenv

load_dotenv()


def _parse_csv_env(value: str) -> list[str]:
    parts = [item.strip() for item in value.split(",")]
    return [item for item in parts if item]


app = FastAPI(
    title="F1 Telemetry Dashboard API",
    description="Real-time F1 telemetry data API",
    version="1.0.0",
)

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

_cors_origins_raw = os.getenv("TELEMETRYX_CORS_ORIGINS", "*")
_cors_origins = _parse_csv_env(_cors_origins_raw) or ["*"]
_allow_any_origin = len(_cors_origins) == 1 and _cors_origins[0] == "*"

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=not _allow_any_origin,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)


def _resolve_require_auth() -> bool:
    explicit = os.getenv("TELEMETRYX_REQUIRE_AUTH")
    if explicit is not None:
        return explicit.strip() == "1"
    if "pytest" in sys.modules:
        return False
    return True


# Optional auth gate. Enabled by default outside tests.
_REQUIRE_AUTH = _resolve_require_auth()
try:
    from api.clerk_auth import require_user

    _AUTH_DEPS = [Depends(require_user)] if _REQUIRE_AUTH else []
except Exception:
    _AUTH_DEPS = []


@app.middleware("http")
async def request_timing_middleware(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration_ms = (time.time() - start) * 1000
    payload_bytes = 0
    try:
        payload_bytes = int(response.headers.get("content-length", "0") or 0)
    except Exception:
        payload_bytes = 0
    try:
        metrics.record_request(
            request.url.path, duration_ms, payload_bytes=payload_bytes
        )
    except Exception:
        pass
    response.headers["x-telemetryx-duration-ms"] = f"{duration_ms:.2f}"
    # Add Cache-Control for static-ish endpoints
    path = request.url.path
    if any(seg in path for seg in ["/seasons", "/races", "/standings", "/profiles"]):
        response.headers.setdefault(
            "Cache-Control", "public, max-age=60, stale-while-revalidate=120"
        )
    return response


app.include_router(
    seasons.router, prefix="/api/v1", tags=["Seasons"], dependencies=_AUTH_DEPS
)
app.include_router(
    races.router, prefix="/api/v1", tags=["Races"], dependencies=_AUTH_DEPS
)
app.include_router(
    sessions.router, prefix="/api/v1", tags=["Sessions"], dependencies=_AUTH_DEPS
)
app.include_router(
    drivers.router, prefix="/api/v1", tags=["Drivers"], dependencies=_AUTH_DEPS
)
app.include_router(
    laps.router, prefix="/api/v1", tags=["Laps"], dependencies=_AUTH_DEPS
)
app.include_router(
    telemetry.router, prefix="/api/v1", tags=["Telemetry"], dependencies=_AUTH_DEPS
)
app.include_router(
    positions.router, prefix="/api/v1", tags=["Positions"], dependencies=_AUTH_DEPS
)
app.include_router(
    streams.router, prefix="/api/v1", tags=["Streams"], dependencies=_AUTH_DEPS
)
app.include_router(
    metrics.router, prefix="/api/v1", tags=["Metrics"], dependencies=_AUTH_DEPS
)
app.include_router(
    models.router, prefix="/api/v1", tags=["Models"], dependencies=_AUTH_DEPS
)
app.include_router(
    features.router, prefix="/api/v1", tags=["Features"], dependencies=_AUTH_DEPS
)
app.include_router(
    fia_documents.router,
    prefix="/api/v1",
    tags=["FIA Documents"],
    dependencies=_AUTH_DEPS,
)
app.include_router(
    assets.router, prefix="/api/v1", tags=["Assets"], dependencies=_AUTH_DEPS
)
app.include_router(
    insights.router, prefix="/api/v1", tags=["Insights"], dependencies=_AUTH_DEPS
)
app.include_router(
    websocket_router, prefix="/api/v1", tags=["WebSocket"], dependencies=_AUTH_DEPS
)

# Auth endpoints must remain public (used to obtain a token).
app.include_router(auth.router, prefix="/api/v1", tags=["Auth"])


@app.get("/")
async def root():
    return {"message": "F1 Telemetry Dashboard API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    # Port configuration: Use PORT env var, fallback to 9000
    port = int(os.getenv("PORT", "9000"))
    reload_enabled = str(os.getenv("TELEMETRYX_RELOAD", "0")).strip() in {"1", "true", "yes", "on"}

    print(f"🚀 Starting TelemetryX Backend on port {port}")
    print(f"📡 API Docs: http://localhost:{port}/docs")
    print(f"💡 To use different port: PORT=8080 python main.py")
    print(f"🔁 Hot reload: {'enabled' if reload_enabled else 'disabled'}")

    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=reload_enabled, log_level="info")
