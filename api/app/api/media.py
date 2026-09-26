import os
import re
import tempfile

from fastapi import APIRouter, Depends, File, Request, UploadFile
from fastapi.responses import StreamingResponse

from app.core import telegram
from app.core.config import ALLOWED_MEDIA_TYPES, MAX_MEDIA_BYTES
from app.core.database import get_db, new_id
from app.core.exceptions import bad_request, not_found
from app.core.security import CurrentUser, require_active

router = APIRouter()

# Magic-byte sniffing so a renamed file can't masquerade as an image/video.
_SIGS = [
    (b"\xff\xd8\xff", "image/jpeg"), (b"\x89PNG", "image/png"), (b"GIF8", "image/gif"),
    (b"\x00\x00\x01\x00", "image/x-icon"), (b"\x1aE\xdf\xa3", "video/webm"),
]


def _sniff(head: bytes) -> str | None:
    for sig, mime in _SIGS:
        if head.startswith(sig):
            return mime
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "image/webp"
    if head[4:8] == b"ftyp":
        return "video/mp4"
    return None


def media_url(media_id: str | None) -> str | None:
    # Absolute URLs (SITE_URL) so favicons and social previews work everywhere.
    from app.core.config import SITE_URL
    if not media_id:
        return None
    base = SITE_URL.rstrip("/")
    return f"{base}/api/v1/media/{media_id}" if base and base != "http://localhost:8000" else f"/api/v1/media/{media_id}"


async def store_upload(file: UploadFile, uploader_id: str, allow_video: bool = True) -> dict:
    if not telegram.is_configured():
        raise bad_request("Media storage is not configured")
    fd, path = tempfile.mkstemp()
    size = 0
    head = b""
    try:
        with os.fdopen(fd, "wb") as out:
            while chunk := await file.read(1024 * 1024):
                if not head:
                    head = chunk[:16]
                size += len(chunk)
                if size > MAX_MEDIA_BYTES:
                    raise bad_request("File too large (max 2 GB)")
                out.write(chunk)
        mime = _sniff(head)
        if not mime or mime not in ALLOWED_MEDIA_TYPES:
            raise bad_request("Unsupported file type")
        kind = "video" if mime.startswith("video/") else "image"
        if kind == "video" and not allow_video:
            raise bad_request("Videos are not allowed here")
        name = re.sub(r"[^A-Za-z0-9._-]", "_", file.filename or "file")[:120]
        chat_id, msg_id = await telegram.upload(path, name, mime)
    finally:
        try:
            os.remove(path)
        except OSError:
            pass
    mid = new_id()
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO media (id,tg_chat_id,tg_message_id,filename,mime_type,size_bytes,kind,uploaded_by) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
                (mid, chat_id, msg_id, name, mime, size, kind, uploader_id),
            )
    return {"id": mid, "url": media_url(mid), "kind": kind, "mime_type": mime, "size": size}


@router.post("/media", status_code=201)
async def upload_media(file: UploadFile = File(...), user: CurrentUser = Depends(require_active)):
    # Members may upload images only; videos are admin-only (ads).
    allow_video = user.role in ("admin", "super_admin")
    return await store_upload(file, user.id, allow_video=allow_video)


@router.get("/media/{media_id}")
async def get_media(media_id: str, request: Request):
    if not re.fullmatch(r"[0-9a-f-]{36}", media_id):
        raise not_found()
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM media WHERE id=%s", (media_id,))
            m = cur.fetchone()
    if not m:
        raise not_found()
    size = int(m["size_bytes"])
    start, end, status = 0, size - 1, 200
    rng = request.headers.get("range")
    if rng and (match := re.match(r"bytes=(\d*)-(\d*)", rng)):
        if match.group(1):
            start = int(match.group(1))
            if match.group(2):
                end = min(int(match.group(2)), size - 1)
        elif match.group(2):
            start = max(size - int(match.group(2)), 0)
        if start > end:
            start, end = 0, size - 1
        status = 206
    length = end - start + 1
    headers = {
        "Accept-Ranges": "bytes",
        "Content-Length": str(length),
        "Cache-Control": "public, max-age=604800, immutable",
        "X-Content-Type-Options": "nosniff",
    }
    if status == 206:
        headers["Content-Range"] = f"bytes {start}-{end}/{size}"
    return StreamingResponse(
        telegram.stream(int(m["tg_message_id"]), start, length),
        status_code=status, media_type=m["mime_type"], headers=headers,
    )
