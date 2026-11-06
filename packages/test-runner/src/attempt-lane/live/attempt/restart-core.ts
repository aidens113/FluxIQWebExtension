import type { RunningTopology } from "../../../coordinator.js";
import type { ChatBrowserSession, ChatPanelDriver } from "../../../extension-chat-check/index.js";
import type { ExistingFluxIQControlClient } from "../../../existing-fluxiq-control.js";
import { RunnerFailure } from "../../../failure.js";
import { extensionStatus } from "../../../run-lifecycle/index.js";

/** What a Core restart between attempts looked like from the browser, in the Lab's evidence. */
export type AttemptCoreRestart = Readonly<{
  /** From the stop to the extension saying it is connected again. */
  reconnectedAfterMs: number;
  /** What the browser's model key read after it: `unlocked`, or the lock and its reason. */
  modelKey: string;
  /** `carried_on`: the open panel took the next message by itself. `reopened`: it could not, and was opened again as a person would. */
  panel: "carried_on" | "reopened";
  /** What the open panel showed before anything was reopened. */
  panelBefore: string;
}>;

export type AttemptCoreRestartInput = {
  topology: RunningTopology;
  control: ExistingFluxIQControlClient;
  browser: ChatBrowserSession;
  projectId: string;
  log: (line: string) => void;
};

type ChatProjectScope = Awaited<ReturnType<ChatPanelDriver["projectScope"]>>;

const RECONNECT_MS = 90_000;
const SETTLE_MS = 45_000;

/**
 * Stops this run's Core and starts it again on the same ports and stores, between two attempts, and brings
 * the browser back as a person's comes back (`--restart-between`): nothing in the browser is touched while
 * Core is down, the extension reconnects on its own, and the chat that was open is used as it stands. Only
 * a panel that cannot take a message is opened again, which is what a person would do, and the evidence says
 * which happened. The Lab's own control client signs in again, since its session belonged to the Core that stopped.
 */
export async function restartAttemptCore(input: AttemptCoreRestartInput): Promise<AttemptCoreRestart> {
  const { topology, control, browser, projectId, log } = input;
  if (!topology.restartCore) throw new RunnerFailure("environment.missing", "This run's Core is not one it can restart");
  const began = Date.now();
  log("[attempt] restarting Core between the attempts: the browser and the chat stay as they are");
  await topology.restartCore();
  await control.reauthenticate();
  const connection = await waitFor(() => connectionState(browser), (state) => state === "connected", RECONNECT_MS);
  if (connection !== "connected") throw new RunnerFailure("gateway.connection", `The extension did not connect again after Core restarted: it stood at ${connection}`);
  const reconnectedAfterMs = Date.now() - began;
  log(`[attempt] the extension connected again ${Math.round(reconnectedAfterMs / 1000)} s after the restart began`);
  const modelKey = await waitFor(() => modelKeyReadiness(browser), (readiness) => readiness === "unlocked", SETTLE_MS);
  log(`[attempt] the browser's model key reads ${modelKey} after the restart`);
  await control.selectProject(projectId);
  const read = await waitFor(() => panelScope(browser), (scopeNow) => ready(scopeNow, projectId), SETTLE_MS);
  const scope = typeof read === "string" ? null : read;
  const panelBefore = scope ? `${scope.scopeState ?? "unknown"}, ${scope.composerEnabled ? "composer ready" : scope.composerAvailable ? "composer shown but not ready" : "no composer"}` : "unreadable";
  if (ready(scope, projectId)) {
    log("[attempt] the open chat carried on by itself after the restart");
    return Object.freeze({ reconnectedAfterMs, modelKey, panel: "carried_on", panelBefore });
  }
  log(`[attempt] the open chat could not take a message after the restart (${panelBefore}), so it is opened again, as a person would`);
  await browser.openPanel();
  const reopened = await browser.panel!.selectProject(projectId);
  if (!reopened.composerAvailable) throw new RunnerFailure("gateway.connection", `The chat opened again after Core restarted with no composer: its scope stood at ${reopened.scopeState ?? "unknown"}`);
  return Object.freeze({ reconnectedAfterMs, modelKey, panel: "reopened", panelBefore });
}

function ready(scope: ChatProjectScope | null, projectId: string): boolean {
  return scope !== null && scope.projectId === projectId && scope.scopeState === "ready" && scope.composerEnabled;
}

async function connectionState(browser: ChatBrowserSession): Promise<string> {
  return String((await extensionStatus(browser.control) as { connectionState?: unknown }).connectionState ?? "unread");
}

/** What Core tells the panel about this browser's key: the read the chat's own setup step uses. */
async function modelKeyReadiness(browser: ChatBrowserSession): Promise<string> {
  const reply = await browser.control.evaluate(() => (globalThis as unknown as { chrome: { runtime: { sendMessage(message: unknown): Promise<unknown> } } }).chrome.runtime.sendMessage({ type: "fluxiq.panel.modelReadiness" })) as { payload?: { keys?: { unlocked?: boolean; lockedBecause?: string }[] } };
  const keys = reply.payload?.keys ?? [];
  if (keys.length === 0) return "no key";
  return keys.every((key) => key.unlocked === false) ? `locked: ${keys[0]?.lockedBecause ?? "unknown"}` : "unlocked";
}

async function panelScope(browser: ChatBrowserSession): Promise<ChatProjectScope | null> {
  return browser.panel ? await browser.panel.projectScope() : null;
}

/** The last read, once `wanted` holds or the time is up. A read that throws is a read of its error's name, and the wait goes on. */
async function waitFor<T>(read: () => Promise<T>, wanted: (value: T) => boolean, timeoutMs: number): Promise<T | string> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    let last: T | string;
    try {
      last = await read();
      if (wanted(last)) return last;
    } catch (error) {
      last = `read failed: ${error instanceof Error ? error.name : "non_error"}`;
    }
    if (Date.now() >= deadline) return last;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
}
