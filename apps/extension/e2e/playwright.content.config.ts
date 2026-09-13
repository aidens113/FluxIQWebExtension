// The T2 content-script harness (e2e/content/): the content-script bundle in
// headless Chromium on Scenario Lab fixtures, with no extension loaded. The
// global setup builds the bundle once per run. Headless runs the full Chromium
// build (`channel: "chromium"`) because the default headless shell crashes on
// launch on the development machine.
//
// `workers` is pinned to 4, the count the harness is run at on that machine, so
// the bare `pnpm exec playwright test -c e2e/playwright.content.config.ts` is
// the correct invocation. A `--workers` flag still overrides it: pass
// `--workers=2` when the machine is under load.

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./content/tests",
  globalSetup: "./content/global-setup.ts",
  fullyParallel: true,
  workers: 4,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "test-results/content/report" }]],
  outputDir: "test-results/content/artifacts",
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
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  }
});
