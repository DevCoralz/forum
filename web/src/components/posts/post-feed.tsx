import { useState } from "react";
import { Crown, Eye, Heart, LockKeyhole, MessageCircle, MoreVertical, Pin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthorIdentity } from "@/components/profiles/author-identity";
import { useAuth } from "@/hooks/use-auth";
import type { PostSummary } from "@/types/community";

type FeedFilter = "all" | "free" | "premium";

/** Premium content is readable by premium members, admins and super admins. */
function useHasPremiumAccess(): boolean {
  const { user } = useAuth();
  return Boolean(user && user.role !== "free");
}

export function PremiumBlockade({ className = "" }: { className?: string }) {
  return (
    <div className={`premium-blockade ${className}`}>
      <LockKeyhole />
      <span>Upgrade To Premium to view Premium Posts</span>
      <Button asChild variant="coralz" size="sm">
        <a href="/settings">
          <Crown /> Upgrade
        </a>
      </Button>
    </div>
  );
}

export function PostRow({ post }: { post: PostSummary }) {
  const hasPremium = useHasPremiumAccess();
  const premiumBlocked = post.access === "premium" && !hasPremium;

  return (
    <article className="post-row">
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <AuthorIdentity author={post.author} />
        <div className="flex shrink-0 items-center gap-2 text-[.69rem] text-muted-foreground">
          {post.isPinned && <Pin className="size-3 text-cyan" />}
          <time>{post.publishedAt}</time>
          <Button variant="ghost" size="iconSm" aria-label={`More options for ${post.title}`}><MoreVertical /></Button>
        </div>
      </div>
      <div className="mt-2 pl-0 sm:pl-12">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {/* Title is the only thing lists ever show. Plain anchor on purpose: tapping it
              does a real browser navigation so the detail page loads fresh. */}
          <h3 className="min-w-0 text-sm font-semibold text-foreground sm:text-[.94rem]">
            <a className="post-title-link" href={`/post/${post.id}`}>{post.title}</a>
          </h3>
          {post.access === "premium" && <span className="premium-badge"><LockKeyhole /> Premium</span>}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <span className="category-tag">{post.category}{post.subcategory ? ` · ${post.subcategory}` : ""}</span>
          <div className="flex items-center gap-4 text-[.7rem] text-muted-foreground">
            <span><Eye />{post.views}</span><span><MessageCircle />{post.comments}</span><span><Heart />{post.likes}</span>
          </div>
        </div>
        {premiumBlocked && <PremiumBlockade />}
      </div>
    </article>
  );
}

export function PostFeed({ posts, isLoading = false }: { posts: PostSummary[]; isLoading?: boolean }) {
  const [filter, setFilter] = useState<FeedFilter>("all");
  const hasPremium = useHasPremiumAccess();
  const visible = filter === "all" ? posts : posts.filter((post) => post.access === filter);
  const showPremiumWall = !hasPremium && (filter === "premium" || visible.some((p) => p.access === "premium"));

  return (
    <section id="latest" className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
      <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <h2 className="section-title">Latest Posts</h2>
        <div className="feed-tabs" aria-label="Filter posts">
          {(["all", "free", "premium"] as FeedFilter[]).map((value) => (
            <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>
              {value === "all" ? "All" : value === "free" ? "Free" : "Premium"}
            </button>
          ))}
        </div>
      </div>
      {showPremiumWall && <PremiumBlockade className="mb-4" />}
      {isLoading ? (
        <div className="post-stream">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="post-row animate-pulse space-y-3">
              <div className="flex items-center gap-2"><span className="avatar bg-surface" /><span className="h-3 w-24 rounded bg-surface" /></div>
              <div className="h-3.5 w-3/4 rounded bg-surface" />
              <div className="h-3 w-full rounded bg-surface/70" />
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <p className="border-y border-border py-10 text-center text-sm text-muted-foreground">
          No posts here yet{filter !== "all" ? ` in the ${filter} tab` : ""} — be the first to{" "}
          <a className="text-primary" href="/write">write one</a>.
        </p>
      ) : (
        <div className="post-stream">{visible.map((post) => <PostRow key={post.id} post={post} />)}</div>
      )}
    </section>
  );
}
