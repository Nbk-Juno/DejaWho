import "dotenv/config";
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:5050",
    headless: true,
  },
  webServer: {
    command: "npm run dev",
    port: 5050,
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
});
