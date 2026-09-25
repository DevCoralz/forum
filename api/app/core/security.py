import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, Request
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import JWT_ALGORITHM, JWT_EXPIRE_HOURS, JWT_SECRET
from app.core.database import new_id
from app.core.exceptions import unauthorized

COOKIE_NAME = "cz_session"
COOKIE_MAX_AGE = JWT_EXPIRE_HOURS * 3600

_pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return _pwd_ctx.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_ctx.verify(plain, hashed)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_access_token(user_id: str, role: str, session_id: Optional[str] = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS)
    sid = session_id or new_id()
    payload = {"sub": user_id, "role": role, "sid": sid, "exp": expire}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        return None


class CurrentUser:
    """Lightweight identity extracted from a verified, non-revoked session."""

    def __init__(self, user_id: str, role: str, session_id: str):
        self.id = user_id
        self.role = role
        self.session_id = session_id


def get_current_user(request: Request) -> CurrentUser:
    from app.repositories.session_repository import session_repo

    token = request.cookies.get(COOKIE_NAME)
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise unauthorized()

    payload = decode_access_token(token)
    if not payload:
        raise unauthorized()

    sid = payload.get("sid")
    if not sid or not session_repo.is_active(sid):
        raise unauthorized("Session expired or revoked")

    session_repo.touch(sid)
    return CurrentUser(user_id=payload["sub"], role=payload["role"], session_id=sid)


def get_optional_user(request: Request) -> Optional[CurrentUser]:
    try:
        return get_current_user(request)
    except Exception:
        return None


def require_roles(*roles: str):
    def _dep(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role not in roles:
            from app.core.exceptions import forbidden
            raise forbidden("You don't have permission to do this")
        return user
    return _dep
