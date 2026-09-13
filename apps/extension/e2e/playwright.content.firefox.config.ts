// The content-script harness (e2e/content/) run in Playwright's Firefox
// instead of Chromium, so the Chromium-only Week 1 measurements can be
// compared against a Gecko engine. Added by the p-firefox investigation; it
// changes nothing about playwright.content.config.ts, which stays the
// Chromium baseline.
//
// FLUXIQ_FIREFOX_EXECUTABLE lets a run point at a Playwright Firefox build
// that is present on the machine but not the exact revision this Playwright
// version downloads. Unset, Playwright uses its own.

import { defineConfig } from "@playwright/test";

const executablePath = process.env.FLUXIQ_FIREFOX_EXECUTABLE;

export default defineConfig({
  testDir: "./content/tests",
  globalSetup: "./content/global-setup.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [["list"], ["json", { outputFile: "test-results/content-firefox/results.json" }]],
  outputDir: "test-results/content-firefox/artifacts",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    browserName: "firefox",
    headless: true,
    actionTimeout: 10_000,
    locale: "en-US",
    timezoneId: "UTC",
    viewport: { width: 1280, height: 720 },
    colorScheme: "light",
    trace: "off",
    screenshot: "off",
    ...(executablePath ? { launchOptions: { executablePath } } : {})
  }
});
