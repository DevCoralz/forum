import { createFileRoute } from "@tanstack/react-router";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/navigation/site-header";
import { MessagesPage } from "@/components/messages/messages-page";

export const Route = createFileRoute("/messages")({
  head: () => ({
    meta: [
      { title: "Messages & live chat — CORALZ" },
      { name: "description", content: "Watch and join the CORALZ public chat stream, or find members to message." },
      { property: "og:title", content: "Messages & live chat — CORALZ" },
      { property: "og:description", content: "Watch and join the CORALZ public chat stream, or find members to message." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MessagesRoute,
});

function MessagesRoute() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <SiteHeader />
      <main><MessagesPage /></main>
      <SiteFooter />
    </div>
  );
}
