import { createFileRoute } from "@tanstack/react-router";
import { AuthForm } from "@/components/auth/auth-form";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Sign up — CORALZ" },
      { name: "description", content: "Create a CORALZ account with a username, email, and password." },
      { property: "og:title", content: "Sign up — CORALZ" },
      { property: "og:description", content: "Create a CORALZ account with a username, email, and password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AuthForm mode="signup" />,
});
