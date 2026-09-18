// The browser a saved-Flow replay runs in: the workspace's own Chromium
// profile with the Lab's extension, the deterministic network guard, and the
// extension paired to the workspace's Core, with the fixture's start page as
// the tab the extension automates. It is the browser `lab run` stands up for a
// Flow run, less the recording and the Core action probe a replay has no use for.
//
// `pairScenarioExtension` and `activateScenarioTab` repeat the two private
// helpers of `run-scenario.ts` of the same purpose. That file belongs to another
// unit of work while this one is open; once both have landed, the two copies
// belong in `run-lifecycle/`, called from both places.

import { chromium, type BrowserContext, type Page } from "@playwright/test";
import type { RunningTopology } from "../coordinator.js";
import { withoutProviderSecrets } from "../environment.js";
import { RunnerFailure } from "../failure.js";
import { scenarioLabOriginProof } from "../lab-control/index.js";
import { installDeterministicNetworkGuard, scenarioNetworkOrigins, type DeterministicNetworkGuard } from "../network-guard.js";
import { awaitExtensionWorker, extensionStatus, pairExtensionWithColdEpochRecovery, pollStatus, runtimeMessage } from "../run-lifecycle/index.js";

export type ReplayBrowser = Readonly<{
  context: BrowserContext;
  /** The tab showing the fixture, which the extension was told to automate. */
  scenarioPage: Page;
  guard: DeterministicNetworkGuard;
  /** Loads the fixture's entry point in `scenarioPage`, as every Flow run in the Lab begins. */
  openStart(): Promise<void>;
  close(): Promise<void>;
}>;

/**
 * Launches the browser and pairs its extension. The browser's environment is
 * stripped of provider credentials (`withoutProviderSecrets`), as every
 * browser the Lab starts is, although a replay is refused before this point
 * when its own process holds one.
 */
export async function openReplayBrowser(topology: RunningTopology, input: { extensionPath: string; startPath: string }): Promise<ReplayBrowser> {
  const control = topology.control;
  if (!control) throw new RunnerFailure("environment.missing", "A saved-Flow replay needs an authenticated Core to pair its extension with");
  const context = await chromium.launchPersistentContext(topology.allocation.browserProfileDir, {
    headless: false, env: withoutProviderSecrets(process.env), locale: "en-US", timezoneId: "UTC", viewport: { width: 1280, height: 720 }, colorScheme: "light",
    args: [`--disable-extensions-except=${input.extensionPath}`, `--load-extension=${input.extensionPath}`, "--no-first-run", "--disable-default-apps"],
  });
  try {
    const guard = await installDeterministicNetworkGuard(context, {
      scenarioOrigins: scenarioNetworkOrigins(topology.scenarioOrigin),
      fluxiqOrigins: [topology.fluxiqOrigin],
      ...(topology.gatewayUrl ? { gatewayOrigins: [topology.gatewayUrl] } : {}),
      verifyScenarioOrigin: scenarioLabOriginProof(topology.scenarioOrigin, topology.allocation.controllerToken),
    });
    const worker = await awaitExtensionWorker(context);
    const extensionPage = await context.newPage();
    await extensionPage.goto(`chrome-extension://${new URL(worker.url()).hostname}/sidepanel/index.html`);
    const start = `${topology.scenarioOrigin}${input.startPath}`;
    const scenarioPage = await context.newPage();
    await scenarioPage.goto(start);
    await scenarioPage.bringToFront();
    await pairScenarioExtension(extensionPage, topology, referenceCode => control.approvePairing(referenceCode));
    await activateScenarioTab(extensionPage, topology.scenarioOrigin);
    return Object.freeze({
      context, scenarioPage, guard,
      openStart: async () => { await scenarioPage.goto(start); },
      close: () => context.close(),
    });
  } catch (error) {
    await context.close().catch(/* best-effort: the launch or pairing error is the one reported */ () => undefined);
    throw error;
  }
}

async function pairScenarioExtension(page: Page, topology: RunningTopology, approvePairing: (referenceCode: string) => Promise<unknown>): Promise<void> {
  await pairExtensionWithColdEpochRecovery({
    connect: async () => (await runtimeMessage(page, { type: "fluxiq.connect", settings: { gatewayUrl: topology.gatewayUrl, coreApiUrl: topology.fluxiqOrigin, autoReconnect: true, captureMutations: true, captureInputValues: true, captureSnapshots: true } })).status,
    readStatus: () => extensionStatus(page),
    approvePairing,
  });
}

async function activateScenarioTab(extensionPage: Page, scenarioOrigin: string): Promise<void> {
  const tabId = await extensionPage.evaluate(async (origin: string) => {
    const tabs = await (globalThis as any).chrome.tabs.query({ url: `${origin}/*` });
    const tab = tabs.find((candidate: any) => typeof candidate.id === "number");
    if (!tab) throw new Error(`Scenario tab is unavailable for ${origin}`);
    await (globalThis as any).chrome.tabs.update(tab.id, { active: true });
    return tab.id as number;
  }, scenarioOrigin);
  await pollStatus(extensionPage, value => value.activeTabId === tabId && typeof value.activeTabUrl === "string" && value.activeTabUrl.startsWith(scenarioOrigin));
}
