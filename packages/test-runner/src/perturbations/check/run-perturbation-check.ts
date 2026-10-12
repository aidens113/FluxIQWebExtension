// The provider-free proof that a perturbation fires at the right moment and is
// recorded: one committing act, run by hand through the real path, under one
// declared fault.
//
// It is the extension chat check's harness (`extension-chat-check/`) without
// the chat: an isolated Core, the Scenario Lab, headed Chromium with the
// extension's e2e build and the run network guard, and the extension paired
// with Core -- through the relay when the fault is a dropped result. On
// social-network-feed's request list the person answers the site's own
// prompts, and then Core, through `execute-client-action`, has the extension
// press Confirm on Amara Osei's request: a committing act whose request to the
// fixture (`POST /api/social-network-feed/confirm-request`) is row 11's trigger
// and whose acknowledgement is row 9's dropped frame.
//
// It proves only the fault: that it fired after the act reached the site, that
// the site took the act, and what the extension and Core said afterwards. It
// does not judge whether FluxIQ reconciles; no model is called.

import { randomBytes } from "node:crypto";
import path from "node:path";
import type { Page } from "@playwright/test";
import { removeRunOwnedTopologyState, startTopology, type RunningTopology } from "../../coordinator.js";
import { chatNetworkPolicy, evidenceWriter, openChromeChatSession, type ChatBrowserSession } from "../../extension-chat-check/index.js";
import { resolveLabPaths } from "../../lab-instance/index.js";
import { scenarioNetworkOrigins } from "../../network-guard.js";
import { assertRealisticScenarios } from "../../realistic-scenarios/index.js";
import { extensionStatus, pairExtensionWithColdEpochRecovery, runtimeMessage } from "../../run-lifecycle/index.js";
import { activateScenarioTab } from "../../run-scenario/index.js";
import { loadScenarioManifest } from "../../scenarios.js";
import type { PerturbationReport } from "../perturbation-log.js";
import type { RunPerturbation } from "../run-perturbation.js";
import { startRunPerturbation, type RunPerturbationSession } from "../start-run-perturbation.js";

export type PerturbationCheckOptions = {
  repositoryRoot: string;
  fluxiqRepositoryRoot: string;
  perturbation: RunPerturbation;
  evidenceDirectory: string;
  log?: (line: string) => void;
};

export type PerturbationCheckResult = {
  perturbation: RunPerturbation;
  scenarioId: string;
  browserVersion: string | null;
  /** How far the check got: the last stage it entered. */
  stage: string;
  /** What the person did about the site's own prompts before the act. */
  sitePrompts: string[];
  /** Core's answer to the hand-run act: its status and error, or that no answer came in time. */
  coreResult: { status: string | null; error: string | null; answeredInMs: number | null } | null;
  /** Whether the site shows the request accepted after the act: the act landed. */
  siteTookTheAct: boolean | null;
  report: PerturbationReport | null;
  networkGuardViolations: number | null;
  /** The fault fired at the right moment and is recorded; `reasons` says why not when false. */
  proven: boolean;
  reasons: string[];
  failure: string | null;
  evidenceDirectory: string;
};

const SCENARIO_ID = "social-network-feed";
const PAGE_PATH = "friends/requests/";
const CARD = "[role=\"listitem\"]:has(a[href$=\"/people/amara-osei/\"])";
const CONFIRM = `${CARD} [aria-label="Confirm"]`;
const ACCEPTED = `${CARD} a[href*="/messages/t/"]`;
/** Core is told to give up on the act after this long, and the check stops waiting for Core a little after. */
const ACT_TIMEOUT_MS = 15_000;
const CORE_ANSWER_WAIT_MS = 45_000;
/** How long after the act the fault has to fire, and how long the readers then get (their last read is 10 s after the fault). */
const FIRE_WAIT_MS = 30_000;
const OBSERVATION_WAIT_MS = 15_000;

/** Runs the check end to end and answers how far it got, whatever happened. */
export async function runPerturbationCheck(options: PerturbationCheckOptions): Promise<PerturbationCheckResult> {
  assertRealisticScenarios([SCENARIO_ID], "The perturbation check");
  const log = options.log ?? (() => undefined);
  const labPaths = resolveLabPaths(options.repositoryRoot);
  const scenario = await loadScenarioManifest(options.repositoryRoot, SCENARIO_ID, labPaths.scenarioLabDist);
  const runId = `perturbation-check-${options.perturbation.kind}-${Date.now().toString(36)}`;
  let browser: ChatBrowserSession | undefined;
  let topology: RunningTopology | undefined;
  let perturbation: RunPerturbationSession | undefined;
  const evidence = evidenceWriter(options.evidenceDirectory, () => browser);
  const result: PerturbationCheckResult = { perturbation: options.perturbation, scenarioId: scenario.id, browserVersion: null, stage: "topology", sitePrompts: [], coreResult: null, siteTookTheAct: null, report: null, networkGuardViolations: null, proven: false, reasons: [], failure: null, evidenceDirectory: options.evidenceDirectory };
  const stage = (name: string) => {
    result.stage = name;
    log(`[perturbation-check] ${options.perturbation.kind}: ${name}`);
  };
  try {
    topology = await startTopology({
      repositoryRoot: options.repositoryRoot, fluxiqRepositoryRoot: options.fluxiqRepositoryRoot,
      runsDirectory: path.join(labPaths.runsDirectory, ".perturbation-check-work"), runId, seed: scenario.seed,
      target: { mode: "isolated" }, scenarioEntrypoint: labPaths.scenarioEntrypoint, hostModulePath: labPaths.hostModulePath,
      prepareHost: false, bootstrapIdentity: true,
    });
    const { control, projectId, authorizationPin } = topology;
    if (!control || !projectId || !authorizationPin || !topology.gatewayUrl) throw new Error("The isolated Core started without a signed-in control, a project, a PIN or a gateway");
    stage("start perturbation");
    ({ session: perturbation, topology } = await startRunPerturbation(options.perturbation, topology));
    const running = topology;
    stage("open chrome");
    const pageUrl = new URL(PAGE_PATH, `${running.scenarioOrigin}${scenario.startPath}`).href;
    browser = await openChromeChatSession({ topology: running, extensionPath: labPaths.extensionPath, scenarioUrl: pageUrl, workerRequests: [], policy: chatNetworkPolicy(running, running.fluxiqOrigin) });
    result.browserVersion = browser.browserVersion;
    const controlPage = browser.control;
    await perturbation.armBrowser({ context: browser.context, cdpPage: controlPage, scenarioOrigins: scenarioNetworkOrigins(running.scenarioOrigin), readers: { extension: () => extensionStatus(controlPage), core: () => control.gatewaySnapshot() } });
    stage("pair");
    const paired = await pairExtensionWithColdEpochRecovery({
      connect: async () => (await runtimeMessage(controlPage, { type: "fluxiq.connect", settings: { gatewayUrl: running.gatewayUrl, coreApiUrl: running.fluxiqOrigin, autoReconnect: true, captureMutations: true, captureInputValues: true, captureSnapshots: true } })).status,
      readStatus: () => extensionStatus(controlPage),
      approvePairing: referenceCode => control.approvePairing(referenceCode),
    });
    const sessionId = (paired as { sessionId?: unknown }).sessionId;
    if (typeof sessionId !== "string") throw new Error("Pairing produced no session id");
    await control.selectProject(projectId);
    stage("answer site prompts");
    result.sitePrompts = await answerSitePrompts(browser.scenario);
    await browser.scenario.locator(CONFIRM).waitFor({ state: "visible", timeout: 10_000 });
    await browser.scenario.bringToFront();
    await activateScenarioTab(controlPage, running.scenarioOrigin);
    await evidence.shot("before-act");
    stage("act through core");
    const startedAt = Date.now();
    const command = { actionType: "web.dom.click", parameters: { selector: CONFIRM }, timeoutMs: ACT_TIMEOUT_MS, metadata: { correlationId: `perturbation-check-${randomBytes(6).toString("hex")}` } };
    const answer = await Promise.race([
      control.executeClientAction(sessionId, command, authorizationPin).then(value => ({ value }), (error: unknown) => ({ error })),
      new Promise<undefined>(resolve => { setTimeout(() => resolve(undefined), CORE_ANSWER_WAIT_MS); }),
    ]);
    result.coreResult = coreResultOf(answer, Date.now() - startedAt);
    stage("wait for the fault");
    await until(() => perturbation!.fired(), FIRE_WAIT_MS);
    await until(() => perturbation!.report().afterFault.length >= 2, OBSERVATION_WAIT_MS);
    try { result.siteTookTheAct = await browser.scenario.locator(ACCEPTED).isVisible(); } catch (error) { result.reasons.push(`the site could not be read: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`); }
    await evidence.shot("after-fault");
    result.networkGuardViolations = browser.guard.violations().length;
    stage("done");
  } catch (error) {
    result.failure = error instanceof Error ? `${error.message}${error.stack ? `\n${error.stack.split("\n").slice(1, 6).join("\n")}` : ""}` : String(error);
    log(`[perturbation-check] failed at ${result.stage}: ${result.failure.split("\n")[0]}`);
    await evidence.shot(`failed-at-${result.stage.replace(/[^a-z0-9]+/giu, "-")}`).catch(/* best-effort: the failure itself is already recorded in the result */ () => undefined);
  } finally {
    result.report = (await perturbation?.close().catch((error: unknown) => {
      result.reasons.push(`the perturbation did not close cleanly: ${String(error)}`);
      return perturbation?.report();
    })) ?? null;
    judge(result);
    await evidence.json(`result-${options.perturbation.kind}`, result).catch((error: unknown) => log(`[perturbation-check] the result could not be written: ${error instanceof Error ? error.message : String(error)}`));
    await browser?.close().catch(/* best-effort: cleanup after the result is written */ () => undefined);
    await topology?.close().catch(/* best-effort: cleanup after the result is written */ () => undefined);
    if (topology) await removeRunOwnedTopologyState(topology).catch(/* best-effort: run-owned state is disposable and pruned later */ () => undefined);
  }
  return result;
}

/**
 * The person answers the site's own prompts before acting, as the scenario's
 * recording does: cookies allowed, notifications refused, the chat popup
 * closed. Each is answered if it shows within its wait; one that never shows
 * is noted, not an error.
 */
async function answerSitePrompts(page: Page): Promise<string[]> {
  const answered: string[] = [];
  for (const [name, timeout] of [["Allow all cookies", 5_000], ["Not now", 10_000], ["Close chat", 10_000]] as const) {
    const button = page.getByRole("button", { name, exact: true }).first();
    const shown = await button.waitFor({ state: "visible", timeout }).then(() => true, () => false);
    if (shown) await button.click();
    answered.push(`${name}: ${shown ? "pressed" : "not shown"}`);
  }
  return answered;
}

function coreResultOf(answer: { value: unknown } | { error: unknown } | undefined, elapsedMs: number): NonNullable<PerturbationCheckResult["coreResult"]> {
  if (answer === undefined) return { status: null, error: `no answer within ${CORE_ANSWER_WAIT_MS} ms`, answeredInMs: null };
  if ("error" in answer) return { status: null, error: (answer.error instanceof Error ? answer.error.message : String(answer.error)).split("\n")[0]!.slice(0, 300), answeredInMs: elapsedMs };
  const result = record(record(record(answer.value).payload).result);
  const error = result.error ?? result.message;
  return { status: typeof result.status === "string" ? result.status : null, error: typeof error === "string" ? error.slice(0, 300) : null, answeredInMs: elapsedMs };
}

/** Whether the fault fired at the right moment and was recorded; the reasons are why not. */
function judge(result: PerturbationCheckResult): void {
  const reasons = result.reasons;
  const report = result.report;
  if (result.failure) reasons.push(`the check failed at ${result.stage}`);
  if (!report?.fired) reasons.push("the fault never fired");
  if (result.siteTookTheAct !== true) reasons.push("the site does not show the act as taken");
  if (result.coreResult?.status === "succeeded") reasons.push("Core received a successful result, so the outcome was not lost");
  const events = report?.events ?? [];
  const at = (name: string) => events.find(event => event.event === name)?.atMs;
  if (result.perturbation.kind === "drop-action-result") {
    const armed = events.find(event => event.event === "fault.armed")?.detail?.commandId;
    const dropped = events.find(event => event.event === "fault.fired")?.detail?.commandId;
    if (armed === undefined || armed !== dropped) reasons.push("the dropped result is not the armed committing act's");
  } else {
    const sent = at("site-request.sent");
    const stopped = at("worker.stopped");
    if (sent === undefined || stopped === undefined || stopped < sent) reasons.push("the worker was not stopped after the site received the act's request");
    // The stop is proven only by a worker with a new global scope answering, never by the close call alone (`../stop-service-worker.ts`).
    if (at("worker.restarted") === undefined) reasons.push("no worker with a new global scope answered after the stop, so the stop is not proven");
    if (at("worker.still-running") !== undefined) reasons.push("the stopped worker still answered after it was closed, so the stop did not take");
  }
  if ((report?.afterFault.length ?? 0) < 1) reasons.push("nothing was read from the extension or Core after the fault");
  result.proven = reasons.length === 0;
}

async function until(predicate: () => boolean, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 200));
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
