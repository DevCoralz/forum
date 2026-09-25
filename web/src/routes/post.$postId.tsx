import { createFileRoute, notFound } from "@tanstack/react-router";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/navigation/site-header";
import { PostDetailPage } from "@/components/posts/post-detail-page";
import { postsService } from "@/services/posts";
import { ApiError } from "@/services/api";
import type { PostDetail } from "@/types/community";

async function loadPost(postId: string): Promise<PostDetail> {
  try {
    return await postsService.getPost(postId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) throw notFound();
    throw error;
  }
}

export const Route = createFileRoute("/post/$postId")({
  loader: ({ params }) => loadPost(params.postId),
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Post not found — CORALZ" }, { name: "robots", content: "noindex" }] };
    const { title, excerpt } = loaderData;
    return {
      meta: [
        { title: `${title} — CORALZ` },
        { name: "description", content: excerpt },
        { property: "og:title", content: `${title} — CORALZ` },
        { property: "og:description", content: excerpt },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  notFoundComponent: PostNotFound,
  component: PostRoute,
});

function PostNotFound() {
  return <div className="min-h-screen bg-background"><SiteHeader /><p className="p-10 text-center text-muted-foreground">This post doesn’t exist.</p></div>;
}

function PostRoute() {
  const post = Route.useLoaderData();
  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <SiteHeader />
      <main><PostDetailPage key={post.id} post={post} /></main>
      <SiteFooter />
    </div>
  );
}
