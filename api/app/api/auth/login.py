from fastapi import APIRouter, Depends, Request, Response

from app.core.security import (
    COOKIE_MAX_AGE, COOKIE_NAME, CurrentUser, get_current_user,
)
from app.repositories.session_repository import session_repo
from app.repositories.user_repository import user_repo
from app.schemas.auth import (
    ChangePasswordRequest, LoginRequest, LoginResponse, MeResponse,
)
from app.services.auth_service import auth_service

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, request: Request, response: Response):
    ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("User-Agent", "")
    result = auth_service.login(body, ip, user_agent)
    response.set_cookie(
        COOKIE_NAME,
        result.access_token,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=request.url.scheme == "https",
        path="/",
    )
    return result


@router.post("/logout")
def logout(response: Response, user: CurrentUser = Depends(get_current_user)):
    session_repo.revoke(user.session_id, user.id)
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/me", response_model=MeResponse)
def me(user: CurrentUser = Depends(get_current_user)):
    from app.core.exceptions import not_found

    record = user_repo.find_by_id(user.id)
    if not record:
        raise not_found("User not found")
    return MeResponse(
        id=record["id"],
        username=record["username"],
        email=record["email"],
        role=record["role"],
        is_verified_tick=bool(record["is_verified_tick"]),
        about_me=record.get("about_me"),
        avatar_url=record.get("avatar_url"),
        created_at=record["created_at"],
        is_suspended=user.is_suspended,
        suspended_until=record.get("suspended_until") if user.is_suspended else None,
        suspend_reason=record.get("suspend_reason") if user.is_suspended else None,
        is_flagged=bool(record.get("is_flagged")),
        flag_reason=record.get("flag_reason"),
    )


@router.post("/change-password")
def change_password(body: ChangePasswordRequest, user: CurrentUser = Depends(get_current_user)):
    auth_service.change_password(user.id, body)
    return {"ok": True}
