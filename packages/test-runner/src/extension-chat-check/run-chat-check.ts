import path from "node:path";
import { defaultLlmModelForProvider } from "@fluxiq-web-extension/test-contracts";
import { removeRunOwnedTopologyState, startTopology, type RunningTopology } from "../coordinator.js";
import { resolveLabPaths } from "../lab-instance/index.js";
import { extensionStatus, pairExtensionWithColdEpochRecovery, runtimeMessage } from "../run-lifecycle/index.js";
import { assertRealisticScenarios } from "../realistic-scenarios/index.js";
import { loadScenarioManifest } from "../scenarios.js";
import { saveApprovalFlow, type ApprovalFlow } from "./approval-flow.js";
import { startCoreRecordingProxy, type CoreRecordingProxy } from "./core-recording-proxy.js";
import { chatNetworkPolicy } from "./chat-network-policy.js";
import { evidenceWriter } from "./evidence-writer.js";
import { openChromeChatSession, type WorkerRequest } from "./open-chrome-session.js";
import { openFirefoxChatSession } from "./open-firefox-session.js";
import { proveAskAnswered, proveChatBuild, proveChatRelay, proveApprovedClientAccess, type AskAnswerObservation, type ChatBuildObservation, type ApprovedClientAccessObservation, type ChatRelayObservation } from "./prove/index.js";
import { providerFreeEnvironment, scriptedModelChildEnvironment, scriptedModelKey, startScriptedModelServer, type ScriptedModelServer } from "../attempt-lane/scripted-model/index.js";
import { approvedClientModelScript } from "./model-fixture/index.js";
import { LAB_PROJECT_DOMAIN_ID } from "../flow-lane/index.js";
import { threadReader } from "./thread-reader.js";
import type { Page } from "@playwright/test";
import type { ChatBrowser, ChatBrowserSession, ChatCheckContext } from "./types.js";
import type { ExistingFluxIQControlClient } from "../existing-fluxiq-control.js";

export type ChatCheckOptions = {
  repositoryRoot: string;
  fluxiqRepositoryRoot: string;
  browser: ChatBrowser;
  scenarioId: string;
  /** The page under the scenario's start path the person is on, such as `friends/requests/`. */
  pagePath: string;
  /** Also run claim 3, which saves the approval Flow and asks the chat to run it. */
  ask: boolean;
  /** Also run claim 4: the created-Flow lane's chat stage types a build request into the panel and follows the build (`prove/chat-build.ts`). */
  build?: boolean;
  /** Proves approved-client access through Core's real custody and a provider-free loopback model. */
  modelKey?: boolean;
  evidenceDirectory: string;
  log?: (line: string) => void;
  /** Owned provider-free capture only; never supplied to an existing/user host. */
  hostModulePath?: string;
  prepare?: (input: { topology: RunningTopology; control: ExistingFluxIQControlClient; projectId: string; authorizationPin: string }) => Promise<void>;
  /** Additional read-only protocol proof on this isolated paired context; owns its precise receipts. */
  proof?: (input: { context: ChatCheckContext; control: ExistingFluxIQControlClient; authorizationPin: string; topology: RunningTopology }) => Promise<void>;
};

export type ChatCheckResult = {
  browser: ChatBrowser;
  browserVersion: string | null;
  scenarioId: string;
  pageUrl: string | null;
  panelMode: string | null;
  panelNote: string | null;
  /** How the panel was typed into and pressed: Playwright's trusted input, or script in the panel's own document. */
  panelInput: string | null;
  /** Whether the extension reported the run's project after it was selected: `matches`, `other`, or `unset`. */
  extensionProject: string | null;
  /** What the person did about the scenario's cookie prompt before asking anything. */
  cookiePrompt: string | null;
  /** How far the check got: the last stage it entered. */
  stage: string;
  relay: ChatRelayObservation | null;
  ask: AskAnswerObservation | null;
  build: ChatBuildObservation | null;
  modelKey: ApprovedClientAccessObservation | null;
  flow: ApprovalFlow | null;
  /** The chat-relevant program calls the extension made, as the proxy in front of Core received them. No headers. */
  coreCalls: unknown[];
  failure: string | null;
  evidenceDirectory: string;
};

const RELEVANT = new Set(["open-conversation", "append-turn", "answer-ask"]);

/**
 * Proves the extension chat's relay in a real headed browser without a live provider: an
 * isolated Core, the scenario lab, the extension paired with Core through a
 * recording proxy, and the chat shown the way a person sees it -- Chrome's
 * side panel or Firefox's popup. Every stage is logged and the result says
 * how far it got, so a failure reads as a cause and a distance. Approved-client
 * acceptance uses the product's model binding with a loopback transport fixture.
 */
export async function runExtensionChatCheck(options: ChatCheckOptions): Promise<ChatCheckResult> {
  assertRealisticScenarios([options.scenarioId], "The extension chat check");
  const log = options.log ?? (() => undefined);
  const labPaths = resolveLabPaths(options.repositoryRoot);
  const scenario = await loadScenarioManifest(options.repositoryRoot, options.scenarioId, labPaths.scenarioLabDist);
  const runId = `chat-check-${options.browser}-${Date.now().toString(36)}`;
  let session: ChatBrowserSession | undefined;
  const evidence = evidenceWriter(options.evidenceDirectory, () => session);
  const workerRequests: WorkerRequest[] = [];
  let topology: RunningTopology | undefined;
  let proxy: CoreRecordingProxy | undefined;
  let modelStub: ScriptedModelServer | undefined;
  const modelScript = options.modelKey ? approvedClientModelScript() : undefined;
  const result: ChatCheckResult = { browser: options.browser, browserVersion: null, scenarioId: scenario.id, pageUrl: null, panelMode: null, panelNote: null, panelInput: null, extensionProject: null, cookiePrompt: null, stage: "topology", relay: null, ask: null, build: null, modelKey: null, flow: null, coreCalls: [], failure: null, evidenceDirectory: options.evidenceDirectory };
  const stage = (name: string) => { result.stage = name; log(`[chat-check] ${options.browser}: ${name}`); };
  try {
    if (modelScript) {
      stage("provider-free model transport");
      modelStub = await startScriptedModelServer({ script: modelScript.script, key: scriptedModelKey() });
    }
    topology = await startTopology({
      repositoryRoot: options.repositoryRoot,
      fluxiqRepositoryRoot: options.fluxiqRepositoryRoot,
      runsDirectory: path.join(labPaths.runsDirectory, ".chat-check-work"),
      runId,
      seed: scenario.seed,
      target: { mode: "isolated" },
      scenarioEntrypoint: labPaths.scenarioEntrypoint,
      hostModulePath: options.hostModulePath ?? labPaths.hostModulePath,
      prepareHost: false,
      bootstrapIdentity: true,
      ...(modelStub ? { environment: scriptedModelChildEnvironment(process.env, modelStub.origin), modelProvidersEnabled: true, args: ["--llm-provider", "anthropic", "--llm-model", defaultLlmModelForProvider("anthropic")] } : { environment: providerFreeEnvironment(process.env), modelProvidersEnabled: false }),
    });
    const control = topology.control;
    const projectId = topology.projectId;
    const authorizationPin = topology.authorizationPin;
    if (!control || !projectId || !authorizationPin || !topology.gatewayUrl) throw new Error("The isolated Core started without a signed-in control, a project, a PIN or a gateway");
    await options.prepare?.({ topology, control, projectId, authorizationPin });
    stage("recording proxy");
    proxy = await startCoreRecordingProxy(topology.fluxiqOrigin);
    if (options.ask) {
      stage("save approval flow");
      result.flow = await saveApprovalFlow(control, { projectId, authorizationPin });
    }
    const pageUrl = new URL(options.pagePath, `${topology.scenarioOrigin}${scenario.startPath}`).href;
    result.pageUrl = pageUrl;
    stage(`open ${options.browser}`);
    const policy = chatNetworkPolicy(topology, proxy.origin);
    session = options.browser === "chrome"
      ? await openChromeChatSession({ topology, extensionPath: labPaths.extensionPath, scenarioUrl: pageUrl, workerRequests, policy, addresses: { gatewayUrl: topology.gatewayUrl, coreApiUrl: proxy.origin } })
      : await openFirefoxChatSession({ profileDir: path.join(topology.allocation.runRoot, "firefox-profile"), addonPath: path.join(options.repositoryRoot, "apps", "extension", "dist", "firefox"), scenarioUrl: pageUrl, policy });
    result.browserVersion = session.browserVersion;
    stage("pair");
    const page = session.control;
    const gatewayUrl = topology.gatewayUrl;
    const coreApiUrl = proxy.origin;
    const paired = await pairExtensionWithColdEpochRecovery({
      connect: async () => (await runtimeMessage(page, { type: "fluxiq.connect", settings: { gatewayUrl, coreApiUrl, autoReconnect: true, captureMutations: true, captureInputValues: true, captureSnapshots: true } })).status,
      readStatus: () => extensionStatus(page),
      approvePairing: referenceCode => control.approvePairing(referenceCode),
    });
    log(`[chat-check] paired: connectionState ${String(paired.connectionState)}, project ${typeof (paired as { projectId?: unknown }).projectId === "string" ? "set" : "unset"}`);
    stage("select project");
    await control.selectProject(projectId);
    result.extensionProject = await extensionProject(page, projectId);
    log(`[chat-check] extension project after selecting it: ${result.extensionProject}`);
    stage("dismiss cookie prompt");
    result.cookiePrompt = await declineCookiePrompt(session.scenario);
    stage("open panel");
    await session.openPanel();
    result.panelMode = session.panelMode ?? null;
    result.panelNote = session.panelNote ?? null;
    result.panelInput = session.panel?.input ?? null;
    await session.scenario.bringToFront();
    await evidence.shot("panel-open");
    const context: ChatCheckContext = {
      session,
      projectId,
      coreCalls: () => proxy!.calls(),
      ...(options.browser === "chrome" ? { workerRequests: () => workerRequests } : {}),
      reader: threadReader(control, projectId),
      evidence,
      log,
    };
    if (options.modelKey) {
      stage("claim approved-client model access");
      const owned = topology;
      if (!modelStub || !modelScript) throw new Error("Approved-client acceptance has no provider-free model transport.");
      result.modelKey = await proveApprovedClientAccess(context, {
        gatewaySnapshot: () => control.gatewaySnapshot(),
        restartCore: () => owned.restartCore!(),
        signOut: () => control.signOut(),
        signIn: async () => {
          await control.reauthenticate();
          return control.sessionCookieValue();
        },
        configureKey: async () => {
          await control.secretKeysCall("create-key", { name: "Approved-client fixture", value: scriptedModelKey(), kind: "llm", provider: "anthropic", authorizationPassword: owned.authorizationPassword ?? "", authorizationPin });
        },
        writePanelTurn: async (conversationId, text) => { await control.automationStudioCall("append-turn", { projectId, conversationId, text }, {}, LAB_PROJECT_DOMAIN_ID); },
        selectProject: () => control.selectProject(projectId),
        model: { calls: () => modelStub!.calls(), receipts: modelScript.receipts },
        fluxiqOrigin: owned.fluxiqOrigin,
        gatewayUrl: owned.gatewayUrl!,
        coreApiUrl: proxy.origin,
      });
    } else {
      stage("claim relay");
      result.relay = await proveChatRelay(context, { message: "What can you do?", expectedPageUrl: pageUrl });
      await evidence.shot("relay-answered");
    }
    if (options.proof) {
      stage("additional protocol proof");
      await options.proof({ context, control, authorizationPin, topology });
    }
    if (options.ask && result.flow && !options.modelKey) {
      stage("claim ask");
      result.ask = await proveAskAnswered(context, { flow: result.flow, screenshot: name => evidence.shot(name) });
      await evidence.shot("ask-settled");
    }
    if (options.build) {
      stage("claim build");
      result.build = await proveChatBuild(context, { control, screenshot: name => evidence.shot(name) });
    }
    stage("network guard");
    session.guard.assertNoViolations();
    stage("done");
  } catch (error) {
    result.failure = error instanceof Error ? `${error.message}${error.stack ? `\n${error.stack.split("\n").slice(1, 6).join("\n")}` : ""}` : String(error);
    log(`[chat-check] ${options.browser} failed at ${result.stage}: ${result.failure.split("\n")[0]}`);
    await evidence.shot(`failed-at-${result.stage.replace(/[^a-z0-9]+/giu, "-")}`).catch(/* best-effort: the failure itself is already recorded in the result */ () => undefined);
  } finally {
    result.coreCalls = (proxy?.calls() ?? []).filter(call => call.endpoint !== null && RELEVANT.has(call.endpoint));
    await evidence.json(`result-${options.browser}`, result).catch((error: unknown) => log(`[chat-check] the result could not be written: ${error instanceof Error ? error.message : String(error)}`));
    await session?.close().catch(/* best-effort: cleanup after the result is written */ () => undefined);
    await proxy?.close().catch(/* best-effort: cleanup after the result is written */ () => undefined);
    await topology?.close().catch(/* best-effort: cleanup after the result is written */ () => undefined);
    await modelStub?.close().catch(/* best-effort: cleanup after the result is written */ () => undefined);
    if (topology) await removeRunOwnedTopologyState(topology).catch(/* best-effort: run-owned state is disposable and pruned later */ () => undefined);
  }
  return result;
}

/** Polls the extension's status until it names the selected project, and says what it named. */
async function extensionProject(page: Page, projectId: string): Promise<string> {
  const deadline = Date.now() + 15_000;
  let named: unknown;
  for (;;) {
    named = ((await extensionStatus(page)) as { projectId?: unknown } | undefined)?.projectId;
    if (named === projectId) return "matches";
    if (Date.now() >= deadline) return typeof named === "string" ? "other" : "unset";
    await new Promise(resolve => setTimeout(resolve, 300));
  }
}

/**
 * A person answers the site's own cookie prompt before doing anything else on
 * it; left up, its scrim covers the page the Flow later presses a button on.
 * The optional cookies are declined, the answer that commits nothing.
 */
async function declineCookiePrompt(scenario: Page): Promise<string> {
  const decline = scenario.getByText("Decline optional cookies", { exact: true }).first();
  const shown = await decline.waitFor({ state: "visible", timeout: 5_000 }).then(() => true, () => false);
  if (!shown) return "none shown";
  await decline.click();
  return "declined optional cookies";
}
