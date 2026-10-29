import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
const directory = fileURLToPath(new URL(".", import.meta.url));
export default defineConfig({
  root: directory,
  plugins: [react()],
  resolve: { alias: { "@": resolve(directory, "..") } },
  build: {
    outDir: resolve(directory, "../selfhost-dist/client"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(directory, "index.html"),
        admin: resolve(directory, "admin/index.html"),
      },
    },
  },
});
