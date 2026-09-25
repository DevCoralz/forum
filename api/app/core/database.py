import uuid
from contextlib import contextmanager

import pymysql
import pymysql.cursors

from app.core.config import DB_HOST, DB_NAME, DB_PASS, DB_PORT, DB_USER


def _conn(**kwargs):
    return pymysql.connect(
        host=DB_HOST,
        port=DB_PORT,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASS,
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=False,
        **kwargs,
    )


@contextmanager
def get_db():
    conn = _conn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def new_id() -> str:
    return str(uuid.uuid4())


# ── SCHEMA ────────────────────────────────────────────────────────────────────

_TABLES = [
    # ── Core users ──────────────────────────────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS users (
        id               VARCHAR(36)  PRIMARY KEY,
        username         VARCHAR(50)  NOT NULL UNIQUE,
        email            VARCHAR(255) NOT NULL UNIQUE,
        password_hash    VARCHAR(255) NOT NULL,
        role             ENUM('super_admin','admin','premium','free') NOT NULL DEFAULT 'free',
        is_suspended     BOOLEAN      NOT NULL DEFAULT FALSE,
        suspended_until  DATETIME     NULL,
        suspend_reason   VARCHAR(500) NULL,
        is_banned        BOOLEAN      NOT NULL DEFAULT FALSE,
        ban_reason       VARCHAR(500) NULL,
        is_verified_tick BOOLEAN      NOT NULL DEFAULT FALSE,
        about_me         TEXT         NULL,
        avatar_url       VARCHAR(500) NULL,
        socials          JSON         NULL,
        reset_token      VARCHAR(255) NULL,
        reset_expires    DATETIME     NULL,
        created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        last_login       DATETIME     NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,

    # ── Auth sessions ────────────────────────────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS user_sessions (
        id          VARCHAR(36)  PRIMARY KEY,
        user_id     VARCHAR(36)  NOT NULL,
        token_hash  VARCHAR(255) NOT NULL,
        user_agent  VARCHAR(500) NULL,
        ip_address  VARCHAR(64)  NULL,
        is_revoked  BOOLEAN      NOT NULL DEFAULT FALSE,
        created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_used   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at  DATETIME     NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,

    # ── User labels (admin-granted badges) ──────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS user_labels (
        id         VARCHAR(36)  PRIMARY KEY,
        user_id    VARCHAR(36)  NOT NULL,
        label      VARCHAR(100) NOT NULL,
        color      VARCHAR(20)  NOT NULL DEFAULT '#666666',
        added_by   VARCHAR(36)  NOT NULL,
        created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id)  REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (added_by) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,

    # ── User warnings and flags (moderation) ────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS user_warnings (
        id         VARCHAR(36) PRIMARY KEY,
        user_id    VARCHAR(36) NOT NULL,
        reason     TEXT        NOT NULL,
        warned_by  VARCHAR(36) NOT NULL,
        created_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id)   REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (warned_by) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,
    """
    CREATE TABLE IF NOT EXISTS user_flags (
        id          VARCHAR(36) PRIMARY KEY,
        user_id     VARCHAR(36) NOT NULL,
        reason      TEXT        NOT NULL,
        flagged_by  VARCHAR(36) NOT NULL,
        is_resolved BOOLEAN     NOT NULL DEFAULT FALSE,
        created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,

    # ── Follows ──────────────────────────────────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS user_follows (
        follower_id  VARCHAR(36) NOT NULL,
        following_id VARCHAR(36) NOT NULL,
        created_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (follower_id, following_id),
        FOREIGN KEY (follower_id)  REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,

    # ── Privacy settings ─────────────────────────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS user_privacy (
        user_id             VARCHAR(36) PRIMARY KEY,
        show_email          BOOLEAN     NOT NULL DEFAULT FALSE,
        show_socials        BOOLEAN     NOT NULL DEFAULT TRUE,
        show_activity       BOOLEAN     NOT NULL DEFAULT TRUE,
        allow_follow        BOOLEAN     NOT NULL DEFAULT TRUE,
        allow_comments      BOOLEAN     NOT NULL DEFAULT TRUE,
        allow_mentions      BOOLEAN     NOT NULL DEFAULT TRUE,
        allow_direct_messages BOOLEAN   NOT NULL DEFAULT TRUE,
        profile_visibility  VARCHAR(16) NOT NULL DEFAULT 'public',
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,

    # ── Subscriptions ────────────────────────────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS user_subscriptions (
        id          VARCHAR(36)  PRIMARY KEY,
        user_id     VARCHAR(36)  NOT NULL,
        tier        VARCHAR(50)  NOT NULL DEFAULT 'free',
        status      ENUM('active','expired','cancelled') NOT NULL DEFAULT 'active',
        assigned_by VARCHAR(36)  NULL,
        expires_at  DATETIME     NULL,
        created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id)     REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_by) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,

    # ── File uploads ─────────────────────────────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS user_uploads (
        id          VARCHAR(36)  PRIMARY KEY,
        user_id     VARCHAR(36)  NOT NULL,
        kind        VARCHAR(50)  NOT NULL DEFAULT 'avatar',
        storage_key VARCHAR(500) NOT NULL,
        url         VARCHAR(500) NOT NULL,
        mime_type   VARCHAR(100) NULL,
        size_bytes  INT          NULL,
        created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,

    # ── Profile social links ─────────────────────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS profile_social_links (
        id         VARCHAR(36)  PRIMARY KEY,
        user_id    VARCHAR(36)  NOT NULL,
        platform   VARCHAR(50)  NOT NULL,
        value      VARCHAR(500) NOT NULL,
        created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,

    # ── Post categories ──────────────────────────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS post_categories (
        id          VARCHAR(36)  PRIMARY KEY,
        name        VARCHAR(100) NOT NULL,
        slug        VARCHAR(100) NOT NULL UNIQUE,
        description TEXT         NULL,
        icon        VARCHAR(100) NULL,
        sort_order  INT          NOT NULL DEFAULT 0,
        created_by  VARCHAR(36)  NULL,
        created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,
    """
    CREATE TABLE IF NOT EXISTS post_subcategories (
        id          VARCHAR(36)  PRIMARY KEY,
        category_id VARCHAR(36)  NOT NULL,
        name        VARCHAR(100) NOT NULL,
        slug        VARCHAR(100) NOT NULL,
        description TEXT         NULL,
        sort_order  INT          NOT NULL DEFAULT 0,
        created_by  VARCHAR(36)  NULL,
        created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_subcat_slug (category_id, slug),
        FOREIGN KEY (category_id) REFERENCES post_categories(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,

    # ── Posts ─────────────────────────────────────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS posts (
        id             VARCHAR(36)   PRIMARY KEY,
        title          VARCHAR(500)  NOT NULL,
        slug           VARCHAR(600)  NOT NULL UNIQUE,
        content        LONGTEXT      NOT NULL,
        category_id    VARCHAR(36)   NOT NULL,
        subcategory_id VARCHAR(36)   NULL,
        author_id      VARCHAR(36)   NOT NULL,
        post_type      ENUM('free','premium') NOT NULL DEFAULT 'free',
        status         ENUM('active','flagged','suspended','deleted') NOT NULL DEFAULT 'active',
        is_pinned      BOOLEAN       NOT NULL DEFAULT FALSE,
        tags           JSON          NULL,
        view_count     INT           NOT NULL DEFAULT 0,
        created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES post_categories(id),
        FOREIGN KEY (author_id)   REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,

    # ── Post interactions ────────────────────────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS post_likes (
        post_id    VARCHAR(36) NOT NULL,
        user_id    VARCHAR(36) NOT NULL,
        created_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (post_id, user_id),
        FOREIGN KEY (post_id)  REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id)  REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,
    """
    CREATE TABLE IF NOT EXISTS post_comments (
        id         VARCHAR(36) PRIMARY KEY,
        post_id    VARCHAR(36) NOT NULL,
        author_id  VARCHAR(36) NOT NULL,
        content    TEXT        NOT NULL,
        status     ENUM('active','deleted') NOT NULL DEFAULT 'active',
        created_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (post_id)   REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (author_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,
    """
    CREATE TABLE IF NOT EXISTS post_blocks (
        blocker_id VARCHAR(36) NOT NULL,
        blocked_id VARCHAR(36) NOT NULL,
        created_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (blocker_id, blocked_id),
        FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,

    # ── Chat (public stream) ─────────────────────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS chat_members (
        user_id     VARCHAR(36) PRIMARY KEY,
        joined_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_seen_at DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,
    """
    CREATE TABLE IF NOT EXISTS chat_messages (
        id         VARCHAR(36)  PRIMARY KEY,
        user_id    VARCHAR(36)  NOT NULL,
        text       TEXT         NULL,
        image_url  VARCHAR(512) NULL,
        created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX ix_chat_messages_created_at (created_at),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,

    # ── Direct messages ──────────────────────────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS dm_threads (
        id              VARCHAR(36) PRIMARY KEY,
        created_at      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_message_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX ix_dm_threads_last_message_at (last_message_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,
    """
    CREATE TABLE IF NOT EXISTS dm_participants (
        thread_id    VARCHAR(36) NOT NULL,
        user_id      VARCHAR(36) NOT NULL,
        last_read_at DATETIME    NULL,
        PRIMARY KEY (thread_id, user_id),
        INDEX ix_dm_participants_user_id (user_id),
        FOREIGN KEY (thread_id) REFERENCES dm_threads(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id)   REFERENCES users(id)     ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,
    """
    CREATE TABLE IF NOT EXISTS dm_messages (
        id         VARCHAR(36) PRIMARY KEY,
        thread_id  VARCHAR(36) NOT NULL,
        sender_id  VARCHAR(36) NOT NULL,
        text       TEXT        NOT NULL,
        created_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX ix_dm_messages_thread_id (thread_id),
        FOREIGN KEY (thread_id) REFERENCES dm_threads(id) ON DELETE CASCADE,
        FOREIGN KEY (sender_id) REFERENCES users(id)      ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,

    # ── Notifications ────────────────────────────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS notifications (
        id         VARCHAR(36)  PRIMARY KEY,
        user_id    VARCHAR(36)  NOT NULL,
        title      VARCHAR(255) NOT NULL,
        body       TEXT         NOT NULL,
        type       VARCHAR(50)  NOT NULL DEFAULT 'system',
        is_read    BOOLEAN      NOT NULL DEFAULT FALSE,
        created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,

    # ── Announcements ────────────────────────────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS announcements (
        id         VARCHAR(36)  PRIMARY KEY,
        title      VARCHAR(255) NOT NULL,
        content    TEXT         NOT NULL,
        author_id  VARCHAR(36)  NOT NULL,
        is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
        created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (author_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,

    # ── Payments ─────────────────────────────────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS payments (
        id            VARCHAR(36)    PRIMARY KEY,
        user_id       VARCHAR(36)    NOT NULL,
        amount        DECIMAL(10,2)  NOT NULL,
        currency      VARCHAR(10)    NOT NULL DEFAULT 'USD',
        method        VARCHAR(100)   NOT NULL,
        status        ENUM('pending','confirmed','rejected') NOT NULL DEFAULT 'pending',
        notes         TEXT           NULL,
        granted_by    VARCHAR(36)    NULL,
        premium_until DATETIME       NULL,
        created_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id)    REFERENCES users(id),
        FOREIGN KEY (granted_by) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,

    # ── Site settings ────────────────────────────────────────────────────────
    """
    CREATE TABLE IF NOT EXISTS site_settings (
        `key`       VARCHAR(100) PRIMARY KEY,
        `value`     TEXT         NULL,
        updated_by  VARCHAR(36)  NULL,
        updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,
]

# ── Migrations for existing DBs ───────────────────────────────────────────────
# Rename old table names if this DB was previously running the original schema.
_RENAMES = [
    ("auth_sessions",   "user_sessions"),
    ("subscriptions",   "user_subscriptions"),
    ("uploads",         "user_uploads"),
    ("categories",      "post_categories"),
    ("subcategories",   "post_subcategories"),
    ("comments",        "post_comments"),
    ("follows",         "user_follows"),
    ("profile_privacy", "user_privacy"),
]

_SEED_CATEGORIES = [
    ("leaks",           "Leaks",            "Leaks"),
    ("methods",         "Methods",          "Methods"),
    ("premium",         "Premium",          "ELITES"),
    ("combos", "Combos",           "Accounts"),
    ("cookies",         "Cookies",          "Cookies"),
    ("logs",            "Logs",             "Logs"),
    
    ("others",          "Others",           "Others"),
]

_DEFAULT_SETTINGS = [
    ("registration_open", "true"),
    ("maintenance_mode",  "false"),
    ("site_name",         "Forum"),
]


def init_db() -> None:
    from app.core.config import (
        SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD, SUPER_ADMIN_USERNAME,
    )
    from app.core.security import hash_password

    with get_db() as conn:
        with conn.cursor() as cur:
            # Rename legacy tables before creating new ones (safe — IF EXISTS)
            for old, new in _RENAMES:
                cur.execute(
                    "SELECT COUNT(*) AS n FROM information_schema.tables "
                    "WHERE table_schema=DATABASE() AND table_name=%s",
                    (old,),
                )
                if cur.fetchone()["n"]:
                    cur.execute(f"RENAME TABLE `{old}` TO `{new}`")

            for stmt in _TABLES:
                cur.execute(stmt)

            # Add new privacy columns to user_privacy if this is an old DB
            cur.execute(
                "SELECT COUNT(*) AS n FROM information_schema.columns "
                "WHERE table_schema=DATABASE() AND table_name='user_privacy' "
                "AND column_name='allow_comments'"
            )
            if not cur.fetchone()["n"]:
                cur.execute(
                    "ALTER TABLE user_privacy "
                    "ADD COLUMN allow_comments BOOLEAN NOT NULL DEFAULT TRUE, "
                    "ADD COLUMN allow_mentions BOOLEAN NOT NULL DEFAULT TRUE, "
                    "ADD COLUMN allow_direct_messages BOOLEAN NOT NULL DEFAULT TRUE, "
                    "ADD COLUMN profile_visibility VARCHAR(16) NOT NULL DEFAULT 'public'"
                )

            # Migrate legacy 'verified' role -> 'free'
            cur.execute("SHOW COLUMNS FROM users LIKE 'role'")
            col = cur.fetchone()
            if col and "'verified'" in col["Type"]:
                cur.execute("ALTER TABLE users MODIFY role VARCHAR(20) NOT NULL DEFAULT 'free'")
                cur.execute("UPDATE users SET role='free' WHERE role='verified'")
                cur.execute(
                    "ALTER TABLE users MODIFY role ENUM('super_admin','admin','premium','free') NOT NULL DEFAULT 'free'"
                )

            # Seed categories
            cur.execute("SELECT COUNT(*) AS n FROM post_categories")
            if cur.fetchone()["n"] == 0:
                for i, (slug, name, desc) in enumerate(_SEED_CATEGORIES):
                    cur.execute(
                        "INSERT IGNORE INTO post_categories (id, name, slug, description, sort_order) VALUES (%s,%s,%s,%s,%s)",
                        (new_id(), name, slug, desc, i),
                    )

            # Seed site settings
            for key, val in _DEFAULT_SETTINGS:
                cur.execute(
                    "INSERT IGNORE INTO site_settings (`key`, `value`) VALUES (%s,%s)",
                    (key, val),
                )

            # Seed super admin
            cur.execute("SELECT id FROM users WHERE email=%s", (SUPER_ADMIN_EMAIL,))
            if not cur.fetchone():
                cur.execute(
                    "INSERT INTO users (id, username, email, password_hash, role) VALUES (%s,%s,%s,%s,'super_admin')",
                    (new_id(), SUPER_ADMIN_USERNAME, SUPER_ADMIN_EMAIL, hash_password(SUPER_ADMIN_PASSWORD)),
                )
            else:
                cur.execute(
                    "UPDATE users SET role='super_admin' WHERE email=%s",
                    (SUPER_ADMIN_EMAIL,),
                )
