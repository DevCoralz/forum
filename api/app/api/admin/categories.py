"""Admin category & subcategory management.

POST   /categories                     create a category (name + optional icon)
PUT    /categories/{id}                rename / change icon / hide / sort
DELETE /categories/{id}                delete (Threads is protected; refuses when posts exist)
GET    /categories                     everything including hidden ones
POST   /categories/{id}/subcategories  create a subcategory (name + icon)
PUT    /subcategories/{id}             rename / change icon
DELETE /subcategories/{id}             delete
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator

from app.api.media import media_url
from app.core.database import get_db
from app.core.exceptions import bad_request, forbidden, not_found
from app.core.security import CurrentUser, require_roles
from app.repositories.post_repository import category_repo
from app.services.audit_service import audit_service

router = APIRouter()

_admin = require_roles("admin", "super_admin")

PRESET_ICONS = {"flame", "settings", "crown", "database", "cookie", "file", "grid", None}


def _category_out(row: dict) -> dict:
    out = dict(row)
    out["icon_url"] = media_url(row.get("icon_media_id") or None)
    out["post_count"] = category_repo.post_count(row["id"])
    return out


def _subcategory_out(row: dict) -> dict:
    out = dict(row)
    out["icon_url"] = media_url(row.get("icon_media_id") or None)
    out["post_count"] = category_repo.subcategory_post_count(row["id"])
    return out


def _validate_icon(icon: Optional[str], icon_media_id: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    if icon_media_id is not None:
        import re
        if icon_media_id and not re.fullmatch(r"[0-9a-f-]{36}", icon_media_id):
            raise bad_request("icon_media_id must be a media id from /media")
    if icon is not None and icon not in PRESET_ICONS:
        raise bad_request("Unknown preset icon name")
    return icon, icon_media_id


class CategoryRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    icon: Optional[str] = None
    icon_media_id: Optional[str] = None
    sort_order: Optional[int] = None

    @field_validator("name")
    @classmethod
    def clean(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name cannot be empty")
        return v


class CategoryUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    icon: Optional[str] = None
    icon_media_id: Optional[str] = None
    is_hidden: Optional[bool] = None
    sort_order: Optional[int] = None
    description: Optional[str] = Field(default=None, max_length=300)


class SubcategoryRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    icon: Optional[str] = None
    icon_media_id: Optional[str] = None


@router.get("/categories")
def list_categories(admin: CurrentUser = Depends(_admin)):
    return {
        "items": [_category_out(c) for c in category_repo.list_all(include_hidden=True)],
        "subcategories": {
            c["id"]: [_subcategory_out(s) for s in category_repo.list_subcategories(c["id"])]
            for c in category_repo.list_all(include_hidden=True)
        },
    }


@router.post("/categories", status_code=201)
def create_category(body: CategoryRequest, admin: CurrentUser = Depends(_admin)):
    icon, icon_media_id = _validate_icon(body.icon, body.icon_media_id)
    if category_repo.find_by_name(body.name):
        raise bad_request("A category with this name already exists")
    row = category_repo.create(body.name, icon, icon_media_id, admin.id, body.sort_order)
    audit_service.record(admin.id, "category.create", row["id"], body.name)
    return _category_out(row)


@router.put("/categories/{category_id}")
def update_category(category_id: str, body: CategoryUpdateRequest,
                    admin: CurrentUser = Depends(_admin)):
    row = category_repo.find(category_id)
    if not row:
        raise not_found("Category not found")
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    if "icon" in fields or "icon_media_id" in fields:
        icon, icon_media_id = _validate_icon(
            fields.get("icon"), fields.get("icon_media_id")
        )
        fields["icon"], fields["icon_media_id"] = icon, icon_media_id
    updated = category_repo.update(category_id, fields)
    if not updated:
        raise not_found("Category not found")
    audit_service.record(admin.id, "category.update", category_id, ", ".join(fields))
    return _category_out(updated)


@router.delete("/categories/{category_id}")
def delete_category(category_id: str, admin: CurrentUser = Depends(require_roles("super_admin"))):
    result = category_repo.delete(category_id)
    if result == "missing":
        raise not_found("Category not found")
    if result == "protected":
        raise forbidden("The Threads category cannot be deleted")
    if result == "in_use":
        raise bad_request("Move or delete its posts first")
    audit_service.record(admin.id, "category.delete", category_id)
    return {"ok": True}


@router.post("/categories/{category_id}/subcategories", status_code=201)
def create_subcategory(category_id: str, body: SubcategoryRequest,
                       admin: CurrentUser = Depends(_admin)):
    category = category_repo.find(category_id)
    if not category:
        raise not_found("Category not found")
    if category["slug"] == "threads":
        raise bad_request("Threads cannot have subcategories")
    icon, icon_media_id = _validate_icon(body.icon, body.icon_media_id)
    row = category_repo.create_subcategory(category_id, body.name.strip(), icon, icon_media_id, admin.id)
    audit_service.record(admin.id, "subcategory.create", row["id"], body.name)
    return _subcategory_out(row)


@router.put("/subcategories/{subcategory_id}")
def update_subcategory(subcategory_id: str, body: SubcategoryRequest,
                       admin: CurrentUser = Depends(_admin)):
    sub = category_repo.find_subcategory(subcategory_id)
    if not sub:
        raise not_found("Subcategory not found")
    fields: dict = {}
    if body.name and body.name.strip() and body.name.strip() != sub["name"]:
        fields["name"] = body.name.strip()
    if body.icon is not None or body.icon_media_id is not None:
        icon, icon_media_id = _validate_icon(body.icon, body.icon_media_id)
        fields["icon"], fields["icon_media_id"] = icon, icon_media_id
    updated = category_repo.update_subcategory(subcategory_id, fields)
    if not updated:
        raise not_found("Subcategory not found")
    audit_service.record(admin.id, "subcategory.update", subcategory_id, ", ".join(fields))
    return _subcategory_out(updated)


@router.delete("/subcategories/{subcategory_id}")
def delete_subcategory(subcategory_id: str, admin: CurrentUser = Depends(_admin)):
    if not category_repo.delete_subcategory(subcategory_id):
        raise not_found("Subcategory not found")
    audit_service.record(admin.id, "subcategory.delete", subcategory_id)
    return {"ok": True}


@router.get("/categories/db-check")
def db_check(admin: CurrentUser = Depends(_admin)):
    """Diagnostic: confirms the tool tables exist."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS n FROM information_schema.tables "
                "WHERE table_schema=DATABASE() AND table_name IN "
                "('post_subcategory_map','tool_purchases')"
            )
            return {"tables": int(cur.fetchone()["n"])}
