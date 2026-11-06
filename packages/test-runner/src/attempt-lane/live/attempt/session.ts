import path from "node:path";
import { removeRunOwnedTopologyState, startTopology, type RunningTopology } from "../../../coordinator.js";
import { chatNetworkPolicy, openChromeChatSession, sendChatMessage, startCoreRecordingProxy, type ChatBrowserSession, type ChatCheckContext, type CoreRecordingProxy, type WorkerRequest } from "../../../extension-chat-check/index.js";
import type { ExistingFluxIQControlClient } from "../../../existing-fluxiq-control.js";
import { RunnerFailure } from "../../../failure.js";
import { resolveLabPaths } from "../../../lab-instance/index.js";
import { extensionStatus, pairExtensionWithColdEpochRecovery, runtimeMessage } from "../../../run-lifecycle/index.js";
import { attemptStartupLogs } from "./startup-logs.js";

/** A Core of this run's own, the real extension paired with it, and the real chat beside the page, visible. */
export type LiveAttemptSession = {
  topology: RunningTopology;
  control: ExistingFluxIQControlClient;
  projectId: string;
  browser: ChatBrowserSession;
  /** Types into the real chat and answers the thread the extension sent it to. */
  send(text: string): Promise<{ conversationId: string }>;
  close(): Promise<void>;
};

export type LiveAttemptSessionInput = {
  repositoryRoot: string;
  fluxiqRepositoryRoot: string;
  runsDirectory: string;
  runId: string;
  seed: number;
  /** Where the scenario opens, from the fixture's origin. */
  startPath: string;
  /** The Core child's own environment and arguments, which is where a scripted model's wrapper and a run's ceiling reach it. */
  environment: NodeJS.ProcessEnv;
  args: readonly string[];
  stepLogDirectory?: string;
  /** Where a failed startup's process logs are kept, in the run's own folder (`./startup-logs.ts`). */
  startupLogsDirectory?: string;
  /** The most model calls the run typed, for a run that typed one. */
  buildCallLimit?: number;
  /** Called once Core and the extension stand and before the chat opens: where a run's key goes into Secret Keys. */
  authorize(topology: RunningTopology, control: ExistingFluxIQControlClient): Promise<void>;
  log?: (line: string) => void;
};

/**
 * Starts everything an attempt needs, as the chat check starts it and in the created-Flow
 * lane's order: Core, the fixture, a headed Chrome with the extension on the scenario's
 * page, pairing through the real approval, then the run's key, then the side panel.
 * Everything it started goes on any failure, and with `close`.
 */
export async function openLiveAttemptSession(input: LiveAttemptSessionInput): Promise<LiveAttemptSession> {
  const paths = resolveLabPaths(input.repositoryRoot, input.environment);
  const log = input.log ?? (() => undefined);
  let topology: RunningTopology | undefined;
  let proxy: CoreRecordingProxy | undefined;
  let browser: ChatBrowserSession | undefined;
  const startupLogs = input.startupLogsDirectory === undefined ? undefined : attemptStartupLogs(input.startupLogsDirectory);
  const close = async (): Promise<void> => {
    await browser?.close().catch(/* best-effort: the result is written */ () => undefined);
    await proxy?.close().catch(/* best-effort: the result is written */ () => undefined);
    await topology?.close().catch(/* best-effort: the result is written */ () => undefined);
    if (topology) await removeRunOwnedTopologyState(topology).catch(/* best-effort: run-owned state is disposable and pruned later */ () => undefined);
  };
  try {
    log("[attempt] starting an isolated Core");
    topology = await startTopology({
      repositoryRoot: input.repositoryRoot, fluxiqRepositoryRoot: input.fluxiqRepositoryRoot,
      runsDirectory: path.join(input.runsDirectory, ".attempt-work"),
      runId: input.runId, seed: input.seed, target: { mode: "isolated" },
      environment: input.environment, args: input.args,
      scenarioEntrypoint: paths.scenarioEntrypoint, hostModulePath: paths.hostModulePath,
      ...(paths.hostPrebuilt ? { prepareHost: false } : {}),
      ...(input.stepLogDirectory ? { stepLogDirectory: input.stepLogDirectory } : {}),
      ...(input.buildCallLimit === undefined ? {} : { buildCallLimit: input.buildCallLimit }),
      bootstrapIdentity: true,
      ...(startupLogs ? { copyStartupFailureLogs: startupLogs.copy } : {}),
    });
    const { control, projectId, gatewayUrl } = topology;
    if (!control || !projectId || !gatewayUrl) throw new RunnerFailure("environment.missing", "The isolated Core started without a signed-in control, a project or a gateway");
    proxy = await startCoreRecordingProxy(topology.fluxiqOrigin);
    const workerRequests: WorkerRequest[] = [];
    log("[attempt] opening a visible Chrome with the extension");
    browser = await openChromeChatSession({ topology, extensionPath: paths.extensionPath, scenarioUrl: `${topology.scenarioOrigin}${input.startPath}`, workerRequests, policy: chatNetworkPolicy(topology, proxy.origin) });
    const page = browser.control, coreApiUrl = proxy.origin;
    await pairExtensionWithColdEpochRecovery({
      connect: async () => (await runtimeMessage(page, { type: "fluxiq.connect", settings: { gatewayUrl, coreApiUrl, autoReconnect: true, captureMutations: true, captureInputValues: true, captureSnapshots: true } })).status,
      readStatus: () => extensionStatus(page),
      approvePairing: (referenceCode) => control.approvePairing(referenceCode),
    });
    await input.authorize(topology, control);
    await control.selectProject(projectId);
    await browser.openPanel();
    const panel = browser.panel;
    if (!panel) throw new RunnerFailure("environment.missing", "The side panel opened with nothing to type in");
    const scope = await panel.selectProject(projectId);
    if (!scope.composerAvailable) throw new RunnerFailure("gateway.connection", `The chat opened on this run's project with no composer: its scope stood at ${scope.scopeState ?? "unknown"}`);
    log(`[attempt] the chat is open: ${browser.panelMode ?? "unknown"}, ${panel.input} input`);
    const session = browser, recording = proxy, running = topology;
    const chatContext = { session, coreCalls: () => recording.calls() } as unknown as ChatCheckContext;
    return {
      topology: running, control, projectId, browser: session,
      send: async (text) => {
        await session.scenario.bringToFront().catch(/* best-effort: typing does not depend on which tab is in front */ () => undefined);
        const { conversationId } = await sendChatMessage(chatContext, text);
        return { conversationId };
      },
      close,
    };
  } catch (error) {
    await close();
    throw startupLogs ? startupLogs.named(error) : error;
  }
}
