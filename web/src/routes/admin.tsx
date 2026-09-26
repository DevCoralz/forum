import { createFileRoute } from "@tanstack/react-router";
import { AdminCenter } from "@/components/admin/admin-center";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Management Center — I2P Forum" },
      { name: "robots", content: "noindex" },
{ property: "og:type", content: "website" },
    ],
  }),
  component: AdminCenter,
});
