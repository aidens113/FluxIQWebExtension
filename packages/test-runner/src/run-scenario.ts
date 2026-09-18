import { randomBytes } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { chromium, type BrowserContext, type Page } from "@playwright/test";
import { assertClonePackage, assertRunManifest, canonicalClonePackageJson, flowLaneExclusion, resolveScenarioWorkflow, scenarioPageFactSchedule, type FacilityFailureStage, type ResolvedScenarioWorkflow, type RunActionTiming, type RunAutomationFailure, type RunEvaluation, type ScenarioArming, type WebScenario } from "@fluxiq-web-extension/test-contracts";
import { createCorrelationId, EvidenceBundle, EvidenceCaptureController, sha256 } from "@fluxiq-web-extension/test-evidence";
import type { EvidenceMode } from "./commands.js";
import { removeRunOwnedTopologyState, startTopology, type RunningTopology } from "./coordinator.js";
import { classifyRunnerFailure, RunnerFailure, type RunnerFailureCategory } from "./failure.js";
import { withoutProviderSecrets } from "./environment.js";
import { WebPanelAuthSessionCache } from "./auth-session.js";
import { ExistingFluxIQControlClient } from "./existing-fluxiq-control.js";
import { httpTransportFailureDetails, topologyReadinessFailureDetails } from "./http-control/index.js";
import { executeExistingPersistedFlow, preflightExistingFluxIQ, type ExistingFlowExecution, type ExistingFluxIQPreflight } from "./existing-flow-run.js";
import { installDeterministicNetworkGuard, scenarioNetworkOrigins, type DeterministicNetworkGuard } from "./network-guard.js";
import { verifyAuthenticatedFluxIQPanel, type FluxIQPanelVerificationOutcome } from "./panel-verification.js";
import { assertExpectedFacts, playwrightScenarioFactProbe } from "./scenario-assertions.js";
import { loadScenarioManifest } from "./scenarios.js";
import type { FluxIQTargetConfiguration } from "./target-config.js";
import { ClonePackageCache } from "./clone-cache.js";
import { exportClonePackage, exportCloneSource } from "./clone-source-exporter.js";
import {
  classifyCloneDependencies,
  createDeterministicCloneIdMap,
} from "./clone-policy.js";
import { createRunOwnedCloneFlowId, createRunOwnedCloneProject, importClonePackageIntoIsolatedDestination } from "./isolated-flow-importer.js";
import { effectiveEvidencePolicy } from "./evidence-policy/index.js";
import { resolveLabPaths } from "./lab-instance/index.js";
import { armScenarioVariant, scenarioLabOriginProof } from "./lab-control/index.js";
import { awaitFinalizedRecording, createdFlowLaneSnapshot, declaredSecretValues, writeFlowExtractionMismatches, finalizedRecordingWaitFailureDetails, flowLaneSnapshot, readRecordingDiscards, recordingLaneProbeObservation, resolveCreatedFlowSecrets, runLiveRepairLane, withDeclaredFlowRepair, resolveDeclaredSecrets, runCreatedFlowLane, runFlowLane, selectLaneObservation, type CreatedFlowRequest, type DeclaredSecret, type PersistedFlowRunOutcome, type RecordingDiscard, type RecordingDiscardScope, type RunLaneObservation } from "./flow-lane/index.js";
import { attestRunRedaction, runRedactionScopes, scenarioRedactionLiterals, type RunRedactionAttestation } from "./redaction-attestation/index.js";
import { runLaneWithLiveLlmSettlement, type LiveLlmRun } from "./live-llm/index.js";
import { assertExtraction, assertRecordedEvents, ConsoleErrorWatch, readExtensionRecordingLog, readRecordingCompleteness, runExtractionMeasurements, type ExtractionStepRead } from "./run-expectations/index.js";
import { singleRunEvaluation } from "./run-evaluation/index.js";
import { automationFailureFromActionResult, createRunManifest, flowActionTimings, runActionStatus, type CloneRunState } from "./run-manifest/index.js";
import { assertFlowLaneBuiltFlow, coreIdentityRequired, coreProbeTargetUsable, finalStateFacts, selectCoreProbeStep } from "./lane-rules/index.js";
import { createExtractionIntentDriver, createScriptedNavigationDriver, ScenarioStepRunner } from "./scenario-steps/index.js";
import { awaitExtensionWorker, cleanupFailureOutcome, describeRecordingStartDiagnostic, extensionStatus, pairingStatusWaitFailureDetails, pairExtensionWithColdEpochRecovery, pollStatus, recordingStartDiagnostic, runtimeMessage } from "./run-lifecycle/index.js";
import { assertSafeScenarioRunId, createBenchReceipt, type BenchReceiptMetadata } from "./bench/index.js";
import { projectFacilityFailure, ProjectedFacilityError } from "./facility-failure/index.js";

/** `evidence` overrides the manifest's `evidencePolicy`; `workflowId` and `variantId` select what `resolveScenarioWorkflow` resolves, and a `creation` run passes its request's own. */
export type RunScenarioOptions = { repositoryRoot: string; fluxiqRepositoryRoot: string; runsDirectory: string; scenarioId: string; seed?: number; evidence?: EvidenceMode; workflowId?: string; variantId?: string; flow?: boolean; creation?: CreatedFlowRequest; environment?: NodeJS.ProcessEnv; target?: FluxIQTargetConfiguration; runId?: string; benchReceipt?: BenchReceiptMetadata; live?: LiveLlmRun; replays?: number };
/**
 * `observation` carries the `RunEvaluation` fields only the lane that ran can
 * know, and `evaluation` is the run's own `RunEvaluation` built from it — the
 * same judgement the bench records per corpus row, also persisted in the
 * bundle as `evaluation.json`. Both are absent on the existing and clone
 * targets, which run a pre-existing Flow on no evaluation lane.
 */
export type RunScenarioResult = { runId: string; verdict: "passed" | "failed"; path: string; failureCategory?: string; observation?: RunLaneObservation; evaluation?: RunEvaluation };

export async function runScenario(options: RunScenarioOptions): Promise<RunScenarioResult> {
  let facilityStage: FacilityFailureStage = "scenario.load";
  try {
    return await runScenarioImplementation(options, stage => { facilityStage = stage; });
  } catch (error) {
    if (error instanceof ProjectedFacilityError) throw error;
    throw new ProjectedFacilityError(error, projectFacilityFailure(error, "no-final-bundle", facilityStage));
  }
}

async function runScenarioImplementation(options: RunScenarioOptions, setFacilityStage: (stage: FacilityFailureStage) => void): Promise<RunScenarioResult> {
  setFacilityStage("scenario.load");
  if (options.benchReceipt && options.runId === undefined) throw new Error("A bench receipt requires a supervisor-provided run id");
  const runId = options.runId ?? `run-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
  assertSafeScenarioRunId(runId);
  const benchReceipt = options.benchReceipt ? createBenchReceipt(options.benchReceipt, runId) : undefined;
  const labPaths = resolveLabPaths(options.repositoryRoot, options.environment);
  const scenario = await loadScenarioManifest(options.repositoryRoot, options.scenarioId, labPaths.scenarioLabDist);
  const target = options.target ?? { mode: "isolated" as const };
  // A Flow-lane run whose grant only proposes a repair is held to what the scenario declares such a run ends with, and judged on the proposal.
  const workflow = resolveWorkflow(scenario, options, target);
  const { workflow: flowWorkflow, repair } = await withDeclaredFlowRepair(workflow, { scenario, scenarioLabDist: labPaths.scenarioLabDist, flowLane: options.flow === true, proposalOnly: options.live?.proposesRepairOnly === true });
  // A variant never changes the recording: on the Flow lane the script runs
  // unarmed, so the recording lane checks the workflow's own expectations while
  // the variant's govern the Flow run alone. Judging the unarmed recording by
  // the armed expectation fails every negative variant before its Flow exists.
  const recordingWorkflow = options.flow && workflow.variant ? unarmedWorkflow(scenario, options) : workflow;
  // Page facts are phase-specific -- a workflow's describe its unarmed
  // rendering, a variant's the armed one -- and the contract owns that rule so
  // that no lane decides it again. Both checks below read this schedule and
  // nothing else: until it existed the Flow lane checked the unarmed page and
  // never looked at the armed rendering it was about to run the Flow against,
  // while the existing and clone lanes checked only the armed one.
  const pageFacts = scenarioPageFactSchedule(scenario, workflowSelection(options), armingOf(options, workflow));
  const seed = options.seed ?? scenario.seed;
  const environment = options.environment ?? process.env;
  // A live provider run is planned and credentialed before this is reached (`beginLiveLlmRun`), so that an unexecutable profile or an absent key refuses at the command line rather than inside a run.
  const live = options.live; const creation = options.creation; const flowLane = options.flow === true || creation !== undefined;
  if (live) live.assertLane({ flowLane: options.flow === true, creation: creation !== undefined }); else if (creation) throw new RunnerFailure("fixture.invalid", "An instruction task is built only by a live run: pass --live-llm --llm-task create-flow");
  // Declared replay secrets resolve before the bundle so their values join the
  // redaction list; only the two Flow lanes supply them, so a recording-lane run
  // of the same scenario does not require them to be configured.
  const declaredSecrets: DeclaredSecret[] = options.flow ? resolveDeclaredSecrets(scenario, environment) : creation ? resolveCreatedFlowSecrets(scenario, workflow, environment) : [];
  const secrets = [environment.FLUXIQ_TEST_PASSWORD, environment.FLUXIQ_TEST_PIN, environment.FLUXIQ_TEST_TOTP, ...declaredSecretValues(declaredSecrets)].filter((value): value is string => Boolean(value));
  // What the redaction attestation scans for once Core has stopped -- the scenario's declared
  // literals and a live run's provider credential -- read here so a bad declaration fails before
  // the bundle. Never added to `secrets`: the bundle's redactor would scrub them on write and hide
  // the leak the bundle scan looks for. The existing target's FluxIQ is remote and cannot be
  // scanned, so a scenario declaring literals there stays unattested (`pending`) instead of verified.
  const redactionLiterals = target.mode === "existing" && scenario.secrets?.length ? undefined : [...scenarioRedactionLiterals(scenario), ...(live?.redactionLiterals ?? [])];
  let redaction: RunRedactionAttestation | undefined;
  const evidence = effectiveEvidencePolicy(scenario.evidencePolicy, options.evidence);
  setFacilityStage("bundle.initialize");
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
  let failureCategory: RunnerFailureCategory | undefined;
  let failureMessage: string | undefined;
  let facilityFailure: RunEvaluation["facilityFailure"] = null;
  let existingPreflight: ExistingFluxIQPreflight | undefined;
  let existingExecution: ExistingFlowExecution | undefined;
  let panelVerification: FluxIQPanelVerificationOutcome | undefined;
  let stepRunner: ScenarioStepRunner | undefined;
  let consoleErrors: ConsoleErrorWatch | undefined;
  let recordingBaseline: Set<string> | undefined;
  let recordedEvents: Record<string, number> | undefined;
  // The extension's count of the executable actions it recorded, read before Stop and compared with Core's.
  let extensionActionCount: unknown;
  let flowObservation: RunLaneObservation | undefined;
  // What each `extract` step of the recording script read, by step id, and
  // `undefined` until the lane starts running the script at all.
  //
  // That difference is the measurement's own honesty: a run that never reached
  // its first step measured no extraction and publishes `null` for it, which
  // the contract reads as unmeasured, while a lane that ran the script
  // publishes one measurement per extract step -- including `[]` for a
  // workflow that extracts nothing, and `not_run` for an expected step the run
  // failed before. A read is kept **before** its expectation is judged, so a
  // step whose records did not match is measured rather than lost with the
  // failure.
  let extractionRead: Map<string, ExtractionStepRead> | undefined;
  // The first read of Core's discard audit, which `finally` reads again, in the same scope closed at the Flow lane's dispatch, and unions with it before the topology closes.
  let firstDiscardRead: { scope: RecordingDiscardScope; discards: RecordingDiscard[] } | undefined;
  // The window in which a discard Core audits is this recording's loss: from just before the extension is asked to start
  // recording, whose Core action probe's runtime confirmations reach Core with no recording open, until the Flow lane
  // dispatches its Flow, whose runtime confirmations Core audits against the finalized recording.
  let discardWindowFrom: number | undefined;
  let discardWindowUntil: number | undefined;
  // The fixture oracle's own verdict, published rather than inferred: a failure
  // category cannot tell "the fixture disagreed" from "the rig broke first".
  let oracleVerdict: "passed" | "failed" | null = null;
  const actions: RunActionTiming[] = [];
  // null: FluxIQ reported no failure. On the Flow lane it is set from the observation the lane publishes, failed runs included.
  let automationFailure: RunAutomationFailure | null | undefined = target.mode === "existing" || target.mode === "clone" ? undefined : null;
  const cloneState: CloneRunState = { sourceSessionIdentityVerified: false, sourceHashVerifiedAfterRun: false, cleanupOutcome: "pending" };
  let topologyStateRemoved = false;
  const extensionPath = labPaths.extensionPath;
  setFacilityStage("scenario.execute");
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
    topology = await startTopology({ repositoryRoot: options.repositoryRoot, fluxiqRepositoryRoot: options.fluxiqRepositoryRoot, runsDirectory: topologyRunsDirectory, coreWebBuildRunsDirectory: options.runsDirectory, runId, seed, target: topologyTarget, scenarioEntrypoint: labPaths.scenarioEntrypoint, hostModulePath: labPaths.hostModulePath, copyStartupFailureLogs: logsDirectory => copyProcessLogs(bundle, logsDirectory), ...(ownsIsolatedCore && labPaths.hostPrebuilt ? { prepareHost: false } : {}), ...(ownsIsolatedCore ? { bootstrapIdentity: coreIdentityRequired({ clone: target.mode === "clone", flowLane, scenario, recorded: recordingWorkflow.expected }), ...(credentials ? { credentials } : {}) } : {}) });
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
    // The existing and clone lanes replay a pre-existing Flow, so their variant
    // is armed before the page opens. The two Flow lanes must not arm here: each
    // presents the unarmed rendering first and arms when it prepares the page it
    // explores or runs, or the drift would break the recording it builds a Flow from.
    if (workflow.variant && !flowLane) await armScenarioVariant(topology.scenarioOrigin, topology.allocation.controllerToken, scenario.id, workflow.variant);
    const page = scenarioPage = await context.newPage();
    await openScenarioStart(page, topology.scenarioOrigin, scenario);
    await page.bringToFront();
    await assertExpectedFacts(pageFacts.atLoad, playwrightScenarioFactProbe(page));
    // What either Flow lane is handed: present the page, publish what the Flow did, and consult the fixture oracle.
    const flowRunHooks = <E extends { observation: RunLaneObservation; run: PersistedFlowRunOutcome }>(activeTopology: RunningTopology, publish: (evidence: E) => Promise<void>) => ({
      prepareFlowPage: async () => {
        if (workflow.variant) await armScenarioVariant(activeTopology.scenarioOrigin, activeTopology.allocation.controllerToken, scenario.id, workflow.variant);
        // Runs before every Flow run and every exploration. The reset and any arm are server-side, and the tab still shows
        // wherever the recording or the exploration ended, so it is loaded again: unarmed, or the Flow starts on that last
        // page; armed, or a drift variant is judged against a page that never drifted. Load the entry point, not a reload.
        await openScenarioStart(page, activeTopology.scenarioOrigin, scenario);
        // The rendering the Flow meets is now on screen. Check the armed facts here (none for an unarmed run), so
        // "the fixture did not arm as declared" cannot arrive disguised as "the generated Flow failed".
        await assertExpectedFacts(pageFacts.afterArm, playwrightScenarioFactProbe(page));
      },
      recordEvidence: async (evidence: E) => {
        // The lane publishes before it judges any expectation, so these are set even when an expectation then throws:
        // the run is evaluated as the Flow run it was, with the category Core actually reported.
        flowObservation = evidence.observation;
        oracleVerdict = evidence.observation.oracleVerdict;
        automationFailure = evidence.observation.automationFailureReported;
        actions.push(...evidence.run.actions.map(action => ({ actionType: action.actionType, startedAt: action.startedAt, ...(action.durationMs === undefined ? {} : { durationMs: action.durationMs }), status: action.status })));
        await publish(evidence);
      },
      checkFinalState: async () => {
        try { scenarioPage = await findScenarioPageWithExpectedState(context!, page, activeTopology.scenarioOrigin, scenario, flowWorkflow); return true; }
        catch { return false; }
      },
    });
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
      actions.push(...flowActionTimings(existingExecution.actions, existingExecution.actionTypes));
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
      actions.push(...flowActionTimings(cloneState.execution.actions, cloneState.execution.actionTypes));
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
    } else if (creation) {
      // No recording: FluxIQ explores the page the task's variant renders, which the lane presents, and builds the Flow from the instruction.
      if (!paired || !live || !topology.control || !topology.projectId || !topology.authorizationPin) throw new RunnerFailure("environment.missing", "The created-Flow lane needs a paired extension, a live run, and an authenticated isolated Core with an authorization PIN");
      const control = topology.control; const activeTopology = topology;
      await capture.trigger({ ...event(runId, scenario.id, undefined, "runtime.dispatch", "Build a Flow from the live instruction task and run it"), details: { taskId: creation.task.id, judgeBy: creation.judgement.judgeBy, variantId: workflow.variant?.id ?? null, declaredSecrets: declaredSecrets.map(secret => secret.id) } });
      const lane = await runCreatedFlowLane({
        control, projectId: topology.projectId, authorizationPin: topology.authorizationPin, request: creation, workflow, facilityRunId: runId,
        scenarioOrigin: topology.scenarioOrigin, runToken: topology.allocation.controllerToken, secrets: declaredSecrets,
        authorizeBuild: live.buildAuthorizer(control, activeTopology),
        settleBuild: build => live.settleBuild(build, bundle, details => capture.trigger({ ...event(runId, scenario.id, undefined, "runtime.settle", "The live Flow build finished"), details })),
        ...flowRunHooks(activeTopology, async evidence => {
          await bundle.writeStructured("snapshots/flow-lane.json", createdFlowLaneSnapshot(evidence));
          await writeFlowExtractionMismatches(bundle, scenario, evidence.extraction);
        }),
      });
      await capture.trigger({ ...event(runId, scenario.id, undefined, "runtime.settle", "The created Flow ran and met the task's judgement"), details: { runtimeRunId: lane.run.runId, actionCount: lane.run.actions.length, flowShape: lane.shape } });
    } else {
      if (paired && topology.authorizationPin) await proveCoreActionRoundTrip(page, topology, paired.sessionId, scenario.id, workflow, capture, runId, (timing, result) => { actions.push(timing); automationFailure ??= automationFailureFromActionResult(result); });
      if (topology.control && topology.projectId) recordingBaseline = recordingIds(await topology.control.listRecordings(topology.projectId));
      if (topology.control) {
        // Selected again immediately before the start, so whether Core accepts the recording
        // does not depend on how long pairing, tab activation and the Core action probe took.
        if (topology.projectId) await topology.control.selectProject(topology.projectId);
        // The discard window opens here, after the Core action probe above, whose runtime confirmations Core audits with no recording open.
        discardWindowFrom = Date.now();
        const startResponse = await runtimeMessage(extensionControl, { type: "fluxiq.startRecording" }); recordingStarted = true;
        // startRecording answers before Core accepts the recording, and input before then is not recorded.
        await pollStatus(extensionControl, value => value.recordingState === "recording").catch(async cause => {
          const observed = await runtimeMessage(extensionControl, { type: "fluxiq.getStatus" }).then((response: any) => response.status).catch(() => undefined);
          const diagnostic = { answered: recordingStartDiagnostic(startResponse?.status), observed: recordingStartDiagnostic(observed) };
          await bundle.writeStructured("snapshots/recording-start.json", diagnostic);
          throw new RunnerFailure("recording.persistence", `The extension recording did not start (${describeRecordingStartDiagnostic(diagnostic.observed)})`, { cause, details: diagnostic });
        });
      }
      // FluxIQ reads its own page. The seam is bound to the control page and
      // needs the extension to hold an automation tab, which pairing and
      // `activateScenarioTab` above are what give it; without one the reference
      // reader runs instead, and says that it reported no pages, no truncation
      // and no duration rather than defaulting them (`extract-intent.ts`).
      const extractionIntent = paired ? { extractionIntent: createExtractionIntentDriver(extensionControl) } : {};
      const runner = stepRunner = new ScenarioStepRunner({ context, page, origin: topology.scenarioOrigin, isScenarioUrl, uploadDirectory: path.join(topology.allocation.runRoot, "scenario-uploads"), scriptedNavigation: createScriptedNavigationDriver(extensionControl), ...extractionIntent });
      const reads = extractionRead = new Map<string, ExtractionStepRead>();
      for (const step of recordingWorkflow.recordingScript) {
        await stepCapture.trigger(event(runId, scenario.id, step.id, "step.start", `Start ${step.operation}`));
        const { extraction } = await runner.run(step);
        if (extraction) {
          // Kept before it is judged, so the run publishes what a failing step
          // read (`runExtractionMeasurements`). Every extract step is then
          // asserted against what the read itself reported: an expectation
          // naming `pages` or `truncated` that nothing reported is refused as
          // unjudgeable rather than passed on the rest of it.
          reads.set(step.id, extraction);
          assertExtraction(recordingWorkflow.expected.extracted, step.id, extraction.records, extraction.observed);
        }
        await stepCapture.trigger({ ...event(runId, scenario.id, step.id, step.operation === "checkpoint" ? "checkpoint" : "step.complete", `Complete ${step.operation}`), ...(extraction ? { details: { recordCount: extraction.records.length } } : {}) });
      }
      // Read while still recording: the extension's log is what it recorded.
      recordedEvents = await assertRecordedEvents(() => readExtensionRecordingLog(message => runtimeMessage(extensionControl, message)), recordingWorkflow.expected.recordingEvents ?? []);
      extensionActionCount = await runtimeMessage(extensionControl, { type: "fluxiq.getStatus" }).then((response: any) => response.status?.eventCount, () => undefined);
      scenarioPage = runner.activePage();
      try { await assertFinalState(scenarioPage, scenario, recordingWorkflow); oracleVerdict = "passed"; }
      catch (error) { oracleVerdict = "failed"; throw error; }
    }
    if (topology.control && !creation && (target.mode === "isolated" || target.mode === "persistent-isolated")) {
      await runtimeMessage(extensionPage, { type: "fluxiq.stopRecording" });
      recordingStarted = false;
      const outcome = await assertCoreRoundTrip(topology, paired?.sessionId, recordingBaseline);
      // Core audits a message that reached a finalized recording, tells the client
      // nothing, and since `267a2ca` no longer fails the connection for it: its audit
      // log and the extension's own state after Stop are where a short recording shows.
      // A discard is this run's by its recording, or, naming none, by the session this run paired, and only inside the recording's window.
      const discardScope: RecordingDiscardScope = { recordingIds: outcome.newRecordingIds, sessionId: paired?.sessionId, from: discardWindowFrom };
      const discardAudit = readRecordingDiscards(await topology.control.gatewaySnapshot(), discardScope);
      firstDiscardRead = { scope: discardScope, discards: discardAudit.discards };
      const connectionAfterStop = await runtimeMessage(extensionControl, { type: "fluxiq.getStatus" }).then((response: any) => String(response.status?.connectionState ?? "unreported"), () => "unavailable");
      // An action that never reached the recording shows in neither the audit nor an entry count, so Core's actions are counted against the extension's.
      const completeness = await readRecordingCompleteness(topology.control, { projectId: topology.projectId, recordingIds: outcome.newRecordingIds, extensionActionCount });
      await capture.trigger({ ...event(runId, scenario.id, undefined, "gateway.action", "Core gateway retained the paired extension session"), details: { sessionCount: outcome.sessionCount } });
      await capture.trigger({ ...event(runId, scenario.id, undefined, "runtime.settle", "Core persisted the completed recording"), details: { recordingCount: outcome.recordingCount, projectId: topology.projectId, recordedEvents, recordingDiscards: discardAudit.discards, recordingDiscardWindow: discardAudit.window, extensionConnectionAfterStop: connectionAfterStop, recordedActions: { extension: completeness.extensionActions, core: completeness.coreActions }, recordings: outcome.finalized.map(item => ({ recordingId: item.recordingId, entryCount: item.entryCount, entriesAppendedAfterFirstPoll: item.entriesAppendedWhileWaiting, finalizationWaitMs: item.waitedMs })) } });
      if (discardAudit.failure) throw discardAudit.failure;
      if (completeness.failure) throw completeness.failure;
      if (options.flow) {
        const control = topology.control;
        const activeTopology = topology;
        const recordingId = outcome.newRecordingIds[0];
        const { projectId, authorizationPin } = topology; if (!projectId || !authorizationPin) throw new RunnerFailure("environment.missing", "The Flow lane needs an authenticated isolated Core with an authorization PIN");
        if (outcome.newRecordingIds.length !== 1 || !recordingId) throw new RunnerFailure("recording.persistence", `The Flow lane builds a Flow from exactly the recording this run produced, and observed ${outcome.newRecordingIds.length} new recordings`);
        await capture.trigger({ ...event(runId, scenario.id, undefined, "runtime.dispatch", "Build a Flow from the run's own recording and run it"), details: { variantId: workflow.variant?.id ?? null, declaredSecrets: declaredSecrets.map(secret => secret.id) } });
        // Settled however the lane ends: an overspend or an unreached provider fails a finished run, and a failed lane still leaves its provider calls itemized.
        const lane = await runLaneWithLiveLlmSettlement({ live, control, projectId, bundle, publish: details => capture.trigger({ ...event(runId, scenario.id, undefined, "runtime.settle", "The live provider run finished"), details }) }, async flowRunIdentified => await runFlowLane({
          control, projectId, authorizationPin, recordingId,
          scenario, workflow: flowWorkflow, facilityRunId: runId, flowRunIdentified, ...(repair ? { repairExpectation: repair } : {}),
          // The unarmed workflow's, which the recording lane asserted above.
          recordingEvents: recordingWorkflow.expected.recordingEvents ?? [],
          scenarioOrigin: activeTopology.scenarioOrigin, runToken: activeTopology.allocation.controllerToken, secrets: declaredSecrets,
          ...(live ? { authorizeLiveLlm: live.authorizer(control, activeTopology) } : {}),
          // Closes the discard window for the second read: Core audits the Flow's runtime confirmations against the finalized recording.
          flowDispatchStarting: at => { discardWindowUntil = at; },
          ...flowRunHooks(activeTopology, async evidence => {
            await bundle.writeStructured("snapshots/flow-lane.json", flowLaneSnapshot(evidence));
            await writeFlowExtractionMismatches(bundle, scenario, evidence.extraction);
          }),
        }));
        if (lane.observation.oracleVerdict === "failed") throw new RunnerFailure("runtime.behavior", "The generated Flow ran, but the fixture's expected final state did not hold afterwards");
        await capture.trigger({ ...event(runId, scenario.id, undefined, "runtime.settle", "The generated Flow ran and met the workflow's expectations"), details: { runtimeRunId: lane.run.runId, actionCount: lane.run.actions.length, harnessActivations: lane.run.harnessActivations } });
        // `--replays N`: approve the repair this run produced, apply it to the Flow, and replay that Flow N
        // times with no grant, so "the model fixed it" becomes "the Flow works without the model". Without
        // the option the lane does nothing. `checkGoal` is judged against the scenario's own expected final
        // state, never the proposal-only one an `adapt` run's Flow run was held to.
        await runLiveRepairLane(control, {
          ...(options.replays === undefined ? {} : { replays: options.replays }), ...(live ? { live } : {}),
          lane, projectId, facilityRunId: runId, scenarioId: scenario.id, secrets: declaredSecrets, steps: flowWorkflow.recordingScript,
          scenarioOrigin: activeTopology.scenarioOrigin, runToken: activeTopology.allocation.controllerToken,
          prepare: flowRunHooks(activeTopology, async () => undefined).prepareFlowPage,
          checkGoal: () => findScenarioPageWithExpectedState(context!, page, activeTopology.scenarioOrigin, scenario, workflow).then(found => { scenarioPage = found; return true; }, () => false),
          bundle, publish: details => capture.trigger({ ...event(runId, scenario.id, undefined, "runtime.settle", "The live repair was applied and replayed"), details }),
        });
      }
    }
    // A Flow-lane run that never reached the lane built no Flow, and does not pass on the recording's checks alone.
    assertFlowLaneBuiltFlow({ flowLane, evaluated: target.mode === "isolated" || target.mode === "persistent-isolated", published: flowObservation });
    consoleWatch.assertOnlyAllowed(workflow.expected.allowedConsoleErrors);
    networkGuard.assertNoViolations();
    await capture.trigger(event(runId, scenario.id, undefined, "final", "Scenario completed"));
    verdict = "passed";
  } catch (error) {
    failureCategory = classifyRunnerFailure(error);
    failureMessage = error instanceof Error ? error.message : String(error);
    if (flowObservation?.reportedVerdict == null) {
      facilityFailure = projectFacilityFailure(error, "finalized-bundle", "scenario.execute");
    }
    // Recorded-event mismatches are types and counts, never page data, so they are published for diagnosis.
    // So is what the Flow reported when the lane got that far: Core's category and closed-set code, and nothing else of the record.
    const flowReported = flowObservation?.automationFailureReported;
    const finalizationWaitDetails = finalizedRecordingWaitFailureDetails(error);
    const pairingWaitDetails = pairingStatusWaitFailureDetails(error);
    const httpTransportDetails = httpTransportFailureDetails(error);
    const topologyReadinessDetails = topologyReadinessFailureDetails(error);
    const failureEvent = { ...event(runId, scenario.id, undefined, "error", failureMessage), details: { failureCategory, ...(error instanceof RunnerFailure && error.category === "recording.contract" && error.details ? { failureDetails: error.details } : {}), ...(finalizationWaitDetails ? { failureDetails: finalizationWaitDetails } : {}), ...(pairingWaitDetails ? { failureDetails: pairingWaitDetails } : {}), ...(httpTransportDetails ? { failureDetails: httpTransportDetails } : {}), ...(topologyReadinessDetails ? { failureDetails: topologyReadinessDetails } : {}), ...(flowReported ? { flowReportedFailure: { category: flowReported.category, ...(flowReported.code === undefined ? {} : { code: flowReported.code }) } } : {}) } };
    const failurePage = stepRunner?.activePage() ?? scenarioPage;
    const bytes = evidence.failureScreenshot && scenario.id !== "sensitive-input" && failurePage && !failurePage.isClosed() ? await failurePage.screenshot({ type: "png" }).catch(() => undefined) : undefined;
    if (bytes) {
      const digest = sha256(bytes);
      const artifactPath = `screenshots/failure-${digest.slice(0, 12)}.png`;
      await bundle.writeVerifiedVisual(artifactPath, { bytes, mediaType: "image/png", redactionVerified: true });
      await bundle.appendEvent({ ...failureEvent, screenshot: { path: artifactPath, sha256: digest } });
    } else await capture.trigger(failureEvent).catch(() => undefined);
  } finally {
    setFacilityStage("scenario.cleanup");
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
        const hadPrimaryFailure = failureCategory !== undefined && failureMessage !== undefined;
        const completion = cleanupFailureOutcome({ category: failureCategory, message: failureMessage }, "clone-source-verification", error instanceof Error ? error.message : String(error), classifyRunnerFailure(error));
        verdict = "failed";
        failureCategory = completion.primary.category;
        failureMessage = completion.primary.message;
        if (!hadPrimaryFailure && flowObservation?.reportedVerdict == null) {
          facilityFailure = projectFacilityFailure(error, "finalized-bundle", "scenario.cleanup");
        }
        await capture.trigger({ ...event(runId, scenario.id, undefined, "error", completion.event.summary), details: completion.event.details }).catch(() => undefined);
      }
    }
    try { await context?.close(); }
    catch (error) {
      const hadPrimaryFailure = failureCategory !== undefined && failureMessage !== undefined;
      const cleanup = cleanupFailureOutcome({ category: failureCategory, message: failureMessage }, "browser", error);
      verdict = "failed"; failureCategory = cleanup.primary.category; failureMessage = cleanup.primary.message;
      if (!hadPrimaryFailure && flowObservation?.reportedVerdict == null) {
        facilityFailure = projectFacilityFailure(error, "finalized-bundle", "scenario.cleanup");
      }
      await capture.trigger({ ...event(runId, scenario.id, undefined, "error", cleanup.event.summary), details: cleanup.event.details }).catch(() => undefined);
    }
    // The second read of Core's discard audit. Core audits a discard only when the late
    // message arrives, which can be after the first read; the browser has closed, so no
    // message is still to come, and Core, whose audit is in memory, has not. A discarded
    // action outranks what the run concluded from the short recording; an audit this read
    // cannot get fails only a run that had passed.
    if (firstDiscardRead && topology?.control) {
      const earlier = firstDiscardRead.discards;
      // A snapshot this read could not fetch, or that held no audit log to read (`excluded: null`), is fetched once more before
      // the read fails closed: in Lab Stage 2 one failed fetch failed a W19 run whose Flow had met its expectations.
      let secondRead: ReturnType<typeof readRecordingDiscards>;
      let snapshotFetches = 0;
      do {
        snapshotFetches += 1;
        secondRead = readRecordingDiscards(await topology.control.gatewaySnapshot().catch(() => undefined), { ...firstDiscardRead.scope, until: discardWindowUntil }, earlier);
      } while (secondRead.window.excluded === null && snapshotFetches < 2);
      await capture.trigger({ ...event(runId, scenario.id, undefined, "runtime.settle", "Core's discard audit was read again before the topology closed"), details: { recordingDiscards: secondRead.discards, recordingDiscardWindow: secondRead.window, discardsAfterFirstRead: secondRead.discards.length - earlier.length, snapshotFetches } }).catch(() => undefined);
      const failure = secondRead.failure;
      if (failure && (failure.category === "recording.persistence" ? failureCategory !== "recording.persistence" : verdict === "passed")) {
        const superseded = failureCategory;
        verdict = "failed"; failureCategory = failure.category; failureMessage = failure.message;
        await capture.trigger({ ...event(runId, scenario.id, undefined, "error", failure.message), details: { failureCategory: failure.category, recordingDiscards: secondRead.discards, ...(superseded ? { supersededFailureCategory: superseded } : {}) } }).catch(() => undefined);
      }
    }
    try { await topology?.close(); }
    catch (error) {
      const hadPrimaryFailure = failureCategory !== undefined && failureMessage !== undefined;
      const cleanup = cleanupFailureOutcome({ category: failureCategory, message: failureMessage }, "topology", error);
      verdict = "failed"; failureCategory = cleanup.primary.category; failureMessage = cleanup.primary.message;
      if (!hadPrimaryFailure && flowObservation?.reportedVerdict == null) {
        facilityFailure = projectFacilityFailure(error, "finalized-bundle", "scenario.cleanup");
      }
      await capture.trigger({ ...event(runId, scenario.id, undefined, "error", cleanup.event.summary), details: cleanup.event.details }).catch(() => undefined);
    }
    if (failureMessage && !bundle.getEvents().some(item => item.trigger === "error" && item.summary === failureMessage)) {
      await capture.trigger({ ...event(runId, scenario.id, undefined, "error", failureMessage), details: { failureCategory } }).catch(() => undefined);
    }
    if (topology) await copyProcessLogs(bundle, topology.allocation.logsDir);
    // Core has stopped and its logs are in the bundle; the clone cleanup below
    // deletes the workspace, and `finalize` renames the staging directory. This is
    // the one point where both trees are complete and still exist. A persistent-isolated
    // workspace outlives the run, so only what this run wrote there is scanned.
    if (redactionLiterals) {
      const failRedaction = async (message: string, details: Record<string, unknown>) => {
        if (verdict === "passed") { failureCategory = "security.redaction"; failureMessage = message; }
        verdict = "failed";
        await capture.trigger({ ...event(runId, scenario.id, undefined, "error", message), details: { failureCategory: "security.redaction", ...details } }).catch(() => undefined);
      };
      try { redaction = await attestRunRedaction({ literals: redactionLiterals, scopes: runRedactionScopes({ bundleStagingPath: bundle.stagingPath, workspaceStorageDir: topology?.allocation.storageDir, workspaceWrittenSince: target.mode === "persistent-isolated" ? Date.parse(startedAt) : undefined }) }); }
      catch (error) { await failRedaction(`Redaction attestation could not run: ${redactionLiterals.reduce((text, literal) => text.replaceAll(literal, "[redacted]"), error instanceof Error ? error.message : String(error))}`, {}); }
      if (redaction?.status === "failed") await failRedaction(`Redaction attestation found ${redaction.findingCount} file(s) holding a declared literal or left unread`, { findings: redaction.findings });
      if (redaction) await bundle.writeStructured("snapshots/redaction-attestation.json", redaction).catch(() => undefined);
    }
    if (target.mode === "clone" && topology) {
      try {
        await removeRunOwnedTopologyState(topology);
        topologyStateRemoved = true;
        cloneState.cleanupOutcome = "completed";
      } catch (error) {
        const hadPrimaryFailure = failureCategory !== undefined && failureMessage !== undefined;
        const cleanup = cleanupFailureOutcome({ category: failureCategory, message: failureMessage }, "clone-destination", error);
        verdict = "failed";
        failureCategory = cleanup.primary.category;
        failureMessage = cleanup.primary.message;
        if (!hadPrimaryFailure && flowObservation?.reportedVerdict == null) {
          facilityFailure = projectFacilityFailure(error, "finalized-bundle", "scenario.cleanup");
        }
        cloneState.cleanupOutcome = "failed";
        await capture.trigger({ ...event(runId, scenario.id, undefined, "error", cleanup.event.summary), details: cleanup.event.details }).catch(() => undefined);
      }
    }
    if (target.mode === "clone" && !topology) cloneState.cleanupOutcome = "completed";
  }
  setFacilityStage("bundle.publish");
  try {
    const manifest = await createRunManifest({ repositoryRoot: options.repositoryRoot, fluxiqRepositoryRoot: options.fluxiqRepositoryRoot, target: options.target, scenario, runId, seed, startedAt, verdict, browserVersion, extensionPath, topology, existingPreflight, existingExecution, panelVerification, cloneState, workflowId: workflow.workflowId, variantId: workflow.variant?.id, automationFailure, steps: stepRunner?.timings() ?? [], actions, redaction });
    assertRunManifest(manifest);
    await bundle.writeStructured("run.json", manifest);
    const metrics = { steps: workflow.recordingScript.length };
    // A Flow-lane run the lane never published for is a Flow run that created
    // no Flow, not a recording-lane run: see `selectLaneObservation`.
    const observation = selectLaneObservation({
      evaluated: target.mode === "isolated" || target.mode === "persistent-isolated",
      flowLane,
      published: flowObservation,
      automationFailureExpected: flowWorkflow.expected.failure ?? null,
      recordingLane: () => recordingLaneProbeObservation({
        oracleVerdict, actions, automationFailure,
        automationFailureExpected: workflow.expected.failure ?? null,
        // The run knows which steps ran: one measurement per `extract` step of the script it executed, or `null` when it executed none.
        extraction: extractionRead ? runExtractionMeasurements({ script: recordingWorkflow.recordingScript, expected: recordingWorkflow.expected.extracted, read: extractionRead }) : null,
      }),
    });
    // The run's own `RunEvaluation`, built from the observation the lane just
    // published: the same judgement `lab bench` records per corpus row, so one
    // run can be read on its own instead of only as a corpus rate. It is
    // written into the bundle before finalization, which makes it a hashed
    // artifact `lab inspect` verifies, and returned so `lab run` prints it.
    // The existing and clone targets run a pre-existing Flow on no evaluation
    // lane, publish no observation, and so get no evaluation. A Flow-lane run's
    // evidence sizes come from the staging directory's `snapshots/flow-lane.json`,
    // the file the bench reads once `finalize` has renamed that directory.
    const evaluation = observation
      ? singleRunEvaluation({ runId, verdict, failureCategory, facilityFailure, scenarioId: scenario.id, workflowId: workflow.workflowId, variantId: workflow.variant?.id, repeatIndex: benchReceipt?.cellIdentity.repeatIndex ?? 0, observation, manifest, metrics, events: bundle.getEvents(), wallClockMs: Date.now() - Date.parse(startedAt), llm: live?.usage, bundlePath: bundle.stagingPath })
      : undefined;
    if (evaluation) await bundle.writeStructured("evaluation.json", evaluation);
    if (benchReceipt) await bundle.writeStructured("bench-receipt.json", benchReceipt);
    bundle.registerEvidencePolicy(evidence.capture);
    const finalized = await bundle.finalize({ verdict, metrics });
    return { runId, verdict, path: finalized.path, ...(observation ? { observation } : {}), ...(evaluation ? { evaluation } : {}), ...(failureCategory ? { failureCategory } : {}) };
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
async function extensionControlPage(context: BrowserContext): Promise<Page> { const worker = await awaitExtensionWorker(context); const id = new URL(worker.url()).hostname; const page = await context.newPage(); await page.goto(`chrome-extension://${id}/sidepanel/index.html`); return page; }
type PairedExtensionStatus = Record<string, unknown> & { connectionState: "connected"; sessionId: string };
async function pairExtension(page: Page, topology: RunningTopology): Promise<PairedExtensionStatus> {
  return pairExtensionWithColdEpochRecovery({
    connect: async () => (await runtimeMessage(page, { type: "fluxiq.connect", settings: { gatewayUrl: topology.gatewayUrl, coreApiUrl: topology.fluxiqOrigin, autoReconnect: true, captureMutations: true, captureInputValues: true, captureSnapshots: true } })).status,
    readStatus: () => extensionStatus(page),
    approvePairing: referenceCode => topology.control!.approvePairing(referenceCode),
  });
}
/** How long the start page is given to show a probe candidate's target before that step is passed over. */
const PROBE_TARGET_VISIBLE_MS = 1_000;
/**
 * Proves one Core-issued action reaches the page, typing into the step `selectCoreProbeStep` chooses: a `type` step whose
 * target is visible on `page`, still the start page the recording is about to begin on. A skipped probe is published with its
 * reason. Each action is reported to `record`.
 */
async function proveCoreActionRoundTrip(page: Page, topology: RunningTopology, sessionId: string, scenarioId: string, workflow: ResolvedScenarioWorkflow, capture: EvidenceCaptureController, runId: string, record: (timing: RunActionTiming, result: unknown) => void) {
  // Visible is not enough: a consent overlay covers a visible field, and Core rightly refuses to type into it.
  // A trial click runs the whole actionability check, including "receives events", and presses nothing.
  const choice = await selectCoreProbeStep(workflow.recordingScript, selector => coreProbeTargetUsable(page, selector, PROBE_TARGET_VISIBLE_MS));
  if (choice.kind === "skipped") {
    await capture.trigger({ ...event(runId, scenarioId, undefined, "runtime.settle", "The Core action probe was skipped"), details: { reason: choice.reason, stepIds: choice.stepIds } });
    return;
  }
  const { step, selector: target } = choice; const correlationId = createCorrelationId("command"); const text = "FluxIQ Core probe";
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
/**
 * The recording a run produced, once Core has actually finished writing it.
 *
 * A recording *id* exists from `client.start_recording`, so the wait for one
 * to appear has always returned immediately -- and the caller then read a
 * recording Core was still appending to. `awaitFinalizedRecording` waits for
 * Core's own `endedAt`, which it stamps only after the stop drain and the
 * entry flush, so "Core persisted the completed recording" is true when this
 * says so rather than merely likely.
 */
async function assertCoreRoundTrip(topology: RunningTopology, expectedSessionId?: string, recordingBaseline?: Set<string>) {
  const snapshot = await topology.control!.gatewaySnapshot() as any;
  const sessions = snapshot?.payload?.sessions;
  if (!Array.isArray(sessions) || !sessions.some((session: any) => (session.status === "ready" || session.status === "connected") && (!expectedSessionId || session.sessionId === expectedSessionId))) throw new RunnerFailure("gateway.connection", "Core gateway snapshot has no matching paired extension session");
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const response = await topology.control!.listRecordings(topology.projectId!) as any;
    const ids = recordingIds(response);
    const newRecordingIds = recordingBaseline ? [...ids].filter(id => !recordingBaseline.has(id)) : [...ids];
    if (newRecordingIds.length) {
      // Only a baselined call knows which recordings this run produced; without
      // a baseline every recording in the project is "new", and an unrelated
      // open one must not fail the run. The Flow lane holds the same wait on
      // the exact recording it builds from, so the guarantee is not lost there.
      const finalized = recordingBaseline
        ? await Promise.all(newRecordingIds.map(recordingId => awaitFinalizedRecording(topology.control!, { projectId: topology.projectId!, recordingId })))
        : [];
      return { sessionCount: sessions.length, recordingCount: ids.size, newRecordingCount: newRecordingIds.length, newRecordingIds, finalized };
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new RunnerFailure("recording.persistence", recordingBaseline ? "Core did not persist a new recording for the completed scenario run" : "Core did not persist a recording for the completed scenario");
}
function recordingIds(response: any): Set<string> { const values = response?.payload?.recordings ?? response?.payload?.items ?? response?.payload; if (!Array.isArray(values)) return new Set(); return new Set(values.flatMap((item: any) => { const id = item?.recordingId ?? item?.id; return typeof id === "string" && id ? [id] : []; })); }
/** The facts `finalStateFacts` chooses: the final state, then a positive primary run's playback-goal facts. */
async function assertFinalState(page: Page, scenario: WebScenario, workflow: ResolvedScenarioWorkflow) { await assertExpectedFacts(finalStateFacts(scenario, workflow), playwrightScenarioFactProbe(page)); }
async function findScenarioPageWithExpectedState(context: BrowserContext, fallback: Page, origin: string, scenario: WebScenario, workflow: ResolvedScenarioWorkflow): Promise<Page> { for (const candidate of context.pages().filter(item => !item.isClosed() && item.url().startsWith(`${origin}/`)).reverse()) { try { await assertFinalState(candidate, scenario, workflow); return candidate; } catch {} } await assertFinalState(fallback, scenario, workflow); return fallback; }
/**
 * Loads the fixture's own entry point, `scenario.startPath`. Every load of the
 * fixture the runner performs goes through it -- the unarmed load the
 * recording is made against, and the Flow lane's load before every Flow run,
 * armed or not -- because a Flow generated from a recording that began at
 * `startPath` begins there too.
 *
 * The Flow lane's load used to be a `page.reload()` once a variant was armed,
 * which reloads wherever the recording left the page rather than where the Flow
 * starts, and an unarmed run had no load at all. Most fixtures end their
 * recording on the page they opened on and could not tell the difference;
 * `auth-gate` ends on `/scenarios/auth-gate/account`, and once the `expired`
 * variant is armed that URL answers 302 to `/?expired=1`. So the armed run
 * began on a rendering the workflow never starts from: its page facts were
 * judged against the wrong page, the Flow's first action typed into a
 * `testid:username` that page does not carry, and the account GET recorded a
 * denial in the fixture state before the Flow had done anything. Unarmed, W18
 * ran its Flow on that account page, where no password field exists. No
 * scenario wants the recording's last page here -- the Flow replays the
 * recording from its beginning, and `multi-tab`, the only other fixture whose
 * recording leaves this tab's URL in question, expects to be back on
 * `startPath` anyway.
 */
export async function openScenarioStart(page: Pick<Page, "goto">, scenarioOrigin: string, scenario: Pick<WebScenario, "startPath">): Promise<void> {
  await page.goto(`${scenarioOrigin}${scenario.startPath}`);
}

/** The same workflow with no variant applied: what the Flow lane records. */
function unarmedWorkflow(scenario: WebScenario, options: RunScenarioOptions): ResolvedScenarioWorkflow {
  try { return resolveScenarioWorkflow(scenario, { ...(options.workflowId === undefined ? {} : { workflowId: options.workflowId }) }); }
  catch (cause) { throw new RunnerFailure("fixture.invalid", cause instanceof Error ? cause.message : String(cause), { cause }); }
}
function workflowSelection(options: RunScenarioOptions): { workflowId?: string; variantId?: string } {
  return { ...(options.workflowId === undefined ? {} : { workflowId: options.workflowId }), ...(options.variantId === undefined ? {} : { variantId: options.variantId }) };
}
/**
 * When this run arms its variant relative to the first page load, which is all
 * the page-fact schedule needs to know about the lane. Both Flow lanes present
 * the unarmed rendering first and arm before the page they explore or run.
 * `resolveWorkflow` has already refused a variant on any other combination, so
 * a resolved variant on neither is the existing or clone lane, which arms
 * before it opens the fixture and never presents the unarmed rendering.
 */
function armingOf(options: RunScenarioOptions, workflow: ResolvedScenarioWorkflow): ScenarioArming {
  if (options.flow || options.creation) return "arms-after-loading";
  return workflow.variant ? "arms-before-loading" : "unarmed";
}
function resolveWorkflow(scenario: WebScenario, options: RunScenarioOptions, target: FluxIQTargetConfiguration): ResolvedScenarioWorkflow {
  let workflow: ResolvedScenarioWorkflow;
  try { workflow = resolveScenarioWorkflow(scenario, { ...(options.workflowId === undefined ? {} : { workflowId: options.workflowId }), ...(options.variantId === undefined ? {} : { variantId: options.variantId }) }); }
  catch (cause) { throw new RunnerFailure("fixture.invalid", cause instanceof Error ? cause.message : String(cause), { cause }); }
  if (workflow.variant && !options.flow && !options.creation && target.mode !== "existing" && target.mode !== "clone") throw new RunnerFailure("fixture.invalid", "A variant is armed only before a Flow run; the recording lane always records the workflow unarmed");
  // A script that records no action yields no Flow on any product: refused before the bundle, Core or a browser exists, with the reason the bench skips it for.
  const noFlowLane = options.flow ? flowLaneExclusion(workflow.recordingScript) : undefined;
  if (noFlowLane !== undefined) throw new RunnerFailure("fixture.invalid", `A Flow run was refused: ${noFlowLane}`);
  return workflow;
}
function probeTiming(actionType: string, startedAt: number, result: any): RunActionTiming { return { actionType, startedAt: new Date(startedAt).toISOString(), durationMs: Math.max(0, Date.now() - startedAt), status: runActionStatus(result?.status) }; }
function event(runId: string, scenarioId: string, stepId: string | undefined, trigger: "step.start" | "step.complete" | "gateway.action" | "runtime.dispatch" | "runtime.settle" | "checkpoint" | "error" | "final", summary: string) { return { trigger, summary, correlation: { runId, scenarioId, ...(stepId ? { stepId } : {}), correlationId: createCorrelationId() } }; }

async function copyProcessLogs(bundle: EvidenceBundle, logsDir: string) { try { for (const name of await readdir(logsDir)) if (name.endsWith(".log")) await bundle.writeText(`logs/${name}`, await readFile(path.join(logsDir, name), "utf8")); } catch {} }
