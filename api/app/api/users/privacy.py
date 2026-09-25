"""Privacy settings: GET /me/privacy (was missing) + extended PATCH /me/privacy."""
from __future__ import annotations

from typing import Literal, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import CurrentUser, get_current_user

router = APIRouter(tags=["account"])

_SIMPLE_FIELDS = ("show_email", "show_socials", "show_activity", "allow_follow")
_EXTRA_FIELDS  = ("allow_comments", "allow_mentions", "allow_direct_messages", "profile_visibility")


# ── Schemas ───────────────────────────────────────────────────────────────────

class PrivacyOut(BaseModel):
    show_email: bool = False
    show_socials: bool = True
    show_activity: bool = True
    allow_follow: bool = True
    allow_comments: bool = True
    allow_mentions: bool = True
    allow_direct_messages: bool = True
    profile_visibility: Literal["public", "members", "private"] = "public"


class UpdatePrivacyIn(BaseModel):
    show_email: Optional[bool] = None
    show_socials: Optional[bool] = None
    show_activity: Optional[bool] = None
    allow_follow: Optional[bool] = None
    allow_comments: Optional[bool] = None
    allow_mentions: Optional[bool] = None
    allow_direct_messages: Optional[bool] = None
    profile_visibility: Optional[Literal["public", "members", "private"]] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _ensure_row(conn, user_id: str) -> dict:
    """Return user_privacy row, creating it if absent."""
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM user_privacy WHERE user_id=%s", (user_id,))
        row = cur.fetchone()
        if row is None:
            cur.execute("INSERT INTO user_privacy (user_id) VALUES (%s)", (user_id,))
            cur.execute("SELECT * FROM user_privacy WHERE user_id=%s", (user_id,))
            row = cur.fetchone()
    return row or {}


def _row_to_out(row: dict) -> PrivacyOut:
    vis = row.get("profile_visibility", "public") or "public"
    if vis not in ("public", "members", "private"):
        vis = "public"
    return PrivacyOut(
        show_email=bool(row.get("show_email", False)),
        show_socials=bool(row.get("show_socials", True)),
        show_activity=bool(row.get("show_activity", True)),
        allow_follow=bool(row.get("allow_follow", True)),
        allow_comments=bool(row.get("allow_comments", True)),
        allow_mentions=bool(row.get("allow_mentions", True)),
        allow_direct_messages=bool(row.get("allow_direct_messages", True)),
        profile_visibility=vis,  # type: ignore[arg-type]
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/me/privacy", response_model=PrivacyOut)
def get_privacy(user: CurrentUser = Depends(get_current_user)):
    with get_db() as conn:
        row = _ensure_row(conn, user.id)
    return _row_to_out(row)


@router.patch("/me/privacy", response_model=PrivacyOut)
def update_privacy(payload: UpdatePrivacyIn, user: CurrentUser = Depends(get_current_user)):
    all_fields = _SIMPLE_FIELDS + _EXTRA_FIELDS
    updates = {f: getattr(payload, f) for f in all_fields if getattr(payload, f) is not None}

    with get_db() as conn:
        _ensure_row(conn, user.id)
        if updates:
            sets = ", ".join(f"{k}=%s" for k in updates)
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE user_privacy SET {sets} WHERE user_id=%s",
                    (*updates.values(), user.id),
                )
        row = _ensure_row(conn, user.id)
    return _row_to_out(row)
