import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

// Replaces @lovable.dev/vite-tanstack-config with the real, vanilla plugin
// stack it was wrapping. Same functional pipeline (TanStack Start + Nitro +
// Tailwind + tsconfig paths + React), minus the injected Lovable editor
// badge, its error-logger plugin, and sandbox detection that came bundled
// inside that wrapper package.
//
// Why this replacement happened: the wrapper's own tanstackStart.server.preset
// key (the previous version of this file) could not be confirmed to actually
// reach Nitro — no network access to inspect the wrapper's source against the
// installed 2.24.0 version, and a sibling project hit exactly this failure
// mode (a wrong-shaped preset key silently ignored, Nitro falling back to its
// `cloudflare-module` default, which then exits immediately under plain
// Node — see /mnt/skills conversation history). Calling nitro() directly, the
// documented way, removes that uncertainty entirely.
export default defineConfig({
  plugins: [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart({
      // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
      server: { entry: "server" },
    }),
    // Render needs a plain Node HTTP server, not Nitro's Cloudflare Workers
    // default target. `preset` is a top-level option on nitro().
    nitro({ preset: "node-server" }),
    viteReact(),
  ],
});
