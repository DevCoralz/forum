import { createFileRoute } from "@tanstack/react-router";
import { AuthForm } from "@/components/auth/auth-form";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in — CORALZ" },
      { name: "description", content: "Log in to CORALZ to view and download community content." },
      { property: "og:title", content: "Log in — CORALZ" },
      { property: "og:description", content: "Log in to CORALZ to view and download community content." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AuthForm mode="login" />,
});
