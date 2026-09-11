import { randomBytes } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { chromium, type BrowserContext, type Page } from "@playwright/test";
import { assertClonePackage, assertRunManifest, canonicalClonePackageJson, resolveScenarioWorkflow, type ResolvedScenarioWorkflow, type RunActionTiming, type RunAutomationFailure, type WebScenario } from "@fluxiq-web-extension/test-contracts";
import { createCorrelationId, EvidenceBundle, EvidenceCaptureController, sha256 } from "@fluxiq-web-extension/test-evidence";
import type { EvidenceMode } from "./commands.js";
import { removeRunOwnedTopologyState, startTopology, type RunningTopology } from "./coordinator.js";
import { classifyRunnerFailure, RunnerFailure } from "./failure.js";
import { withoutProviderSecrets } from "./environment.js";
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
import { createRunOwnedCloneFlowId, createRunOwnedCloneProject, importClonePackageIntoIsolatedDestination } from "./isolated-flow-importer.js";
import { effectiveEvidencePolicy } from "./evidence-policy/index.js";
import { armScenarioVariant, scenarioLabOriginProof } from "./lab-control/index.js";
import { assertExtraction, assertRecordedEvents, ConsoleErrorWatch, readExtensionRecordingLog } from "./run-expectations/index.js";
import { automationFailureFromActionResult, createRunManifest, flowActionTimings, runActionStatus, type CloneRunState } from "./run-manifest/index.js";
import { cssSelectorForTarget, parseScenarioTarget, ScenarioStepRunner } from "./scenario-steps/index.js";

/** `evidence` overrides the manifest's `evidencePolicy`; `workflowId` and `variantId` select what `resolveScenarioWorkflow` resolves. */
export type RunScenarioOptions = { repositoryRoot: string; fluxiqRepositoryRoot: string; runsDirectory: string; scenarioId: string; seed?: number; evidence?: EvidenceMode; workflowId?: string; variantId?: string; environment?: NodeJS.ProcessEnv; target?: FluxIQTargetConfiguration };
export type RunScenarioResult = { runId: string; verdict: "passed" | "failed"; path: string; failureCategory?: string };

export async function runScenario(options: RunScenarioOptions): Promise<RunScenarioResult> {
  const runId = `run-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
  const scenario = await loadScenarioManifest(options.repositoryRoot, options.scenarioId);
  const target = options.target ?? { mode: "isolated" as const };
  const workflow = resolveWorkflow(scenario, options, target);
  const seed = options.seed ?? scenario.seed;
  const environment = options.environment ?? process.env;
  const secrets = [environment.FLUXIQ_TEST_PASSWORD, environment.FLUXIQ_TEST_PIN, environment.FLUXIQ_TEST_TOTP].filter((value): value is string => Boolean(value));
  const evidence = effectiveEvidencePolicy(scenario.evidencePolicy, options.evidence);
  const bundle = new EvidenceBundle({ rootDirectory: options.runsDirectory, runId, scenarioId: scenario.id, redaction: { secrets }, evidencePolicy: evidence.capture });
  await bundle.initialize();
  const capture = new EvidenceCaptureController(bundle, evidence.capture);
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
  let stepRunner: ScenarioStepRunner | undefined;
  let consoleErrors: ConsoleErrorWatch | undefined;
  let recordingBaseline: Set<string> | undefined;
  let recordedEvents: Record<string, number> | undefined;
  const actions: RunActionTiming[] = [];
  // null: FluxIQ reported no failure. A Flow lane cannot see a failed run's actions, so it stays unobserved until its Flow succeeds.
  let automationFailure: RunAutomationFailure | null | undefined = target.mode === "existing" || target.mode === "clone" ? undefined : null;
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
    topology = await startTopology({ repositoryRoot: options.repositoryRoot, fluxiqRepositoryRoot: options.fluxiqRepositoryRoot, runsDirectory: topologyRunsDirectory, runId, seed, target: topologyTarget, ...(ownsIsolatedCore ? { bootstrapIdentity: target.mode === "clone" || scenarioRequiresCore({ ...scenario, expected: workflow.expected }), ...(credentials ? { credentials } : {}) } : {}) });
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
    const scenarioOrigins = new Set(scenarioNetworkOrigins(topology.scenarioOrigin));
    const isScenarioUrl = (url: string) => { try { return scenarioOrigins.has(new URL(url).origin); } catch { return false; } };
    networkGuard = await installDeterministicNetworkGuard(context, {
      scenarioOrigins: [...scenarioOrigins],
      fluxiqOrigins: [topology.fluxiqOrigin],
      ...(topology.gatewayUrl ? { gatewayOrigins: [topology.gatewayUrl] } : {}),
      verifyScenarioOrigin: scenarioLabOriginProof(topology.scenarioOrigin, topology.allocation.controllerToken),
    });
    const consoleWatch = consoleErrors = new ConsoleErrorWatch(context, isScenarioUrl);
    const extensionControl = extensionPage = await extensionControlPage(context);
    browserVersion = await browserVersionFromCdp(context, extensionPage);
    if (workflow.variant) await armScenarioVariant(topology.scenarioOrigin, topology.allocation.controllerToken, scenario.id, workflow.variant);
    const page = scenarioPage = await context.newPage();
    await page.goto(`${topology.scenarioOrigin}${scenario.startPath}`);
    await page.bringToFront();
    await assertExpectedFacts(workflow.expected.pageFacts ?? [], playwrightScenarioFactProbe(page));
    const paired = topology.control ? await pairExtension(extensionPage, topology) : undefined;
    if (paired) await activateScenarioTab(extensionPage, topology.scenarioOrigin);
    const screenshotAdapter = scenario.id === "sensitive-input" ? undefined : { capture: async () => ({ bytes: await (stepRunner?.activePage() ?? page).screenshot({ type: "png" }), mediaType: "image/png" as const, redactionVerified: true as const }) };
    const stepCapture = new EvidenceCaptureController(bundle, evidence.capture, screenshotAdapter);
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
      }, workflow.expected.actions ?? []);
      actions.push(...flowActionTimings(existingExecution.actions));
      automationFailure = null;
      await bundle.writeStructured("snapshots/existing-flow.json", { projectId: target.projectId, flowId: target.flowId, contentHash: existingPreflight.flow.contentHash, name: existingPreflight.flow.name, updatedAt: existingPreflight.flow.updatedAt });
      await bundle.writeStructured("snapshots/runtime-run.json", existingExecution.detail);
      await bundle.writeStructured("snapshots/runtime-actions.json", existingExecution.actions);
      await bundle.writeStructured("snapshots/runtime-events.json", existingExecution.events);
      scenarioPage = await findScenarioPageWithExpectedState(context, page, topology.scenarioOrigin, scenario, workflow);
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
      }, workflow.expected.actions ?? []);
      actions.push(...flowActionTimings(cloneState.execution.actions));
      automationFailure = null;
      await bundle.writeStructured("snapshots/runtime-run.json", cloneState.execution.detail);
      await bundle.writeStructured("snapshots/runtime-actions.json", cloneState.execution.actions);
      await bundle.writeStructured("snapshots/runtime-events.json", cloneState.execution.events);
      scenarioPage = await findScenarioPageWithExpectedState(context, page, topology.scenarioOrigin, scenario, workflow);
      await runtimeMessage(extensionPage, { type: "fluxiq.stopRecording" });
      recordingStarted = false;
      const outcome = await assertCoreRoundTrip(topology, paired.sessionId, recordingBaseline);
      panelVerification = await verifyAuthenticatedFluxIQPanel({ context, origin: topology.fluxiqOrigin, sessionCookieValue: topology.control.sessionCookieValue(), projectId: cloneState.destination.projectId, flowId: cloneState.destination.flowId, runId: cloneState.execution.runId });
      if (panelVerification.status !== "verified") throw new RunnerFailure("runtime.behavior", "Isolated FluxIQ panel could not verify the exact cloned Flow run");
      await capture.trigger({ ...event(runId, scenario.id, undefined, "runtime.settle", "Cloned Flow and browser state succeeded in isolation"), details: { runtimeRunId: cloneState.execution.runId, actionCount: cloneState.execution.actions.length, eventCount: cloneState.execution.events.length, recordingCount: outcome.recordingCount, sourceHashUnchanged: true, panelVerification: panelVerification.status } });
    } else {
      if (paired && topology.authorizationPin) await proveCoreActionRoundTrip(page, topology, paired.sessionId, scenario.id, workflow, capture, runId, (timing, result) => { actions.push(timing); automationFailure ??= automationFailureFromActionResult(result); });
      if (topology.control && topology.projectId) recordingBaseline = recordingIds(await topology.control.listRecordings(topology.projectId));
      if (topology.control) {
        // Core accepts `client.start_recording` only while the approving operator's Automation
        // Studio context is under 10 s old (Core `resolveClientRecordingProject`, freshnessMs
        // 10_000). The coordinator stamps that context once, at topology startup; pairing
        // approval, tab activation and the Core action probe all run after it and can outlast
        // the window, and Core then answers `recording.project_required`. The extension clears
        // its pending start on that error, so its own 750 ms local fallback never fires and the
        // recording stays idle for good -- no poll length can recover it. Restamping the context
        // here makes acceptance depend on this call instead of on how long startup happened to take.
        if (topology.projectId) await topology.control.selectProject(topology.projectId);
        const startResponse = await runtimeMessage(extensionControl, { type: "fluxiq.startRecording" }); recordingStarted = true;
        // startRecording answers before Core accepts the recording, and input before then is not recorded.
        await pollStatus(extensionControl, value => value.recordingState === "recording").catch(async cause => {
          const observed = await runtimeMessage(extensionControl, { type: "fluxiq.getStatus" }).then((response: any) => response.status).catch(() => undefined);
          const diagnostic = { answered: recordingStartDiagnostic(startResponse?.status), observed: recordingStartDiagnostic(observed) };
          await bundle.writeStructured("snapshots/recording-start.json", diagnostic);
          throw new RunnerFailure("recording.persistence", `The extension recording did not start (${describeRecordingStartDiagnostic(diagnostic.observed)})`, { cause, details: diagnostic });
        });
      }
      const runner = stepRunner = new ScenarioStepRunner({ context, page, origin: topology.scenarioOrigin, isScenarioUrl, uploadDirectory: path.join(topology.allocation.runRoot, "scenario-uploads") });
      for (const step of workflow.recordingScript) {
        await stepCapture.trigger(event(runId, scenario.id, step.id, "step.start", `Start ${step.operation}`));
        const { extracted } = await runner.run(step);
        // Only an extract step without pagination is asserted here: this lane reads the current page and never follows `next`.
        if (extracted && !step.pagination) assertExtraction(workflow.expected.extracted, step.id, extracted);
        await stepCapture.trigger({ ...event(runId, scenario.id, step.id, step.operation === "checkpoint" ? "checkpoint" : "step.complete", `Complete ${step.operation}`), ...(extracted ? { details: { recordCount: extracted.length } } : {}) });
      }
      // Read while still recording: the extension's log is what it recorded.
      recordedEvents = await assertRecordedEvents(() => readExtensionRecordingLog(message => runtimeMessage(extensionControl, message)), workflow.expected.recordingEvents ?? []);
      scenarioPage = runner.activePage();
      await assertFinalState(scenarioPage, scenario, workflow);
    }
    if (topology.control && (target.mode === "isolated" || target.mode === "persistent-isolated")) {
      await runtimeMessage(extensionPage, { type: "fluxiq.stopRecording" });
      recordingStarted = false;
      const outcome = await assertCoreRoundTrip(topology, paired?.sessionId, recordingBaseline);
      await capture.trigger({ ...event(runId, scenario.id, undefined, "gateway.action", "Core gateway retained the paired extension session"), details: { sessionCount: outcome.sessionCount } });
      await capture.trigger({ ...event(runId, scenario.id, undefined, "runtime.settle", "Core persisted the completed recording"), details: { recordingCount: outcome.recordingCount, projectId: topology.projectId, recordedEvents } });
    }
    consoleWatch.assertOnlyAllowed(workflow.expected.allowedConsoleErrors);
    networkGuard.assertNoViolations();
    await capture.trigger(event(runId, scenario.id, undefined, "final", "Scenario completed"));
    verdict = "passed";
  } catch (error) {
    failureCategory = classifyRunnerFailure(error);
    failureMessage = error instanceof Error ? error.message : String(error);
    // Recorded-event mismatches are types and counts, never page data, so they are published for diagnosis.
    const failureEvent = { ...event(runId, scenario.id, undefined, "error", failureMessage), details: { failureCategory, ...(error instanceof RunnerFailure && error.category === "recording.contract" && error.details ? { failureDetails: error.details } : {}) } };
    const failurePage = stepRunner?.activePage() ?? scenarioPage;
    const bytes = evidence.failureScreenshot && scenario.id !== "sensitive-input" && failurePage && !failurePage.isClosed() ? await failurePage.screenshot({ type: "png" }).catch(() => undefined) : undefined;
    if (bytes) {
      const digest = sha256(bytes);
      const artifactPath = `screenshots/failure-${digest.slice(0, 12)}.png`;
      await bundle.writeVerifiedVisual(artifactPath, { bytes, mediaType: "image/png", redactionVerified: true });
      await bundle.appendEvent({ ...failureEvent, screenshot: { path: artifactPath, sha256: digest } });
    } else await capture.trigger(failureEvent).catch(() => undefined);
  } finally {
    stepRunner?.dispose();
    consoleErrors?.dispose();
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
    const manifest = await createRunManifest({ repositoryRoot: options.repositoryRoot, fluxiqRepositoryRoot: options.fluxiqRepositoryRoot, target: options.target, scenario, runId, seed, startedAt, verdict, browserVersion, extensionPath, topology, existingPreflight, existingExecution, panelVerification, cloneState, workflowId: workflow.workflowId, variantId: workflow.variant?.id, automationFailure, steps: stepRunner?.timings() ?? [], actions });
    assertRunManifest(manifest);
    await bundle.writeStructured("run.json", manifest);
    bundle.registerEvidencePolicy(evidence.capture);
    const finalized = await bundle.finalize({ verdict, metrics: { steps: workflow.recordingScript.length } });
    return { runId, verdict, path: finalized.path, ...(failureCategory ? { failureCategory } : {}) };
  } finally {
    if (topology && !topologyStateRemoved) await removeRunOwnedTopologyState(topology).catch(() => undefined);
  }
}

function configuredCredentials(environment: NodeJS.ProcessEnv) { const username = environment.FLUXIQ_TEST_USERNAME; const password = environment.FLUXIQ_TEST_PASSWORD; return username && password ? { username, password, ...(environment.FLUXIQ_TEST_TOTP ? { totp: environment.FLUXIQ_TEST_TOTP } : {}), ...(environment.FLUXIQ_TEST_PIN ? { pin: environment.FLUXIQ_TEST_PIN } : {}) } : undefined; }
async function requireExtension(extensionPath: string) { try { await stat(path.join(extensionPath, "manifest.json")); } catch (cause) { throw new RunnerFailure("environment.missing", `Built E2E extension is missing: ${extensionPath}`, { cause }); } }

async function launchBrowser(topology: RunningTopology, extensionPath: string) {
  const context = await chromium.launchPersistentContext(topology.allocation.browserProfileDir, { headless: false, env: withoutProviderSecrets(process.env), locale: "en-US", timezoneId: "UTC", viewport: { width: 1280, height: 720 }, colorScheme: "light", args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, "--no-first-run", "--disable-default-apps"] });
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
/** Proves one Core-issued action reaches the page, using the first `type` step whose target is a CSS selector; each action is reported to `record`. */
async function proveCoreActionRoundTrip(page: Page, topology: RunningTopology, sessionId: string, scenarioId: string, workflow: ResolvedScenarioWorkflow, capture: EvidenceCaptureController, runId: string, record: (timing: RunActionTiming, result: unknown) => void) {
  const probe = workflow.recordingScript.filter(candidate => candidate.operation === "type" && candidate.target).map(step => ({ step, css: cssSelectorForTarget(parseScenarioTarget(step.target)) })).find(candidate => candidate.css);
  if (!probe?.css) return;
  const { step, css: target } = probe; const correlationId = createCorrelationId("command"); const text = "FluxIQ Core probe";
  const navigationCorrelationId = createCorrelationId("command");
  const automationPagePromise = page.context().waitForEvent("page", { timeout: 10_000 });
  await capture.trigger({ ...event(runId, scenarioId, step.id, "runtime.dispatch", "Initialize the extension automation tab through Core"), details: { correlationId: navigationCorrelationId, actionType: "web.browser.navigate", url: page.url() } });
  const navigationStartedAt = Date.now();
  const navigationResponse = await topology.control!.executeClientAction(sessionId, { actionType: "web.browser.navigate", parameters: { url: page.url() }, metadata: { correlationId: navigationCorrelationId } }, topology.authorizationPin!) as any;
  const navigationResult = navigationResponse?.payload?.result;
  record(probeTiming("web.browser.navigate", navigationStartedAt, navigationResult), navigationResult);
  if (navigationResult?.status !== "succeeded") throw new RunnerFailure("action.dispatch", `Core navigation did not succeed: ${String(navigationResult?.status ?? "missing result")}: ${String(navigationResult?.message ?? navigationResult?.error ?? "no error detail")}`);
  const automationPage = await automationPagePromise;
  await automationPage.waitForLoadState("domcontentloaded");
  await capture.trigger({ ...event(runId, scenarioId, step.id, "runtime.settle", "Core navigation initialized the extension automation tab"), details: { correlationId: navigationCorrelationId, commandId: navigationResult.commandId, status: navigationResult.status, url: automationPage.url() } });
  await capture.trigger({ ...event(runId, scenarioId, step.id, "runtime.dispatch", "Dispatch Core action through the production gateway"), details: { correlationId, actionType: "web.dom.type", target } });
  const typeStartedAt = Date.now();
  const response = await topology.control!.executeClientAction(sessionId, { actionType: "web.dom.type", parameters: { selector: target, text }, metadata: { correlationId } }, topology.authorizationPin!) as any;
  const result = response?.payload?.result;
  record(probeTiming("web.dom.type", typeStartedAt, result), result);
  if (result?.status !== "succeeded") {
    await capture.trigger({ ...event(runId, scenarioId, step.id, "runtime.settle", "Core action returned a failed result"), details: { correlationId, commandId: result?.commandId, status: result?.status, message: result?.message ?? result?.error } });
    throw new RunnerFailure("action.dispatch", `Core action did not succeed: ${String(result?.status ?? "missing result")}: ${String(result?.message ?? result?.error ?? "no error detail")}`);
  }
  if (await automationPage.locator(target).inputValue() !== text) throw new RunnerFailure("runtime.behavior", "Core action result did not reach page state");
  await capture.trigger({ ...event(runId, scenarioId, step.id, "runtime.settle", "Core action reached the expected page state"), details: { correlationId, commandId: result.commandId, status: result.status } });
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
  throw new RunnerFailure("recording.persistence", recordingBaseline ? "Core did not persist a new recording for the completed scenario run" : "Core did not persist a recording for the completed scenario");
}
function recordingIds(response: any): Set<string> { const values = response?.payload?.recordings ?? response?.payload?.items ?? response?.payload; if (!Array.isArray(values)) return new Set(); return new Set(values.flatMap((item: any) => { const id = item?.recordingId ?? item?.id; return typeof id === "string" && id ? [id] : []; })); }
async function runtimeMessage(page: Page, message: Record<string, unknown>): Promise<any> { const response = await page.evaluate((value: Record<string, unknown>) => (globalThis as any).chrome.runtime.sendMessage(value), message); if (!response?.ok) throw new RunnerFailure("extension.worker", response?.error ?? "Extension runtime message failed"); return response; }
async function pollStatus(page: Page, predicate: (value: any) => boolean): Promise<any> { const deadline = Date.now() + 15_000; while (Date.now() < deadline) { const response = await runtimeMessage(page, { type: "fluxiq.getStatus" }); if (predicate(response.status)) return response.status; await new Promise(resolve => setTimeout(resolve, 100)); } throw new RunnerFailure("gateway.connection", "Timed out waiting for extension connection state"); }
/** The extension's own account of a recording start. Labels and reasons only: activity details and tab URLs carry page data. */
function recordingStartDiagnostic(status: any): Record<string, unknown> | undefined {
  if (!status) return undefined;
  return {
    connectionState: status.connectionState,
    recordingState: status.recordingState,
    hasSessionId: typeof status.sessionId === "string",
    hasProjectId: typeof status.projectId === "string",
    unsupportedPageReason: status.unsupportedPage?.reason,
    recordingBlockCode: status.recordingBlock?.code,
    lastError: status.lastError,
    queueSize: status.queueSize,
    eventCount: status.eventCount,
    activities: Array.isArray(status.recentActivities) ? status.recentActivities.map((entry: any) => `${entry?.kind}:${entry?.label}`) : undefined
  };
}
function describeRecordingStartDiagnostic(diagnostic: Record<string, unknown> | undefined): string {
  if (!diagnostic) return "the extension reported no status";
  return `connectionState=${String(diagnostic.connectionState)} recordingState=${String(diagnostic.recordingState)} lastError=${String(diagnostic.lastError ?? "none")} unsupportedPage=${String(diagnostic.unsupportedPageReason ?? "none")} recordingBlock=${String(diagnostic.recordingBlockCode ?? "none")}`;
}
/** Final-state facts, then the primary workflow's playback-goal success facts. */
async function assertFinalState(page: Page, scenario: WebScenario, workflow: ResolvedScenarioWorkflow) { const probe = playwrightScenarioFactProbe(page); await assertExpectedFacts(workflow.expected.finalState ?? [], probe); if (workflow.workflowId === undefined) await assertExpectedFacts(scenario.playbackGoal?.successFacts ?? [], probe); }
async function findScenarioPageWithExpectedState(context: BrowserContext, fallback: Page, origin: string, scenario: WebScenario, workflow: ResolvedScenarioWorkflow): Promise<Page> { for (const candidate of context.pages().filter(item => !item.isClosed() && item.url().startsWith(`${origin}/`)).reverse()) { try { await assertFinalState(candidate, scenario, workflow); return candidate; } catch {} } await assertFinalState(fallback, scenario, workflow); return fallback; }
function resolveWorkflow(scenario: WebScenario, options: RunScenarioOptions, target: FluxIQTargetConfiguration): ResolvedScenarioWorkflow {
  let workflow: ResolvedScenarioWorkflow;
  try { workflow = resolveScenarioWorkflow(scenario, { ...(options.workflowId === undefined ? {} : { workflowId: options.workflowId }), ...(options.variantId === undefined ? {} : { variantId: options.variantId }) }); }
  catch (cause) { throw new RunnerFailure("fixture.invalid", cause instanceof Error ? cause.message : String(cause), { cause }); }
  if (workflow.variant && target.mode !== "existing" && target.mode !== "clone") throw new RunnerFailure("fixture.invalid", "A variant is armed only before a Flow run; the recording lane always records the workflow unarmed");
  return workflow;
}
function probeTiming(actionType: string, startedAt: number, result: any): RunActionTiming { return { actionType, startedAt: new Date(startedAt).toISOString(), durationMs: Math.max(0, Date.now() - startedAt), status: runActionStatus(result?.status) }; }
function event(runId: string, scenarioId: string, stepId: string | undefined, trigger: "step.start" | "step.complete" | "gateway.action" | "runtime.dispatch" | "runtime.settle" | "checkpoint" | "error" | "final", summary: string) { return { trigger, summary, correlation: { runId, scenarioId, ...(stepId ? { stepId } : {}), correlationId: createCorrelationId() } }; }

async function copyProcessLogs(bundle: EvidenceBundle, logsDir: string) { try { for (const name of await readdir(logsDir)) if (name.endsWith(".log")) await bundle.writeText(`logs/${name}`, await readFile(path.join(logsDir, name), "utf8")); } catch {} }
