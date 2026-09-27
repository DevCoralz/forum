/**
 * Client-side error reporting for the root error boundary. Logs to the
 * console in both dev and prod (so it shows up in any log aggregator reading
 * browser console output) — swap the body for a real telemetry call
 * (Sentry, PostHog, etc.) when one is wired up.
 */
export function reportRuntimeError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  // Loaders and server fns commonly throw a raw Response; String(it) gives the
  // opaque "[object Response]", so pull out the status and URL instead.
  const message =
    error instanceof Response
      ? `Response ${error.status}${error.url ? ` at ${error.url}` : ""}`
      : error instanceof Error
        ? error.message
        : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  console.error("[error-boundary]", message, {
    route: window.location.pathname,
    stack,
    ...context,
  });
}
