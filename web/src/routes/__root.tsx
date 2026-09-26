import { Toaster } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { API_URL } from "@/services/api";

const API_ORIGIN = (() => { try { return API_URL ? new URL(API_URL).origin : ""; } catch { return ""; } })();
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "@/hooks/use-auth";
import { SiteProvider } from "@/hooks/use-site";
import { NotFoundPage } from "@/components/common/not-found-page";
import { getSiteMeta } from "@/lib/site-meta.functions";

function NotFoundComponent() {
  return <NotFoundPage />;
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  loader: async () => {
    try {
      return { meta: await getSiteMeta() };
    } catch {
      return { meta: null };
    }
  },
  staleTime: 60_000,
  head: ({ loaderData }) => {
    const m = loaderData?.meta ?? null;
    const name = m?.name ?? "I2P Forum";
    const description = m?.description ?? "I2P Forum discussions, posts, and member profiles.";
    const meta: Array<Record<string, string>> = [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: name },
      { name: "description", content: description },
      { name: "author", content: name },
      { property: "og:site_name", content: name },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      // Browser-level guard: scripts may only talk to this site and the forum API.
      {
        httpEquiv: "Content-Security-Policy",
        content: `connect-src 'self' ${API_ORIGIN} ${API_ORIGIN.startsWith("https") ? `wss://${API_ORIGIN.slice(8)}` : ""}`.trim(),
      },
    ];
    if (m?.image) {
      meta.push({ property: "og:image", content: m.image }, { name: "twitter:image", content: m.image });
    }
    return {
      meta,
      links: [
        { rel: "stylesheet", href: appCss },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
        { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Libre+Baskerville:wght@400;700&display=swap" },
        ...(API_ORIGIN ? [{ rel: "preconnect", href: API_ORIGIN, crossOrigin: "use-credentials" as const }] : []),
        m?.image
          ? { rel: "icon", href: m.image }
          : { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
        ...(m?.image ? [{ rel: "apple-touch-icon", href: m.image }] : []),
      ],
    };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SiteProvider>
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <Outlet />
          <Toaster />
        </SiteProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
