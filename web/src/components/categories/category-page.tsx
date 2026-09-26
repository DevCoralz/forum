import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { ArrowLeft, Clock, Lock, Wrench } from "lucide-react";
import { AdCarousel } from "@/components/common/ad-carousel";
import { SubcategoryPills } from "@/components/categories/subcategory-pills";
import { useSite } from "@/hooks/use-site";
import { postsService } from "@/services/posts";
import { type Category, type PostSummary, type Subcategory } from "@/services/mappers";
import type { AdSlide } from "@/types/admin";

/** One tool row inside its subcategory: square icon, name, date + time. */
function ToolRow({ post, sub }: { post: PostSummary; sub?: Subcategory | undefined }) {
  return (
    <Link to="/tool/$toolId" params={{ toolId: post.id }} className="tool-row">
      <span className="tool-row-icon">
        {sub?.iconUrl ? (
          <img src={sub.iconUrl} alt="" loading="lazy" />
        ) : (
          <Wrench size={16} aria-hidden />
        )}
      </span>
      <span className="tool-row-main">
        <span className="tool-row-title">{post.title}</span>
        <span className="tool-row-meta">
          <Clock size={11} aria-hidden />
          {post.publishedAt}
        </span>
      </span>
      <span className="tool-row-price">
        {post.access === "premium" && <Lock size={11} aria-hidden />}
        {post.price !== undefined && post.price > 0 ? post.price : "Free"}
      </span>
    </Link>
  );
}

export function CategoryPage() {
  const { categoryId } = useParams({ from: "/category/$categoryId" });
  const { sub: selectedSub } = useSearch({ from: "/category/$categoryId" });
  const navigate = useNavigate();
  const { ads } = useSite();
  const [category, setCategory] = useState<Category | null>(null);
  const [subs, setSubs] = useState<Subcategory[]>([]);
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const cats = await postsService.listCategories();
        const cat = cats.find((c) => c.id === categoryId || c.slug === categoryId) ?? null;
        if (cancelled) return;
        setCategory(cat);
        if (!cat) {
          setSubs([]);
          setPosts([]);
          return;
        }
        const [subList, postList] = await Promise.all([
          postsService.listSubcategories(cat.id),
          postsService.listByCategory(cat.id),
        ]);
        if (cancelled) return;
        setSubs(subList);
        setPosts(postList);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [categoryId]);

  const activeSub = useMemo(
    () => subs.find((s) => s.id === selectedSub) ?? null,
    [subs, selectedSub],
  );

  const visiblePosts = useMemo(() => {
    const filtered = activeSub
      ? posts.filter((p) => p.subcategoryId === activeSub.id)
      : posts.filter((p) => p.kind === "tool");
    return [...filtered].sort((a, b) => (b.publishedAtIso ?? "").localeCompare(a.publishedAtIso ?? ""));
  }, [posts, activeSub]);

  return (
    <div className="page category-page">
      <div className="category-page-head">
        <button
          type="button"
          className="ghost-back"
          onClick={() => navigate({ to: "/" })}
          aria-label="Back home"
        >
          <ArrowLeft size={15} aria-hidden />
        </button>
        <div>
          <h1 className="category-page-title">
            {activeSub ? activeSub.name : category?.name ?? "Category"}
          </h1>
          <p className="category-page-sub">
            {activeSub
              ? `Tools in ${category?.name ?? "this category"} · ${activeSub.name}`
              : category
                ? `${subs.length} subcategories`
                : ""}
          </p>
        </div>
      </div>

      <AdCarousel ads={ads} />

      {!loading && category && (
        <SubcategoryPills subcategories={subs} categoryId={category.id} />
      )}

      <section className="post-list" aria-label="Posts">
        {activeSub && (
          <div className="post-list-head">
            <button
              type="button"
              className="linkish"
              onClick={() =>
                navigate({ to: "/category/$categoryId", params: { categoryId } })
              }
            >
              ← All subcategories
            </button>
          </div>
        )}
        {loading && <p className="muted-note">Loading…</p>}
        {!loading && visiblePosts.length === 0 && (
          <p className="muted-note">No posts here yet.</p>
        )}
        {visiblePosts.map((post) => (
          <ToolRow
            key={post.id}
            post={post}
            sub={subs.find((s) => s.id === post.subcategoryId)}
          />
        ))}
      </section>
    </div>
  );
}
