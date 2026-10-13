// The browser a saved-Flow replay runs in: the workspace's own Chromium
// profile with the Lab's extension, the deterministic network guard, and the
// extension paired to the workspace's Core, with the fixture's start page as
// the tab the extension automates. It is the browser `lab run` stands up for a
// Flow run, less the recording and the Core action probe a replay has no use for.
//
// It starts through the run lane's own session (`launchExtensionSession`), not
// a launch of its own: the containment switches and forgotten cached workers
// (`launchBrowser`), the guard installed before any page and its worker proofs
// awaited before pairing, the control page's worker-stage details, and the
// one normal close and relaunch when Playwright saw no worker that Chrome had.
// Replay `replay-mv62rwy7-fcb23be8` launched Chromium itself and died on the
// bare readiness wait with none of that. Whatever the session launched last is
// closed here on failure, since the session leaves its final browser to its caller.
//
// `pairScenarioExtension` and `activateScenarioTab` repeat the two private
// helpers of `run-scenario.ts` of the same purpose. That file belongs to another
// unit of work while this one is open; once both have landed, the two copies
// belong in `run-lifecycle/`, called from both places.

import type { BrowserContext, Page } from "@playwright/test";
import type { RunningTopology } from "../coordinator.js";
import { RunnerFailure } from "../failure.js";
import { scenarioNetworkOrigins, type DeterministicNetworkGuard } from "../network-guard.js";
import { extensionStatus, pairExtensionWithColdEpochRecovery, pollStatus, runtimeMessage } from "../run-lifecycle/index.js";
import { ExtensionStartTrace, launchExtensionSession } from "../run-scenario/index.js";
import { profileHandoverProbe } from "./profile-handover-probe.js";

export type ReplayBrowser = Readonly<{
  context: BrowserContext;
  /** The tab showing the fixture, which the extension was told to automate. */
  scenarioPage: Page;
  guard: DeterministicNetworkGuard;
  /** Loads the fixture's entry point in `scenarioPage`, as every Flow run in the Lab begins. */
  openStart(): Promise<void>;
  close(): Promise<void>;
}>;

type SessionOptions = Parameters<typeof launchExtensionSession>[2];
type ReplaySession = { context: BrowserContext; controlPage: Page };

/**
 * Launches the browser and pairs its extension. The browser's environment is
 * stripped of provider credentials (`launchBrowser` uses `withoutProviderSecrets`),
 * as every browser the Lab starts is, although a replay is refused before this
 * point when its own process holds one. `trace` receives the start's events and
 * the pre-launch profile probe; the caller writes it out. `seams` are for tests.
 */
export async function openReplayBrowser(
  topology: RunningTopology,
  input: { extensionPath: string; startPath: string; trace?: SessionOptions["trace"] },
  seams: { session?: Pick<SessionOptions, "launch" | "openControl" | "installGuard" | "findTarget">; probeProfile?: typeof profileHandoverProbe; openScenario?: (session: ReplaySession, start: string) => Promise<Page> } = {},
): Promise<ReplayBrowser> {
  const control = topology.control;
  if (!control) throw new RunnerFailure("environment.missing", "A saved-Flow replay needs an authenticated Core to pair its extension with");
  const trace = input.trace ?? new ExtensionStartTrace({ secrets: [topology.allocation.controllerToken] });
  // Before the launch, which forgets the profile's cached workers and so writes to it. Recorded only: a probe that cannot read the profile gates nothing.
  const probe = await (seams.probeProfile ?? profileHandoverProbe)(topology.allocation.browserProfileDir)
    .catch((error: unknown) => ({ unavailable: String((error as NodeJS.ErrnoException | null)?.code ?? "unknown") }));
  trace.mark("browser.profile-handover", probe);
  let latest: BrowserContext | undefined;
  try {
    const session = await launchExtensionSession(topology, input.extensionPath, {
      ...seams.session, scenarioOrigins: scenarioNetworkOrigins(topology.scenarioOrigin), trace,
      onLaunched: launched => { latest = launched.context; },
    });
    const { context, guard } = session;
    const start = `${topology.scenarioOrigin}${input.startPath}`;
    const openScenario = seams.openScenario ?? ((opened: ReplaySession) => openPairedScenario(opened, topology, start, referenceCode => control.approvePairing(referenceCode)));
    const scenarioPage = await openScenario(session, start);
    return Object.freeze({
      context, scenarioPage, guard,
      openStart: async () => { await scenarioPage.goto(start); },
      close: () => context.close(),
    });
  } catch (error) {
    await latest?.close().catch(/* best-effort: the launch or pairing error is the one reported */ () => undefined);
    throw error;
  }
}

/** Opens the fixture's start page, pairs the extension from its control page, and makes the fixture its active tab. */
async function openPairedScenario(session: ReplaySession, topology: RunningTopology, start: string, approvePairing: (referenceCode: string) => Promise<unknown>): Promise<Page> {
  const scenarioPage = await session.context.newPage();
  await scenarioPage.goto(start);
  await scenarioPage.bringToFront();
  await pairScenarioExtension(session.controlPage, topology, approvePairing);
  await activateScenarioTab(session.controlPage, topology.scenarioOrigin);
  return scenarioPage;
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
