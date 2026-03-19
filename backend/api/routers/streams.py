from fastapi import APIRouter, Query, HTTPException, Header
from fastapi.responses import StreamingResponse
from typing import List, Dict, Any, Optional, Iterator
import json
import os
import urllib.parse
import urllib.request

from api.routers.auth import require_user

router = APIRouter()


def _configured_streams() -> List[Dict[str, Any]]:
    raw = os.getenv("TELEMETRYX_STREAMS_JSON", "").strip()
    if not raw:
        return []
    try:
        payload = json.loads(raw)
    except Exception:
        return []
    if not isinstance(payload, list):
        return []
    rows: List[Dict[str, Any]] = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        stream_id = str(item.get("id") or "").strip()
        stream_name = str(item.get("name") or "").strip()
        stream_type = str(item.get("type") or "").strip()
        stream_url = str(item.get("url") or "").strip()
        if not (stream_id and stream_name and stream_type and stream_url):
            continue
        rows.append(
            {
                "id": stream_id,
                "name": stream_name,
                "type": stream_type,
                "url": stream_url,
            }
        )
    return rows


def _allowed_stream_hosts() -> set[str]:
    hosts: set[str] = set()
    for row in _configured_streams():
        try:
            parsed = urllib.parse.urlparse(str(row.get("url") or ""))
        except Exception:
            continue
        if parsed.hostname:
            hosts.add(parsed.hostname)
    return hosts


@router.get("/streams/list")
async def list_streams(
    authorization: Optional[str] = Header(default=None),
) -> List[Dict[str, Any]]:
    _ = authorization
    return _configured_streams()


@router.get("/streams/proxy")
async def proxy_stream(
    url: str = Query(...),
    authorization: Optional[str] = Header(default=None),
) -> StreamingResponse:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        raise HTTPException(status_code=400, detail="Invalid URL")

    allowed_hosts = _allowed_stream_hosts()
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
