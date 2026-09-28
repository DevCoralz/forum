import { createServerFn } from "@tanstack/react-start";
import { getRequestUrl, getRequestHeader } from "@tanstack/react-start/server";

export interface SiteMeta {
  name: string | null;
  description: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  image: string | null;
}

let cache: { at: number; origin: string; value: SiteMeta } | null = null;
// Stretched from 30s: every SSR page render was hitting /site on
// the origin server, and a single slow backend response (Termux under load)
// aborted the fetch and showed up as an origin-side "context canceled" on the
// proxy. Longer TTL means far fewer of these round trips in the first place.
const TTL = 5 * 60_000;
const STALE_OK = 30 * 60_000; // serve a stale cached value rather than refetch while one is already in flight

let inFlight: Promise<SiteMeta | null> | null = null;

/**
 * Server-rendered site name/image so browsers and social crawlers (which never
 * run JavaScript) see the admin-chosen image instead of the default icon.
 * Never throws: on any failure the page renders with defaults (or a stale
 * cached value, which is always preferred over hammering a slow backend).
 */
export const getSiteMeta = createServerFn({ method: "GET" }).handler(async (): Promise<SiteMeta | null> => {
  const api = (process.env["VITE_API_URL"] ?? import.meta.env["VITE_API_URL"] ?? "").trim().replace(/\/$/, "");
  if (!api) return null;
  let origin = "";
  try {
    origin = new URL(getRequestUrl()).origin;
  } catch {
    origin = getRequestHeader("origin") ?? "";
  }
  if (cache && cache.origin === origin && Date.now() - cache.at < TTL) return cache.value;
  // A stale-but-not-ancient cache beats a concurrent burst of fresh fetches:
  // if many requests land while nothing is in flight, only the first one
  // below actually calls out — the rest wait on the same promise.
  if (inFlight) {
    const result = await inFlight.catch(() => null);
    if (result) return result;
  }
  if (cache && cache.origin === origin && Date.now() - cache.at < STALE_OK) return cache.value;

  inFlight = (async (): Promise<SiteMeta | null> => {
    // 2.5s was too tight for a backend that can be slow to wake up or briefly
    // busy — that's what was aborting mid-request and showing up as an origin
    // "context canceled" on every timeout. 8s gives it real room without
    // blocking the page render forever.
    const signal = AbortSignal.timeout(8000);
    try {
      const res = await fetch(`${api}/api/v1/site`, {
        headers: { Origin: origin, Accept: "application/json" },
        signal,
      });
      if (!res.ok) return cache?.value ?? null;
      const body = (await res.json()) as { settings?: Record<string, unknown> };
      const s = body.settings ?? {};
      const str = (k: string) => (typeof s[k] === "string" && (s[k] as string).trim() ? (s[k] as string) : null);
      const rel = str("site_og_url") ?? str("site_logo_url") ?? str("site_favicon_url");
      const value: SiteMeta = {
        name: str("site_name"),
        description: str("site_description"),
        ogTitle: str("og_title"),
        ogDescription: str("og_description"),
        image: rel ? (/^https?:\/\//i.test(rel) ? rel : `${api}${rel.startsWith("/") ? rel : `/${rel}`}`) : null,
      };
      cache = { at: Date.now(), origin, value };
      return value;
    } catch {
      return cache?.value ?? null;
    }
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
});
