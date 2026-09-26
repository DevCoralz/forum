import json
import re
from typing import Optional

from app.core.database import get_db, new_id


def slugify(title: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return s[:580] or "post"


class CategoryRepository:
    def list_all(self, include_hidden: bool = True) -> list[dict]:
        clause = "" if include_hidden else "WHERE NOT is_hidden"
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT * FROM post_categories {clause} ORDER BY sort_order, name"
                )
                return list(cur.fetchall())

    def find(self, category_id: str) -> Optional[dict]:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM post_categories WHERE id=%s", (category_id,))
                return cur.fetchone()

    def find_slug(self, slug: str) -> Optional[dict]:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM post_categories WHERE slug=%s", (slug,))
                return cur.fetchone()

    def find_by_name(self, name: str) -> Optional[dict]:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM post_categories WHERE name=%s", (name,))
                return cur.fetchone()

    def unique_slug(self, base: str, table: str, exclude_id: Optional[str] = None) -> str:
        slug = slugify(base)[:100]
        with get_db() as conn:
            with conn.cursor() as cur:
                n = 1
                while True:
                    if exclude_id:
                        cur.execute(
                            f"SELECT id FROM {table} WHERE slug=%s AND id<>%s", (slug, exclude_id)
                        )
                    else:
                        cur.execute(f"SELECT id FROM {table} WHERE slug=%s", (slug,))
                    if not cur.fetchone():
                        return slug
                    n += 1
                    slug = f"{slugify(base)[:90]}-{n}"

    def create(self, name: str, icon: Optional[str], icon_media_id: Optional[str],
               created_by: str, sort_order: Optional[int] = None) -> dict:
        cid = new_id()
        slug = self.unique_slug(name, "post_categories")
        with get_db() as conn:
            with conn.cursor() as cur:
                if sort_order is None:
                    cur.execute("SELECT COALESCE(MAX(sort_order), -1) + 1 AS nxt FROM post_categories")
                    sort_order = int(cur.fetchone()["nxt"])
                cur.execute(
                    """INSERT INTO post_categories
                       (id, name, slug, icon, icon_media_id, sort_order, created_by)
                       VALUES (%s,%s,%s,%s,%s,%s,%s)""",
                    (cid, name, slug, icon, icon_media_id, sort_order, created_by),
                )
                cur.execute("SELECT * FROM post_categories WHERE id=%s", (cid,))
                return cur.fetchone()

    def update(self, category_id: str, fields: dict) -> Optional[dict]:
        allowed = {"name", "icon", "icon_media_id", "is_hidden", "sort_order", "description"}
        if "name" in fields and fields["name"]:
            fields["slug"] = self.unique_slug(fields["name"], "post_categories", category_id)
        sets = [f"{k}=%s" for k in fields if k in allowed]
        if not sets:
            return self.find(category_id)
        params = [v for k, v in fields.items() if k in allowed] + [category_id]
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE post_categories SET {', '.join(sets)} WHERE id=%s", tuple(params)
                )
        return self.find(category_id)

    def delete(self, category_id: str) -> Optional[str]:
        """Returns 'protected' for the Threads category, 'in_use' when posts exist."""
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT slug FROM post_categories WHERE id=%s", (category_id,))
                row = cur.fetchone()
                if not row:
                    return "missing"
                if row["slug"] == "threads":
                    return "protected"
                cur.execute(
                    "SELECT COUNT(*) AS n FROM posts WHERE category_id=%s AND status != 'deleted'",
                    (category_id,),
                )
                if int(cur.fetchone()["n"]) > 0:
                    return "in_use"
                cur.execute("DELETE FROM post_categories WHERE id=%s", (category_id,))
                return "ok"

    def post_count(self, category_id: str) -> int:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT COUNT(*) AS n FROM posts WHERE category_id=%s AND status='active'",
                    (category_id,),
                )
                return int(cur.fetchone()["n"])

    # ── Subcategories ────────────────────────────────────────────────────────
    def list_subcategories(self, category_id: str) -> list[dict]:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM post_subcategories WHERE category_id=%s ORDER BY sort_order, name",
                    (category_id,),
                )
                return list(cur.fetchall())

    def find_subcategory(self, subcategory_id: str) -> Optional[dict]:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM post_subcategories WHERE id=%s", (subcategory_id,))
                return cur.fetchone()

    def create_subcategory(self, category_id: str, name: str, icon: Optional[str],
                           icon_media_id: Optional[str], created_by: str) -> dict:
        sid = new_id()
        slug = self.unique_slug(name, "post_subcategories")
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT COALESCE(MAX(sort_order), -1) + 1 AS nxt FROM post_subcategories WHERE category_id=%s",
                    (category_id,),
                )
                sort_order = int(cur.fetchone()["nxt"])
                cur.execute(
                    """INSERT INTO post_subcategories
                       (id, category_id, name, slug, icon, icon_media_id, sort_order, created_by)
                       VALUES (%s,%s,%s,%s,%s,%s,%s,%s)""",
                    (sid, category_id, name, slug, icon, icon_media_id, sort_order, created_by),
                )
                cur.execute("SELECT * FROM post_subcategories WHERE id=%s", (sid,))
                return cur.fetchone()

    def update_subcategory(self, subcategory_id: str, fields: dict) -> Optional[dict]:
        allowed = {"name", "icon", "icon_media_id", "sort_order", "description"}
        if "name" in fields and fields["name"]:
            sub = self.find_subcategory(subcategory_id)
            if not sub:
                return None
            fields["slug"] = self.unique_slug(
                fields["name"], "post_subcategories", subcategory_id
            )
        sets = [f"{k}=%s" for k in fields if k in allowed]
        if not sets:
            return self.find_subcategory(subcategory_id)
        params = [v for k, v in fields.items() if k in allowed] + [subcategory_id]
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE post_subcategories SET {', '.join(sets)} WHERE id=%s", tuple(params)
                )
        return self.find_subcategory(subcategory_id)

    def delete_subcategory(self, subcategory_id: str) -> bool:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM post_subcategories WHERE id=%s", (subcategory_id,))
                return cur.rowcount > 0

    def subcategory_post_count(self, subcategory_id: str) -> int:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT COUNT(*) AS n FROM post_subcategory_map m
                       JOIN posts p ON p.id = m.post_id AND p.status='active'
                       WHERE m.subcategory_id=%s""",
                    (subcategory_id,),
                )
                return int(cur.fetchone()["n"])


class PostRepository:
    def create(self, author_id: str, title: str, content: str, category_id: str,
               subcategory_id: Optional[str], post_type: str, tags: Optional[list[str]],
               kind: str = "thread", price: Optional[float] = None,
               file_media_id: Optional[str] = None,
               attachment_media_id: Optional[str] = None,
               image_media_ids: Optional[list[str]] = None,
               subcategory_ids: Optional[list[str]] = None) -> dict:
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
                       (id, title, slug, content, category_id, subcategory_id, author_id,
                        kind, post_type, price, file_media_id, attachment_media_id,
                        image_media_ids, tags)
                       VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                    (pid, title, slug, content, category_id, subcategory_id, author_id,
                     kind, post_type, price, file_media_id, attachment_media_id,
                     json.dumps(image_media_ids) if image_media_ids else None,
                     json.dumps(tags) if tags else None),
                )
                for sid in subcategory_ids or []:
                    cur.execute(
                        "INSERT IGNORE INTO post_subcategory_map (post_id, subcategory_id) VALUES (%s,%s)",
                        (pid, sid),
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

    def subcategory_ids_for(self, post_id: str) -> list[str]:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT subcategory_id FROM post_subcategory_map WHERE post_id=%s",
                    (post_id,),
                )
                return [r["subcategory_id"] for r in cur.fetchall()]

    def list_latest(self, limit: int, offset: int, category_id: Optional[str] = None,
                    subcategory_id: Optional[str] = None, kind: Optional[str] = None,
                    exclude_hidden: bool = True) -> list[dict]:
        joins = ""
        where = ["p.status='active'"]
        params: list = []
        if exclude_hidden:
            where.append("NOT c.is_hidden")
        if category_id:
            where.append("p.category_id=%s")
            params.append(category_id)
        if kind:
            where.append("p.kind=%s")
            params.append(kind)
        if subcategory_id:
            joins += "JOIN post_subcategory_map m ON m.post_id = p.id AND m.subcategory_id=%s "
            params.insert(0, subcategory_id)
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"""SELECT p.* FROM posts p
                        JOIN post_categories c ON c.id = p.category_id
                        {joins}WHERE {' AND '.join(where)}
                        ORDER BY p.is_pinned DESC, p.created_at DESC LIMIT %s OFFSET %s""",
                    (*params, limit, offset),
                )
                return list(cur.fetchall())

    def list_similar(self, post_id: str, category_id: str, limit: int) -> list[dict]:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT p.* FROM posts p
                       JOIN post_categories c ON c.id = p.category_id
                       WHERE p.status='active' AND NOT c.is_hidden
                         AND p.category_id=%s AND p.id != %s
                       ORDER BY p.created_at DESC LIMIT %s""",
                    (category_id, post_id, limit),
                )
                return list(cur.fetchall())

    def list_by_author(self, author_id: str, limit: int, offset: int = 0) -> list[dict]:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT p.* FROM posts p
                       JOIN post_categories c ON c.id = p.category_id
                       WHERE p.status='active' AND NOT c.is_hidden AND p.author_id=%s
                       ORDER BY p.created_at DESC LIMIT %s OFFSET %s""",
                    (author_id, limit, offset),
                )
                return list(cur.fetchall())

    def create_report(self, post_id: str, reporter_id: Optional[str], reason: str) -> None:
        rid = new_id()
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO post_reports (id, post_id, reporter_id, reason) VALUES (%s,%s,%s,%s)",
                    (rid, post_id, reporter_id, reason),
                )

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

    # ── Tool purchases ───────────────────────────────────────────────────────
    def has_purchase(self, post_id: str, user_id: str) -> bool:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT 1 FROM tool_purchases WHERE post_id=%s AND user_id=%s",
                    (post_id, user_id),
                )
                return cur.fetchone() is not None

    def record_purchase(self, post_id: str, user_id: str, amount: Optional[float]) -> None:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT IGNORE INTO tool_purchases (post_id, user_id, amount) VALUES (%s,%s,%s)",
                    (post_id, user_id, amount),
                )


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
