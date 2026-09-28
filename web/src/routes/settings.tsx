import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/components/settings/settings-page";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Account Settings — Coralz" },
      { name: "description", content: "Manage your Coralz profile, security, privacy, and access." },
      { property: "og:title", content: "Account Settings — Coralz" },
      { property: "og:description", content: "Manage your Coralz account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});