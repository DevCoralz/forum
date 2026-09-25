import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, Heart, LockKeyhole, MessageCircle, Send, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { FormattedText } from "@/lib/telegram-format";
import { Button } from "@/components/ui/button";
import { AuthorIdentity } from "@/components/profiles/author-identity";
import { PostRow } from "@/components/posts/post-feed";
import { postsService } from "@/services/posts";
import { ApiError } from "@/services/api";
import { useAuth } from "@/hooks/use-auth";
import type { PostComment, PostDetail, PostSummary } from "@/types/community";

export function PostDetailPage({ post: initialPost }: { post: PostDetail }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  // The server decides what this viewer may read. The first render may come from a
  // signed-out server render, so always re-fetch in the browser with the session.
  const postQuery = useQuery({
    queryKey: ["post", initialPost.id, user?.id ?? "guest"],
    queryFn: () => postsService.getPost(initialPost.id),
    initialData: initialPost,
    initialDataUpdatedAt: 0,
  });
  const post = postQuery.data;
  const [likedOverride, setLiked] = useState<boolean | null>(null);
  const liked = likedOverride ?? post.likedByViewer;

  const isLockedPost = post.access === "premium";
  const unlocked = !post.lockReason && post.body !== undefined;
  const refreshPost = () => {
    setLiked(null);
    void queryClient.invalidateQueries({ queryKey: ["post", post.id] });
  };

  const commentsQuery = useQuery({
    queryKey: ["comments", post.id],
    queryFn: () => postsService.listComments(post.id),
  });
  const similarQuery = useQuery({
    queryKey: ["similar", post.id],
    queryFn: () => postsService.listSimilar(post.id),
    staleTime: 60_000,
  });

  const likeMutation = useMutation({
    mutationFn: () => postsService.toggleLike(post.id),
    onSuccess: (result) => {
      setLiked(result.liked);
      void queryClient.invalidateQueries({ queryKey: ["posts"] });
      if (!unlocked) refreshPost();
    },
    onError: (error) => toast.error(error instanceof ApiError && error.status === 401 ? "Log in to like posts." : "Couldn't save your like. Try again."),
  });

  const commentMutation = useMutation({
    mutationFn: (body: string) => postsService.addComment(post.id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["comments", post.id] });
      void queryClient.invalidateQueries({ queryKey: ["posts"] });
      if (!unlocked) refreshPost();
    },
    onError: (error) => toast.error(error instanceof ApiError && error.status === 401 ? "Log in to comment." : "Couldn't post your comment. Try again."),
  });

  const comments: PostComment[] = commentsQuery.data ?? [];
  const similar: PostSummary[] = similarQuery.data ?? [];
  const [draft, setDraft] = useState("");
  const [expanded, setExpanded] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    commentMutation.mutate(body);
  }

  const likeCount = Number(post.likes) + (liked && !post.likedByViewer ? 1 : 0) - (!liked && post.likedByViewer ? 1 : 0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <article>
        <div className="flex items-center justify-between gap-3">
          <AuthorIdentity author={post.author} />
          <time className="text-[.7rem] text-muted-foreground">{post.publishedAt}</time>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="category-tag">{post.category}{post.subcategory ? ` · ${post.subcategory}` : ""}</span>
          {isLockedPost && <span className="premium-badge"><LockKeyhole /> Premium</span>}
        </div>
        <h1 className="mt-3 font-display text-xl font-semibold leading-snug text-foreground sm:text-2xl">{post.title}</h1>

        <div className="post-body">
          {unlocked ? (
            <FormattedText text={post.body ?? ""} className="text-sm leading-7 text-foreground/90" />
          ) : (
            <div className="post-lock">
              <LockKeyhole className="size-6 text-primary" />
              <strong>This post is locked</strong>
              {post.lockReason === "premium" ? (
                <>
                  <p>This is a premium post. Premium members can open it right away.</p>
                  <Button asChild variant="coralz" size="sm"><a href="/settings"><Crown /> Go Premium</a></Button>
                </>
              ) : post.lockReason === "interact" ? (
                <>
                  <p>Like and comment to unlock this post.</p>
                  <ul className="flex gap-4 text-xs text-muted-foreground">
                    <li className={liked ? "text-primary" : ""}><Heart className="mr-1 inline size-3.5" />{liked ? "Liked" : "Like it"}</li>
                    <li className={post.commentedByViewer ? "text-primary" : ""}><MessageCircle className="mr-1 inline size-3.5" />{post.commentedByViewer ? "Commented" : "Leave a comment"}</li>
                  </ul>
                  <p className="text-xs text-muted-foreground">Premium members skip this step.</p>
                </>
              ) : (
                <>
                  <p>Log in to read this post.</p>
                  <Button asChild variant="coralz" size="sm"><a href="/login">Log in</a></Button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-5 border-y border-border py-3 text-xs text-muted-foreground">
          <button
            onClick={() => likeMutation.mutate()}
            disabled={likeMutation.isPending}
            className="like-btn"
            data-liked={liked}
            aria-pressed={liked}
          >
            <Heart /> {liked ? "Liked" : "Like"} · {likeCount}
          </button>
          <span className="inline-flex items-center gap-1.5"><MessageCircle className="size-4" />{comments.length}</span>
          <span className="inline-flex items-center gap-1.5"><Eye className="size-4" />{post.views}</span>
        </div>
      </article>

      <section className="mt-8">
        <h2 className="section-title mb-4">Comments</h2>
        <ul className="divide-y divide-border">
          {commentsQuery.isLoading && (
            <li className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading comments…</li>
          )}
          {comments.map((c) => (
            <li key={c.id} className="py-4">
              <div className="flex items-center justify-between gap-3">
                <AuthorIdentity author={c.author} />
                <time className="text-[.68rem] text-muted-foreground">{c.createdAt}</time>
              </div>
              <p className="mt-2 pl-12 text-sm leading-6 text-foreground/85">{c.body}</p>
            </li>
          ))}
          {!commentsQuery.isLoading && comments.length === 0 && (
            <li className="py-4 text-sm text-muted-foreground">No comments yet.</li>
          )}
        </ul>
        <form onSubmit={submit} className="comment-box">
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} maxLength={2000} placeholder={user ? "Write a comment…" : "Log in to comment…"} aria-label="Write a comment" />
          <div className="flex justify-end"><Button type="submit" size="sm" disabled={!draft.trim() || commentMutation.isPending}><Send /> Comment</Button></div>
        </form>
      </section>

      <section className="mt-12">
        <h2 className="section-title mb-4">Similar posts</h2>
        {similar.length === 0 ? (
          <p className="border-y border-border py-8 text-center text-sm text-muted-foreground">No similar posts yet.</p>
        ) : (
          <>
            <div className={`post-stream similar-list ${expanded ? "is-expanded" : ""}`}>
              {(expanded ? similar : similar.slice(0, 5)).map((p) => <PostRow key={p.id} post={p} />)}
            </div>
            {!expanded && similar.length > 5 && (
              <div className="mt-4 flex justify-center"><Button variant="outline" size="sm" onClick={() => setExpanded(true)}>See more</Button></div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
