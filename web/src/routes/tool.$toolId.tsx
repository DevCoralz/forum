import { createFileRoute } from "@tanstack/react-router";
import { ToolDetailPage } from "@/components/tools/tool-detail-page";

export const Route = createFileRoute("/tool/$toolId")({
  head: ({ params }) => ({
    meta: [
      { title: `Tool · ${params.toolId}` },
      { name: "description", content: "Tool details, price, file type and download." },
      { property: "og:title", content: `Tool · ${params.toolId}` },
      { property: "og:description", content: "Tool details, price, file type and download." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ToolDetailPage,
});
