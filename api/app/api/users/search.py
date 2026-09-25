"""User search and follow toggle: GET /users/search, POST /users/{username}/follow."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import CurrentUser, get_current_user

router = APIRouter(tags=["users"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class UserSearchOut(BaseModel):
    id: str
    username: str
    avatar_url: Optional[str] = None
    is_verified_tick: bool = False
    role: Optional[str] = None


class FollowOut(BaseModel):
    following: bool
    follower_count: int


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/users/search", response_model=list[UserSearchOut])
def search_users(
    q: str = "",
    limit: int = 10,
    user: CurrentUser = Depends(get_current_user),
):
    term = (q or "").strip()
    limit = max(1, min(limit, 25))
    with get_db() as conn:
        with conn.cursor() as cur:
            if term:
                cur.execute(
                    "SELECT id, username, avatar_url, is_verified_tick, role FROM users "
                    "WHERE username LIKE %s LIMIT %s",
                    (f"%{term}%", limit),
                )
            else:
                cur.execute(
                    "SELECT id, username, avatar_url, is_verified_tick, role FROM users LIMIT %s",
                    (limit,),
                )
            rows = cur.fetchall()
    return [
        UserSearchOut(
            id=r["id"],
            username=r["username"],
            avatar_url=r.get("avatar_url"),
            is_verified_tick=bool(r.get("is_verified_tick", False)),
            role=r.get("role"),
        )
        for r in rows
    ]


@router.post("/users/{username}/follow", response_model=FollowOut)
def toggle_follow(username: str, user: CurrentUser = Depends(get_current_user)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE username=%s", (username,))
            target = cur.fetchone()
        if target is None:
            raise HTTPException(404, "User not found")
        target_id = target["id"]
        if target_id == user.id:
            raise HTTPException(422, "You cannot follow yourself")

        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM user_follows WHERE follower_id=%s AND following_id=%s",
                (user.id, target_id),
            )
            already_following = cur.fetchone() is not None

            if already_following:
                cur.execute(
                    "DELETE FROM user_follows WHERE follower_id=%s AND following_id=%s",
                    (user.id, target_id),
                )
                following = False
            else:
                from datetime import datetime, timezone
                cur.execute(
                    "INSERT INTO user_follows (follower_id, following_id, created_at) VALUES (%s,%s,%s)",
                    (user.id, target_id, datetime.now(timezone.utc)),
                )
                following = True

            cur.execute(
                "SELECT COUNT(*) AS n FROM user_follows WHERE following_id=%s",
                (target_id,),
            )
            count = int((cur.fetchone() or {}).get("n", 0))

    return FollowOut(following=following, follower_count=count)
