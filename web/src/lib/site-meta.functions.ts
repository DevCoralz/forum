import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestUrl } from "@tanstack/react-start/server";

export interface SiteMeta {
  name: string | null;
  description: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  image: string | null;
}

let cache: { at: number; origin: string; value: SiteMeta } | null = null;
const TTL = 30_000;

/**
 * Server-rendered site name/image so browsers and social crawlers (which never
 * run JavaScript) see the admin-chosen image instead of the default icon.
 * Never throws: on any failure the page renders with defaults.
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

  const signal = AbortSignal.timeout(2500);
  try {
    const hs = await fetch(`${api}/api/v1/client/handshake`, { method: "POST", headers: { Origin: origin }, signal });
    const token = hs.ok ? ((await hs.json()) as { token?: string }).token : undefined;
    const res = await fetch(`${api}/api/v1/site`, {
      headers: { Origin: origin, Accept: "application/json", ...(token ? { "X-Client-Token": token } : {}) },
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
});
