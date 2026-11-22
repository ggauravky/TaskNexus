import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const production = JSON.parse(readFileSync(new URL("./production.config.json", import.meta.url), "utf8"));

export default defineConfig({
  plugins: [react(), {
    name: "tasknexus-production-api",
    configResolved(config) {
      if (config.command !== "build" || !config.isProduction) return;

      const apiUrl = String(config.env.VITE_API_URL || "").trim().replace(/\/$/, "");
      if (apiUrl && apiUrl !== production.apiBaseUrl) {
        throw new Error("VITE_API_URL does not match the canonical production API URL");
      }
    },
  }],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
