from fastapi import APIRouter, Depends

from app.core.exceptions import not_found
from app.core.security import CurrentUser, require_roles
from app.repositories.label_repository import label_repo
from app.repositories.profile_repository import profile_repo
from app.repositories.user_repository import user_repo
from app.schemas.profiles import GrantLabelRequest, GrantTickRequest, LabelOut

router = APIRouter()

# Only admin/super_admin can grant ticks and tags.
_admin_only = require_roles("admin", "super_admin")


@router.post("/users/{user_id}/verified-tick")
def set_verified_tick(user_id: str, body: GrantTickRequest, admin: CurrentUser = Depends(_admin_only)):
    user = user_repo.find_by_id(user_id)
    if not user:
        raise not_found("User not found")
    user_repo.set_verified_tick(user_id, body.is_verified_tick)
    return {"ok": True, "is_verified_tick": body.is_verified_tick}


@router.post("/users/{user_id}/labels", response_model=LabelOut, status_code=201)
def grant_label(user_id: str, body: GrantLabelRequest, admin: CurrentUser = Depends(_admin_only)):
    user = user_repo.find_by_id(user_id)
    if not user:
        raise not_found("User not found")
    return label_repo.grant(user_id, body.label, admin.id, body.color)


@router.delete("/labels/{label_id}")
def revoke_label(label_id: str, admin: CurrentUser = Depends(_admin_only)):
    ok = label_repo.revoke(label_id)
    if not ok:
        raise not_found("Label not found")
    return {"ok": True}


@router.post("/users/{user_id}/role")
def set_role(user_id: str, role: str, admin: CurrentUser = Depends(require_roles("super_admin"))):
    if role not in ("free", "premium", "admin", "super_admin"):
        from app.core.exceptions import bad_request
        raise bad_request("Invalid role")
    user = user_repo.find_by_id(user_id)
    if not user:
        raise not_found("User not found")
    user_repo.set_role(user_id, role)
    return {"ok": True, "role": role}


@router.post("/users/{user_id}/subscription")
def assign_subscription(user_id: str, tier: str, admin: CurrentUser = Depends(_admin_only)):
    user = user_repo.find_by_id(user_id)
    if not user:
        raise not_found("User not found")
    sub = profile_repo.upsert_subscription(user_id, tier, admin.id)
    return {"ok": True, "tier": sub["tier"]}
