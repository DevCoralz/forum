import { createFileRoute } from "@tanstack/react-router";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/navigation/site-header";
import { MessagesPage } from "@/components/messages/messages-page";

export const Route = createFileRoute("/messages")({
  head: () => ({
    meta: [
      { title: "Messages — I2P Forum" },
      { name: "description", content: "I2P Forum messages and public chat." },
      { property: "og:title", content: "Messages — I2P Forum" },
      { property: "og:description", content: "I2P Forum messages and public chat." },
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
