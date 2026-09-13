// The Chromium baseline the Firefox content-harness run
// (playwright.content.firefox.config.ts) is compared against. Identical to
// playwright.content.config.ts except for the browser-neutral bits that must
// not collide with a concurrent run of the shared config: its own outputDir
// and its own JSON reporter file. Added by the p-firefox investigation so the
// delta is measured against a run this worker took itself, rather than
// against a Chromium run someone else reported.

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./content/tests",
  globalSetup: "./content/global-setup.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [["list"], ["json", { outputFile: "test-results/content-chromium-baseline/results.json" }]],
  outputDir: "test-results/content-chromium-baseline/artifacts",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    browserName: "chromium",
    channel: "chromium",
    headless: true,
    actionTimeout: 10_000,
    locale: "en-US",
    timezoneId: "UTC",
    viewport: { width: 1280, height: 720 },
    colorScheme: "light",
    trace: "off",
    screenshot: "off"
  }
});
