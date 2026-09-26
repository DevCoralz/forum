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

    def badges_for_users(self, user_ids: list[str]) -> dict[str, list[dict]]:
        """name+color pairs for shimmer tag rendering."""
        if not user_ids:
            return {}
        with get_db() as conn:
            with conn.cursor() as cur:
                placeholders = ",".join(["%s"] * len(user_ids))
                cur.execute(
                    f"""SELECT user_id, label, color FROM user_labels
                        WHERE user_id IN ({placeholders}) ORDER BY created_at""",
                    tuple(user_ids),
                )
                out: dict[str, list[dict]] = {uid: [] for uid in user_ids}
                for r in cur.fetchall():
                    out.setdefault(r["user_id"], []).append(
                        {"name": r["label"], "color": r["color"] or "#666666"}
                    )
                return out

    def grant(self, user_id: str, label: str, added_by: str, color: str = "#666666") -> dict:
        lid = new_id()
        with get_db() as conn:
            with conn.cursor() as cur:
                # Keep the catalog color in sync when granting a known tag.
                cur.execute("SELECT color FROM tag_definitions WHERE LOWER(name)=LOWER(%s)", (label,))
                row = cur.fetchone()
                if row:
                    color = row["color"]
                    cur.execute(
                        "INSERT IGNORE INTO user_labels (id, user_id, label, color, added_by)"
                        " VALUES (%s,%s,%s,%s,%s)",
                        (lid, user_id, row and label, color, added_by),
                    )
                else:
                    cur.execute(
                        "INSERT INTO user_labels (id, user_id, label, color, added_by)"
                        " VALUES (%s,%s,%s,%s,%s)",
                        (lid, user_id, label, color, added_by),
                    )
                cur.execute("SELECT * FROM user_labels WHERE id=%s", (lid,))
                return cur.fetchone()

    def revoke(self, label_id: str) -> bool:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM user_labels WHERE id=%s", (label_id,))
                return cur.rowcount > 0

    def revoke_by_name(self, user_id: str, label: str) -> bool:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM user_labels WHERE user_id=%s AND LOWER(label)=LOWER(%s)",
                    (user_id, label),
                )
                return cur.rowcount > 0

    def list_for_user_full(self, user_id: str) -> list[dict]:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, label, color FROM user_labels WHERE user_id=%s ORDER BY created_at",
                    (user_id,),
                )
                return [
                    {"id": r["id"], "name": r["label"], "color": r["color"] or "#666666"}
                    for r in cur.fetchall()
                ]

    # ── Tag catalog (shimmer definitions) ────────────────────────────────────
    def list_definitions(self) -> list[dict]:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT name, color, created_at FROM tag_definitions ORDER BY name")
                return cur.fetchall()

    def upsert_definition(self, name: str, color: str) -> None:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO tag_definitions (id, name, color) VALUES (%s,%s,%s)
                       ON DUPLICATE KEY UPDATE color=VALUES(color), name=VALUES(name)""",
                    (new_id(), name, color),
                )
                # Cascade to every member carrying this tag so shimmer stays in sync.
                cur.execute(
                    "UPDATE user_labels SET label=%s, color=%s WHERE LOWER(label)=LOWER(%s)",
                    (name, color, name),
                )

    def delete_definition(self, name: str) -> bool:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM user_labels WHERE LOWER(label)=LOWER(%s)", (name,)
                )
                cur.execute("DELETE FROM tag_definitions WHERE LOWER(name)=LOWER(%s)", (name,))
                return cur.rowcount > 0


label_repo = LabelRepository()
