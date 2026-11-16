import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";

// The release number: package.json is the single source; the footer shows it (docs/CONTRIBUTING.md "Versioning").
const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("framer-motion")) {
              return "framer-motion";
            }
            if (id.includes("react-markdown") || id.includes("remark-gfm")) {
              return "markdown";
            }
            if (id.includes("react-router") || id.includes("@tanstack")) {
              return "vendor-data";
            }
          }
        },
      },
    },
  },
  server: {
    port: 5173,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
  },
});
