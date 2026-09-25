import time
from datetime import datetime

from app.core.database import new_id
from app.core.exceptions import (
    conflict, forbidden, registration_closed, too_many_attempts, unauthorized,
)
from app.core.security import create_access_token, hash_password, verify_password
from app.repositories.session_repository import session_repo
from app.repositories.user_repository import user_repo
from app.schemas.auth import (
    ChangePasswordRequest, LoginRequest, LoginResponse, LoginUser,
    RegisterRequest, RegisterResponse,
)

# Failed-login limiter (in-process, per IP and per username)
_MAX_FAILS, _WINDOW = 5, 15 * 60
_fails: dict[str, list[float]] = {}

# Dummy hash so unknown usernames cost the same time as wrong passwords
_DUMMY_HASH = hash_password("dummy-password-for-timing")


def _recent(key: str) -> list[float]:
    now = time.time()
    hits = [t for t in _fails.get(key, []) if now - t < _WINDOW]
    _fails[key] = hits
    return hits


def _check_limit(*keys: str) -> None:
    if any(len(_recent(k)) >= _MAX_FAILS for k in keys):
        raise too_many_attempts()


def _record_fail(*keys: str) -> None:
    now = time.time()
    for k in keys:
        _fails.setdefault(k, []).append(now)


def _clear(*keys: str) -> None:
    for k in keys:
        _fails.pop(k, None)


class AuthService:
    def register(self, body: RegisterRequest) -> RegisterResponse:
        if not user_repo.is_registration_open():
            raise registration_closed()

        if user_repo.email_or_username_exists(body.email, body.username):
            raise conflict("Email or username already taken")

        user = user_repo.create(
            username=body.username,
            email=body.email,
            password_hash=hash_password(body.password),
            # Every new account starts on the free plan; upgrades are granted later.
            role="free",
        )

        return RegisterResponse(
            id=user["id"],
            username=user["username"],
            email=user["email"],
            role=user["role"],
            created_at=user["created_at"],
        )

    def login(self, body: LoginRequest, ip: str, user_agent: str = "") -> LoginResponse:
        uname = body.username.strip().lower()
        ip_key, user_key = f"ip:{ip}", f"user:{uname}"
        _check_limit(ip_key, user_key)

        user = user_repo.find_by_username_ci(body.username.strip())
        hashed = user["password_hash"] if user else _DUMMY_HASH
        password_ok = verify_password(body.password, hashed)

        if not user or not password_ok:
            _record_fail(ip_key, user_key)
            raise unauthorized("Invalid username or password")

        if user["is_banned"]:
            raise forbidden("This account has been banned")

        if user["is_suspended"]:
            until = user.get("suspended_until")
            if until is None or datetime.now() < until:
                raise forbidden("This account is suspended")
            user_repo.clear_suspension(user["id"])

        _clear(ip_key, user_key)
        user_repo.update_last_login(user["id"])

        session_id = new_id()
        token = create_access_token(user["id"], user["role"], session_id=session_id)
        session_repo.create(session_id, user["id"], token, user_agent, ip)

        return LoginResponse(
            access_token=token,
            user=LoginUser(
                id=user["id"],
                username=user["username"],
                role=user["role"],
                is_verified_tick=bool(user["is_verified_tick"]),
            ),
        )

    def change_password(self, user_id: str, body: ChangePasswordRequest) -> None:
        user = user_repo.find_by_id(user_id)
        if not user or not verify_password(body.current_password, user["password_hash"]):
            raise unauthorized("Current password is incorrect")
        user_repo.update_password(user_id, hash_password(body.new_password))


auth_service = AuthService()
