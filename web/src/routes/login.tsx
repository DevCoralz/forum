import { createFileRoute } from "@tanstack/react-router";
import { AuthForm } from "@/components/auth/auth-form";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in — I2P Forum" },
      { name: "description", content: "Log in to I2P Forum." },
      { property: "og:title", content: "Log in — I2P Forum" },
      { property: "og:description", content: "Log in to I2P Forum." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AuthForm mode="login" />,
});
