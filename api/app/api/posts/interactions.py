from fastapi import APIRouter, Depends, Query

from app.core.security import CurrentUser, get_current_user
from app.schemas.posts import CommentCreate, CommentOut
from app.services.post_service import post_service

router = APIRouter()


@router.get("/{post_id}/comments", response_model=list[CommentOut])
def list_comments(post_id: str, limit: int = Query(30, le=100), offset: int = Query(0, ge=0)):
    return post_service.list_comments(post_id, limit, offset)


@router.post("/{post_id}/comments", response_model=CommentOut, status_code=201)
def add_comment(post_id: str, body: CommentCreate, user: CurrentUser = Depends(get_current_user)):
    return post_service.add_comment(post_id, user.id, body)


@router.post("/{post_id}/like")
def toggle_like(post_id: str, user: CurrentUser = Depends(get_current_user)):
    return post_service.like(post_id, user.id)
