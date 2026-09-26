from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator


class CategoryOut(BaseModel):
    id: str
    name: str
    slug: str
    description: Optional[str] = None
    icon: Optional[str] = None
    icon_media_id: Optional[str] = None
    icon_url: Optional[str] = None
    is_hidden: bool = False
    post_count: int = 0

    model_config = {"from_attributes": True}


class SubcategoryOut(BaseModel):
    id: str
    category_id: str
    name: str
    slug: str
    description: Optional[str] = None
    icon: Optional[str] = None
    icon_media_id: Optional[str] = None
    icon_url: Optional[str] = None
    post_count: int = 0

    model_config = {"from_attributes": True}


class AuthorOut(BaseModel):
    id: str
    username: str
    avatar_url: Optional[str] = None
    is_verified_tick: bool = False
    labels: list[str] = []
    badges: list[dict] = []


class CreatePostRequest(BaseModel):
    title: str
    content: str
    kind: str = "thread"  # "thread" | "tool"
    category_id: Optional[str] = None  # tools only; threads always go to "Threads"
    subcategory_ids: Optional[list[str]] = None  # tools: every sub it appears in
    post_type: str = "free"  # "free" | "premium" — the audience gate
    price: Optional[float] = None  # tools: 0 = free, otherwise the cost
    file_media_id: Optional[str] = None  # tools: the file buyers receive
    attachment_media_id: Optional[str] = None  # threads: one downloadable file
    image_media_ids: Optional[list[str]] = None  # threads: up to 8 inline images
    tags: Optional[list[str]] = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Title cannot be empty")
        if len(v) > 500:
            raise ValueError("Title is too long")
        return v

    @field_validator("content")
    @classmethod
    def validate_content(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Content cannot be empty")
        return v

    @field_validator("kind")
    @classmethod
    def validate_kind(cls, v: str) -> str:
        if v not in ("thread", "tool"):
            raise ValueError("kind must be 'thread' or 'tool'")
        return v

    @field_validator("post_type")
    @classmethod
    def validate_post_type(cls, v: str) -> str:
        if v not in ("free", "premium"):
            raise ValueError("post_type must be 'free' or 'premium'")
        return v

    @field_validator("price")
    @classmethod
    def validate_price(cls, v):
        if v is None:
            return None
        if v < 0 or v > 999999:
            raise ValueError("Price must be between 0 and 999999")
        return round(float(v), 2)

    @field_validator("image_media_ids")
    @classmethod
    def validate_images(cls, v):
        if not v:
            return None
        if len(v) > 8:
            raise ValueError("At most 8 images per thread")
        return v[:8]


class FileInfoOut(BaseModel):
    media_id: str
    name: Optional[str] = None
    size_bytes: Optional[int] = None
    mime_type: Optional[str] = None


class PostSummary(BaseModel):
    id: str
    title: str
    slug: str
    kind: str = "thread"
    category_id: str
    category_name: Optional[str] = None
    subcategory_id: Optional[str] = None
    subcategory_name: Optional[str] = None
    subcategory_icon_url: Optional[str] = None
    author: AuthorOut
    post_type: str
    price: Optional[float] = None
    is_locked: bool
    excerpt: Optional[str] = None  # always None: lists are title-only
    view_count: int
    like_count: int
    comment_count: int
    created_at: datetime


class PostDetail(PostSummary):
    content: Optional[str] = None  # None when locked for this viewer
    lock_reason: Optional[str] = None  # "login" | "premium" | "interact" | None
    liked_by_viewer: bool = False
    commented_by_viewer: bool = False
    image_urls: list[str] = []
    attachment: Optional[FileInfoOut] = None
    file: Optional[FileInfoOut] = None  # tools: the purchasable file
    has_file_access: bool = False


class CommentCreate(BaseModel):
    content: str

    @field_validator("content")
    @classmethod
    def validate_content(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Comment cannot be empty")
        if len(v) > 2000:
            raise ValueError("Comment is too long")
        return v


class CommentOut(BaseModel):
    id: str
    post_id: str
    author: AuthorOut
    content: str
    created_at: datetime
