import { chromium, type BrowserContext } from "@playwright/test";
import type { RunningTopology } from "../../coordinator.js";
import { withoutProviderSecrets } from "../../environment.js";
import { forgetCachedServiceWorkers, networkContainmentArgs } from "../../guarded-browser/index.js";

/**
 * The headed Chromium a scenario run drives, with the built extension loaded.
 *
 * Every setting here is part of the run's determinism rather than a
 * convenience: a fixed locale, timezone, viewport and colour scheme, and a
 * profile directory the allocation owns so two runs never share browser state.
 * It is headed because the extension's side panel and its content scripts are
 * what is under test, and `withoutProviderSecrets` keeps the provider
 * credential out of the browser process's environment -- the browser never
 * needs it, and a leaked one would reach the pages the run visits.
 *
 * `networkContainmentArgs` is the browser-level half of containment, scoped to
 * the hosts of the run's own origins; the
 * caller installs the route-level guard (`installRunNetworkGuard`) before it
 * opens any page, which `guarded-browser/tests/launch-containment.test.ts` pins.
 *
 * The window is 1700 by 1000 so the extension panel shown beside the fixture
 * (`openLivePanel`) has room next to the 1280-wide viewport. `headless` is
 * returned so the caller decides from the launch itself whether there is a
 * window to show that panel in.
 *
 * The profile's stored service workers are forgotten first, so a persistent
 * workspace's profile runs this build's background worker rather than the one
 * it ran before (`forgetCachedServiceWorkers`).
 */
export async function launchBrowser(topology: RunningTopology, extensionPath: string): Promise<{ context: BrowserContext; browserVersion: string; headless: boolean }> {
  const headless = false;
  await forgetCachedServiceWorkers(topology.allocation.browserProfileDir);
  const context = await chromium.launchPersistentContext(topology.allocation.browserProfileDir, { headless, env: withoutProviderSecrets(process.env), locale: "en-US", timezoneId: "UTC", viewport: { width: 1280, height: 720 }, colorScheme: "light", args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, "--no-first-run", "--disable-default-apps", "--window-size=1700,1000", ...networkContainmentArgs([topology.scenarioOrigin, topology.fluxiqOrigin, topology.gatewayUrl])] });
  return { context, browserVersion: context.browser()?.version() ?? "chromium", headless };
}
