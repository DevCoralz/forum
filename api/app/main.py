from __future__ import annotations

import platform
import shutil
import ssl
import subprocess
import sys
import threading
import time
import urllib.request
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.core.config import CF_TUNNEL_TOKEN, CORS_ORIGINS, UPLOAD_DIR, CHAT_UPLOAD_DIR
from app.core.database import init_db

# ── Auth ──────────────────────────────────────────────────────────────────────
from app.api.auth.register import router as register_router
from app.api.auth.login import router as login_router

# ── Account / sessions / profile ─────────────────────────────────────────────
from app.api.users.sessions import router as sessions_router
from app.api.users.profiles import router as profiles_router
from app.api.users.privacy import router as privacy_router          # GET+extended PATCH /me/privacy
from app.api.users.profile_update import router as profile_update_router  # PATCH /me/profile with username
from app.api.users.search import router as user_search_router       # GET /users/search, POST /users/{username}/follow

# ── Posts ─────────────────────────────────────────────────────────────────────
from app.api.posts.posts import router as posts_router
from app.api.posts.interactions import router as interactions_router
from app.api.posts.manage import router as posts_manage_router      # DELETE /posts/{id}, GET /posts/categories/counts

# ── Media (Telegram-backed uploads) ───────────────────────────────────────────
from app.api.media import router as media_router

# ── Chat & DMs ────────────────────────────────────────────────────────────────
from app.api.chat.stream import router as chat_router
from app.api.dm.threads import router as dm_router

# ── Public site bootstrap ─────────────────────────────────────────────────────
from app.api.site import router as public_site_router

# ── Admin ─────────────────────────────────────────────────────────────────────
from app.api.admin.tags import router as admin_tags_router
from app.api.admin.users import router as admin_users_router
from app.api.admin.site import router as admin_site_router

BIN_DIR = Path(__file__).parent.parent / ".bin"


def _cf_binary() -> Path:
    BIN_DIR.mkdir(exist_ok=True)
    cf = BIN_DIR / "cloudflared"
    if cf.exists():
        return cf
    system = platform.system().lower()
    machine = platform.machine().lower()
    arch = (
        "arm64" if machine in ("aarch64", "arm64", "armv8l") else
        "arm"   if "arm" in machine else "amd64"
    )
    url = f"https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-{system}-{arch}"
    print(f"[coralz] Downloading cloudflared ({arch})…", flush=True)
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, context=ctx) as resp, cf.open("wb") as fh:
        shutil.copyfileobj(resp, fh)
    cf.chmod(0o755)
    print("[coralz] cloudflared ready.", flush=True)
    return cf


def _start_tunnel() -> None:
    if not CF_TUNNEL_TOKEN:
        print("[coralz] CF_TUNNEL_TOKEN not set — skipping tunnel.", flush=True)
        return
    cf = _cf_binary()

    def _run():
        while True:
            try:
                proc = subprocess.Popen(
                    [str(cf), "tunnel", "--no-autoupdate", "run", "--token", CF_TUNNEL_TOKEN],
                    stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                )
                print(f"[coralz] Tunnel up (pid {proc.pid})", flush=True)
                for line in proc.stdout:
                    print(f"[cf] {line.decode(errors='replace')}", end="", flush=True)
                proc.wait()
            except Exception as exc:
                print(f"[coralz] Tunnel error: {exc}", flush=True)
            time.sleep(5)

    threading.Thread(target=_run, daemon=True).start()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    _start_tunnel()
    yield


app = FastAPI(
    title="I2P Forum API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url=None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def maintenance_gate(request, call_next):
    """Site mode = maintenance: everything 503s except admin surface, login and the
    public bootstrap so the maintenance page can still render."""
    path = request.url.path
    if path.startswith("/api/v1/"):
        from app.repositories.settings_repository import settings_repo

        allowed = (
            path.startswith("/api/v1/admin")
            or path.startswith("/api/v1/auth/login")
            or path.startswith("/api/v1/site")
            or path.startswith("/api/v1/media/")
            or path.startswith("/api/docs")
        )
        if not allowed and settings_repo.get_all().get("site_mode") == "maintenance":
            from fastapi.responses import JSONResponse

            return JSONResponse(
                {"detail": "Site is in maintenance mode. Check back soon."},
                status_code=503,
            )
    return await call_next(request)

# ── Auth ──────────────────────────────────────────────────────────────────────
app.include_router(register_router,  prefix="/api/v1/auth", tags=["auth"])
app.include_router(login_router,     prefix="/api/v1/auth", tags=["auth"])

# ── Account ───────────────────────────────────────────────────────────────────
# profile_update_router mounts PATCH /me/profile and must come before profiles_router
# so the username-change version wins over the original (which lacks that field).
app.include_router(profile_update_router, prefix="/api/v1", tags=["account"])
app.include_router(privacy_router,        prefix="/api/v1", tags=["account"])
app.include_router(sessions_router,       prefix="/api/v1/me", tags=["account"])
app.include_router(profiles_router,       prefix="/api/v1",    tags=["profiles"])

# ── Users ─────────────────────────────────────────────────────────────────────
app.include_router(user_search_router, prefix="/api/v1", tags=["users"])

# ── Posts ─────────────────────────────────────────────────────────────────────
# posts_manage_router first so DELETE /posts/{id} and /posts/categories/counts are registered
# before the wildcard /{post_id} route in posts_router.
app.include_router(posts_manage_router,  prefix="/api/v1",       tags=["posts"])
app.include_router(posts_router,         prefix="/api/v1/posts",  tags=["posts"])
app.include_router(interactions_router,  prefix="/api/v1/posts",  tags=["posts"])

# ── Chat & DMs ────────────────────────────────────────────────────────────────
app.include_router(chat_router, prefix="/api/v1", tags=["chat"])
app.include_router(dm_router,   prefix="/api/v1", tags=["dm"])

# ── Media ─────────────────────────────────────────────────────────────────────
app.include_router(media_router, prefix="/api/v1", tags=["media"])

# ── Public site bootstrap ─────────────────────────────────────────────────────
app.include_router(public_site_router, prefix="/api/v1", tags=["site"])

# ── Admin ─────────────────────────────────────────────────────────────────────
app.include_router(admin_tags_router, prefix="/api/v1/admin", tags=["admin"])
app.include_router(admin_users_router, prefix="/api/v1/admin", tags=["admin"])
app.include_router(admin_site_router, prefix="/api/v1/admin", tags=["admin"])

# ── Static files ──────────────────────────────────────────────────────────────
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(CHAT_UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")
