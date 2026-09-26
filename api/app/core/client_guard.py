"""Client guard: only allowed origins may call the API, and each client proves
itself with a short-lived signed token obtained from the handshake endpoint.

- CORS still handles browser preflight and response headers.
- Non-browser callers (curl etc.) cannot fake the browser's Origin header
  without knowing the signed-token secret, and tokens expire in 10 minutes.
- Image/video requests, docs and the handshake itself stay public so the site
  can render media without headers.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
import time
from base64 import urlsafe_b64decode, urlsafe_b64encode

from app.core.config import CORS_ORIGINS, JWT_SECRET

# Tokens are signed with the same secret as login sessions unless a dedicated
# CLIENT_GUARD_SECRET is set on the server.
SECRET = os.environ.get("CLIENT_GUARD_SECRET", JWT_SECRET)

TOKEN_TTL_SECONDS = 600
ORIGINS = [o.rstrip("/") for o in CORS_ORIGINS]

# Paths that must stay reachable without a token (images, docs, handshake).
EXEMPT_PREFIXES = (
    "/api/v1/client/handshake", "/api/v1/media/", "/uploads", "/api/docs",
    "/api/openapi.json", "/api/v1/site",  # public bootstrap/meta (read-only)
)


def _sign(payload: bytes) -> str:
    return urlsafe_b64encode(hmac.new(SECRET.encode(), payload, hashlib.sha256).digest()).decode().rstrip("=")


def _origin_hash(origin: str) -> str:
    return hashlib.sha256(origin.encode()).hexdigest()[:16]


def issue_token(origin: str) -> str:
    payload = json.dumps(
        {"n": secrets.token_urlsafe(12), "e": int(time.time()) + TOKEN_TTL_SECONDS, "o": _origin_hash(origin)},
        separators=(",", ":"),
    ).encode()
    body = urlsafe_b64encode(payload).decode().rstrip("=")
    return f"{body}.{_sign(body.encode())}"


def verify_token(token: str | None, origin: str) -> bool:
    if not token or "." not in token:
        return False
    body, sig = token.rsplit(".", 1)
    if not hmac.compare_digest(_sign(body.encode()), sig):
        return False
    try:
        padded = body + "=" * (-len(body) % 4)
        data = json.loads(urlsafe_b64decode(padded))
    except Exception:
        return False
    if int(data.get("e", 0)) < time.time():
        return False
    return hmac.compare_digest(str(data.get("o", "")), _origin_hash(origin))


def origin_allowed(origin: str | None) -> bool:
    return bool(origin) and origin.rstrip("/") in ORIGINS


class ClientGuardMiddleware:
    """Pure ASGI middleware — cheaper than BaseHTTPMiddleware."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = {k.decode("latin-1").lower(): v.decode("latin-1") for k, v in scope.get("headers", [])}
        path = scope.get("path", "")
        method = scope.get("method", "GET")

        if method == "OPTIONS" or not path.startswith("/api/v1/") or any(path.startswith(p) for p in EXEMPT_PREFIXES):
            await self.app(scope, receive, send)
            return

        origin = headers.get("origin")
        fetch_site = headers.get("sec-fetch-site", "")

        # 1. Only the allowed site may call.
        if origin:
            if not origin_allowed(origin):
                await self._reject(send, 403, "Origin not allowed")
                return
        elif fetch_site not in ("same-origin", "same-site", "none"):
            # No Origin header: allow only real same-origin browser calls.
            # Anything else (curl, scripts, other servers) is rejected.
            await self._reject(send, 403, "Origin not allowed")
            return

        # 2. The client must hold a fresh signed token from the handshake.
        token = headers.get("x-client-token")
        if origin:
            token_ok = verify_token(token, origin.rstrip("/"))
        else:
            # Same-origin calls may omit the Origin header — the token still
            # carries it, so accept any token issued for an allowed origin.
            token_ok = any(verify_token(token, o) for o in ORIGINS)
        if not token_ok:
            await self._reject(send, 401, "client_token_required")
            return

        await self.app(scope, receive, send)

    async def _reject(self, send, status: int, detail: str) -> None:
        body = json.dumps({"detail": detail}).encode()
        await send({
            "type": "http.response.start",
            "status": status,
            "headers": [
                (b"content-type", b"application/json"),
                (b"content-length", str(len(body)).encode()),
            ],
        })
        await send({"type": "http.response.body", "body": body})
