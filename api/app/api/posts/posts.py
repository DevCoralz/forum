from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse

from app.api.media import media_url
from app.core.database import get_db
from app.core.exceptions import forbidden, not_found
from app.core.security import CurrentUser, get_current_user, get_optional_user
from app.repositories.post_repository import category_repo
from app.schemas.posts import (
    CategoryOut, CommentCreate, CreatePostRequest, PostDetail, PostSummary, SubcategoryOut,
)
from app.services.post_service import post_service

router = APIRouter()


@router.get("/categories", response_model=list[CategoryOut])
def list_categories():
    """Public list: hidden categories are excluded, each with its icon and count."""
    return [
        CategoryOut(
            id=c["id"], name=c["name"], slug=c["slug"], description=c.get("description"),
            icon=c.get("icon"), icon_media_id=c.get("icon_media_id"),
            icon_url=media_url(c.get("icon_media_id") or None),
            is_hidden=bool(c.get("is_hidden")), post_count=category_repo.post_count(c["id"]),
        )
        for c in category_repo.list_all(include_hidden=False)
    ]


@router.get("/categories/{category_id}/subcategories", response_model=list[SubcategoryOut])
def list_subcategories(category_id: str):
    if not category_repo.find(category_id):
        raise not_found("Category not found")
    return [
        SubcategoryOut(
            id=s["id"], category_id=s["category_id"], name=s["name"], slug=s["slug"],
            description=s.get("description"), icon=s.get("icon"),
            icon_media_id=s.get("icon_media_id"),
            icon_url=media_url(s.get("icon_media_id") or None),
            post_count=category_repo.subcategory_post_count(s["id"]),
        )
        for s in category_repo.list_subcategories(category_id)
    ]


@router.get("", response_model=list[PostSummary])
def list_posts(
    sort: str = Query("latest"),
    category_id: Optional[str] = Query(None),
    subcategory_id: Optional[str] = Query(None),
    kind: Optional[str] = Query(None),
    limit: int = Query(20, le=50),
    offset: int = Query(0, ge=0),
    user: Optional[CurrentUser] = Depends(get_optional_user),
):
    role = user.role if user else None
    uid = user.id if user else None
    return post_service.list_latest(role, uid, limit, offset, category_id, subcategory_id, kind)


@router.post("", response_model=dict, status_code=201)
def create_post(body: CreatePostRequest, user: CurrentUser = Depends(get_current_user)):
    post = post_service.create(user.id, user.role, body)
    return {"id": post["id"], "slug": post["slug"]}


@router.get("/{post_id}", response_model=PostDetail)
def get_post(post_id: str, user: Optional[CurrentUser] = Depends(get_optional_user)):
    role = user.role if user else None
    uid = user.id if user else None
    return post_service.get_detail(post_id, role, uid)


@router.get("/{post_id}/file")
def download_tool_file(post_id: str, user: Optional[CurrentUser] = Depends(get_optional_user)):
    """Streams the tool's file — only to its author, staff, or after payment."""
    post = post_repo_find(post_id)
    if not post or not post.get("file_media_id"):
        raise not_found("File not found")
    role = user.role if user else None
    uid = user.id if user else None
    if not uid:
        raise forbidden("Log in to download this file")
    from app.services.post_service import _has_file_access
    if not _has_file_access(post, role, uid):
        price = float(post.get("price") or 0)
        raise forbidden(f"Payment required — this tool costs {price:g}")

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM media WHERE id=%s", (post["file_media_id"],))
            m = cur.fetchone()
    if not m:
        raise not_found()
    from app.core import telegram
    from app.core.database import get_db as _gdb  # noqa: F401  (kept for clarity)
    size = int(m["size_bytes"])
    filename = m.get("filename") or "file"
    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "Content-Length": str(size),
        "Cache-Control": "private, no-store",
    }
    return StreamingResponse(
        telegram.stream(int(m["tg_message_id"]), 0, size),
        media_type=m["mime_type"], headers=headers,
    )


def post_repo_find(post_id: str):
    from app.repositories.post_repository import post_repo
    return post_repo.find(post_id)


@router.get("/{post_id}/similar", response_model=list[PostSummary])
def similar_posts(post_id: str, limit: int = Query(10, le=30),
                   user: Optional[CurrentUser] = Depends(get_optional_user)):
    role = user.role if user else None
    uid = user.id if user else None
    return post_service.list_similar(post_id, role, uid, limit)


@router.get("/author/{username}", response_model=list[PostSummary])
def posts_by_author(username: str, limit: int = Query(30, le=50),
                     user: Optional[CurrentUser] = Depends(get_optional_user)):
    role = user.role if user else None
    uid = user.id if user else None
    return post_service.list_by_author(username, role, uid, limit)


@router.post("/{post_id}/like", response_model=dict)
def like_post(post_id: str, user: CurrentUser = Depends(get_current_user)):
    return post_service.like(post_id, user.id)


@router.get("/{post_id}/comments", response_model=list)
def list_comments(post_id: str, limit: int = Query(50, le=100), offset: int = Query(0, ge=0),
                   user: Optional[CurrentUser] = Depends(get_optional_user)):
    return post_service.list_comments(post_id, limit, offset)


@router.post("/{post_id}/comments", response_model=dict, status_code=201)
def add_comment(post_id: str, body: dict, user: CurrentUser = Depends(get_current_user)):
    content = str(body.get("content") or "").strip()
    if not content:
        from app.core.exceptions import bad_request
        raise bad_request("Write something first")
    comment = post_service.add_comment(post_id, user.id, CommentCreate(content=content))
    return comment.model_dump(mode="json")


@router.post("/{post_id}/report", response_model=dict, status_code=201)
def report_post(post_id: str, body: dict, user: CurrentUser = Depends(get_current_user)):
    reason = str(body.get("reason") or "").strip()[:1000]
    post_service.report(post_id, user.id, reason)
    return {"ok": True}
