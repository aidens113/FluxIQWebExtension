import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  // The content-script harness specs run under playwright.content.config.ts.
  testIgnore: ["content/**"],
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "test-results/report" }]],
  outputDir: "test-results/artifacts",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    // Full Chromium in headless mode for the built-in page fixtures: the
    // separate headless shell crashes on launch on some Windows hosts.
    // Extension sessions launch headed through their own fixture.
    channel: "chromium",
    actionTimeout: 10_000,
    locale: "en-US",
    timezoneId: "UTC",
    viewport: { width: 1280, height: 720 },
    colorScheme: "light",
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  }
});
