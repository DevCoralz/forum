from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.core.security import CurrentUser, get_current_user, get_optional_user
from app.repositories.post_repository import category_repo
from app.schemas.posts import (
    CategoryOut, CreatePostRequest, PostDetail, PostSummary, SubcategoryOut,
)
from app.services.post_service import post_service

router = APIRouter()


@router.get("/categories", response_model=list[CategoryOut])
def list_categories():
    return category_repo.list_all()


@router.get("/categories/{category_id}/subcategories", response_model=list[SubcategoryOut])
def list_subcategories(category_id: str):
    return category_repo.list_subcategories(category_id)


@router.get("", response_model=list[PostSummary])
def list_posts(
    sort: str = Query("latest"),
    category_id: Optional[str] = Query(None),
    limit: int = Query(20, le=50),
    offset: int = Query(0, ge=0),
    user: Optional[CurrentUser] = Depends(get_optional_user),
):
    role = user.role if user else None
    uid = user.id if user else None
    return post_service.list_latest(role, uid, limit, offset, category_id)


@router.post("", response_model=dict, status_code=201)
def create_post(body: CreatePostRequest, user: CurrentUser = Depends(get_current_user)):
    post = post_service.create(user.id, user.role, body)
    return {"id": post["id"], "slug": post["slug"]}


@router.get("/{post_id}", response_model=PostDetail)
def get_post(post_id: str, user: Optional[CurrentUser] = Depends(get_optional_user)):
    role = user.role if user else None
    uid = user.id if user else None
    return post_service.get_detail(post_id, role, uid)


@router.get("/{post_id}/similar", response_model=list[PostSummary])
def similar_posts(post_id: str, limit: int = Query(10, le=30),
                   user: Optional[CurrentUser] = Depends(get_optional_user)):
    role = user.role if user else None
    uid = user.id if user else None
    return post_service.list_similar(post_id, role, uid, limit)
