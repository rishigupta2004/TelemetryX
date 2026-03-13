from fastapi import APIRouter, Query, HTTPException, Header
from fastapi.responses import StreamingResponse
from typing import List, Dict, Any, Optional, Iterator
import urllib.parse
import urllib.request

from api.routers.auth import require_user

router = APIRouter()


DEMO_STREAMS: List[Dict[str, Any]] = [
    {
        "id": "demo-bbb-hls",
        "name": "Demo HLS (Big Buck Bunny)",
        "type": "hls",
        "url": "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    },
    {
        "id": "demo-elephants-hls",
        "name": "Demo HLS (Elephants Dream)",
        "type": "hls",
        "url": "https://test-streams.mux.dev/pts_shift/master.m3u8",
    },
]


@router.get("/streams/list")
async def list_streams(
    authorization: Optional[str] = Header(default=None),
) -> List[Dict[str, Any]]:
    _ = authorization
    return list(DEMO_STREAMS)


@router.get("/streams/proxy")
async def proxy_stream(
    url: str = Query(...),
    authorization: Optional[str] = Header(default=None),
) -> StreamingResponse:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        raise HTTPException(status_code=400, detail="Invalid URL")

    allowed_hosts = {
        "test-streams.mux.dev",
    }
    if parsed.hostname not in allowed_hosts:
        raise HTTPException(status_code=403, detail="Host not allowed")

    if "/protected" in parsed.path:
        if not authorization:
            raise HTTPException(status_code=401, detail="Missing bearer token")
        _ = require_user(authorization)

    req = urllib.request.Request(url, headers={"User-Agent": "TelemetryX/1.0"})
    resp = urllib.request.urlopen(req, timeout=15)
    content_type = resp.headers.get("Content-Type", "application/octet-stream")

    def _iter() -> Iterator[bytes]:
        try:
            while True:
                chunk = resp.read(1024 * 256)
                if not chunk:
                    break
                yield chunk
        finally:
            try:
                resp.close()
            except Exception:
                pass

    return StreamingResponse(_iter(), media_type=content_type)
