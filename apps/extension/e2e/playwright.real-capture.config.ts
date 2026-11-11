import { defineConfig } from "@playwright/test";

// The real-browser brand capture (`real-panel-capture.spec.ts`) launches its own Chrome and Firefox, so this
// config sets no `channel` (the main e2e config pins one, which Firefox refuses). Run with
// `node --no-experimental-strip-types node_modules/@playwright/test/cli.js test -c e2e/playwright.real-capture.config.ts`,
// FLUXIQ_REAL_BROWSER=chrome|firefox and FLUXIQ_CAPTURE_RAW=<folder for the window photographs>.
const NO_STRIP_TYPES = "--no-experimental-strip-types";
if (!(process.env.NODE_OPTIONS ?? "").includes(NO_STRIP_TYPES)) process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS ?? ""} ${NO_STRIP_TYPES}`.trim();

export default defineConfig({
  testDir: ".",
  testMatch: "real-panel-capture.spec.ts",
  workers: 1,
  reporter: [["list"]],
  outputDir: "test-results/real-capture",
  timeout: 300_000
});
