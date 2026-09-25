from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator


class CategoryOut(BaseModel):
    id: str
    name: str
    slug: str
    description: Optional[str] = None
    icon: Optional[str] = None

    model_config = {"from_attributes": True}


class SubcategoryOut(BaseModel):
    id: str
    category_id: str
    name: str
    slug: str
    description: Optional[str] = None

    model_config = {"from_attributes": True}


class AuthorOut(BaseModel):
    id: str
    username: str
    avatar_url: Optional[str] = None
    is_verified_tick: bool = False
    labels: list[str] = []


class CreatePostRequest(BaseModel):
    title: str
    content: str
    category_id: str
    subcategory_id: Optional[str] = None
    post_type: str = "free"  # "free" | "premium" — this is the audience gate
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

    @field_validator("post_type")
    @classmethod
    def validate_post_type(cls, v: str) -> str:
        if v not in ("free", "premium"):
            raise ValueError("post_type must be 'free' or 'premium'")
        return v


class PostSummary(BaseModel):
    id: str
    title: str
    slug: str
    category_id: str
    subcategory_id: Optional[str] = None
    author: AuthorOut
    post_type: str
    is_locked: bool
    excerpt: Optional[str] = None
    view_count: int
    like_count: int
    comment_count: int
    created_at: datetime


class PostDetail(PostSummary):
    content: Optional[str] = None  # None when locked for this viewer
    liked_by_viewer: bool = False


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
