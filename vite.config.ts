import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import path from "path";
import fs from "fs";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "stamp-sw-cache-version",
      closeBundle() {
        const swPath = path.resolve(import.meta.dirname, "dist/public/sw.js");
        if (!fs.existsSync(swPath)) return;
        const stamped = fs.readFileSync(swPath, "utf-8")
          .replace("__CACHE_VERSION__", Date.now().toString());
        fs.writeFileSync(swPath, stamped);
      },
    },
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      disable: !process.env.SENTRY_AUTH_TOKEN,
      // Upload maps to Sentry, then delete them from the build so they're never served publicly.
      sourcemaps: { filesToDeleteAfterUpload: ["./dist/public/**/*.map"] },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    // "hidden" still emits maps (so Sentry can symbolicate) but omits the //# sourceMappingURL
    // comment, so the public bundle has no pointer to them. The Sentry plugin then deletes the
    // .map files after upload (filesToDeleteAfterUpload above). serveStatic also refuses to
    // serve .map as a backstop for builds where SENTRY_AUTH_TOKEN is unset (plugin disabled).
    sourcemap: "hidden",
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
