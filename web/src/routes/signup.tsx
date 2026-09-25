import { createFileRoute } from "@tanstack/react-router";
import { AuthForm } from "@/components/auth/auth-form";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Sign up — I2P Forum" },
      { name: "description", content: "Create an I2P Forum account." },
      { property: "og:title", content: "Sign up — I2P Forum" },
      { property: "og:description", content: "Create an I2P Forum account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AuthForm mode="signup" />,
});
