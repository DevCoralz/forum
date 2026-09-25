import os
import uuid

from fastapi import APIRouter, Depends, File, UploadFile

from app.core.config import ALLOWED_AVATAR_TYPES, MAX_AVATAR_BYTES, UPLOAD_BASE_URL, UPLOAD_DIR
from app.core.exceptions import bad_request
from app.core.security import CurrentUser, get_current_user
from app.repositories.profile_repository import profile_repo
from app.schemas.profiles import (
    PrivacyOut, PublicProfile, SubscriptionOut, UpdatePrivacyRequest,
    UpdateProfileRequest, UploadOut,
)
from app.services.profile_service import profile_service

router = APIRouter()


@router.get("/profiles/{username}", response_model=PublicProfile)
def get_profile(username: str):
    return profile_service.get_public_profile(username)


@router.patch("/me/profile")
def update_profile(body: UpdateProfileRequest, user: CurrentUser = Depends(get_current_user)):
    profile_service.update_profile(user.id, user.role, body)
    return {"ok": True}


@router.patch("/me/privacy", response_model=PrivacyOut)
def update_privacy(body: UpdatePrivacyRequest, user: CurrentUser = Depends(get_current_user)):
    return profile_service.update_privacy(user.id, body)


@router.get("/me/subscription", response_model=SubscriptionOut)
def get_subscription(user: CurrentUser = Depends(get_current_user)):
    return profile_service.get_subscription(user.id)


@router.post("/me/avatar", response_model=UploadOut)
def upload_avatar(file: UploadFile = File(...), user: CurrentUser = Depends(get_current_user)):
    if file.content_type not in ALLOWED_AVATAR_TYPES:
        raise bad_request("Unsupported image type")

    data = file.file.read()
    if len(data) > MAX_AVATAR_BYTES:
        raise bad_request("Image is too large (max 5MB)")

    ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif"}[file.content_type]
    filename = f"{uuid.uuid4().hex}.{ext}"

    avatar_dir = os.path.join(UPLOAD_DIR, "avatars")
    os.makedirs(avatar_dir, exist_ok=True)
    storage_key = os.path.join("avatars", filename)
    with open(os.path.join(avatar_dir, filename), "wb") as f:
        f.write(data)

    url = f"{UPLOAD_BASE_URL}/{storage_key}"
    upload = profile_repo.create_upload(
        user.id, "avatar", storage_key, url, file.content_type, len(data)
    )

    from app.repositories.user_repository import user_repo
    user_repo.update_profile(user.id, None, url)

    return UploadOut(url=url, id=upload["id"])
