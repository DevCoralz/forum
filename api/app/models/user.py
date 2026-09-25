from datetime import datetime
from typing import Optional
from typing import TypedDict


class User(TypedDict):
    id: str
    username: str
    email: str
    password_hash: str
    role: str
    is_suspended: bool
    suspended_until: Optional[datetime]
    suspend_reason: Optional[str]
    is_banned: bool
    ban_reason: Optional[str]
    is_verified_tick: bool
    about_me: Optional[str]
    avatar_url: Optional[str]
    socials: Optional[dict]
    reset_token: Optional[str]
    reset_expires: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    last_login: Optional[datetime]
