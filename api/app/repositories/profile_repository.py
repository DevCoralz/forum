from typing import Optional

from app.core.database import get_db, new_id


class ProfileRepository:
    def list_socials(self, user_id: str) -> list[dict]:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT platform, value FROM profile_social_links WHERE user_id=%s", (user_id,)
                )
                return list(cur.fetchall())

    def replace_socials(self, user_id: str, socials: list[dict]) -> None:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM profile_social_links WHERE user_id=%s", (user_id,))
                for s in socials:
                    cur.execute(
                        "INSERT INTO profile_social_links (id, user_id, platform, value) VALUES (%s,%s,%s,%s)",
                        (new_id(), user_id, s["platform"], s["value"]),
                    )

    def follower_count(self, user_id: str) -> int:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) AS n FROM user_follows WHERE following_id=%s", (user_id,))
                return cur.fetchone()["n"]

    def following_count(self, user_id: str) -> int:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) AS n FROM user_follows WHERE follower_id=%s", (user_id,))
                return cur.fetchone()["n"]

    def post_count(self, user_id: str) -> int:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT COUNT(*) AS n FROM posts WHERE author_id=%s AND status='active'",
                    (user_id,),
                )
                return cur.fetchone()["n"]

    def get_privacy(self, user_id: str) -> dict:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM user_privacy WHERE user_id=%s", (user_id,))
                row = cur.fetchone()
                if row:
                    return row
                cur.execute(
                    "INSERT INTO user_privacy (user_id) VALUES (%s)", (user_id,)
                )
                cur.execute("SELECT * FROM user_privacy WHERE user_id=%s", (user_id,))
                return cur.fetchone()

    def update_privacy(self, user_id: str, fields: dict) -> dict:
        self.get_privacy(user_id)  # ensure row exists
        if fields:
            with get_db() as conn:
                with conn.cursor() as cur:
                    sets = ", ".join(f"{k}=%s" for k in fields)
                    cur.execute(
                        f"UPDATE user_privacy SET {sets} WHERE user_id=%s",
                        (*fields.values(), user_id),
                    )
        return self.get_privacy(user_id)

    def get_subscription(self, user_id: str) -> Optional[dict]:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM user_subscriptions WHERE user_id=%s ORDER BY created_at DESC LIMIT 1",
                    (user_id,),
                )
                return cur.fetchone()

    def upsert_subscription(self, user_id: str, tier: str, assigned_by: str,
                             expires_at=None) -> dict:
        sid = new_id()
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO user_subscriptions (id, user_id, tier, status, assigned_by, expires_at)
                       VALUES (%s,%s,%s,'active',%s,%s)""",
                    (sid, user_id, tier, assigned_by, expires_at),
                )
                cur.execute("SELECT * FROM user_subscriptions WHERE id=%s", (sid,))
                return cur.fetchone()

    def create_upload(self, user_id: str, kind: str, storage_key: str, url: str,
                       mime_type: Optional[str], size_bytes: Optional[int]) -> dict:
        uid = new_id()
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO user_uploads (id, user_id, kind, storage_key, url, mime_type, size_bytes)
                       VALUES (%s,%s,%s,%s,%s,%s,%s)""",
                    (uid, user_id, kind, storage_key, url, mime_type, size_bytes),
                )
                cur.execute("SELECT * FROM user_uploads WHERE id=%s", (uid,))
                return cur.fetchone()


profile_repo = ProfileRepository()
