"""Strip metadata (EXIF, ICC profiles, XMP, comments) from accepted uploads.

Files are validated by magic-byte signature in the media route; before they are
stored in the Telegram channel, image containers are rebuilt without any
metadata segments so location, author and device details never leave the server.
Everything is pure Python — no image library required.

Supported: JPEG, PNG, WEBP (RIFF), GIF. Any other kind is stored as-is.
"""
from __future__ import annotations

import os


def strip_metadata(path: str, mime: str) -> int:
    """Rewrite `path` in place without metadata. Returns the new size in bytes."""
    try:
        with open(path, "rb") as fh:
            data = fh.read()
    except OSError:
        return _size(path)

    handlers = {
        "image/jpeg": _strip_jpeg,
        "image/png": _strip_png,
        "image/webp": _strip_webp,
        "image/gif": _strip_gif,
    }
    handler = handlers.get(mime)
    if handler is None:
        return _size(path)
    try:
        cleaned = handler(data)
    except Exception:
        return _size(path)  # never reject a valid upload over a parsing hiccup
    if not cleaned or len(cleaned) >= len(data):
        return _size(path)
    tmp = f"{path}.clean"
    try:
        with open(tmp, "wb") as fh:
            fh.write(cleaned)
        os.replace(tmp, path)
    except OSError:
        try:
            os.remove(tmp)
        except OSError:
            pass
    return _size(path)


def _size(path: str) -> int:
    try:
        return os.path.getsize(path)
    except OSError:
        return 0


def _strip_jpeg(data: bytes) -> bytes:
    if not data.startswith(b"\xff\xd8"):
        return data
    out = bytearray(data[:2])  # SOI
    i = 2
    while i + 4 <= len(data):
        if data[i] != 0xFF:
            break
        marker = data[i + 1]
        # Standalone markers carry no length field.
        if marker in (0xD8, 0xD9) or 0xD0 <= marker <= 0xD7:
            out += data[i:i + 2]
            i += 2
            continue
        length = int.from_bytes(data[i + 2:i + 4], "big")
        segment = data[i:i + 2 + length]
        keep = not (
            marker == 0xFE                      # COM comment
            or (0xE1 <= marker <= 0xEF)         # APP1..APP15: EXIF, XMP, ICC, Photoshop…
        )
        if keep:
            out += segment
        i += 2 + length
        if marker == 0xDA:  # SOS — the entropy-coded image follows verbatim
            out += data[i:]
            i = len(data)
    if i < len(data) and not out.endswith(b"\xff\xd9"):
        out += data[i:]
    return bytes(out)


def _strip_png(data: bytes) -> bytes:
    if not data.startswith(b"\x89PNG"):
        return data
    drop = {b"eXIf", b"tEXt", b"zTXt", b"iTXt", b"tIME", b"iCCP"}
    out = bytearray(data[:8])  # signature
    i = 8
    while i + 8 <= len(data):
        length = int.from_bytes(data[i:i + 4], "big")
        ctype = data[i + 4:i + 8]
        chunk = data[i:i + 12 + length]
        if ctype not in drop:
            out += chunk
        i += 12 + length
        if ctype == b"IEND":
            break
    return bytes(out)


def _strip_webp(data: bytes) -> bytes:
    if len(data) < 12 or data[:4] != b"RIFF" or data[8:12] != b"WEBP":
        return data
    drop = {b"EXIF", b"XMP ", b"XMPR"}
    body = bytearray(data[12:])
    kept = bytearray()
    i = 0
    while i + 8 <= len(body):
        ctype = body[i:i + 4]
        length = int.from_bytes(body[i + 4:i + 8], "little")
        chunk = body[i:i + 8 + length + (length & 1)]
        if ctype not in drop:
            kept += chunk
        i += 8 + length + (length & 1)
    out = bytearray(data[:8])
    out[4:8] = (4 + len(kept)).to_bytes(4, "little")  # RIFF size
    out += b"WEBP"
    out += kept
    return bytes(out)


def _strip_gif(data: bytes) -> bytes:
    if not data.startswith((b"GIF87a", b"GIF89a")):
        return data
    out = bytearray()
    i = 13  # header + logical screen descriptor
    if i < len(data) and data[i] & 0x80:  # global color table
        i += 3 * (2 ** ((data[i] & 0x07) + 1))
    out += data[:i]
    while i < len(data):
        block = data[i]
        if block == 0x21:  # extension
            label = data[i + 1]
            if label in (0xFE, 0xFF):  # comment / application (metadata) — drop
                j = i + 2
                while j < len(data) and data[j] != 0x00:
                    j += 1 + data[j]
                i = j + 1
                continue
            j = i + 2
            while j < len(data) and data[j] != 0x00:
                j += 1 + data[j]
            out += data[i:j + 1]
            i = j + 1
        elif block == 0x2C:  # image descriptor
            j = i + 9
            if j < len(data) and data[i + 9] & 0x80:  # local color table
                j += 3 * (2 ** ((data[i + 9] & 0x07) + 1))
            j += 1  # LZW min code size
            while j < len(data) and data[j] != 0x00:
                j += 1 + data[j]
            out += data[i:j + 1]
            i = j + 1
        elif block == 0x3B:  # trailer
            out += data[i:i + 1]
            i += 1
        else:
            out += data[i:]
            i = len(data)
    return bytes(out)
