from app.core.database import get_db, new_id


class LabelRepository:
    def list_for_user(self, user_id: str) -> list[str]:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT label FROM user_labels WHERE user_id=%s ORDER BY created_at", (user_id,)
                )
                return [r["label"] for r in cur.fetchall()]

    def list_for_users(self, user_ids: list[str]) -> dict[str, list[str]]:
        if not user_ids:
            return {}
        with get_db() as conn:
            with conn.cursor() as cur:
                placeholders = ",".join(["%s"] * len(user_ids))
                cur.execute(
                    f"SELECT user_id, label FROM user_labels WHERE user_id IN ({placeholders}) ORDER BY created_at",
                    tuple(user_ids),
                )
                out: dict[str, list[str]] = {uid: [] for uid in user_ids}
                for r in cur.fetchall():
                    out.setdefault(r["user_id"], []).append(r["label"])
                return out

    def grant(self, user_id: str, label: str, added_by: str, color: str = "#666666") -> dict:
        lid = new_id()
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO user_labels (id, user_id, label, color, added_by)
                       VALUES (%s,%s,%s,%s,%s)""",
                    (lid, user_id, label, color, added_by),
                )
                cur.execute("SELECT * FROM user_labels WHERE id=%s", (lid,))
                return cur.fetchone()

    def revoke(self, label_id: str) -> bool:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM user_labels WHERE id=%s", (label_id,))
                return cur.rowcount > 0


label_repo = LabelRepository()
