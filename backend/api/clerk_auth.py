from __future__ import annotations

import os
from functools import lru_cache
from typing import Any, Dict, Optional

from fastapi import Header, HTTPException
from jwt import InvalidTokenError, PyJWKClient, decode as jwt_decode


def _get_required_env(name: str) -> str:
    value = str(os.getenv(name, "")).strip()
    if not value:
        raise HTTPException(status_code=500, detail=f"Missing required env: {name}")
    return value


def _normalize_issuer(value: str) -> str:
    return value.rstrip("/")


@lru_cache(maxsize=2)
def _jwk_client(jwks_url: str) -> PyJWKClient:
    return PyJWKClient(jwks_url)


def _decode_clerk_token(token: str) -> Dict[str, Any]:
    issuer = _normalize_issuer(_get_required_env("CLERK_ISSUER"))
    audience = str(os.getenv("CLERK_AUDIENCE", "")).strip() or None
    jwks_url = (
        str(os.getenv("CLERK_JWKS_URL", "")).strip()
        or f"{issuer}/.well-known/jwks.json"
    )


def verify_clerk_token(token: str) -> Dict[str, str]:
    payload = _decode_clerk_token(token)
    user_id = str(payload.get("sub") or "").strip()
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid Clerk token payload")

    email = (
        payload.get("email")
        or payload.get("email_address")
        or payload.get("primary_email_address")
        or ""
    )
    org_id = payload.get("org_id") or payload.get("organization_id") or ""
    return {
        "user_id": user_id,
        "email": str(email),
        "org_id": str(org_id or ""),
    }
    signing_key = _jwk_client(jwks_url).get_signing_key_from_jwt(token)
    options = {"verify_aud": audience is not None}
    return jwt_decode(
        token,
        signing_key.key,
        algorithms=["RS256"],
        issuer=issuer,
        audience=audience,
        options=options,
    )


def require_user(authorization: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")

    try:
        return verify_clerk_token(token)
    except InvalidTokenError as exc:
        raise HTTPException(
            status_code=401, detail=f"Invalid Clerk token: {exc}"
        ) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=401, detail=f"Invalid Clerk token: {exc}"
        ) from exc
