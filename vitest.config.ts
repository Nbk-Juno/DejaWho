import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // The project tsconfig sets jsx:"preserve" (for the client's Vite pipeline); force the
  // automatic runtime here so the server-side React Email templates (server/emails/*.tsx)
  // transform correctly when a test renders them.
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true },
    },
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "./shared"),
      "@": path.resolve(__dirname, "./client/src"),
    },
  },
});
