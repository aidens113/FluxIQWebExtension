import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { BrowserContext, Page } from "@playwright/test";
import { withoutProviderSecrets } from "../environment.js";
import { launchGuardedPersistentContext } from "../guarded-browser/index.js";
import { scenarioLabOriginProof } from "../lab-control/index.js";
import { scenarioNetworkOrigins, type DeterministicNetworkGuard } from "../network-guard.js";

export type GuardedLabTab = { context: BrowserContext; page: Page; guard: DeterministicNetworkGuard; close(): Promise<void> };

/**
 * One visible, isolated browser session on a Scenario Lab, guarded to reach the
 * Lab's origin and nothing else (no FluxIQ, no gateway, no provider). Each call
 * is its own browser with its own run-scoped temporary profile, removed on
 * close, so tabs never share cookies or storage.
 */
export async function openGuardedLabTab(lab: { origin: string; token: string }): Promise<GuardedLabTab> {
  const profile = await mkdtemp(path.join(tmpdir(), "fluxiq-lab-tab-"));
  const removeProfile = async () => {
    await rm(profile, { recursive: true, force: true }).catch(/* best-effort: an OS temp profile is disposable */ () => undefined);
  };
  try {
    const { context, guard } = await launchGuardedPersistentContext(profile, {
      headless: false,
      channel: "chromium",
      env: withoutProviderSecrets(process.env),
      locale: "en-US",
      timezoneId: "UTC",
      viewport: { width: 1280, height: 720 },
      args: ["--no-first-run", "--disable-default-apps"],
    }, {
      scenarioOrigins: scenarioNetworkOrigins(lab.origin),
      fluxiqOrigins: [],
      verifyScenarioOrigin: scenarioLabOriginProof(lab.origin, lab.token),
    });
    const page = await context.newPage();
    const close = async () => {
      await context.close().catch(/* best-effort: the result is written */ () => undefined);
      await removeProfile();
    };
    return { context, page, guard, close };
  } catch (error) {
    await removeProfile();
    throw error;
  }
}
