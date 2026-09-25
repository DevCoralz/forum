import { useState } from "react";
import { Eye, Heart, LockKeyhole, MessageCircle, MoreVertical, Pin } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { AuthorIdentity } from "@/components/profiles/author-identity";
import type { PostSummary } from "@/types/community";

type FeedFilter = "all" | "free" | "premium";

export function PostRow({ post }: { post: PostSummary }) {
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
          <h3 className="min-w-0 text-sm font-semibold text-foreground hover:text-primary sm:text-[.94rem]">
            <Link to="/post/$postId" params={{ postId: post.id }}>{post.title}</Link>
          </h3>
          {post.access === "premium" && <span className="premium-badge"><LockKeyhole /> Premium</span>}
        </div>
        <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-muted-foreground sm:pr-40">{post.excerpt}</p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <span className="category-tag">{post.category}{post.subcategory ? ` · ${post.subcategory}` : ""}</span>
          <div className="flex items-center gap-4 text-[.7rem] text-muted-foreground">
            <span><Eye />{post.views}</span><span><MessageCircle />{post.comments}</span><span><Heart />{post.likes}</span>
          </div>
        </div>
 {post.access === "premium" && (
          <div className="locked-notice"><LockKeyhole /><span><strong>Premium content</strong> — <Link className="underline" to="/login">Log in</Link> to continue</span></div>
        )}
      </div>
    </article>
  );
}

export function PostFeed({ posts, isLoading = false }: { posts: PostSummary[]; isLoading?: boolean }) {
  const [filter, setFilter] = useState<FeedFilter>("all");
  const visible = filter === "all" ? posts : posts.filter((post) => post.access === filter);

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
          No posts here yet{filter !== "all" ? ` in the ${filter} tab` : ""} — be the first to <Link className="text-primary underline" to="/write">write one</Link>.
        </p>
      ) : (
        <div className="post-stream">{visible.map((post) => <PostRow key={post.id} post={post} />)}</div>
      )}
    </section>
  );
}
