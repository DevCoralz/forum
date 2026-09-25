"""Direct message threads: GET/POST /dm/threads."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import CurrentUser, get_current_user

router = APIRouter(tags=["dm"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class DMPeer(BaseModel):
    id: str
    username: str
    avatar_url: Optional[str] = None
    is_verified_tick: bool = False
    labels: list[str] = []
    role: Optional[str] = None


class ThreadOut(BaseModel):
    id: str
    peer: DMPeer
    last_message: Optional[str] = None
    updated_at: datetime
    unread: int = 0


class StartThreadIn(BaseModel):
    username: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _build_thread(conn, thread_id: str, viewer_id: str) -> ThreadOut:
    with conn.cursor() as cur:
        # Get participants
        cur.execute(
            """SELECT u.id, u.username, u.avatar_url, u.is_verified_tick, u.role,
                      dp.last_read_at
               FROM dm_participants dp
               JOIN users u ON u.id = dp.user_id
               WHERE dp.thread_id=%s""",
            (thread_id,),
        )
        rows = cur.fetchall()

    peer = None
    my_last_read = None
    for r in rows:
        if r["id"] == viewer_id:
            my_last_read = r["last_read_at"]
        else:
            peer = DMPeer(
                id=r["id"],
                username=r["username"],
                avatar_url=r.get("avatar_url"),
                is_verified_tick=bool(r.get("is_verified_tick", False)),
                role=r.get("role"),
            )

    if peer is None:
        # self-thread fallback
        with conn.cursor() as cur:
            cur.execute("SELECT id, username, avatar_url, is_verified_tick, role FROM users WHERE id=%s", (viewer_id,))
            r = cur.fetchone() or {}
        peer = DMPeer(id=r.get("id", viewer_id), username=r.get("username", ""), role=r.get("role"))

    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, sender_id, text, created_at FROM dm_messages WHERE thread_id=%s ORDER BY created_at DESC LIMIT 1",
            (thread_id,),
        )
        last = cur.fetchone()

        unread = 0
        if last and last["sender_id"] != viewer_id:
            q = "SELECT COUNT(*) AS n FROM dm_messages WHERE thread_id=%s AND sender_id != %s"
            params: list = [thread_id, viewer_id]
            if my_last_read:
                q += " AND created_at > %s"
                params.append(my_last_read)
            cur.execute(q, params)
            unread = int((cur.fetchone() or {}).get("n", 0))

        with conn.cursor() as cur2:
            cur2.execute("SELECT last_message_at FROM dm_threads WHERE id=%s", (thread_id,))
            t = cur2.fetchone() or {}

    updated = last["created_at"] if last else t.get("last_message_at", _utcnow())
    return ThreadOut(
        id=thread_id,
        peer=peer,
        last_message=last["text"] if last else None,
        updated_at=updated,
        unread=unread,
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/dm/threads", response_model=list[ThreadOut])
def list_threads(user: CurrentUser = Depends(get_current_user)):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT dt.id FROM dm_threads dt
                   JOIN dm_participants dp ON dp.thread_id = dt.id
                   WHERE dp.user_id=%s
                   ORDER BY dt.last_message_at DESC LIMIT 100""",
                (user.id,),
            )
            thread_ids = [r["id"] for r in cur.fetchall()]
        return [_build_thread(conn, tid, user.id) for tid in thread_ids]


@router.post("/dm/threads", response_model=ThreadOut)
def start_thread(payload: StartThreadIn, user: CurrentUser = Depends(get_current_user)):
    username = payload.username.strip()
    if not username:
        raise HTTPException(422, "Username is required")

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, username FROM users WHERE username=%s", (username,))
            peer = cur.fetchone()
        if peer is None:
            raise HTTPException(404, "User not found")
        if peer["id"] == user.id:
            raise HTTPException(422, "You cannot message yourself")

        with conn.cursor() as cur:
            # Check for an existing thread between the two users
            cur.execute(
                """SELECT dp1.thread_id FROM dm_participants dp1
                   JOIN dm_participants dp2 ON dp2.thread_id = dp1.thread_id
                   WHERE dp1.user_id=%s AND dp2.user_id=%s LIMIT 1""",
                (user.id, peer["id"]),
            )
            existing = cur.fetchone()

        if existing:
            return _build_thread(conn, existing["thread_id"], user.id)

        thread_id = str(uuid4())
        now = _utcnow()
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO dm_threads (id, created_at, last_message_at) VALUES (%s,%s,%s)",
                (thread_id, now, now),
            )
            cur.execute(
                "INSERT INTO dm_participants (thread_id, user_id) VALUES (%s,%s),(%s,%s)",
                (thread_id, user.id, thread_id, peer["id"]),
            )
        return _build_thread(conn, thread_id, user.id)
