import { defineConfig } from "@playwright/test";

// Node 22.18+ strips TypeScript itself by default, and then loads the
// TypeScript sources the site-reset specs reach (FluxIQ Core and the scenario
// Lab) natively instead of through Playwright's transform: they fail with
// "TypeScript parameter property is not supported in strip-only mode" (t724
// L1). Playwright lists spec files in the process that loads this config, so
// the flag must reach it at launch: `pnpm test:e2e` starts the runner with
// `node --no-experimental-strip-types`, and a direct run needs
// `NODE_OPTIONS=--no-experimental-strip-types`. Set here too, so every process
// Playwright spawns inherits it.
const NO_STRIP_TYPES = "--no-experimental-strip-types";
if (!(process.env.NODE_OPTIONS ?? "").includes(NO_STRIP_TYPES)) process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS ?? ""} ${NO_STRIP_TYPES}`.trim();

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
