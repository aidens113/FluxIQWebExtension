import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { resolveScenarioWorkflow, type AttemptSeries } from "@fluxiq-web-extension/test-contracts";
import { removeRunOwnedTopologyState, startTopology, type RunningTopology } from "../coordinator.js";
import { chatNetworkPolicy, openChromeChatSession, sendChatMessage, startCoreRecordingProxy, type ChatBrowserSession, type ChatCheckContext, type CoreRecordingProxy, type WorkerRequest } from "../extension-chat-check/index.js";
import { loadLiveInstructionTasks, resetScenarioLab, resolveCreatedFlowRequest, selectLiveInstructionTask } from "../flow-lane/index.js";
import { resolveLabPaths } from "../lab-instance/index.js";
import { assertRealisticScenarios } from "../realistic-scenarios/index.js";
import { extensionStatus, pairExtensionWithColdEpochRecovery, runtimeMessage } from "../run-lifecycle/index.js";
import { loadScenarioManifest } from "../scenarios.js";
import type { AttemptTask } from "./driver.js";
import { openGuardedLabTab } from "./open-guarded-lab-tab.js";
import { renderAttemptSeries } from "./report.js";
import { runAttemptSeries, type AttemptSeriesResult } from "./run-attempt-series.js";
import { scriptedAttemptDriver, type ScriptedDoubleAct, type ScriptedDriverInput } from "./scripted/index.js";
import { scriptedWorkspace } from "./scripted/index.js";

export type AttemptProofOptions = {
  repositoryRoot: string;
  fluxiqRepositoryRoot: string;
  scenarioId: string;
  taskId: string;
  /** Where the act is doubled in the wrong-answer scene, and the steps that double it on the real site. */
  doubleAct: ScriptedDoubleAct;
  evidenceDirectory: string;
  /**
   * Types each attempt's instruction into the real extension chat of a real isolated
   * Core, with no model key, so the start is the product's. Without it the lane opens
   * the site in a visible browser alone.
   */
  fromChat: boolean;
  log?: (line: string) => void;
};

/** Each claim the proof makes, separately, so a failure names which. */
export type AttemptProofChecks = {
  rightWithNoFlowPromoted: boolean;
  wrongWithRepeatedAct: boolean;
  repeatedActNamed: boolean;
  rightButNotShownFails: boolean;
  secondStartedFromFirst: boolean;
  secondSpentLess: boolean;
  secondRight: boolean;
};

export type AttemptProofResult = {
  entry: "real-extension-chat" | "site-only";
  chatTurns: { attempt: string; conversationId: string; status: number | null }[];
  series: AttemptSeries;
  doubled: AttemptSeries;
  silent: AttemptSeries;
  wrongBecause: { doubled: readonly string[]; silent: readonly string[] };
  continuationRefused: readonly string[];
  checks: AttemptProofChecks;
  held: boolean;
};

const LAB_TOKEN = "attempt-proof-scenario-token";

type ProofSession = {
  origin: string;
  runToken: string;
  openTab: ScriptedDriverInput["openTab"];
  sendToChat?: (scene: string, instruction: string, ordinal: number) => Promise<void>;
  close(): Promise<void>;
};

/** The site alone: the real fixture in a visible browser. */
async function siteOnlySession(options: AttemptProofOptions, seed: number): Promise<ProofSession> {
  const paths = resolveLabPaths(options.repositoryRoot);
  const server = await import(pathToFileURL(path.join(paths.scenarioLabDist, "server.js")).href) as { startScenarioLab(input: { runToken: string; seed: number }): Promise<{ origin: string; close(): Promise<void> }> };
  const lab = await server.startScenarioLab({ runToken: LAB_TOKEN, seed });
  const tabs = new Set<{ close(): Promise<void> }>();
  return {
    origin: lab.origin,
    runToken: LAB_TOKEN,
    openTab: async () => {
      const tab = await openGuardedLabTab({ origin: lab.origin, token: LAB_TOKEN });
      tabs.add(tab);
      const close = async () => {
        tabs.delete(tab);
        await tab.close();
      };
      return { context: tab.context, page: tab.page, close };
    },
    close: async () => {
      for (const tab of [...tabs]) await tab.close();
      await lab.close().catch(/* best-effort: the result is written */ () => undefined);
    },
  };
}

/** A real isolated Core with no model key, the extension paired with it, and the chat beside the page, as the chat check starts them. */
async function realChatSession(options: AttemptProofOptions, seed: number, runId: string, scenarioStartUrl: (origin: string) => string, chatTurns: AttemptProofResult["chatTurns"]): Promise<ProofSession> {
  const paths = resolveLabPaths(options.repositoryRoot);
  const log = options.log ?? (() => undefined);
  let topology: RunningTopology | undefined;
  let proxy: CoreRecordingProxy | undefined;
  let session: ChatBrowserSession | undefined;
  const close = async () => {
    await session?.close().catch(/* best-effort: the result is written */ () => undefined);
    await proxy?.close().catch(/* best-effort: the result is written */ () => undefined);
    await topology?.close().catch(/* best-effort: the result is written */ () => undefined);
    if (topology) await removeRunOwnedTopologyState(topology).catch(/* best-effort: run-owned state is disposable and pruned later */ () => undefined);
  };
  try {
    log("[attempt-proof] starting an isolated Core with no model key");
    topology = await startTopology({ repositoryRoot: options.repositoryRoot, fluxiqRepositoryRoot: options.fluxiqRepositoryRoot, runsDirectory: path.join(paths.runsDirectory, ".chat-check-work"), runId, seed, target: { mode: "isolated" }, scenarioEntrypoint: paths.scenarioEntrypoint, hostModulePath: paths.hostModulePath, prepareHost: false, bootstrapIdentity: true });
    const { control, projectId, gatewayUrl } = topology;
    if (!control || !projectId || !gatewayUrl) throw new Error("The isolated Core started without a signed-in control, a project or a gateway");
    proxy = await startCoreRecordingProxy(topology.fluxiqOrigin);
    const workerRequests: WorkerRequest[] = [];
    const scenarioUrl = scenarioStartUrl(topology.scenarioOrigin);
    log("[attempt-proof] opening Chrome with the extension");
    session = await openChromeChatSession({ topology, extensionPath: paths.extensionPath, scenarioUrl, workerRequests, policy: chatNetworkPolicy(topology, proxy.origin) });
    const page = session.control, coreApiUrl = proxy.origin;
    await pairExtensionWithColdEpochRecovery({
      connect: async () => (await runtimeMessage(page, { type: "fluxiq.connect", settings: { gatewayUrl, coreApiUrl, autoReconnect: true, captureMutations: true, captureInputValues: true, captureSnapshots: true } })).status,
      readStatus: () => extensionStatus(page),
      approvePairing: (referenceCode) => control.approvePairing(referenceCode),
    });
    await control.selectProject(projectId);
    await session.openPanel();
    log(`[attempt-proof] the chat is open: ${session.panelMode ?? "unknown"}`);
    const opened = session, recording = proxy, running = topology;
    const chatContext = { session: opened, coreCalls: () => recording.calls() } as unknown as ChatCheckContext;
    return {
      origin: running.scenarioOrigin,
      runToken: running.allocation.controllerToken,
      openTab: async () => {
        const tab = await opened.context.newPage();
        return { context: opened.context, page: tab, close: () => tab.close() };
      },
      sendToChat: async (scene, instruction, ordinal) => {
        await opened.scenario.bringToFront().catch(/* best-effort: typing does not depend on which tab is in front */ () => undefined);
        const { call, conversationId } = await sendChatMessage(chatContext, instruction);
        chatTurns.push({ attempt: `${scene}-${ordinal}`, conversationId, status: call.status ?? null });
      },
      close,
    };
  } catch (error) {
    await close();
    throw error;
  }
}

/**
 * The Lab lane's done-when, in a visible browser on a realistic site, with no model
 * and no spend: a task scored right with no Flow promoted, wrong with a repeated act,
 * wrong when the right answer never reached the person, and a second attempt on the
 * same workspace that started from the first's draft and spent less.
 *
 * Every act lands on the real fixture and every oracle is the task's own. What Core's
 * attempt loop will do is scripted (`./scripted/`) and named on every row.
 */
export async function runAttemptProof(options: AttemptProofOptions): Promise<AttemptProofResult> {
  assertRealisticScenarios([options.scenarioId], "The attempt lane's proof");
  const log = options.log ?? (() => undefined);
  const paths = resolveLabPaths(options.repositoryRoot);
  const scenario = await loadScenarioManifest(options.repositoryRoot, options.scenarioId, paths.scenarioLabDist);
  const taskDefinition = selectLiveInstructionTask(await loadLiveInstructionTasks(paths.scenarioLabDist), scenario.id, options.taskId);
  const request = resolveCreatedFlowRequest(scenario, taskDefinition);
  const workflow = resolveScenarioWorkflow(scenario, { ...(request.workflowId === undefined ? {} : { workflowId: request.workflowId }), ...(request.variantId === undefined ? {} : { variantId: request.variantId }) });
  const task: AttemptTask = { scenario, request, workflow };
  await mkdir(options.evidenceDirectory, { recursive: true });
  const chatTurns: AttemptProofResult["chatTurns"] = [];
  const session = options.fromChat
    ? await realChatSession(options, scenario.seed, `attempt-proof-${Date.now()}`, (origin) => `${origin}${scenario.startPath}`, chatTurns)
    : await siteOnlySession(options, scenario.seed);
  try {
    const scene = async (name: string, attempts: number, extra: Pick<ScriptedDriverInput, "doubleAct" | "chat">): Promise<AttemptSeriesResult> => {
      log(`[attempt-proof] scene ${name}: ${attempts} attempt(s)`);
      const driver = scriptedAttemptDriver({
        origin: session.origin, runToken: session.runToken, openTab: session.openTab,
        ...(session.sendToChat ? { sendToChat: (instruction: string, ordinal: number) => session.sendToChat!(name, instruction, ordinal) } : {}),
        resetSite: async () => { await resetScenarioLab(session.origin, session.runToken); },
        workspace: scriptedWorkspace(path.join(options.evidenceDirectory, "workspaces", name), `workspace-${name}`),
        picture: async (ordinal, page) => { await page.screenshot({ path: path.join(options.evidenceDirectory, `${name}-attempt-${ordinal}.png`) }).catch(/* best-effort: a picture never decides the proof */ () => undefined); },
        ...extra,
      });
      const result = await runAttemptSeries({ task, driver, attempts });
      log(renderAttemptSeries(result.series));
      return result;
    };
    const series = await scene("right-then-from-draft", 2, {});
    const doubled = await scene("repeated-act", 1, { doubleAct: options.doubleAct });
    const silent = await scene("never-shown", 1, { chat: "silent" });
    const [first, second] = series.series.rows;
    const doubledRow = doubled.series.rows[0]!, silentRow = silent.series.rows[0]!;
    const checks: AttemptProofChecks = {
      rightWithNoFlowPromoted: first?.answerVerdict === "right" && first.flow === "unproven" && first.oracleVerdict === null && first.path === "explore",
      wrongWithRepeatedAct: doubledRow.answerVerdict === "wrong",
      repeatedActNamed: doubledRow.repeatedActs.length > 0 && doubledRow.repeatedActs.every((act) => act.landed > act.asked),
      rightButNotShownFails: silentRow.answerVerdict === "wrong" && silent.outcomes[0]!.answer.wrongBecause.includes("not_shown") && silent.outcomes[0]!.answer.records === "held",
      secondStartedFromFirst: series.continuations[0]?.held === true,
      secondSpentLess: first !== undefined && second !== undefined && second.calls < first.calls && second.inputTokens + second.outputTokens < first.inputTokens + first.outputTokens && second.usd < first.usd,
      secondRight: second?.answerVerdict === "right",
    };
    const result: AttemptProofResult = {
      entry: options.fromChat ? "real-extension-chat" : "site-only",
      chatTurns,
      series: series.series,
      doubled: doubled.series,
      silent: silent.series,
      wrongBecause: { doubled: doubled.outcomes[0]!.answer.wrongBecause, silent: silent.outcomes[0]!.answer.wrongBecause },
      continuationRefused: series.continuations[0]?.refused ?? [],
      checks,
      held: Object.values(checks).every(Boolean),
    };
    await writeFile(path.join(options.evidenceDirectory, "attempt-proof.json"), JSON.stringify(result, null, 2));
    await writeFile(path.join(options.evidenceDirectory, "attempt-proof.txt"), [series.series, doubled.series, silent.series].map(renderAttemptSeries).join("\n\n"));
    return result;
  } finally {
    await session.close();
  }
}
