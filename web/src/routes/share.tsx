import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/navigation/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Lock } from "lucide-react";

export const Route = createFileRoute("/share")({
  head: () => ({
    meta: [
      { title: "Submit a Tool — Coralz" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ShareRoute,
});

function ShareRoute() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <SiteHeader />
      <main className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="mx-auto max-w-sm rounded-2xl border border-border/60 bg-card p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-primary/10">
            <Lock className="size-6 text-primary" />
          </div>
          <h1 className="mb-2 font-semibold text-foreground text-xl">Submissions are Staff-Only</h1>
          <p className="text-sm text-muted-foreground leading-6">
            Only admins can publish tools on Coralz. If you have a tool you'd like to submit, reach out to us through Telegram or WhatsApp and we'll review it.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Link to="/" className="hz-pill-btn hz-pill-primary justify-center">Back to Home</Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
