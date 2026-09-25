"""Extended PATCH /me/profile — adds username change support."""
from __future__ import annotations

import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import CurrentUser, get_current_user

router = APIRouter(tags=["account"])

_USERNAME_RE = re.compile(r"^[a-zA-Z0-9_]{3,24}$")


class ProfileUpdateIn(BaseModel):
    username: Optional[str] = None
    about_me: Optional[str] = None
    avatar_url: Optional[str] = None
    socials: Optional[list[dict]] = None


@router.patch("/me/profile")
def update_profile(payload: ProfileUpdateIn, user: CurrentUser = Depends(get_current_user)):
    updates: dict = {}

    if payload.username is not None:
        new_name = payload.username.strip()
        if not _USERNAME_RE.match(new_name):
            raise HTTPException(422, "Username must be 3-24 letters, numbers or underscores")
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id FROM users WHERE username=%s AND id != %s", (new_name, user.id))
                if cur.fetchone():
                    raise HTTPException(409, "Username already taken")
        updates["username"] = new_name

    if payload.about_me is not None:
        updates["about_me"] = payload.about_me

    if payload.avatar_url is not None:
        updates["avatar_url"] = payload.avatar_url

    result_username: Optional[str] = payload.username

    if updates:
        sets = ", ".join(f"{k}=%s" for k in updates)
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(f"UPDATE users SET {sets} WHERE id=%s", (*updates.values(), user.id))
                cur.execute("SELECT username FROM users WHERE id=%s", (user.id,))
                row = cur.fetchone()
                result_username = row["username"] if row else payload.username

    if payload.socials is not None:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM profile_social_links WHERE user_id=%s", (user.id,))
                for s in payload.socials:
                    from app.core.database import new_id
                    cur.execute(
                        "INSERT INTO profile_social_links (id, user_id, platform, value) VALUES (%s,%s,%s,%s)",
                        (new_id(), user.id, s.get("platform", ""), s.get("value", "")),
                    )

    return {"ok": True, "username": result_username}
