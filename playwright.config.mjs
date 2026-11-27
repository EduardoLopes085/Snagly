import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "*.spec.mjs",
  workers: 1,
  timeout: 20000,
  globalTimeout: 180000,
  forbidOnly: !!process.env.CI,
  reporter: "list",
});
