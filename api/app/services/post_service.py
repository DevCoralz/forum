from typing import Optional

from app.core.config import CAN_POST_ROLES, PREMIUM_ACCESS_ROLES
from app.core.exceptions import bad_request, forbidden, not_found
from app.repositories.label_repository import label_repo
from app.repositories.post_repository import category_repo, comment_repo, post_repo
from app.repositories.user_repository import user_repo
from app.schemas.posts import (
    AuthorOut, CommentCreate, CommentOut, CreatePostRequest, PostDetail, PostSummary,
)

EXCERPT_LEN = 240


def _viewer_can_see_premium(viewer_role: Optional[str]) -> bool:
    return bool(viewer_role) and viewer_role in PREMIUM_ACCESS_ROLES


def _is_staff(viewer_role: Optional[str]) -> bool:
    return viewer_role in ("admin", "super_admin")


def _lock_reason(post: dict, viewer_role: Optional[str], viewer_id: Optional[str]) -> Optional[str]:
    """Why the viewer can't read this post's content, or None if they can.

    - "login":    not signed in (every post needs an account)
    - "premium":  premium post and viewer lacks a premium role
    - "interact": free post, free viewer who hasn't liked AND commented yet
    Authors and admins always see their own / all posts.
    """
    if not viewer_id:
        return "login"
    if viewer_id == post["author_id"] or _is_staff(viewer_role):
        return None
    premium_viewer = _viewer_can_see_premium(viewer_role)
    if post["post_type"] == "premium":
        return None if premium_viewer else "premium"
    if premium_viewer:
        return None
    liked = post_repo.is_liked_by(post["id"], viewer_id)
    commented = comment_repo.has_commented(post["id"], viewer_id)
    return None if (liked and commented) else "interact"


def _ensure_not_suspended(user_id: Optional[str]) -> None:
    if not user_id:
        return
    u = user_repo.find_by_id(user_id)
    if u and u["is_suspended"]:
        until = u.get("suspended_until")
        from datetime import datetime
        if until is None or datetime.now() < until:
            raise forbidden("Your account is suspended")


def _threads_category_id() -> str:
    from app.core.database import get_db
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM post_categories WHERE slug='threads'")
            row = cur.fetchone()
    if not row:
        raise bad_request("Threads category missing")
    return row["id"]


def _author_out(user_row: dict, labels_by_user: dict[str, list[str]]) -> AuthorOut:
    badges = label_repo.badges_for_users([user_row["id"]]).get(user_row["id"], [])
    return AuthorOut(
        id=user_row["id"],
        username=user_row["username"],
        avatar_url=user_row.get("avatar_url"),
        is_verified_tick=bool(user_row.get("is_verified_tick")),
        labels=labels_by_user.get(user_row["id"], []),
        badges=badges,
    )


class PostService:
    def create(self, author_id: str, author_role: str, body: CreatePostRequest) -> dict:
        if author_role not in CAN_POST_ROLES:
            raise forbidden("Upgrade Membership to create threads")
        _ensure_not_suspended(author_id)
        # Every thread goes into the Threads category for now.
        threads_id = _threads_category_id()

        return post_repo.create(
            author_id=author_id,
            title=body.title,
            content=body.content,
            category_id=threads_id,
            subcategory_id=None,
            post_type=body.post_type,
            tags=body.tags,
        )

    def _to_summary(self, post: dict, viewer_role: Optional[str], viewer_id: Optional[str],
                     labels_by_user: dict[str, list[str]], authors_by_id: dict[str, dict]) -> PostSummary:
        author = authors_by_id[post["author_id"]]
        # Lists are title-only: content/excerpt never leaves the detail endpoint.
        locked = post["post_type"] == "premium" and not _viewer_can_see_premium(viewer_role)
        return PostSummary(
            id=post["id"],
            title=post["title"],
            slug=post["slug"],
            category_id=post["category_id"],
            subcategory_id=post.get("subcategory_id"),
            author=_author_out(author, labels_by_user),
            post_type=post["post_type"],
            is_locked=locked,
            excerpt=None,
            view_count=post["view_count"],
            like_count=post_repo.like_count(post["id"]),
            comment_count=post_repo.comment_count(post["id"]),
            created_at=post["created_at"],
        )

    def list_latest(self, viewer_role: Optional[str], viewer_id: Optional[str],
                     limit: int, offset: int, category_id: Optional[str]) -> list[PostSummary]:
        posts = post_repo.list_latest(limit, offset, category_id)
        return self._hydrate_summaries(posts, viewer_role, viewer_id)

    def list_similar(self, post_id: str, viewer_role: Optional[str], viewer_id: Optional[str],
                      limit: int) -> list[PostSummary]:
        post = post_repo.find(post_id)
        if not post:
            raise not_found("Thread not found")
        similar = post_repo.list_similar(post_id, post["category_id"], limit)
        return self._hydrate_summaries(similar, viewer_role, viewer_id)

    def _hydrate_summaries(self, posts: list[dict], viewer_role: Optional[str],
                            viewer_id: Optional[str]) -> list[PostSummary]:
        author_ids = list({p["author_id"] for p in posts})
        authors_by_id = {a["id"]: a for a in (user_repo.find_by_id(aid) for aid in author_ids) if a}
        labels_by_user = label_repo.list_for_users(author_ids)
        return [self._to_summary(p, viewer_role, viewer_id, labels_by_user, authors_by_id) for p in posts]

    def get_detail(self, post_id: str, viewer_role: Optional[str], viewer_id: Optional[str]) -> PostDetail:
        _ensure_not_suspended(viewer_id)
        post = post_repo.find(post_id)
        if not post:
            raise not_found("Thread not found")

        author = user_repo.find_by_id(post["author_id"])
        labels_by_user = label_repo.list_for_users([post["author_id"]])
        reason = _lock_reason(post, viewer_role, viewer_id)
        locked = reason is not None

        post_repo.increment_view(post_id)

        return PostDetail(
            id=post["id"],
            title=post["title"],
            slug=post["slug"],
            category_id=post["category_id"],
            subcategory_id=post.get("subcategory_id"),
            author=_author_out(author, labels_by_user),
            post_type=post["post_type"],
            is_locked=locked,
            excerpt=None,
            content=None if locked else post["content"],
            lock_reason=reason,
            liked_by_viewer=bool(viewer_id and post_repo.is_liked_by(post_id, viewer_id)),
            commented_by_viewer=bool(viewer_id and comment_repo.has_commented(post_id, viewer_id)),
            view_count=post["view_count"] + 1,
            like_count=post_repo.like_count(post_id),
            comment_count=post_repo.comment_count(post_id),
            created_at=post["created_at"],
        )

    def like(self, post_id: str, user_id: str) -> dict:
        _ensure_not_suspended(user_id)
        post = post_repo.find(post_id)
        if not post:
            raise not_found("Thread not found")
        if post["post_type"] == "premium":
            user = user_repo.find_by_id(user_id)
            if not user or user["role"] not in PREMIUM_ACCESS_ROLES:
                raise forbidden("Premium content — upgrade to interact with this post")

        if post_repo.is_liked_by(post_id, user_id):
            post_repo.unlike(post_id, user_id)
            liked = False
        else:
            post_repo.like(post_id, user_id)
            liked = True
        return {"liked": liked, "like_count": post_repo.like_count(post_id)}

    def add_comment(self, post_id: str, user_id: str, body: CommentCreate) -> CommentOut:
        _ensure_not_suspended(user_id)
        post = post_repo.find(post_id)
        if not post:
            raise not_found("Thread not found")
        if post["post_type"] == "premium":
            user = user_repo.find_by_id(user_id)
            if not user or user["role"] not in PREMIUM_ACCESS_ROLES:
                raise forbidden("Premium content — upgrade to comment on this post")

        comment = comment_repo.create(post_id, user_id, body.content)
        author = user_repo.find_by_id(user_id)
        labels_by_user = label_repo.list_for_users([user_id])
        return CommentOut(
            id=comment["id"],
            post_id=post_id,
            author=_author_out(author, labels_by_user),
            content=comment["content"],
            created_at=comment["created_at"],
        )

    def list_comments(self, post_id: str, limit: int, offset: int) -> list[CommentOut]:
        post = post_repo.find(post_id)
        if not post:
            raise not_found("Thread not found")

        comments = comment_repo.list_for_post(post_id, limit, offset)
        author_ids = list({c["author_id"] for c in comments})
        authors_by_id = {a["id"]: a for a in (user_repo.find_by_id(aid) for aid in author_ids) if a}
        labels_by_user = label_repo.list_for_users(author_ids)

        return [
            CommentOut(
                id=c["id"],
                post_id=post_id,
                author=_author_out(authors_by_id[c["author_id"]], labels_by_user),
                content=c["content"],
                created_at=c["created_at"],
            )
            for c in comments
        ]


post_service = PostService()
