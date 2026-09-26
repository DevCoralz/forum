"""Public site bootstrap: settings + active ad slides for every visitor."""
from __future__ import annotations

from fastapi import APIRouter

from app.api.media import media_url
from app.repositories.settings_repository import settings_repo

router = APIRouter()

PUBLIC_KEYS = (
    "site_name", "site_currency", "site_footer", "site_description", "site_keywords",
    "site_mode", "site_logo_media_id", "site_favicon_media_id", "site_og_media_id",
    "og_title", "og_description", "registration_open",
)


@router.get("/site")
def public_site():
    raw = settings_repo.get_all()
    settings = {k: raw.get(k, "") for k in PUBLIC_KEYS}
    settings["site_logo_url"] = media_url(raw.get("site_logo_media_id") or None)
    settings["site_favicon_url"] = media_url(raw.get("site_favicon_media_id") or None)
    settings["site_og_url"] = media_url(raw.get("site_og_media_id") or None)
    settings["registration_open"] = raw.get("registration_open", "true") != "false"

    ads = []
    for ad in settings_repo.list_ads(only_active=True)[:5]:
        ads.append({
            "id": ad["id"],
            "media_type": ad["media_type"],
            "media_url": media_url(ad["media_id"]),
            "description": ad["description"],
            "url": ad["url"],
        })
    return {"settings": settings, "ads": ads}
