"""Post management extras: DELETE /posts/{post_id}, GET /posts/categories with post counts."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import CurrentUser, get_current_user

router = APIRouter(tags=["posts"])

_ADMIN_ROLES = {"admin", "super_admin", "moderator"}


class CategoryWithCountOut(BaseModel):
    id: str
    name: str
    slug: str
    description: Optional[str] = None
    icon: Optional[str] = None
    post_count: int = 0


@router.delete("/posts/{post_id}")
def delete_post(post_id: str, user: CurrentUser = Depends(get_current_user)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, author_id FROM posts WHERE id=%s", (post_id,))
            row = cur.fetchone()
        if row is None:
            raise HTTPException(404, "Post not found")

        if row["author_id"] != user.id and user.role not in _ADMIN_ROLES:
            raise HTTPException(403, "You can only delete your own posts")

        with conn.cursor() as cur:
            # Remove child rows first
            for child_table in ("post_likes", "post_comments"):
                try:
                    cur.execute(f"DELETE FROM {child_table} WHERE post_id=%s", (post_id,))
                except Exception:
                    conn.rollback()

            cur.execute("DELETE FROM posts WHERE id=%s", (post_id,))

    return {"ok": True}


@router.get("/posts/categories/counts", response_model=list[CategoryWithCountOut])
def categories_with_counts():
    """Categories with per-category active post counts."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT c.id, c.name, c.slug, c.description, c.icon,
                          COUNT(p.id) AS post_count
                   FROM post_categories c
                   LEFT JOIN posts p ON p.category_id = c.id AND p.status='active'
                   GROUP BY c.id
                   ORDER BY c.sort_order, c.name"""
            )
            rows = cur.fetchall()
    return [
        CategoryWithCountOut(
            id=r["id"],
            name=r["name"],
            slug=r["slug"],
            description=r.get("description"),
            icon=r.get("icon"),
            post_count=int(r.get("post_count") or 0),
        )
        for r in rows
    ]
