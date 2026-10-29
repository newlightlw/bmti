import { build } from "esbuild";
import { build as buildClient } from "vite";
import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const directory = fileURLToPath(new URL(".", import.meta.url));
await rm(new URL("../selfhost-dist", import.meta.url), {
  recursive: true,
  force: true,
});
await buildClient({ configFile: directory + "vite.config.ts" });
await build({
  entryPoints: [directory + "server.ts"],
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  outfile: directory + "../selfhost-dist/server.mjs",
  plugins: [
    {
      name: "local-sqlite-binding",
      setup(builder) {
        builder.onResolve({ filter: /^cloudflare:workers$/ }, () => ({
          path: directory + "env.ts",
        }));
      },
    },
  ],
});
await mkdir(new URL("../selfhost-dist/migrations", import.meta.url), {
  recursive: true,
});
await cp(
  new URL("../drizzle", import.meta.url),
  new URL("../selfhost-dist/migrations", import.meta.url),
  { recursive: true, filter: (source) => !source.includes("/meta") },
);
console.log("Standalone Node + SQLite release ready in selfhost-dist/");
