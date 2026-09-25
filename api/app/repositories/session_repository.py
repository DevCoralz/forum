from datetime import datetime, timedelta
from typing import Optional

from app.core.database import get_db, new_id
from app.core.config import JWT_EXPIRE_HOURS


class SessionRepository:
    def create(self, session_id: str, user_id: str, token: str, user_agent: str, ip: str) -> None:
        from app.core.security import hash_token

        expires_at = datetime.now() + timedelta(hours=JWT_EXPIRE_HOURS)
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO user_sessions
                       (id, user_id, token_hash, user_agent, ip_address, expires_at)
                       VALUES (%s,%s,%s,%s,%s,%s)""",
                    (session_id, user_id, hash_token(token), user_agent, ip, expires_at),
                )

    def is_active(self, session_id: str) -> bool:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT is_revoked, expires_at FROM user_sessions WHERE id=%s""",
                    (session_id,),
                )
                row = cur.fetchone()
                if not row or row["is_revoked"]:
                    return False
                return row["expires_at"] > datetime.now()

    def touch(self, session_id: str) -> None:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("UPDATE user_sessions SET last_used=NOW() WHERE id=%s", (session_id,))

    def list_for_user(self, user_id: str) -> list[dict]:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT id, user_agent, ip_address, created_at, last_used, expires_at, is_revoked
                       FROM user_sessions WHERE user_id=%s ORDER BY last_used DESC""",
                    (user_id,),
                )
                return list(cur.fetchall())

    def revoke(self, session_id: str, user_id: str) -> bool:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE user_sessions SET is_revoked=TRUE WHERE id=%s AND user_id=%s",
                    (session_id, user_id),
                )
                return cur.rowcount > 0

    def find(self, session_id: str) -> Optional[dict]:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM user_sessions WHERE id=%s", (session_id,))
                return cur.fetchone()


session_repo = SessionRepository()
