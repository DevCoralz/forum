import { createServerFn } from "@tanstack/react-start";
import { getRequestUrl, getRequestHeader } from "@tanstack/react-start/server";

export interface SiteMeta {
  name: string | null;
  description: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  image: string | null;
}

// Fresh window: serve straight from memory, no network.
const TTL = 5 * 60_000;
// After the fresh window a stale value is still preferred over a live fetch
// when the backend is unhealthy.
const STALE_OK = 30 * 60_000;
// When a fetch fails, don't try again for this long. Without it every render
// during an outage launched its own request at a backend that was already
// struggling (a retry storm: 4 concurrent renders = 4 upstream calls, again
// and again), which is what kept it struggling.
const FAILURE_BACKOFF = 15_000;
// How long a page render is willing to wait for the backend. SSR must never be
// held hostage by it: the client fetches the full settings itself right after
// hydration (SiteProvider), so the server only needs a best-effort head start.
const RENDER_WAIT = 2_500;
// Upper bound for the background fetch itself.
const FETCH_TIMEOUT = 8_000;

interface Entry {
  at: number;
  origin: string;
  value: SiteMeta;
}

let cache: Entry | null = null;
let inFlight: Promise<void> | null = null;
let lastFailureAt = 0;

/**
 * Starts (at most) one background refresh. Never rejects, never returns a
 * value: callers read `cache` afterwards. Sharing this single promise is what
 * actually de-duplicates concurrent renders — including when it fails.
 */
function refresh(api: string, origin: string): Promise<void> {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const res = await fetch(`${api}/api/v1/site`, {
        headers: { Origin: origin, Accept: "application/json" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT),
      });
      if (!res.ok) {
        lastFailureAt = Date.now();
        return;
      }
      const body = (await res.json()) as { settings?: Record<string, unknown> };
      const s = body.settings ?? {};
      const str = (k: string) =>
        typeof s[k] === "string" && (s[k] as string).trim() ? (s[k] as string) : null;
      const rel = str("site_og_url") ?? str("site_logo_url") ?? str("site_favicon_url");
      cache = {
        at: Date.now(),
        origin,
        value: {
          name: str("site_name"),
          description: str("site_description"),
          ogTitle: str("og_title"),
          ogDescription: str("og_description"),
          image: rel
            ? /^https?:\/\//i.test(rel)
              ? rel
              : `${api}${rel.startsWith("/") ? rel : `/${rel}`}`
            : null,
        },
      };
      lastFailureAt = 0;
    } catch {
      lastFailureAt = Date.now();
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

/** The cached value for this origin, but only if it is still within STALE_OK. */
function usable(origin: string): SiteMeta | null {
  return cache && cache.origin === origin && Date.now() - cache.at < STALE_OK
    ? cache.value
    : null;
}

/** Resolves when `p` settles or after `ms`, whichever comes first. Never rejects. */
function waitAtMost(p: Promise<void>, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    p.then(
      () => {
        clearTimeout(timer);
        resolve();
      },
      () => {
        clearTimeout(timer);
        resolve();
      },
    );
  });
}

/**
 * Server-rendered site name/image so browsers and social crawlers (which never
 * run JavaScript) see the admin-chosen image instead of the default icon.
 *
 * Never throws and never blocks a render for long: on any failure the page
 * renders with defaults (or a stale cached value).
 */
export const getSiteMeta = createServerFn({ method: "GET" }).handler(
  async (): Promise<SiteMeta | null> => {
    try {
      const api = (process.env["VITE_API_URL"] ?? import.meta.env["VITE_API_URL"] ?? "")
        .trim()
        .replace(/\/$/, "");
      if (!api) return null;

      let origin = "";
      try {
        origin = new URL(getRequestUrl()).origin;
      } catch {
        origin = getRequestHeader("origin") ?? "";
      }

      const now = Date.now();
      const entry = cache && cache.origin === origin ? cache : null;

      // Fresh: no network at all.
      if (entry && now - entry.at < TTL) return entry.value;

      // Backend recently failed: don't add load, use whatever we have.
      const backingOff = lastFailureAt > 0 && now - lastFailureAt < FAILURE_BACKOFF;
      if (backingOff) {
        return entry && now - entry.at < STALE_OK ? entry.value : null;
      }

      const flight = refresh(api, origin);

      // Stale but usable: answer immediately and refresh in the background, so
      // no visitor ever waits on the backend once we have seen it once.
      if (entry && now - entry.at < STALE_OK) return entry.value;

      // Cold start (or an entry too old to trust): wait a short, bounded time
      // for a fresh value.
      await waitAtMost(flight, RENDER_WAIT);
      return usable(origin);
    } catch {
      return null;
    }
  },
);
