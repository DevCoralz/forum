from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.exceptions import bad_request, conflict, forbidden, not_found
from app.core.security import CurrentUser, hash_password, require_roles
from app.repositories.label_repository import label_repo
from app.repositories.user_repository import user_repo
from app.services.audit_service import audit_service

router = APIRouter()

_admin_only = require_roles("admin", "super_admin")


def _guard_target(admin: CurrentUser, target: dict) -> None:
    """Admins can never manage other admins/super_admins; only super_admin can."""
    if target["role"] in ("admin", "super_admin") and admin.role != "super_admin":
        raise forbidden("Only the super admin can manage staff accounts")
    if target["role"] == "super_admin" and admin.role != "super_admin":
        raise forbidden("Only the super admin can manage staff accounts")


class SuspendRequest(BaseModel):
    days: Optional[int] = Field(default=None, ge=1, le=3650)
    reason: Optional[str] = Field(default=None, max_length=500)


class BanRequest(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=500)


class FlagRequest(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=500)


class TierRequest(BaseModel):
    tier: str

    @field_validator("tier")
    @classmethod
    def valid_tier(cls, v: str) -> str:
        if v not in ("free", "premium"):
            raise ValueError("Tier must be free or premium")
        return v


class TagRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    color: str = Field(default="#FFC928", pattern=r"^#[0-9A-Fa-f]{6}$")


class CreateMemberRequest(BaseModel):
    username: str = Field(min_length=3, max_length=32, pattern=r"^[A-Za-z0-9_]+$")
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: str = "free"

    @field_validator("role")
    @classmethod
    def valid_role(cls, v: str) -> str:
        if v not in ("free", "premium"):
            raise ValueError("Role must be free or premium")
        return v


class ResetPasswordRequest(BaseModel):
    password: str = Field(min_length=8, max_length=128)


@router.get("/users")
def list_users(
    search: str = "",
    role: str = "",
    status: str = "",
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    admin: CurrentUser = Depends(_admin_only),
):
    rows, total = user_repo.list_users(search=search.strip(), limit=limit, offset=offset,
                                      role=role, status_filter=status)
    tags_by_user = label_repo.badges_for_users([r["id"] for r in rows])
    items = []
    for r in rows:
        items.append({
            "id": r["id"], "username": r["username"], "email": r["email"],
            "role": r["role"], "is_verified_tick": bool(r["is_verified_tick"]),
            "is_suspended": bool(r["is_suspended"]), "suspended_until": r["suspended_until"],
            "suspend_reason": r["suspend_reason"], "is_banned": bool(r["is_banned"]),
            "ban_reason": r["ban_reason"], "is_flagged": bool(r["is_flagged"]),
            "flag_reason": r["flag_reason"], "avatar_url": r["avatar_url"],
            "created_at": r["created_at"], "last_login": r["last_login"],
            "tags": tags_by_user.get(r["id"], []),
        })
    return {"items": items, "total": total}


@router.post("/users", status_code=201)
def create_member(body: CreateMemberRequest, admin: CurrentUser = Depends(_admin_only)):
    if user_repo.exists_by_username_or_email(body.username, body.email):
        raise conflict("Username or email already taken")
    role = body.role
    if role == "premium" and admin.role != "super_admin":
        pass  # admins may create premium members; only staff roles are restricted
    uid = user_repo.create(body.username, body.email, hash_password(body.password), role)["id"]
    audit_service.record(admin.id, "user.create", uid, f"created member {body.username}")
    return {"ok": True, "id": uid}


@router.delete("/users/{user_id}")
def delete_member(user_id: str, admin: CurrentUser = Depends(_admin_only)):
    target = user_repo.find_by_id(user_id)
    if not target:
        raise not_found("User not found")
    if target["id"] == admin.id:
        raise bad_request("You cannot delete your own account")
    _guard_target(admin, target)
    user_repo.delete_user(user_id)
    audit_service.record(admin.id, "user.delete", user_id, f"deleted @{target['username']}")
    return {"ok": True}


@router.post("/users/{user_id}/tier")
def set_tier(user_id: str, body: TierRequest, admin: CurrentUser = Depends(_admin_only)):
    target = user_repo.find_by_id(user_id)
    if not target:
        raise not_found("User not found")
    if target["role"] in ("admin", "super_admin"):
        raise bad_request("Staff roles are managed by the super admin only")
    user_repo.set_role(user_id, body.tier)
    audit_service.record(admin.id, f"user.tier.{body.tier}", user_id, f"@{target['username']}")
    return {"ok": True, "tier": body.tier}


@router.post("/users/{user_id}/suspend")
def suspend(user_id: str, body: SuspendRequest, admin: CurrentUser = Depends(_admin_only)):
    target = user_repo.find_by_id(user_id)
    if not target:
        raise not_found("User not found")
    _guard_target(admin, target)
    until = None
    if body.days:
        until = datetime.now(timezone.utc) + timedelta(days=body.days)
    user_repo.suspend_user(user_id, until, body.reason)
    audit_service.record(admin.id, "user.suspend", user_id,
                         f"@{target['username']} {body.days or 'indefinite'}d: {body.reason or ''}")
    return {"ok": True}


@router.post("/users/{user_id}/unsuspend")
def unsuspend(user_id: str, admin: CurrentUser = Depends(_admin_only)):
    target = user_repo.find_by_id(user_id)
    if not target:
        raise not_found("User not found")
    _guard_target(admin, target)
    user_repo.unban_user(user_id)
    audit_service.record(admin.id, "user.unsuspend", user_id, f"@{target['username']}")
    return {"ok": True}


@router.post("/users/{user_id}/ban")
def ban(user_id: str, body: BanRequest, admin: CurrentUser = Depends(_admin_only)):
    target = user_repo.find_by_id(user_id)
    if not target:
        raise not_found("User not found")
    _guard_target(admin, target)
    user_repo.ban_user(user_id, body.reason)
    audit_service.record(admin.id, "user.ban", user_id, f"@{target['username']}: {body.reason or ''}")
    return {"ok": True}


@router.post("/users/{user_id}/unban")
def unban(user_id: str, admin: CurrentUser = Depends(_admin_only)):
    target = user_repo.find_by_id(user_id)
    if not target:
        raise not_found("User not found")
    _guard_target(admin, target)
    user_repo.unban_user(user_id)
    audit_service.record(admin.id, "user.unban", user_id, f"@{target['username']}")
    return {"ok": True}


@router.post("/users/{user_id}/flag")
def flag(user_id: str, body: FlagRequest, admin: CurrentUser = Depends(_admin_only)):
    target = user_repo.find_by_id(user_id)
    if not target:
        raise not_found("User not found")
    _guard_target(admin, target)
    user_repo.set_flag(user_id, True, body.reason)
    audit_service.record(admin.id, "user.flag", user_id, f"@{target['username']}: {body.reason or ''}")
    return {"ok": True}


@router.post("/users/{user_id}/unflag")
def unflag(user_id: str, admin: CurrentUser = Depends(_admin_only)):
    target = user_repo.find_by_id(user_id)
    if not target:
        raise not_found("User not found")
    _guard_target(admin, target)
    user_repo.set_flag(user_id, False, None)
    audit_service.record(admin.id, "user.unflag", user_id, f"@{target['username']}")
    return {"ok": True}


@router.post("/users/{user_id}/tags")
def assign_tag(user_id: str, body: TagRequest, admin: CurrentUser = Depends(_admin_only)):
    target = user_repo.find_by_id(user_id)
    if not target:
        raise not_found("User not found")
    current = [t["name"].lower() for t in label_repo.list_for_user_full(user_id)]
    if body.name.lower() in current:
        raise conflict("Member already carries this tag")
    label_repo.grant(user_id, body.name.strip(), admin.id, body.color)
    # Keep the shimmer catalog in sync so the color applies everywhere.
    label_repo.upsert_definition(body.name.strip(), body.color)
    audit_service.record(admin.id, "user.tag", user_id, f"@{target['username']} +{body.name}")
    return {"ok": True, "tags": label_repo.list_for_user_full(user_id)}


@router.delete("/users/{user_id}/tags")
def remove_tag(user_id: str, name: str, admin: CurrentUser = Depends(_admin_only)):
    target = user_repo.find_by_id(user_id)
    if not target:
        raise not_found("User not found")
    ok = label_repo.revoke_by_name(user_id, name)
    if not ok:
        raise not_found("Tag not found on member")
    audit_service.record(admin.id, "user.untag", user_id, f"@{target['username']} -{name}")
    return {"ok": True, "tags": label_repo.list_for_user_full(user_id)}


@router.post("/users/{user_id}/verified-tick")
def set_verified_tick(user_id: str, body: dict, admin: CurrentUser = Depends(_admin_only)):
    target = user_repo.find_by_id(user_id)
    if not target:
        raise not_found("User not found")
    value = bool(body.get("is_verified_tick"))
    user_repo.set_verified_tick(user_id, value)
    audit_service.record(admin.id, f"user.tick.{'on' if value else 'off'}", user_id,
                         f"@{target['username']}")
    return {"ok": True, "is_verified_tick": value}


@router.post("/users/{user_id}/password")
def reset_password(user_id: str, body: ResetPasswordRequest, admin: CurrentUser = Depends(_admin_only)):
    target = user_repo.find_by_id(user_id)
    if not target:
        raise not_found("User not found")
    _guard_target(admin, target)
    user_repo.update_password(user_id, hash_password(body.password))
    audit_service.record(admin.id, "user.password_reset", user_id, f"@{target['username']}")
    return {"ok": True}
