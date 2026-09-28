import { createFileRoute } from "@tanstack/react-router";
import { AuthForm } from "@/components/auth/auth-form";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in — Coralz" },
      { name: "description", content: "Log in to Coralz." },
      { property: "og:title", content: "Log in — Coralz" },
      { property: "og:description", content: "Log in to Coralz." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AuthForm mode="login" />,
});
