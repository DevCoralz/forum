"""Token handshake: the allowed frontend exchanges its origin for a short-lived
signed token before calling protected endpoints."""
from fastapi import APIRouter, Request

from app.core.client_guard import TOKEN_TTL_SECONDS, issue_token, origin_allowed

router = APIRouter()


@router.post("/handshake")
def handshake(request: Request):
    from fastapi.responses import JSONResponse

    origin = (request.headers.get("origin") or "").rstrip("/")
    if not origin:
        # Same-origin browser calls may omit Origin — treat as the first
        # allowed origin so the token still binds to a known site.
        fetch_site = request.headers.get("sec-fetch-site", "")
        if fetch_site not in ("same-origin", "same-site", "none"):
            return JSONResponse({"detail": "Origin not allowed"}, status_code=403)
        from app.core.client_guard import ORIGINS
        origin = ORIGINS[0] if ORIGINS else ""
    if not origin_allowed(origin):
        return JSONResponse({"detail": "Origin not allowed"}, status_code=403)
    return {"token": issue_token(origin), "expires_in": TOKEN_TTL_SECONDS}

