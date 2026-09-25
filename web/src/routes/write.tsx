import { createFileRoute } from "@tanstack/react-router";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/navigation/site-header";
import { WritePostPage } from "@/components/posts/write-post-page";

export const Route = createFileRoute("/write")({
  head: () => ({
    meta: [
      { title: "Write a post — CORALZ" },
      { name: "description", content: "Write a CORALZ community post with live formatted previews." },
      { property: "og:title", content: "Write a post — CORALZ" },
      { property: "og:description", content: "Write a CORALZ community post with live formatted previews." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WriteRoute,
});

function WriteRoute() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <SiteHeader />
      <main><WritePostPage /></main>
      <SiteFooter />
    </div>
  );
}
