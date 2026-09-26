from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator

from app.api.media import media_url
from app.core.exceptions import bad_request, not_found
from app.core.security import CurrentUser, require_roles
from app.repositories.label_repository import label_repo
from app.repositories.settings_repository import EDITABLE_KEYS, settings_repo
from app.services.audit_service import audit_service

router = APIRouter()

_super = require_roles("super_admin")


@router.get("/tags")
def list_tags(admin: CurrentUser = Depends(require_roles("admin", "super_admin"))):
    return {"items": label_repo.list_definitions()}


class TagDefinitionRequest(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    color: str = Field(pattern=r"^#[0-9A-Fa-f]{6}$")

    @field_validator("name")
    @classmethod
    def clean(cls, v: str) -> str:
        return v.strip()


@router.post("/tags")
def upsert_tag(body: TagDefinitionRequest, admin: CurrentUser = Depends(_super)):
    label_repo.upsert_definition(body.name, body.color)
    audit_service.record(admin.id, "tag.upsert", body.name, body.color)
    return {"ok": True, "items": label_repo.list_definitions()}


@router.delete("/tags/{name}")
def delete_tag(name: str, admin: CurrentUser = Depends(_super)):
    ok = label_repo.delete_definition(name)
    if not ok:
        raise not_found("Tag not found")
    audit_service.record(admin.id, "tag.delete", name)
    return {"ok": True, "items": label_repo.list_definitions()}


# ── Site settings ─────────────────────────────────────────────────────────────

class SiteSettingsRequest(BaseModel):
    site_name: Optional[str] = Field(default=None, max_length=60)
    site_currency: Optional[str] = Field(default=None, max_length=10)
    site_footer: Optional[str] = Field(default=None, max_length=300)
    site_description: Optional[str] = Field(default=None, max_length=300)
    site_keywords: Optional[str] = Field(default=None, max_length=300)
    site_mode: Optional[str] = None
    site_logo_media_id: Optional[str] = None
    site_favicon_media_id: Optional[str] = None
    site_og_media_id: Optional[str] = None
    og_title: Optional[str] = Field(default=None, max_length=120)
    og_description: Optional[str] = Field(default=None, max_length=300)
    registration_open: Optional[str] = None

    @field_validator("site_mode")
    @classmethod
    def valid_mode(cls, v):
        if v is not None and v not in ("production", "maintenance"):
            raise ValueError("Mode must be production or maintenance")
        return v

    @field_validator("registration_open")
    @classmethod
    def valid_flag(cls, v):
        if v is not None and v not in ("true", "false"):
            raise ValueError("Must be true or false")
        return v


def _decorate_settings(s: dict) -> dict:
    out = dict(s)
    out["site_logo_url"] = media_url(s.get("site_logo_media_id") or None)
    out["site_favicon_url"] = media_url(s.get("site_favicon_media_id") or None)
    out["site_og_url"] = media_url(s.get("site_og_media_id") or None)
    return out


@router.get("/site-settings")
def get_settings(admin: CurrentUser = Depends(require_roles("admin", "super_admin"))):
    return _decorate_settings(settings_repo.get_all())


@router.put("/site-settings")
def put_settings(body: SiteSettingsRequest, admin: CurrentUser = Depends(_super)):
    values = {k: v for k, v in body.model_dump().items() if v is not None and k in EDITABLE_KEYS}
    if not values:
        raise bad_request("Nothing to update")
    settings_repo.set_many(values, admin.id)
    audit_service.record(admin.id, "site.settings", "", ", ".join(sorted(values)))
    return _decorate_settings(settings_repo.get_all())


# ── Ad slides ─────────────────────────────────────────────────────────────────

class AdRequest(BaseModel):
    media_id: Optional[str] = None
    media_type: str = "image"
    description: str = Field(default="", max_length=500)
    url: Optional[str] = Field(default=None, max_length=1000)
    sort_order: int = 0

    @field_validator("media_type")
    @classmethod
    def valid_type(cls, v: str) -> str:
        if v not in ("image", "video"):
            raise ValueError("Type must be image or video")
        return v

    @field_validator("url")
    @classmethod
    def safe_url(cls, v):
        if v is None or v == "":
            return None
        if not v.startswith(("http://", "https://", "/")):
            raise ValueError("URL must start with http(s):// or /")
        return v


def _count_active() -> int:
    return len(settings_repo.list_ads(only_active=True))


@router.get("/ads")
def list_ads(admin: CurrentUser = Depends(require_roles("admin", "super_admin"))):
    items = settings_repo.list_ads()
    for ad in items:
        ad["media_url"] = media_url(ad["media_id"])
    return {"items": items}


@router.post("/ads", status_code=201)
def create_ad(body: AdRequest, admin: CurrentUser = Depends(_super)):
    if body.media_type not in ("image", "video"):
        raise bad_request("Type must be image or video")
    if _count_active() >= 5:
        raise bad_request("At most 5 active ad slides are allowed")
    ad = settings_repo.create_ad(body.media_id, body.media_type, body.description,
                                 body.url, body.sort_order)
    ad["media_url"] = media_url(ad["media_id"])
    audit_service.record(admin.id, "ad.create", ad["id"], body.description[:100])
    return ad


@router.put("/ads/{ad_id}")
def update_ad(ad_id: str, body: AdRequest, admin: CurrentUser = Depends(_super)):
    ad = settings_repo.get_ad(ad_id)
    if not ad:
        raise not_found("Ad not found")
    updated = settings_repo.update_ad(ad_id, body.model_dump())
    updated["media_url"] = media_url(updated["media_id"])
    audit_service.record(admin.id, "ad.update", ad_id)
    return updated


@router.delete("/ads/{ad_id}")
def delete_ad(ad_id: str, admin: CurrentUser = Depends(_super)):
    ok = settings_repo.delete_ad(ad_id)
    if not ok:
        raise not_found("Ad not found")
    audit_service.record(admin.id, "ad.delete", ad_id)
    return {"ok": True}


@router.get("/audit-log")
def audit_log(admin: CurrentUser = Depends(require_roles("admin", "super_admin"))):
    return {"items": audit_service.list()}
