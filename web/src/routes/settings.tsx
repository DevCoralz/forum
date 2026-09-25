import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/components/settings/settings-page";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Account Settings — CORALZ" },
      { name: "description", content: "Manage your CORALZ profile, account security, privacy, and premium access." },
      { property: "og:title", content: "Account Settings — CORALZ" },
      { property: "og:description", content: "Manage your CORALZ profile and account preferences." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});