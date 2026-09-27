import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

// Replaces @lovable.dev/vite-tanstack-config with the real, vanilla plugin
// stack it was wrapping. Same functional pipeline (TanStack Start + Nitro on
// the node-server preset + Tailwind + tsconfig paths + React), minus the
// injected Lovable editor badge, its error-logger plugin, and sandbox
// detection that came bundled inside that wrapper package.
export default defineConfig({
  plugins: [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart(),
    // Render needs a plain Node HTTP server, not Nitro's Cloudflare Workers
    // default target.
    nitro({ config: { preset: "node-server" } }),
    viteReact(),
  ],
});
