import { createFileRoute, notFound } from "@tanstack/react-router";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/navigation/site-header";
import { PostDetailPage } from "@/components/posts/post-detail-page";
import { postsService } from "@/services/posts";
import { ApiError } from "@/services/api";
import type { PostDetail } from "@/types/community";

async function loadThread(threadId: string): Promise<PostDetail> {
  try {
    return await postsService.getPost(threadId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) throw notFound();
    throw error;
  }
}

export const Route = createFileRoute("/thread/$threadId")({
  loader: ({ params }) => loadThread(params.threadId),
  pendingComponent: LoadingSpinner,
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Thread not found — I2P Forum" }, { name: "robots", content: "noindex" }] };
    const { title } = loaderData;
    const excerpt = `${title} — a ${loaderData.category} thread on I2P Forum.`;
    return {
      meta: [
        { title: `${title} — I2P Forum` },
        { name: "description", content: excerpt },
        { property: "og:title", content: `${title} — I2P Forum` },
        { property: "og:description", content: excerpt },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  notFoundComponent: ThreadNotFound,
  component: ThreadRoute,
});

function ThreadNotFound() {
  return <div className="min-h-screen bg-background"><SiteHeader /><p className="p-10 text-center text-muted-foreground">Thread not found</p></div>;
}

function ThreadRoute() {
  const post = Route.useLoaderData();
  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <SiteHeader />
      <main><PostDetailPage key={post.id} post={post} /></main>
      <SiteFooter />
    </div>
  );
}
