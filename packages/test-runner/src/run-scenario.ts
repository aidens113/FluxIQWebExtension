import { createHash, randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile, readdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { chromium, type BrowserContext, type Page } from "@playwright/test";
import { assertClonePackage, assertRunManifest, canonicalClonePackageJson, type ClonePackage, type RunManifest, type ScenarioStep, type WebScenario } from "@fluxiq-web-extension/test-contracts";
import { createCorrelationId, EvidenceBundle, EvidenceCaptureController, sha256 } from "@fluxiq-web-extension/test-evidence";
import type { EvidenceMode } from "./commands.js";
import { removeRunOwnedTopologyState, startTopology, type RunningTopology } from "./coordinator.js";
import { classifyRunnerFailure, RunnerFailure } from "./failure.js";
import { WebPanelAuthSessionCache } from "./auth-session.js";
import { ExistingFluxIQControlClient } from "./existing-fluxiq-control.js";
import { executeExistingPersistedFlow, preflightExistingFluxIQ, type ExistingFlowExecution, type ExistingFluxIQPreflight } from "./existing-flow-run.js";
import { installDeterministicNetworkGuard, scenarioNetworkOrigins, type DeterministicNetworkGuard } from "./network-guard.js";
import { verifyAuthenticatedFluxIQPanel, type FluxIQPanelVerificationOutcome } from "./panel-verification.js";
import { assertExpectedFacts, playwrightScenarioFactProbe } from "./scenario-assertions.js";
import { loadScenarioManifest, scenarioRequiresCore } from "./scenarios.js";
import type { FluxIQTargetConfiguration } from "./target-config.js";
import { ClonePackageCache } from "./clone-cache.js";
import { exportClonePackage, exportCloneSource } from "./clone-source-exporter.js";
import {
  classifyCloneDependencies,
  createDeterministicCloneIdMap,
} from "./clone-policy.js";
import { createRunOwnedCloneFlowId, createRunOwnedCloneProject, importClonePackageIntoIsolatedDestination, type IsolatedCloneImportResult } from "./isolated-flow-importer.js";

const execFileAsync = promisify(execFile);
export type RunScenarioOptions = { repositoryRoot: string; fluxiqRepositoryRoot: string; runsDirectory: string; scenarioId: string; seed?: number; evidence: EvidenceMode; environment?: NodeJS.ProcessEnv; target?: FluxIQTargetConfiguration };
export type RunScenarioResult = { runId: string; verdict: "passed" | "failed"; path: string; failureCategory?: string };
type CloneRunState = {
  clonePackage?: ClonePackage;
  clonePackageHash?: string;
  destination?: IsolatedCloneImportResult;
  execution?: ExistingFlowExecution;
  sourceSessionIdentityVerified: boolean;
  sourceHashVerifiedAfterRun: boolean;
  cleanupOutcome: "pending" | "completed" | "failed";
};

export async function runScenario(options: RunScenarioOptions): Promise<RunScenarioResult> {
  const runId = `run-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
  const scenario = await loadScenarioManifest(options.repositoryRoot, options.scenarioId);
  const seed = options.seed ?? scenario.seed;
  const environment = options.environment ?? process.env;
  const secrets = [environment.FLUXIQ_TEST_PASSWORD, environment.FLUXIQ_TEST_PIN, environment.FLUXIQ_TEST_TOTP].filter((value): value is string => Boolean(value));
  const bundle = new EvidenceBundle({ rootDirectory: options.runsDirectory, runId, scenarioId: scenario.id, redaction: { secrets } });
  await bundle.initialize();
  const capture = new EvidenceCaptureController(bundle, {
    screenshots: options.evidence === "checkpoints" ? "checkpoints" : "none",
    maxScreenshots: 100, maxBytes: 25 * 1024 * 1024,
    trace: "off", video: "off",
  });
  const startedAt = new Date().toISOString();
  let topology: RunningTopology | undefined;
  let context: BrowserContext | undefined;
  let extensionPage: Page | undefined;
  let scenarioPage: Page | undefined;
  let networkGuard: DeterministicNetworkGuard | undefined;
  let recordingStarted = false;
  let browserVersion = "unavailable";
  let verdict: "passed" | "failed" = "failed";
  let failureCategory: string | undefined;
  let failureMessage: string | undefined;
  let existingPreflight: ExistingFluxIQPreflight | undefined;
  let existingExecution: ExistingFlowExecution | undefined;
  let panelVerification: FluxIQPanelVerificationOutcome | undefined;
  const target = options.target ?? { mode: "isolated" as const };
  const cloneState: CloneRunState = { sourceSessionIdentityVerified: false, sourceHashVerifiedAfterRun: false, cleanupOutcome: "pending" };
  let topologyStateRemoved = false;
  const extensionPath = path.join(options.repositoryRoot, "apps", "extension", "dist", "e2e-chromium");
  try {
    await requireExtension(extensionPath);
    if (target.mode === "clone") {
      const pendingSuffix = sha256(`${runId}\0${target.source.projectId}\0${target.source.flowId}`).slice(0, 24);
      cloneState.clonePackage = await exportClonePackage(target, {
        destination: { projectId: `project.clone.pending.${pendingSuffix}`, flowId: `flow.clone.pending.${pendingSuffix}` },
        cache: new ClonePackageCache(options.runsDirectory),
        sessionCache: new WebPanelAuthSessionCache(options.runsDirectory),
      });
      cloneState.clonePackageHash = sha256(canonicalClonePackageJson(cloneState.clonePackage));
      if (cloneState.clonePackage.compatibility.verdict !== "compatible") throw new RunnerFailure("environment.missing", "Source Flow dependencies are not safe to clone into isolation");
    }
    const credentials = target.mode === "isolated" || target.mode === "persistent-isolated" ? configuredCredentials(environment) : undefined;
    const topologyTarget = target.mode === "clone" ? { mode: "isolated" as const } : target;
    const topologyRunsDirectory = topologyTarget.mode === "persistent-isolated"
      ? options.runsDirectory
      : path.join(options.runsDirectory, ".work");
    const ownsIsolatedCore = topologyTarget.mode === "isolated" || topologyTarget.mode === "persistent-isolated";
    topology = await startTopology({ repositoryRoot: options.repositoryRoot, fluxiqRepositoryRoot: options.fluxiqRepositoryRoot, runsDirectory: topologyRunsDirectory, runId, seed, target: topologyTarget, ...(ownsIsolatedCore ? { bootstrapIdentity: target.mode === "clone" || scenarioRequiresCore(scenario), ...(credentials ? { credentials } : {}) } : {}) });
    let existingControl: ExistingFluxIQControlClient | undefined;
    if (target.mode === "existing") {
      existingControl = new ExistingFluxIQControlClient(target.baseUrl);
      await existingControl.login({
        username: target.credentials.username,
        password: target.credentials.password,
        pin: target.credentials.authorizationPin,
        ...(target.credentials.totp ? { totp: target.credentials.totp } : {}),
      }, { sessionCache: new WebPanelAuthSessionCache(options.runsDirectory), ...(target.freshLogin ? { freshLogin: true } : {}) });
      existingPreflight = await preflightExistingFluxIQ(existingControl, target);
      topology = { ...topology, gatewayUrl: existingPreflight.gatewayUrl, control: existingControl };
    }
    if (target.mode === "clone") {
      if (!topology.control || !topology.authorizationPin || !cloneState.clonePackage) throw new RunnerFailure("environment.missing", "Isolated clone destination did not provide authenticated Core control");
      const destinationControl = topology.control;
      const destinationDefinitions = await destinationControl.listNativeNodeDefinitions(topology.projectId ?? "");
      const destinationAssessment = classifyCloneDependencies(cloneState.clonePackage.flowDocument, {
        domainNodeDefinitionIds: destinationDefinitions
          .filter(item => item.sourceKind === "importer" && item.sourceDomainId === "web-automation" && !item.externalSideEffect)
          .map(item => item.id),
        nativeNodeDefinitionIds: destinationDefinitions
          .filter(item => item.sourceKind === "builtin" && !item.externalSideEffect)
          .map(item => item.id),
        externalSideEffectNodeDefinitionIds: destinationDefinitions
          .filter(item => item.externalSideEffect || item.sourceKind === "code")
          .map(item => item.id),
        testDoubles: Object.fromEntries(
          cloneState.clonePackage.dependencies
            .filter(item => item.decision === "test-double" && item.replacementId)
            .map(item => [item.referenceId, item.replacementId!]),
        ),
      });
      if (destinationAssessment.compatibility.verdict !== "compatible") {
        throw new RunnerFailure("environment.missing", "Isolated Core does not provide every safe node definition required by the cloned Flow");
      }
      const destinationProject = await createRunOwnedCloneProject(destinationControl, { runId, sourceContentHash: cloneState.clonePackage.source.contentHash, authorizationPin: topology.authorizationPin });
      const destinationFlowId = createRunOwnedCloneFlowId({ runId, sourceProjectId: cloneState.clonePackage.source.projectId, sourceFlowId: cloneState.clonePackage.source.flowId, sourceContentHash: cloneState.clonePackage.source.contentHash });
      cloneState.clonePackage = {
        ...cloneState.clonePackage,
        idMap: createDeterministicCloneIdMap(cloneState.clonePackage.flowDocument, { projectId: destinationProject.projectId, flowId: destinationFlowId }),
      };
      assertClonePackage(cloneState.clonePackage);
      cloneState.clonePackageHash = sha256(canonicalClonePackageJson(cloneState.clonePackage));
      cloneState.destination = await importClonePackageIntoIsolatedDestination(destinationControl, { clonePackage: cloneState.clonePackage, destinationProjectId: destinationProject.projectId, authorizationPin: topology.authorizationPin });
      topology = { ...topology, projectId: cloneState.destination.projectId };
      await destinationControl.selectExistingContext(cloneState.destination.projectId);
      await bundle.writeStructured("snapshots/clone-package.json", cloneState.clonePackage);
      await bundle.writeStructured("snapshots/clone-import.json", { projectId: cloneState.destination.projectId, flowId: cloneState.destination.flowId, contentHash: cloneState.destination.contentHash, clonePackageHash: cloneState.clonePackageHash, attested: cloneState.destination.attested });
    }
    ({ context, browserVersion } = await launchBrowser(topology, extensionPath));
    networkGuard = await installDeterministicNetworkGuard(context, {
      scenarioOrigins: scenarioNetworkOrigins(topology.scenarioOrigin),
      fluxiqOrigins: [topology.fluxiqOrigin],
      ...(topology.gatewayUrl ? { gatewayOrigins: [topology.gatewayUrl] } : {}),
    });
    extensionPage = await extensionControlPage(context);
    browserVersion = await browserVersionFromCdp(context, extensionPage);
    const page = scenarioPage = await context.newPage();
    await page.goto(`${topology.scenarioOrigin}${scenario.startPath}`);
    await page.bringToFront();
    const paired = topology.control ? await pairExtension(extensionPage, topology) : undefined;
    if (paired) await activateScenarioTab(extensionPage, topology.scenarioOrigin);
    const screenshotAdapter = scenario.id === "sensitive-input" ? undefined : { capture: async () => ({ bytes: await page.screenshot({ type: "png" }), mediaType: "image/png" as const, redactionVerified: true as const }) };
    const stepCapture = new EvidenceCaptureController(bundle, {
      screenshots: options.evidence === "events" ? "events" : options.evidence === "checkpoints" ? "checkpoints" : "none",
      maxScreenshots: 100, maxBytes: 25 * 1024 * 1024, trace: "off", video: "off",
    }, screenshotAdapter);
    if (target.mode === "existing") {
      if (!paired || !existingControl || !existingPreflight) throw new RunnerFailure("gateway.pairing", "Existing FluxIQ extension pairing did not produce an executable session");
      await existingControl.selectExistingContext(target.projectId);
      const recordingBaseline = recordingIds(await existingControl.listRecordings(target.projectId));
      await runtimeMessage(extensionPage, { type: "fluxiq.startRecording" });
      recordingStarted = true;
      await capture.trigger({ ...event(runId, scenario.id, undefined, "runtime.dispatch", "Execute configured persisted FluxIQ Flow"), details: { projectId: target.projectId, flowId: target.flowId, flowContentHash: existingPreflight.flow.contentHash } });
      existingExecution = await executeExistingPersistedFlow(existingControl, target, runId, {
        scenarioId: scenario.id,
        scenarioOrigin: topology.scenarioOrigin,
        scenarioUrl: page.url(),
        seed,
        facilityRunId: runId,
      }, scenario.expected.actions ?? []);
      await bundle.writeStructured("snapshots/existing-flow.json", { projectId: target.projectId, flowId: target.flowId, contentHash: existingPreflight.flow.contentHash, name: existingPreflight.flow.name, updatedAt: existingPreflight.flow.updatedAt });
      await bundle.writeStructured("snapshots/runtime-run.json", existingExecution.detail);
      await bundle.writeStructured("snapshots/runtime-actions.json", existingExecution.actions);
      await bundle.writeStructured("snapshots/runtime-events.json", existingExecution.events);
      scenarioPage = await findScenarioPageWithExpectedState(context, page, topology.scenarioOrigin, scenario);
      await runtimeMessage(extensionPage, { type: "fluxiq.stopRecording" });
      recordingStarted = false;
      const outcome = await assertCoreRoundTrip(topology, paired.sessionId, recordingBaseline);
      panelVerification = await verifyAuthenticatedFluxIQPanel({ context, origin: target.baseUrl, sessionCookieValue: existingControl.sessionCookieValue(), projectId: target.projectId, flowId: target.flowId, runId: existingExecution.runId });
      if (panelVerification.status !== "verified") throw new RunnerFailure("runtime.behavior", "FluxIQ panel could not verify the exact persisted Flow run");
      await capture.trigger({ ...event(runId, scenario.id, undefined, "runtime.settle", "Persisted FluxIQ Flow and browser state succeeded"), details: { runtimeRunId: existingExecution.runId, actionCount: existingExecution.actions.length, eventCount: existingExecution.events.length, recordingCount: outcome.recordingCount, panelVerification: panelVerification.status } });
    } else if (target.mode === "clone") {
      if (!paired || !topology.control || !topology.authorizationPin || !cloneState.clonePackage || !cloneState.destination || !cloneState.clonePackageHash) throw new RunnerFailure("gateway.pairing", "Cloned Flow destination is not ready for execution");
      const recordingBaseline = recordingIds(await topology.control.listRecordings(cloneState.destination.projectId));
      await runtimeMessage(extensionPage, { type: "fluxiq.startRecording" });
      recordingStarted = true;
      await capture.trigger({ ...event(runId, scenario.id, undefined, "runtime.dispatch", "Execute cloned Flow in isolated FluxIQ"), details: { sourceProjectId: cloneState.clonePackage.source.projectId, sourceFlowId: cloneState.clonePackage.source.flowId, sourceContentHash: cloneState.clonePackage.source.contentHash, destinationProjectId: cloneState.destination.projectId, destinationFlowId: cloneState.destination.flowId, clonePackageHash: cloneState.clonePackageHash } });
      cloneState.execution = await executeExistingPersistedFlow(topology.control, { projectId: cloneState.destination.projectId, flowId: cloneState.destination.flowId }, runId, {
        scenarioId: scenario.id,
        scenarioOrigin: topology.scenarioOrigin,
        scenarioUrl: page.url(),
        seed,
        facilityRunId: runId,
      }, scenario.expected.actions ?? []);
      await bundle.writeStructured("snapshots/runtime-run.json", cloneState.execution.detail);
      await bundle.writeStructured("snapshots/runtime-actions.json", cloneState.execution.actions);
      await bundle.writeStructured("snapshots/runtime-events.json", cloneState.execution.events);
      scenarioPage = await findScenarioPageWithExpectedState(context, page, topology.scenarioOrigin, scenario);
      await runtimeMessage(extensionPage, { type: "fluxiq.stopRecording" });
      recordingStarted = false;
      const outcome = await assertCoreRoundTrip(topology, paired.sessionId, recordingBaseline);
      panelVerification = await verifyAuthenticatedFluxIQPanel({ context, origin: topology.fluxiqOrigin, sessionCookieValue: topology.control.sessionCookieValue(), projectId: cloneState.destination.projectId, flowId: cloneState.destination.flowId, runId: cloneState.execution.runId });
      if (panelVerification.status !== "verified") throw new RunnerFailure("runtime.behavior", "Isolated FluxIQ panel could not verify the exact cloned Flow run");
      await capture.trigger({ ...event(runId, scenario.id, undefined, "runtime.settle", "Cloned Flow and browser state succeeded in isolation"), details: { runtimeRunId: cloneState.execution.runId, actionCount: cloneState.execution.actions.length, eventCount: cloneState.execution.events.length, recordingCount: outcome.recordingCount, sourceHashUnchanged: true, panelVerification: panelVerification.status } });
    } else {
      if (paired && topology.authorizationPin) await proveCoreActionRoundTrip(page, topology, paired.sessionId, scenario, capture, runId);
      if (topology.control) { await runtimeMessage(extensionPage, { type: "fluxiq.startRecording" }); recordingStarted = true; }
      for (const step of scenario.recordingScript) {
        await stepCapture.trigger(event(runId, scenario.id, step.id, "step.start", `Start ${step.operation}`));
        await executeStep(page, topology.scenarioOrigin, step);
        await stepCapture.trigger(event(runId, scenario.id, step.id, step.operation === "checkpoint" ? "checkpoint" : "step.complete", `Complete ${step.operation}`));
      }
      await assertFinalState(page, scenario);
    }
    if (topology.control && (target.mode === "isolated" || target.mode === "persistent-isolated")) {
      await runtimeMessage(extensionPage, { type: "fluxiq.stopRecording" });
      recordingStarted = false;
      const outcome = await assertCoreRoundTrip(topology, paired?.sessionId);
      await capture.trigger({ ...event(runId, scenario.id, undefined, "gateway.action", "Core gateway retained the paired extension session"), details: { sessionCount: outcome.sessionCount } });
      await capture.trigger({ ...event(runId, scenario.id, undefined, "runtime.settle", "Core persisted the completed recording"), details: { recordingCount: outcome.recordingCount, projectId: topology.projectId } });
    }
    networkGuard.assertNoViolations();
    await capture.trigger(event(runId, scenario.id, undefined, "final", "Scenario completed"));
    verdict = "passed";
  } catch (error) {
    failureCategory = classifyRunnerFailure(error);
    failureMessage = error instanceof Error ? error.message : String(error);
    const failureEvent = { ...event(runId, scenario.id, undefined, "error", failureMessage), details: { failureCategory } };
    if (options.evidence !== "none" && scenario.id !== "sensitive-input" && scenarioPage) {
      const bytes = await scenarioPage.screenshot({ type: "png" });
      const digest = sha256(bytes);
      const artifactPath = `screenshots/failure-${digest.slice(0, 12)}.png`;
      await bundle.writeVerifiedVisual(artifactPath, { bytes, mediaType: "image/png", redactionVerified: true });
      await bundle.appendEvent({ ...failureEvent, screenshot: { path: artifactPath, sha256: digest } });
    } else await capture.trigger(failureEvent).catch(() => undefined);
  } finally {
    if (recordingStarted && extensionPage) await runtimeMessage(extensionPage, { type: "fluxiq.stopRecording" }).catch(() => undefined);
    if (target.mode === "clone" && cloneState.clonePackage) {
      try {
        const verificationTarget = target.freshLogin ? { mode: "clone" as const, source: target.source } : target;
        const sourceAfter = await exportCloneSource(verificationTarget, { sessionCache: new WebPanelAuthSessionCache(options.runsDirectory) });
        cloneState.sourceSessionIdentityVerified = sourceAfter.sessionIdentityVerified;
        if (sourceAfter.source.contentHash !== cloneState.clonePackage.source.contentHash) throw new RunnerFailure("runtime.behavior", "Source Flow changed while its isolated clone was running");
        cloneState.sourceHashVerifiedAfterRun = true;
      } catch (error) {
        verdict = "failed";
        failureCategory = classifyRunnerFailure(error);
        failureMessage = `Clone source post-run verification failed: ${error instanceof Error ? error.message : String(error)}`;
        await capture.trigger({ ...event(runId, scenario.id, undefined, "error", failureMessage), details: { failureCategory } }).catch(() => undefined);
      }
    }
    try { await context?.close(); }
    catch (error) { verdict = "failed"; failureCategory = "process.startup"; failureMessage = `Browser cleanup failed: ${String(error)}`; }
    try { await topology?.close(); }
    catch (error) { verdict = "failed"; failureCategory = "process.startup"; failureMessage = `Process cleanup failed: ${String(error)}`; }
    if (failureMessage && !bundle.getEvents().some(item => item.trigger === "error" && item.summary === failureMessage)) {
      await capture.trigger({ ...event(runId, scenario.id, undefined, "error", failureMessage), details: { failureCategory } }).catch(() => undefined);
    }
    if (topology) await copyProcessLogs(bundle, topology.allocation.logsDir);
    if (target.mode === "clone" && topology) {
      try {
        await removeRunOwnedTopologyState(topology);
        topologyStateRemoved = true;
        cloneState.cleanupOutcome = "completed";
      } catch (error) {
        verdict = "failed";
        failureCategory = "process.startup";
        failureMessage = `Clone destination cleanup failed: ${String(error)}`;
        cloneState.cleanupOutcome = "failed";
        await capture.trigger({ ...event(runId, scenario.id, undefined, "error", failureMessage), details: { failureCategory } }).catch(() => undefined);
      }
    }
    if (target.mode === "clone" && !topology) cloneState.cleanupOutcome = "completed";
  }
  try {
    const manifest = await createManifest(options, scenario, runId, seed, startedAt, verdict, browserVersion, extensionPath, topology, existingPreflight, existingExecution, panelVerification, cloneState);
    assertRunManifest(manifest);
    await bundle.writeStructured("run.json", manifest);
    const finalized = await bundle.finalize({ verdict, metrics: { steps: scenario.recordingScript.length } });
    return { runId, verdict, path: finalized.path, ...(failureCategory ? { failureCategory } : {}) };
  } finally {
    if (topology && !topologyStateRemoved) await removeRunOwnedTopologyState(topology).catch(() => undefined);
  }
}

function configuredCredentials(environment: NodeJS.ProcessEnv) { const username = environment.FLUXIQ_TEST_USERNAME; const password = environment.FLUXIQ_TEST_PASSWORD; return username && password ? { username, password, ...(environment.FLUXIQ_TEST_TOTP ? { totp: environment.FLUXIQ_TEST_TOTP } : {}), ...(environment.FLUXIQ_TEST_PIN ? { pin: environment.FLUXIQ_TEST_PIN } : {}) } : undefined; }
async function requireExtension(extensionPath: string) { try { await stat(path.join(extensionPath, "manifest.json")); } catch (cause) { throw new RunnerFailure("environment.missing", `Built E2E extension is missing: ${extensionPath}`, { cause }); } }

async function launchBrowser(topology: RunningTopology, extensionPath: string) {
  const context = await chromium.launchPersistentContext(topology.allocation.browserProfileDir, { headless: false, locale: "en-US", timezoneId: "UTC", viewport: { width: 1280, height: 720 }, colorScheme: "light", args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, "--no-first-run", "--disable-default-apps"] });
  return { context, browserVersion: context.browser()?.version() ?? "chromium" };
}
async function extensionControlPage(context: BrowserContext): Promise<Page> { const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker", { timeout: 10_000 }); const id = new URL(worker.url()).hostname; const page = await context.newPage(); await page.goto(`chrome-extension://${id}/sidepanel/index.html`); return page; }
async function pairExtension(page: Page, topology: RunningTopology) {
  await runtimeMessage(page, { type: "fluxiq.connect", settings: { gatewayUrl: topology.gatewayUrl, coreApiUrl: topology.fluxiqOrigin, autoReconnect: true, captureMutations: true, captureInputValues: true, captureSnapshots: true } });
  const status = await pollStatus(page, value => (value.connectionState === "pairing" && typeof value.pairingReferenceCode === "string") || (value.connectionState === "connected" && typeof value.sessionId === "string"));
  if (status.connectionState === "connected") return status;
  await topology.control!.approvePairing(String(status.pairingReferenceCode));
  return pollStatus(page, value => value.connectionState === "connected" && typeof value.sessionId === "string");
}
async function proveCoreActionRoundTrip(page: Page, topology: RunningTopology, sessionId: string, scenario: WebScenario, capture: EvidenceCaptureController, runId: string) {
  const step = scenario.recordingScript.find(candidate => candidate.operation === "type" && candidate.target);
  if (!step?.target) return;
  const target = selector(step.target); const correlationId = createCorrelationId("command"); const text = "FluxIQ Core probe";
  const navigationCorrelationId = createCorrelationId("command");
  const automationPagePromise = page.context().waitForEvent("page", { timeout: 10_000 });
  await capture.trigger({ ...event(runId, scenario.id, step.id, "runtime.dispatch", "Initialize the extension automation tab through Core"), details: { correlationId: navigationCorrelationId, actionType: "web.browser.navigate", url: page.url() } });
  const navigationResponse = await topology.control!.executeClientAction(sessionId, { actionType: "web.browser.navigate", parameters: { url: page.url() }, metadata: { correlationId: navigationCorrelationId } }, topology.authorizationPin!) as any;
  const navigationResult = navigationResponse?.payload?.result;
  if (navigationResult?.status !== "succeeded") throw new RunnerFailure("action.dispatch", `Core navigation did not succeed: ${String(navigationResult?.status ?? "missing result")}: ${String(navigationResult?.message ?? navigationResult?.error ?? "no error detail")}`);
  const automationPage = await automationPagePromise;
  await automationPage.waitForLoadState("domcontentloaded");
  await capture.trigger({ ...event(runId, scenario.id, step.id, "runtime.settle", "Core navigation initialized the extension automation tab"), details: { correlationId: navigationCorrelationId, commandId: navigationResult.commandId, status: navigationResult.status, url: automationPage.url() } });
  await capture.trigger({ ...event(runId, scenario.id, step.id, "runtime.dispatch", "Dispatch Core action through the production gateway"), details: { correlationId, actionType: "web.dom.type", target } });
  const response = await topology.control!.executeClientAction(sessionId, { actionType: "web.dom.type", parameters: { selector: target, text }, metadata: { correlationId } }, topology.authorizationPin!) as any;
  const result = response?.payload?.result;
  if (result?.status !== "succeeded") {
    await capture.trigger({ ...event(runId, scenario.id, step.id, "runtime.settle", "Core action returned a failed result"), details: { correlationId, commandId: result?.commandId, status: result?.status, message: result?.message ?? result?.error } });
    throw new RunnerFailure("action.dispatch", `Core action did not succeed: ${String(result?.status ?? "missing result")}: ${String(result?.message ?? result?.error ?? "no error detail")}`);
  }
  if (await automationPage.locator(target).inputValue() !== text) throw new RunnerFailure("runtime.behavior", "Core action result did not reach page state");
  await capture.trigger({ ...event(runId, scenario.id, step.id, "runtime.settle", "Core action reached the expected page state"), details: { correlationId, commandId: result.commandId, status: result.status } });
  await automationPage.close();
}
async function browserVersionFromCdp(context: BrowserContext, page: Page): Promise<string> { const session = await context.newCDPSession(page); try { const result = await session.send("Browser.getVersion"); return result.product || result.userAgent; } finally { await session.detach(); } }
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
async function assertCoreRoundTrip(topology: RunningTopology, expectedSessionId?: string, recordingBaseline?: Set<string>) {
  const snapshot = await topology.control!.gatewaySnapshot() as any;
  const sessions = snapshot?.payload?.sessions;
  if (!Array.isArray(sessions) || !sessions.some((session: any) => (session.status === "ready" || session.status === "connected") && (!expectedSessionId || session.sessionId === expectedSessionId))) throw new RunnerFailure("gateway.connection", "Core gateway snapshot has no matching paired extension session");
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const response = await topology.control!.listRecordings(topology.projectId!) as any;
    const ids = recordingIds(response);
    const newRecordingIds = recordingBaseline ? [...ids].filter(id => !recordingBaseline.has(id)) : [...ids];
    if (newRecordingIds.length) return { sessionCount: sessions.length, recordingCount: ids.size, newRecordingCount: newRecordingIds.length };
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new RunnerFailure("recording.persistence", recordingBaseline ? "Core did not persist a new recording for the completed existing-Flow scenario" : "Core did not persist a recording for the completed scenario");
}
function recordingIds(response: any): Set<string> { const values = response?.payload?.recordings ?? response?.payload?.items ?? response?.payload; if (!Array.isArray(values)) return new Set(); return new Set(values.flatMap((item: any) => { const id = item?.recordingId ?? item?.id; return typeof id === "string" && id ? [id] : []; })); }
async function runtimeMessage(page: Page, message: Record<string, unknown>): Promise<any> { const response = await page.evaluate((value: Record<string, unknown>) => (globalThis as any).chrome.runtime.sendMessage(value), message); if (!response?.ok) throw new RunnerFailure("extension.worker", response?.error ?? "Extension runtime message failed"); return response; }
async function pollStatus(page: Page, predicate: (value: any) => boolean): Promise<any> { const deadline = Date.now() + 15_000; while (Date.now() < deadline) { const response = await runtimeMessage(page, { type: "fluxiq.getStatus" }); if (predicate(response.status)) return response.status; await new Promise(resolve => setTimeout(resolve, 100)); } throw new RunnerFailure("gateway.connection", "Timed out waiting for extension connection state"); }
function selector(target?: string): string { if (!target) throw new RunnerFailure("fixture.invalid", "Scenario step target is required"); return target.startsWith("testid:") ? `[data-testid=${JSON.stringify(target.slice(7))}]` : target; }
async function executeStep(page: Page, origin: string, step: ScenarioStep) { if (step.operation === "click") return page.locator(selector(step.target)).click(); if (step.operation === "type") return page.locator(selector(step.target)).fill(String(step.value ?? "")); if (step.operation === "select") return page.locator(selector(step.target)).selectOption(String(step.value ?? "")); if (step.operation === "scroll") return page.mouse.wheel(0, Number(step.value ?? 500)); if (step.operation === "navigate") return page.goto(`${origin}${step.path ?? "/"}`); if (step.operation === "waitForState") return page.locator(selector(step.target)).waitFor({ state: "visible", ...(step.timeoutMs === undefined ? {} : { timeout: step.timeoutMs }) }); }
async function assertFinalState(page: Page, scenario: WebScenario) { await assertExpectedFacts(scenario.expected.finalState ?? [], playwrightScenarioFactProbe(page)); }
async function findScenarioPageWithExpectedState(context: BrowserContext, fallback: Page, origin: string, scenario: WebScenario): Promise<Page> { for (const candidate of context.pages().filter(item => !item.isClosed() && item.url().startsWith(`${origin}/`)).reverse()) { try { await assertFinalState(candidate, scenario); return candidate; } catch {} } await assertFinalState(fallback, scenario); return fallback; }
function event(runId: string, scenarioId: string, stepId: string | undefined, trigger: "step.start" | "step.complete" | "gateway.action" | "runtime.dispatch" | "runtime.settle" | "checkpoint" | "error" | "final", summary: string) { return { trigger, summary, correlation: { runId, scenarioId, ...(stepId ? { stepId } : {}), correlationId: createCorrelationId() } }; }

async function createManifest(options: RunScenarioOptions, scenario: WebScenario, runId: string, seed: number, startedAt: string, verdict: "passed" | "failed", browserVersion: string, extensionPath: string, topology?: RunningTopology, existingPreflight?: ExistingFluxIQPreflight, existingExecution?: ExistingFlowExecution, panelVerification?: FluxIQPanelVerificationOutcome, cloneState?: CloneRunState): Promise<RunManifest> {
  const manifest = JSON.parse(await readFile(path.join(extensionPath, "manifest.json"), "utf8")) as { version: string };
  const fluxiqExecution = options.target?.mode === "clone" && cloneState
    ? cloneExecutionMetadata(cloneState, panelVerification)
    : options.target?.mode === "clone" ? undefined
    : topology?.targetMode === "existing" && options.target?.mode === "existing" && existingPreflight && existingExecution
      ? { targetMode: "existing" as const, origin: topology.fluxiqOrigin, projectId: options.target.projectId, flowId: options.target.flowId, flowContentHash: existingPreflight.flow.contentHash, runtimeRunId: existingExecution.runId, ...(existingPreflight.gateway.runtimeId ? { runtimeId: existingPreflight.gateway.runtimeId } : {}), sessionIdentityVerified: existingPreflight.sessionIdentityVerified, panelVerification: panelVerification?.status ?? "limited" }
      : topology?.targetMode === "persistent-isolated" && options.target?.mode === "persistent-isolated"
        ? { targetMode: "persistent-isolated" as const, workspace: options.target.workspace }
        : topology?.targetMode === "isolated" ? { targetMode: "isolated" as const } : undefined;
  const ownsCorePorts = topology?.targetMode === "isolated" || topology?.targetMode === "persistent-isolated";
  return { schemaVersion: "0.1", runId, scenarioId: scenario.id, scenarioRevision: sha256(JSON.stringify(scenario)), seed, status: verdict, startedAt, finishedAt: new Date().toISOString(), repositories: { facility: await revision(options.repositoryRoot), core: await revision(options.fluxiqRepositoryRoot) }, compatibility: [], lockfiles: await lockfiles(options), extension: { version: manifest.version, sha256: await hashDirectory(extensionPath), path: "apps/extension/dist/e2e-chromium" }, environment: { os: os.platform(), architecture: os.arch(), browserName: "chromium", browserVersion, locale: "en-US", timezone: "UTC", viewport: { width: 1280, height: 720 } }, ports: topology ? { scenario: topology.allocation.scenarioPort, ...(ownsCorePorts ? { web: topology.allocation.webPort, gateway: topology.allocation.gatewayPort } : {}) } : {}, processExits: topology?.processExitCodes() ?? {}, artifacts: [], redactionState: "verified", verdict, ...(fluxiqExecution ? { fluxiqExecution } : {}) };
}
function cloneRemappingSummary(clonePackage: ClonePackage) { const count = (kind: ClonePackage["idMap"][number]["kind"]) => clonePackage.idMap.filter(item => item.kind === kind).length; return { projects: count("project"), flows: count("flow"), nodes: count("node"), edges: count("edge"), localReferences: count("local-reference") }; }
function cloneExecutionMetadata(state: CloneRunState, panelVerification?: FluxIQPanelVerificationOutcome): RunManifest["fluxiqExecution"] {
  if (!state.clonePackage || !state.clonePackageHash) return undefined;
  const common = { targetMode: "clone" as const, sourceOrigin: state.clonePackage.source.origin, sourceProjectId: state.clonePackage.source.projectId, sourceFlowId: state.clonePackage.source.flowId, sourceContentHash: state.clonePackage.source.contentHash, sourceSessionIdentityVerified: state.sourceSessionIdentityVerified, clonePackageHash: state.clonePackageHash, dependencyVerdict: state.clonePackage.compatibility.verdict, remappingSummary: cloneRemappingSummary(state.clonePackage), cleanupOutcome: state.cleanupOutcome };
  if (state.destination && state.execution) return { ...common, stage: "executed", destinationProjectId: state.destination.projectId, destinationFlowId: state.destination.flowId, destinationContentHash: state.destination.contentHash, destinationRuntimeRunId: state.execution.runId, sourceHashVerifiedAfterRun: state.sourceHashVerifiedAfterRun, panelVerification: panelVerification?.status ?? "limited" };
  if (state.destination) return { ...common, stage: "imported", destinationProjectId: state.destination.projectId, destinationFlowId: state.destination.flowId, destinationContentHash: state.destination.contentHash };
  return { ...common, stage: "exported" };
}
async function revision(root: string) { const { stdout } = await execFileAsync("git", ["-c", `safe.directory=${path.resolve(root).replaceAll("\\", "/")}`, "rev-parse", "HEAD"], { cwd: root }); const statusResult = await execFileAsync("git", ["-c", `safe.directory=${path.resolve(root).replaceAll("\\", "/")}`, "status", "--porcelain"], { cwd: root }); return { path: path.resolve(root), commit: stdout.trim(), dirty: Boolean(statusResult.stdout.trim()) }; }
async function lockfiles(options: RunScenarioOptions) { const values = []; for (const [root, relative] of [[options.repositoryRoot, "pnpm-lock.yaml"], [options.fluxiqRepositoryRoot, "pnpm-lock.yaml"]] as const) { try { values.push({ path: path.basename(root) + "/" + relative, sha256: sha256(await readFile(path.join(root, relative))) }); } catch {} } return values; }
async function hashDirectory(root: string): Promise<string> { const hash = createHash("sha256"); async function walk(dir: string) { for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a,b) => a.name.localeCompare(b.name))) { const target = path.join(dir, entry.name); if (entry.isDirectory()) await walk(target); else { hash.update(path.relative(root, target)); hash.update(await readFile(target)); } } } await walk(root); return hash.digest("hex"); }
async function copyProcessLogs(bundle: EvidenceBundle, logsDir: string) { try { for (const name of await readdir(logsDir)) if (name.endsWith(".log")) await bundle.writeText(`logs/${name}`, await readFile(path.join(logsDir, name), "utf8")); } catch {} }
