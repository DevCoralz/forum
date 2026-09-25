import { createFileRoute } from "@tanstack/react-router";

/**
 * Same-origin proxy to the Coralz backend.
 *
 * The backend currently rejects browser origins it doesn't know (CORS preflight
 * returns 400 without access-control-allow-origin), so the app talks to its own
 * origin and this route forwards to the live API server-to-server, where CORS
 * does not apply. Once CORS_ORIGINS on the backend includes the preview and
 * production domains, VITE_API_URL can be pointed directly at the backend again.
 */
const API_ORIGIN = process.env["CORALZ_API_ORIGIN"] ?? "https://api-forum.coralz.de5.net";

const HOP_BY_HOP = new Set([
  "connection", "keep-alive", "transfer-encoding", "upgrade", "host",
  "origin", "referer", "cookie", "accept-encoding", "content-length",
]);

async function forward({ request, params }: { request: Request; params: { _splat: string } }): Promise<Response> {
  const url = new URL(request.url);
  const remainder = params._splat ?? "";
  const target = `${API_ORIGIN}/${remainder}${url.search}`;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) headers.set(key, value);
  });

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const body = hasBody ? await request.arrayBuffer() : null;

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body,
      redirect: "manual",
    });
  } catch {
    return Response.json({ detail: "Upstream API unreachable" }, { status: 502 });
  }

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "set-cookie" && key.toLowerCase() !== "content-encoding" && key.toLowerCase() !== "content-length") {
      responseHeaders.set(key, value);
    }
  });

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export const Route = createFileRoute("/api/proxy/$")({
  server: {
    handlers: {
      GET: forward,
      POST: forward,
      PATCH: forward,
      PUT: forward,
      DELETE: forward,
      OPTIONS: forward,
      HEAD: forward,
    },
  },
});
