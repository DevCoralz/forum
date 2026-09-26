import os
from dotenv import load_dotenv

load_dotenv()

# Super admin — seeded on startup, cannot be deleted via API
SUPER_ADMIN_EMAIL: str = os.environ["SUPER_ADMIN_EMAIL"]
SUPER_ADMIN_USERNAME: str = os.environ.get("SUPER_ADMIN_USERNAME", "superadmin")
SUPER_ADMIN_PASSWORD: str = os.environ["SUPER_ADMIN_PASSWORD"]

# JWT
JWT_SECRET: str = os.environ["JWT_SECRET"]
JWT_ALGORITHM: str = "HS256"
JWT_EXPIRE_HOURS: int = int(os.environ.get("JWT_EXPIRE_HOURS", "24"))

# MySQL
DB_HOST: str = os.environ.get("DB_HOST", "localhost")
DB_PORT: int = int(os.environ.get("DB_PORT", "3306"))
DB_NAME: str = os.environ["DB_NAME"]
DB_USER: str = os.environ["DB_USER"]
DB_PASS: str = os.environ["DB_PASS"]

# SMTP
SMTP_HOST: str = os.environ.get("SMTP_HOST", "")
SMTP_PORT: int = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER: str = os.environ.get("SMTP_USER", "")
SMTP_PASS: str = os.environ.get("SMTP_PASS", "")
SMTP_FROM: str = os.environ.get("SMTP_FROM", "noreply@coralz.app")

# Site
SITE_NAME: str = os.environ.get("SITE_NAME", "Coralz")
SITE_URL: str = os.environ.get("SITE_URL", "http://localhost:8000")

# CORS — comma-separated list of allowed frontend origins
CORS_ORIGINS: list[str] = [
    o.strip() for o in os.environ.get("CORS_ORIGINS", SITE_URL).split(",") if o.strip()
]

# Cloudflare Tunnel
CF_TUNNEL_TOKEN: str = os.environ.get("CF_TUNNEL_TOKEN", "")

# Limits
RESET_TOKEN_EXPIRE_MINUTES: int = int(os.environ.get("RESET_TOKEN_EXPIRE_MINUTES", "30"))
USERNAME_MIN: int = 3
USERNAME_MAX: int = 30
PASSWORD_MIN: int = 8

# Role hierarchy
ROLE_LEVELS: dict[str, int] = {
    "free": 0,
    "premium": 1,
    "admin": 2,
    "super_admin": 3,
}

# Who can create posts
CAN_POST_ROLES: set[str] = {"premium", "admin", "super_admin"}

# Who can see premium posts
PREMIUM_ACCESS_ROLES: set[str] = {"premium", "admin", "super_admin"}

# About-me word limits (None = unlimited)
ABOUT_ME_LIMITS: dict[str, int | None] = {
    "free": 20,
    "premium": 40,
    "admin": None,
    "super_admin": None,
}

# Admin-grantable profile labels
SUGGESTED_LABELS: list[str] = ["Verified Member", "Community Contributor", "Featured Author"]

# Local upload storage
UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "uploads")
UPLOAD_BASE_URL: str = os.getenv("UPLOAD_BASE_URL", "/uploads")
MAX_AVATAR_BYTES: int = 5 * 1024 * 1024  # 5 MB
ALLOWED_AVATAR_TYPES: set[str] = {"image/jpeg", "image/png", "image/webp", "image/gif"}

# Chat image uploads
CHAT_UPLOAD_DIR: str = os.getenv("CHAT_UPLOAD_DIR", "uploads/chat")

# Telegram media storage (user session => 2 GB uploads). Server-side only.
TG_API_ID: int = int(os.environ.get("TG_API_ID", "0") or 0)
TG_API_HASH: str = os.environ.get("TG_API_HASH", "")
TG_SESSION_STRING: str = os.environ.get("TG_SESSION_STRING", "")
TG_CHANNEL_ID: str = os.environ.get("TG_CHANNEL_ID", "")
MAX_MEDIA_BYTES: int = 2000 * 1024 * 1024  # Telegram user-session limit
ALLOWED_MEDIA_TYPES: set[str] = {
    "image/jpeg", "image/png", "image/webp", "image/gif", "image/x-icon",
    "image/vnd.microsoft.icon", "video/mp4", "video/webm",
}
