import { createFileRoute } from "@tanstack/react-router";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/navigation/site-header";
import { WritePostPage } from "@/components/posts/write-post-page";

export const Route = createFileRoute("/write")({
  head: () => ({
    meta: [
      { title: "Share a tool — Coralz" },
      { name: "description", content: "Share a tool on Coralz." },
      { property: "og:title", content: "Share a tool — Coralz" },
      { property: "og:description", content: "Share a tool on Coralz." },
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
