"""Telegram channel as media storage.

Uses a Telethon *user* session (StringSession) so uploads can reach 2 GB.
Only metadata is stored in MySQL (`media` table); bytes live in the channel.
All credentials are server-side env vars and never leave this process.
"""
from __future__ import annotations

import asyncio
from typing import AsyncIterator, Optional

from app.core.config import TG_API_HASH, TG_API_ID, TG_CHANNEL_ID, TG_SESSION_STRING

_client = None
_lock = asyncio.Lock()


def is_configured() -> bool:
    return bool(TG_API_ID and TG_API_HASH and TG_SESSION_STRING and TG_CHANNEL_ID)


def _channel():
    cid = TG_CHANNEL_ID.strip()
    return int(cid) if cid.lstrip("-").isdigit() else cid


async def get_client():
    global _client
    if not is_configured():
        raise RuntimeError("Telegram storage is not configured")
    async with _lock:
        if _client is None:
            from telethon import TelegramClient
            from telethon.sessions import StringSession
            _client = TelegramClient(StringSession(TG_SESSION_STRING), TG_API_ID, TG_API_HASH)
            await _client.connect()
            if not await _client.is_user_authorized():
                _client = None
                raise RuntimeError("Telegram session is not authorized")
        return _client


async def upload(path: str, filename: str, mime_type: str) -> tuple[str, int, bool, int]:
    """Upload a local temp file to the channel.

    Returns (chat_id, message_id, sent_as_photo, actual_size).
    Images are sent as photos and videos as videos so they render in Telegram
    and can be streamed back; only documents/archives are forced to files.
    Telegram recompresses photos, so the real byte size is returned too.
    """
    client = await get_client()
    is_image = mime_type.startswith("image/")
    is_video = mime_type.startswith("video/")
    attributes: list = []
    if not (is_image or is_video):
        from telethon.tl.types import DocumentAttributeFilename
        attributes = [DocumentAttributeFilename(filename)]
    msg = await client.send_file(
        _channel(), path,
        force_document=not (is_image or is_video),
        caption="",
        attributes=attributes or None,
    )
    sent_as_photo = bool(getattr(msg, "photo", None))
    actual_size = int(getattr(msg.file, "size", 0) or 0)
    return str(TG_CHANNEL_ID), int(msg.id), sent_as_photo, actual_size


async def stream(message_id: int, offset: int = 0, limit: Optional[int] = None) -> AsyncIterator[bytes]:
    client = await get_client()
    msg = await client.get_messages(_channel(), ids=message_id)
    if not msg or not msg.media:
        raise FileNotFoundError
    request_size = 512 * 1024
    # iter_download requires offset aligned to 4096
    aligned = offset - (offset % 4096)
    skip = offset - aligned
    remaining = limit
    async for chunk in client.iter_download(msg.media, offset=aligned, request_size=request_size):
        if skip:
            chunk = chunk[skip:]
            skip = 0
        if remaining is not None:
            if remaining <= 0:
                break
            chunk = chunk[:remaining]
            remaining -= len(chunk)
        yield bytes(chunk)


async def delete(message_id: int) -> None:
    try:
        client = await get_client()
        await client.delete_messages(_channel(), [message_id])
    except Exception:
        pass
