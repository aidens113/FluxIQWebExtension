import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "test-results/report" }]],
  outputDir: "test-results/artifacts",
  timeout: 20_000,
  expect: { timeout: 3_000 },
  // Full Chromium in headless mode: the separate headless shell crashes on
  // launch on some Windows hosts.
  use: { headless: true, channel: "chromium", locale: "en-US", timezoneId: "UTC", viewport: { width: 1280, height: 720 }, colorScheme: "light", trace: "retain-on-failure", screenshot: "only-on-failure" },
});
