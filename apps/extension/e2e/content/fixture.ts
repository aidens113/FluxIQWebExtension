// The Playwright `test` every content-harness spec uses. `openHarness` opens a
// Scenario Lab fixture in the test's page with the content script loaded;
// every harness a test opens is closed after it.
//
// The specs belong to e2e/playwright.content.config.ts, whose global setup
// builds the bundle. A config whose testDir spans the whole e2e/ tree would
// collect them too; there the bundle is missing, so each test skips before
// any browser starts instead of failing.

import { test as base } from "@playwright/test";
import { CONTENT_HARNESS_BUNDLE_ENV } from "./bundle-env.js";
import { openContentHarness, type ContentHarness, type ContentHarnessOptions } from "./harness.js";

type ContentHarnessFixtures = {
  contentHarnessBundleGuard: void;
  openHarness: (scenarioId: string, options?: Omit<ContentHarnessOptions, "scenarioId">) => Promise<ContentHarness>;
};

export const test = base.extend<ContentHarnessFixtures>({
  contentHarnessBundleGuard: [async ({}, use, testInfo) => {
    testInfo.skip(
      !process.env[CONTENT_HARNESS_BUNDLE_ENV],
      "Content-harness specs run under e2e/playwright.content.config.ts (pnpm test:content), whose global setup builds the bundle."
    );
    await use();
  }, { auto: true }],
  openHarness: async ({ page }, use) => {
    const opened: ContentHarness[] = [];
    await use(async (scenarioId, options = {}) => {
      const harness = await openContentHarness(page, { ...options, scenarioId });
      opened.push(harness);
      return harness;
    });
    await Promise.all(opened.map((harness) => harness.close()));
  }
});

export { expect } from "@playwright/test";
