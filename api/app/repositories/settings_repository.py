from __future__ import annotations

from typing import Optional

from app.core.database import get_db, new_id

EDITABLE_KEYS = {
    "site_name", "site_currency", "site_footer", "site_description", "site_keywords",
    "site_mode", "site_logo_media_id", "site_favicon_media_id", "site_og_media_id",
    "og_title", "og_description", "registration_open",
}


class SettingsRepository:
    def get_all(self) -> dict[str, str]:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT `key`, `value` FROM site_settings")
                return {r["key"]: (r["value"] or "") for r in cur.fetchall()}

    def set(self, key: str, value: str, updated_by: str) -> None:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO site_settings (`key`, `value`, updated_by)
                       VALUES (%s,%s,%s)
                       ON DUPLICATE KEY UPDATE `value`=VALUES(`value`), updated_by=VALUES(updated_by)""",
                    (key, value, updated_by),
                )

    def set_many(self, values: dict[str, str], updated_by: str) -> None:
        for key, value in values.items():
            if key in EDITABLE_KEYS:
                self.set(key, str(value), updated_by)

    # ── Ad slides ─────────────────────────────────────────────────────────────
    def list_ads(self, only_active: bool = False) -> list[dict]:
        clause = "WHERE is_active=TRUE" if only_active else ""
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT * FROM ads {clause} ORDER BY sort_order, created_at"
                )
                return cur.fetchall()

    def create_ad(self, media_id: Optional[str], media_type: str, description: str,
                  url: Optional[str], sort_order: int) -> dict:
        ad_id = new_id()
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO ads (id, media_id, media_type, description, url, sort_order)
                       VALUES (%s,%s,%s,%s,%s,%s)""",
                    (ad_id, media_id, media_type, description[:500], url, sort_order),
                )
                cur.execute("SELECT * FROM ads WHERE id=%s", (ad_id,))
                return cur.fetchone()

    def update_ad(self, ad_id: str, fields: dict) -> Optional[dict]:
        allowed = {"media_id", "media_type", "description", "url", "sort_order", "is_active"}
        sets, params = [], []
        for key, value in fields.items():
            if key not in allowed:
                continue
            sets.append(f"{key}=%s")
            params.append(value)
        if not sets:
            return self.get_ad(ad_id)
        params.append(ad_id)
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(f"UPDATE ads SET {', '.join(sets)} WHERE id=%s", tuple(params))
        return self.get_ad(ad_id)

    def get_ad(self, ad_id: str) -> Optional[dict]:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM ads WHERE id=%s", (ad_id,))
                return cur.fetchone()

    def delete_ad(self, ad_id: str) -> bool:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM ads WHERE id=%s", (ad_id,))
                return cur.rowcount > 0


settings_repo = SettingsRepository()
