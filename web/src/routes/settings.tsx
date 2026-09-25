import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/components/settings/settings-page";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Account Settings — I2P Forum" },
      { name: "description", content: "Manage your I2P Forum profile, security, privacy, and access." },
      { property: "og:title", content: "Account Settings — I2P Forum" },
      { property: "og:description", content: "Manage your I2P Forum account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});