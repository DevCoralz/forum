from fastapi import APIRouter, Depends

from app.core.exceptions import not_found
from app.core.security import CurrentUser, get_current_user
from app.repositories.session_repository import session_repo
from app.schemas.auth import SessionOut

router = APIRouter()


@router.get("/sessions", response_model=list[SessionOut])
def list_sessions(user: CurrentUser = Depends(get_current_user)):
    rows = session_repo.list_for_user(user.id)
    return [
        SessionOut(
            id=r["id"],
            user_agent=r["user_agent"],
            ip_address=r["ip_address"],
            created_at=r["created_at"],
            last_used=r["last_used"],
            expires_at=r["expires_at"],
            is_current=(r["id"] == user.session_id),
        )
        for r in rows
        if not r["is_revoked"]
    ]


@router.delete("/sessions/{session_id}")
def revoke_session(session_id: str, user: CurrentUser = Depends(get_current_user)):
    ok = session_repo.revoke(session_id, user.id)
    if not ok:
        raise not_found("Session not found")
    return {"ok": True}
