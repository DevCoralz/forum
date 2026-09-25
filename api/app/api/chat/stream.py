"""Public chat stream: GET/POST /chat/stream, /chat/stream/join, /chat/stream/messages."""
from __future__ import annotations

import os
import secrets
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.core.config import CHAT_UPLOAD_DIR
from app.core.database import get_db
from app.core.security import CurrentUser, get_current_user

router = APIRouter(tags=["chat"])

MAX_IMAGE_BYTES = 5 * 1024 * 1024


# ── Schemas ───────────────────────────────────────────────────────────────────

class ChatAuthor(BaseModel):
    id: str
    username: str
    avatar_url: Optional[str] = None
    is_verified_tick: bool = False
    labels: list[str] = []
    role: Optional[str] = None


class ChatMessageOut(BaseModel):
    id: str
    author: ChatAuthor
    text: Optional[str] = None
    image_url: Optional[str] = None
    created_at: datetime


class ChatJoinOut(BaseModel):
    joined: bool = True
    member_count: int


# ── Helpers ───────────────────────────────────────────────────────────────────

def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _author_from_row(row: dict) -> ChatAuthor:
    import json
    labels_raw = row.get("labels") or "[]"
    try:
        labels = json.loads(labels_raw) if isinstance(labels_raw, str) else (labels_raw or [])
    except Exception:
        labels = []
    return ChatAuthor(
        id=row["id"],
        username=row["username"],
        avatar_url=row.get("avatar_url"),
        is_verified_tick=bool(row.get("is_verified_tick", False)),
        labels=labels,
        role=row.get("role"),
    )


def _member_count(conn) -> int:
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) AS n FROM chat_members")
        return int((cur.fetchone() or {}).get("n", 0))


def _message_out(row: dict) -> ChatMessageOut:
    return ChatMessageOut(
        id=row["msg_id"],
        author=ChatAuthor(
            id=row["user_id"],
            username=row["username"],
            avatar_url=row.get("avatar_url"),
            is_verified_tick=bool(row.get("is_verified_tick", False)),
            labels=[],
            role=row.get("role"),
        ),
        text=row.get("text"),
        image_url=row.get("image_url"),
        created_at=row["created_at"],
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/chat/stream", response_model=list[ChatMessageOut])
def list_stream(
    limit: int = 80,
    before: Optional[str] = None,
    user: CurrentUser = Depends(get_current_user),
):
    """Latest public chat messages, newest last."""
    with get_db() as conn:
        with conn.cursor() as cur:
            if before:
                cur.execute("SELECT created_at FROM chat_messages WHERE id=%s", (before,))
                anchor = cur.fetchone()
                if anchor:
                    cur.execute(
                        """SELECT m.id AS msg_id, m.user_id, m.text, m.image_url, m.created_at,
                                  u.username, u.avatar_url, u.is_verified_tick, u.role
                           FROM chat_messages m
                           JOIN users u ON u.id = m.user_id
                           WHERE m.created_at < %s
                           ORDER BY m.created_at DESC LIMIT %s""",
                        (anchor["created_at"], max(1, min(limit, 200))),
                    )
                else:
                    return []
            else:
                cur.execute(
                    """SELECT m.id AS msg_id, m.user_id, m.text, m.image_url, m.created_at,
                              u.username, u.avatar_url, u.is_verified_tick, u.role
                       FROM chat_messages m
                       JOIN users u ON u.id = m.user_id
                       ORDER BY m.created_at DESC LIMIT %s""",
                    (max(1, min(limit, 200)),),
                )
            rows = cur.fetchall()
    rows.reverse()
    return [_message_out(r) for r in rows]


@router.post("/chat/stream/join", response_model=ChatJoinOut)
def join_stream(user: CurrentUser = Depends(get_current_user)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT user_id FROM chat_members WHERE user_id=%s", (user.id,))
            if cur.fetchone():
                cur.execute(
                    "UPDATE chat_members SET last_seen_at=%s WHERE user_id=%s",
                    (_utcnow(), user.id),
                )
            else:
                cur.execute(
                    "INSERT INTO chat_members (user_id, joined_at, last_seen_at) VALUES (%s,%s,%s)",
                    (user.id, _utcnow(), _utcnow()),
                )
        count = _member_count(conn)
    return ChatJoinOut(joined=True, member_count=count)


@router.post("/chat/stream/messages", response_model=ChatMessageOut)
async def send_message(
    text: Optional[str] = Form(default=None),
    image: Optional[UploadFile] = File(default=None),
    user: CurrentUser = Depends(get_current_user),
):
    payload = (text or "").strip()
    if not payload and image is None:
        raise HTTPException(422, "Message needs text or an image")

    image_url: Optional[str] = None
    if image is not None:
        data = await image.read()
        if len(data) > MAX_IMAGE_BYTES:
            raise HTTPException(413, "Image exceeds 5 MB")
        ext = os.path.splitext(image.filename or "")[1].lower() or ".png"
        os.makedirs(CHAT_UPLOAD_DIR, exist_ok=True)
        name = f"{secrets.token_hex(12)}{ext}"
        with open(os.path.join(CHAT_UPLOAD_DIR, name), "wb") as fh:
            fh.write(data)
        image_url = f"/api/v1/chat/stream/images/{name}"

    msg_id = str(uuid4())
    now = _utcnow()
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO chat_messages (id, user_id, text, image_url, created_at) VALUES (%s,%s,%s,%s,%s)",
                (msg_id, user.id, payload or None, image_url, now),
            )
            cur.execute(
                """SELECT m.id AS msg_id, m.user_id, m.text, m.image_url, m.created_at,
                          u.username, u.avatar_url, u.is_verified_tick, u.role
                   FROM chat_messages m JOIN users u ON u.id = m.user_id
                   WHERE m.id=%s""",
                (msg_id,),
            )
            row = cur.fetchone()
    return _message_out(row)


@router.get("/chat/stream/images/{name}")
def chat_image(name: str):
    safe = os.path.basename(name)
    path = os.path.join(CHAT_UPLOAD_DIR, safe)
    if not os.path.isfile(path):
        raise HTTPException(404, "Image not found")
    return FileResponse(path)
