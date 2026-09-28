// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: {
      entry: "server",
      // The shared config defaults nitro to the `cloudflare-module` preset, which
      // emits a Workers-style `{ fetch(request, env, ctx) }` export with no HTTP
      // listener — that's why `node .output/server/index.mjs` exited immediately
      // on Render instead of staying up. This pins Nitro to its Node preset so the
      // Render (or any plain Node) host gets a real http.createServer listener.
      // Remove this if this service ever moves to Cloudflare Workers/Pages.
      //
      // If this key isn't forwarded by @lovable.dev/vite-tanstack-config's schema
      // (unverifiable offline against the installed version), set NITRO_PRESET=node-server
      // as a build-time env var on Render instead — Nitro reads that directly and
      // it overrides any preset set here or by the wrapper.
      preset: "node-server",
    },
  },
});
