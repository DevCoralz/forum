from __future__ import annotations

from app.core.database import get_db, new_id


class AuditService:
    def record(self, actor_id: str, action: str, target_id: str = "", detail: str = "") -> None:
        try:
            with get_db() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """INSERT INTO audit_log (id, actor_id, action, target_id, detail)
                           VALUES (%s,%s,%s,%s,%s)""",
                        (new_id(), actor_id, action, target_id, detail[:2000]),
                    )
        except Exception:
            # Audit must never break the admin action itself.
            pass

    def list(self, limit: int = 100) -> list[dict]:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT a.id, a.action, a.target_id, a.detail, a.created_at,
                              u.username AS actor_username
                       FROM audit_log a LEFT JOIN users u ON u.id=a.actor_id
                       ORDER BY a.created_at DESC LIMIT %s""",
                    (limit,),
                )
                return cur.fetchall()


audit_service = AuditService()
