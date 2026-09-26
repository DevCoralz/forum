from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator


class SocialLink(BaseModel):
    platform: str
    value: str


class PublicProfile(BaseModel):
    id: str
    username: str
    about_me: Optional[str] = None
    avatar_url: Optional[str] = None
    is_verified_tick: bool
    labels: list[str] = []
    badges: list[dict] = []
    socials: list[SocialLink] = []
    follower_count: int
    following_count: int
    post_count: int
    created_at: datetime


class UpdateProfileRequest(BaseModel):
    about_me: Optional[str] = None
    avatar_url: Optional[str] = None
    socials: Optional[list[SocialLink]] = None


class UpdatePrivacyRequest(BaseModel):
    show_email: Optional[bool] = None
    show_socials: Optional[bool] = None
    show_activity: Optional[bool] = None
    allow_follow: Optional[bool] = None


class PrivacyOut(BaseModel):
    show_email: bool
    show_socials: bool
    show_activity: bool
    allow_follow: bool

    model_config = {"from_attributes": True}


class SubscriptionOut(BaseModel):
    tier: str
    status: str
    expires_at: Optional[datetime] = None


class UploadOut(BaseModel):
    url: str
    id: str


class GrantTickRequest(BaseModel):
    is_verified_tick: bool


class GrantLabelRequest(BaseModel):
    label: str
    color: str = "#666666"

    @field_validator("label")
    @classmethod
    def validate_label(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Label cannot be empty")
        if len(v) > 100:
            raise ValueError("Label is too long")
        return v


class LabelOut(BaseModel):
    id: str
    label: str
    color: str

    model_config = {"from_attributes": True}
