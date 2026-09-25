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


user_repo = UserRepository()
