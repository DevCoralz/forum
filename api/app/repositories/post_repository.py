import re
from typing import Optional

from app.core.database import get_db, new_id


def slugify(title: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return s[:580] or "post"


class CategoryRepository:
    def list_all(self) -> list[dict]:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM post_categories ORDER BY sort_order, name")
                return list(cur.fetchall())

    def list_subcategories(self, category_id: str) -> list[dict]:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM post_subcategories WHERE category_id=%s ORDER BY sort_order, name",
                    (category_id,),
                )
                return list(cur.fetchall())

    def find(self, category_id: str) -> Optional[dict]:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM post_categories WHERE id=%s", (category_id,))
                return cur.fetchone()

    def find_subcategory(self, subcategory_id: str) -> Optional[dict]:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM post_subcategories WHERE id=%s", (subcategory_id,))
                return cur.fetchone()


class PostRepository:
    def create(self, author_id: str, title: str, content: str, category_id: str,
               subcategory_id: Optional[str], post_type: str, tags: Optional[list[str]]) -> dict:
        import json

        pid = new_id()
        base_slug = slugify(title)
        slug = base_slug
        with get_db() as conn:
            with conn.cursor() as cur:
                n = 1
                while True:
                    cur.execute("SELECT id FROM posts WHERE slug=%s", (slug,))
                    if not cur.fetchone():
                        break
                    n += 1
                    slug = f"{base_slug}-{n}"

                cur.execute(
                    """INSERT INTO posts
                       (id, title, slug, content, category_id, subcategory_id, author_id, post_type, tags)
                       VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                    (pid, title, slug, content, category_id, subcategory_id, author_id,
                     post_type, json.dumps(tags) if tags else None),
                )
                cur.execute("SELECT * FROM posts WHERE id=%s", (pid,))
                return cur.fetchone()

    def find(self, post_id: str) -> Optional[dict]:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM posts WHERE id=%s AND status != 'deleted'", (post_id,)
                )
                return cur.fetchone()

    def list_latest(self, limit: int, offset: int, category_id: Optional[str] = None) -> list[dict]:
        with get_db() as conn:
            with conn.cursor() as cur:
                if category_id:
                    cur.execute(
                        """SELECT * FROM posts WHERE status='active' AND category_id=%s
                           ORDER BY is_pinned DESC, created_at DESC LIMIT %s OFFSET %s""",
                        (category_id, limit, offset),
                    )
                else:
                    cur.execute(
                        """SELECT * FROM posts WHERE status='active'
                           ORDER BY is_pinned DESC, created_at DESC LIMIT %s OFFSET %s""",
                        (limit, offset),
                    )
                return list(cur.fetchall())

    def list_similar(self, post_id: str, category_id: str, limit: int) -> list[dict]:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT * FROM posts WHERE status='active' AND category_id=%s AND id != %s
                       ORDER BY created_at DESC LIMIT %s""",
                    (category_id, post_id, limit),
                )
                return list(cur.fetchall())

    def increment_view(self, post_id: str) -> None:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("UPDATE posts SET view_count = view_count + 1 WHERE id=%s", (post_id,))

    def like_count(self, post_id: str) -> int:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) AS n FROM post_likes WHERE post_id=%s", (post_id,))
                return cur.fetchone()["n"]

    def comment_count(self, post_id: str) -> int:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT COUNT(*) AS n FROM post_comments WHERE post_id=%s AND status='active'",
                    (post_id,),
                )
                return cur.fetchone()["n"]

    def is_liked_by(self, post_id: str, user_id: str) -> bool:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT 1 FROM post_likes WHERE post_id=%s AND user_id=%s", (post_id, user_id)
                )
                return cur.fetchone() is not None

    def like(self, post_id: str, user_id: str) -> bool:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT IGNORE INTO post_likes (post_id, user_id) VALUES (%s,%s)",
                    (post_id, user_id),
                )
                return cur.rowcount > 0

    def unlike(self, post_id: str, user_id: str) -> bool:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM post_likes WHERE post_id=%s AND user_id=%s", (post_id, user_id)
                )
                return cur.rowcount > 0


class CommentRepository:
    def create(self, post_id: str, author_id: str, content: str) -> dict:
        cid = new_id()
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO post_comments (id, post_id, author_id, content) VALUES (%s,%s,%s,%s)",
                    (cid, post_id, author_id, content),
                )
                cur.execute("SELECT * FROM post_comments WHERE id=%s", (cid,))
                return cur.fetchone()

    def has_commented(self, post_id: str, user_id: str) -> bool:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT 1 FROM post_comments WHERE post_id=%s AND author_id=%s AND status='active' LIMIT 1",
                    (post_id, user_id),
                )
                return cur.fetchone() is not None

    def list_for_post(self, post_id: str, limit: int, offset: int) -> list[dict]:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT * FROM post_comments WHERE post_id=%s AND status='active'
                       ORDER BY created_at ASC LIMIT %s OFFSET %s""",
                    (post_id, limit, offset),
                )
                return list(cur.fetchall())


category_repo = CategoryRepository()
post_repo = PostRepository()
comment_repo = CommentRepository()
