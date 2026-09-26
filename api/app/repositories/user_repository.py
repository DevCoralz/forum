from typing import Optional

from app.core.database import get_db, new_id
from app.models.user import User


class UserRepository:
    def find_by_email(self, email: str) -> Optional[User]:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM users WHERE email=%s", (email,))
                return cur.fetchone()

    def find_by_username(self, username: str) -> Optional[User]:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM users WHERE username=%s", (username,))
                return cur.fetchone()

    def find_by_id(self, user_id: str) -> Optional[User]:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM users WHERE id=%s", (user_id,))
                return cur.fetchone()

    def email_or_username_exists(self, email: str, username: str) -> bool:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id FROM users WHERE LOWER(email)=LOWER(%s) OR LOWER(username)=LOWER(%s)",
                    (email, username),
                )
                return cur.fetchone() is not None

    def create(self, username: str, email: str, password_hash: str, role: str = "free") -> User:
        uid = new_id()
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO users (id, username, email, password_hash, role)
                       VALUES (%s, %s, %s, %s, %s)""",
                    (uid, username, email, password_hash, role),
                )
                cur.execute("SELECT * FROM users WHERE id=%s", (uid,))
                return cur.fetchone()

    def find_by_username_ci(self, username: str) -> Optional[User]:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM users WHERE LOWER(username)=LOWER(%s)", (username,))
                return cur.fetchone()

    def clear_suspension(self, user_id: str) -> None:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE users SET is_suspended=FALSE, suspended_until=NULL, suspend_reason=NULL WHERE id=%s",
                    (user_id,),
                )

    def update_last_login(self, user_id: str) -> None:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("UPDATE users SET last_login=NOW() WHERE id=%s", (user_id,))

    def update_password(self, user_id: str, password_hash: str) -> None:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE users SET password_hash=%s WHERE id=%s",
                    (password_hash, user_id),
                )

    def update_profile(self, user_id: str, about_me: Optional[str], avatar_url: Optional[str]) -> None:
        with get_db() as conn:
            with conn.cursor() as cur:
                if about_me is not None:
                    cur.execute("UPDATE users SET about_me=%s WHERE id=%s", (about_me, user_id))
                if avatar_url is not None:
                    cur.execute("UPDATE users SET avatar_url=%s WHERE id=%s", (avatar_url, user_id))

    def set_role(self, user_id: str, role: str) -> None:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("UPDATE users SET role=%s WHERE id=%s", (role, user_id))

    def set_verified_tick(self, user_id: str, is_verified: bool) -> None:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE users SET is_verified_tick=%s WHERE id=%s", (is_verified, user_id)
                )

    def is_registration_open(self) -> bool:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT `value` FROM site_settings WHERE `key`='registration_open'",
                )
                row = cur.fetchone()
                return (row["value"] == "true") if row else True

    # ── Admin moderation ─────────────────────────────────────────────────────
    def find_by_id(self, user_id: str) -> Optional[User]:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM users WHERE id=%s", (user_id,))
                return cur.fetchone()

    def find_by_email(self, email: str) -> Optional[User]:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM users WHERE LOWER(email)=LOWER(%s)", (email,))
                return cur.fetchone()

    def list_users(self, search: str = "", limit: int = 50, offset: int = 0,
                   role: str = "", status_filter: str = "") -> tuple[list[User], int]:
        where: list[str] = []
        params: list = []
        if search:
            where.append("(LOWER(username) LIKE %s OR LOWER(email) LIKE %s)")
            like = f"%{search.lower()}%"
            params += [like, like]
        if role in ("free", "premium", "admin", "super_admin"):
            where.append("role=%s")
            params.append(role)
        if status_filter == "suspended":
            where.append("is_suspended=TRUE")
        elif status_filter == "banned":
            where.append("is_banned=TRUE")
        elif status_filter == "flagged":
            where.append("is_flagged=TRUE")
        elif status_filter == "active":
            where.append("is_suspended=FALSE AND is_banned=FALSE AND is_flagged=FALSE")
        clause = ("WHERE " + " AND ".join(where)) if where else ""
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(f"SELECT COUNT(*) AS n FROM users {clause}", tuple(params))
                total = cur.fetchone()["n"]
                cur.execute(
                    f"""SELECT id, username, email, role, is_verified_tick, is_suspended,
                               suspended_until, suspend_reason, is_banned, ban_reason,
                               is_flagged, flag_reason, avatar_url, created_at, last_login
                        FROM users {clause}
                        ORDER BY created_at DESC LIMIT %s OFFSET %s""",
                    tuple(params + [limit, offset]),
                )
                return cur.fetchall(), total

    def suspend_user(self, user_id: str, until, reason: Optional[str]) -> None:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE users SET is_suspended=TRUE, suspended_until=%s, suspend_reason=%s WHERE id=%s",
                    (until, reason, user_id),
                )

    def unban_user(self, user_id: str) -> None:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE users SET is_banned=FALSE, ban_reason=NULL, is_suspended=FALSE,"
                    " suspended_until=NULL, suspend_reason=NULL WHERE id=%s",
                    (user_id,),
                )

    def ban_user(self, user_id: str, reason: Optional[str]) -> None:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE users SET is_banned=TRUE, ban_reason=%s, is_suspended=FALSE,"
                    " suspended_until=NULL, suspend_reason=NULL WHERE id=%s",
                    (reason, user_id),
                )

    def set_flag(self, user_id: str, flagged: bool, reason: Optional[str]) -> None:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE users SET is_flagged=%s, flag_reason=%s WHERE id=%s",
                    (flagged, reason if flagged else None, user_id),
                )

    def delete_user(self, user_id: str) -> bool:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM users WHERE id=%s", (user_id,))
                return cur.rowcount > 0


user_repo = UserRepository()
