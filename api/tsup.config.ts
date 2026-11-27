import { defineConfig } from "tsup";

export default defineConfig({
  // seedAdmin is built so the first admin can be created inside the production image.
  entry: ["src/server.ts", "src/worker.ts", "src/scripts/seedAdmin.ts"],
  format: ["cjs"],
  platform: "node",
  target: "node20",
  outDir: "dist",
  sourcemap: true,
  clean: true,
  // The shared @taptapsell/* packages ship as TypeScript source, which plain
  // `node` cannot load, so they are compiled into the bundle. Every other
  // dependency stays external and is loaded from node_modules at runtime.
  noExternal: [/^@taptapsell\//],
});
