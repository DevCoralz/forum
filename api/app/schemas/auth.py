from datetime import datetime

from pydantic import BaseModel, EmailStr, field_validator

from app.core.config import PASSWORD_MIN, USERNAME_MAX, USERNAME_MIN


class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        v = v.strip()
        if len(v) < USERNAME_MIN or len(v) > USERNAME_MAX:
            raise ValueError(f"Username must be {USERNAME_MIN}–{USERNAME_MAX} characters")
        if not v.replace("_", "").replace("-", "").replace(".", "").isalnum():
            raise ValueError("Username may only contain letters, numbers, _, - and .")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < PASSWORD_MIN:
            raise ValueError(f"Password must be at least {PASSWORD_MIN} characters")
        return v


class RegisterResponse(BaseModel):
    id: str
    username: str
    email: str
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginUser(BaseModel):
    id: str
    username: str
    role: str
    is_verified_tick: bool


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: LoginUser


class MeResponse(BaseModel):
    id: str
    username: str
    email: str
    role: str
    is_verified_tick: bool
    about_me: str | None = None
    avatar_url: str | None = None
    created_at: datetime
    is_suspended: bool = False
    suspended_until: datetime | None = None
    suspend_reason: str | None = None
    is_flagged: bool = False
    flag_reason: str | None = None

    model_config = {"from_attributes": True}


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        if len(v) < PASSWORD_MIN:
            raise ValueError(f"Password must be at least {PASSWORD_MIN} characters")
        return v


class SessionOut(BaseModel):
    id: str
    user_agent: str | None
    ip_address: str | None
    created_at: datetime
    last_used: datetime
    expires_at: datetime
    is_current: bool = False

    model_config = {"from_attributes": True}
