// The scenario runner's spine: open one evidence bundle, drive one of four
// lanes against one fixture, and close the bundle whatever happened.
//
// **Why this file reached 812 lines (t150).** Six responsibilities had settled
// here that say nothing about the order a run happens in, and each is now a
// module under `run-scenario/` with its own tests: the browser session (the
// extension build, the Chromium it is loaded into, the tab the extension is
// made to hold, the origins the session is confined to); which workflow and
// variant a run resolves to and when it arms; which secret values it replays,
// scrubs and later attests; the fixture's entry point; the round trip proving
// Core kept the session and finished the recording; and what the two lanes that
// replay an already-existing Flow share.
//
// **Why the rest stays here**, mechanically rather than by preference. The
// structure audit keys its `swallowed-failure` and `failure-as-empty` findings
// by file path, so this run's failure handling -- the catch, the cleanup, the
// publication -- cannot move without landing in a file with no baseline entry
// and failing the audit outright. And the order of the call sites below is
// pinned at the source by four test files (`run-evaluation/tests/`, `tests/`),
// which is the only way anything can check that the Core action probe runs
// before the fixture reset, that a step's extraction read is kept before the
// assertion that may throw, or that the redaction scan happens once Core has
// stopped and before the bundle is sealed. Those guarantees are the ordering.
//
// A second pass moves the four lane branches and `flowRunHooks` (~170 lines).
// Both need the same thing first: the dozen `let`s that the catch, the cleanup
// and the manifest all read have to become one record the spine and a lane
// share, because a lane assigns to six of them partway through and a module
// returning its results instead would change what a mid-lane failure leaves in
// the bundle.
import { randomBytes } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type { BrowserContext, Page } from "@playwright/test";
import { assertClonePackage, assertRunManifest, canonicalClonePackageJson, flowLaneExclusion, resolveScenarioWorkflow, scenarioPageFactSchedule, type FacilityFailureStage, type ResolvedScenarioWorkflow, type RunActionTiming, type RunAutomationFailure, type RunEvaluation, type WebScenario } from "@fluxiq-web-extension/test-contracts";
import { EvidenceBundle, EvidenceCaptureController, sha256 } from "@fluxiq-web-extension/test-evidence";
import type { EvidenceMode } from "./commands.js";
import { removeRunOwnedTopologyState, startTopology, type RunningTopology } from "./coordinator.js";
import { classifyRunnerFailure, RunnerFailure, type RunnerFailureCategory } from "./failure.js";
import { WebPanelAuthSessionCache } from "./auth-session.js";
import type { ExistingFluxIQControlClient } from "./existing-fluxiq-control.js";
import { httpTransportFailureDetails, topologyReadinessFailureDetails } from "./http-control/index.js";
import { executeExistingPersistedFlow, preflightExistingFluxIQ, type ExistingFlowExecution, type ExistingFluxIQPreflight } from "./existing-flow-run.js";
import { scenarioNetworkOrigins, type DeterministicNetworkGuard } from "./network-guard.js";
import { verifyAuthenticatedFluxIQPanel, type FluxIQPanelVerificationOutcome } from "./panel-verification.js";
import { assertExpectedFacts, playwrightScenarioFactProbe } from "./scenario-assertions.js";
import { loadScenarioManifest } from "./scenarios.js";
import type { FluxIQTargetConfiguration } from "./target-config.js";
import { exportCloneSource } from "./clone-source-exporter.js";
import { createDeterministicCloneIdMap } from "./clone-policy.js";
import { createRunOwnedCloneFlowId, createRunOwnedCloneProject, importClonePackageIntoIsolatedDestination } from "./isolated-flow-importer.js";
import { effectiveEvidencePolicy } from "./evidence-policy/index.js";
import { resolveLabPaths } from "./lab-instance/index.js";
import { armScenarioVariant } from "./lab-control/index.js";
import { createdFlowLaneSnapshot, createdFlowSecretInputs, writeFlowExtractionMismatches, finalizedRecordingWaitFailureDetails, flowLaneSnapshot, readRecordingDiscards, recordingLaneProbeObservation, resetScenarioLab, runLiveRepairLane, withDeclaredFlowRepair, runCreatedFlowLane, runFlowLane, selectLaneObservation, type CreatedFlowRequest, type LiveRepairLaneInput, type ProveLiveRepairControl, type PersistedFlowRunOutcome, type RecordingDiscard, type RecordingDiscardScope, type RunLaneObservation } from "./flow-lane/index.js";
import { attestRunRedaction, chromiumExtensionStorageDirs, runRedactionScopes, type RunRedactionAttestation } from "./redaction-attestation/index.js";
import { declaredProviderCalls, runLaneWithLiveLlmSettlement, type LiveLlmRun } from "./live-llm/index.js";
import { runProviderFailureLog, writeProviderFailureSidecar } from "./provider-failure/index.js";
import { assertExtraction, assertRecordedEvents, ConsoleErrorWatch, readExtensionRecordingLog, readRecordingCompleteness, runExtractionMeasurements, type ExtractionStepRead } from "./run-expectations/index.js";
import { singleRunEvaluation } from "./run-evaluation/index.js";
import { PERSON_HAND_OFFS_SNAPSHOT, startLabPerson, type LabPerson } from "./person-simulation/index.js";
import { automationFailureFromActionResult, createRunManifest, flowActionTimings, type CloneRunState } from "./run-manifest/index.js";
import { assertFlowLaneBuiltFlow, coreIdentityRequired, finalStateFacts, flowStartPage, scenarioStartUrl, type FlowLanePermissionStop, type FlowLaneStoppedForPermission } from "./lane-rules/index.js";
import { proveCoreActionRoundTrip } from "./core-action-probe/index.js";
import { createExtractionIntentDriver, createScriptedNavigationDriver, ScenarioStepRunner } from "./scenario-steps/index.js";
import { cleanupFailureOutcome, describeRecordingStartDiagnostic, extensionStatus, pairingStatusWaitFailureDetails, pairExtensionWithColdEpochRecovery, pollStatus, recordingStartDiagnostic, runtimeMessage } from "./run-lifecycle/index.js";
import { assertSafeScenarioRunId, createBenchReceipt, type BenchReceiptMetadata } from "./bench/index.js";
import { projectFacilityFailure, ProjectedFacilityError } from "./facility-failure/index.js";
import { ExtensionStartTrace, writeExtensionStartSidecar, extensionControlPage, extensionStartFailureDetails, activateScenarioTab, armingOf, assertCoreRoundTrip, browserVersionFromCdp, cloneDestinationAssessment, configuredCredentials, evidenceEvent, exportRunClonePackage, installRunNetworkGuard, keepsRunState, launchBrowser, openExistingFluxIQControl, openLivePanel, openScenarioStart, persistedFlowRunContext, productFailureOf, readDecisionTrace, recordingIds, requireExtension, resolveRunSecrets, unarmedWorkflow, workflowSelection, writePersistedFlowSnapshots, UiReviewRecorder, PeriodicCapture, createRunScreenshotAdapter } from "./run-scenario/index.js";

/**
 * The blank tab a browser opens on, and where a Flow that must reach its own
 * page is left to start. The extension refuses to automate it
 * (`runtime/unsupported-page.ts`) except by navigating away from it, which is
 * exactly the split wanted: a Flow whose first node is its navigation leaves,
 * and one that has no navigation cannot do anything here at all.
 */
const BLANK_TAB_URL = "about:blank";

/** `evidence` overrides the manifest's `evidencePolicy`; `workflowId` and `variantId` select what `resolveScenarioWorkflow` resolves, and a `creation` run passes its request's own. `livePanel: false` (`--no-live-panel`) keeps the extension panel from being shown beside a headed run's page. */
export type RunScenarioOptions = { repositoryRoot: string; fluxiqRepositoryRoot: string; runsDirectory: string; scenarioId: string; seed?: number; evidence?: EvidenceMode; workflowId?: string; variantId?: string; flow?: boolean; creation?: CreatedFlowRequest; environment?: NodeJS.ProcessEnv; target?: FluxIQTargetConfiguration; runId?: string; benchReceipt?: BenchReceiptMetadata; live?: LiveLlmRun; replays?: number; livePanel?: boolean };
/**
 * `observation` carries the `RunEvaluation` fields only the lane that ran can
 * know, and `evaluation` is the run's own `RunEvaluation` built from it — the
 * same judgement the bench records per corpus row, also persisted in the
 * bundle as `evaluation.json`. Both are absent on the existing and clone
 * targets, which run a pre-existing Flow on no evaluation lane.
 */
/**
 * `permissionStop` is present when the created-Flow build stopped to ask at the task's declared permission point: its `verdict` is
 * `stopped_for_permission`, with the consequence and control it stopped at, and the run's own `verdict` is then `failed`, never `passed`.
 */
export type RunScenarioResult = { runId: string; verdict: "passed" | "failed"; path: string; failureCategory?: string; observation?: RunLaneObservation; evaluation?: RunEvaluation; permissionStop?: FlowLaneStoppedForPermission };
/** Owned by `run-scenario/open-scenario-start.ts` and re-exported unchanged, so every caller and test that imported it from here still does. */
export { openScenarioStart };

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
  // A Flow-lane run whose intent only proposes a repair is held to what the scenario declares such a run ends with, and judged on the proposal: a recorded
  // Flow always, and a created one when `--replays` has its repair applied, whose proposal the repair lane then judges (`proveRepair` below).
  const workflow = resolveWorkflow(scenario, options, target);
  const { workflow: flowWorkflow, repair } = await withDeclaredFlowRepair(workflow, { scenario, scenarioLabDist: labPaths.scenarioLabDist, flowLane: options.flow === true || (options.creation !== undefined && options.replays !== undefined), proposalOnly: options.live?.proposesRepairOnly === true });
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
  // What this run's scenario declares about provider calls, read from the same
  // resolved expectations the lane is judged by, so a variant's declaration
  // replaces the workflow's exactly as every other field of `expected` does.
  if (live) live.expectProviderCalls(declaredProviderCalls(flowWorkflow.expected, { scenarioId: scenario.id, workflowId: workflow.workflowId, variantId: workflow.variant?.id }));
  // What this run must replay, scrub, and afterwards attest was not left behind,
  // resolved before the bundle exists so a declaration the environment cannot
  // satisfy fails the run before anything is written (`run-scenario/resolve-run-secrets.ts`).
  const { declaredSecrets, secrets, redactionLiterals } = resolveRunSecrets({ scenario, workflow, environment, target, recordedFlowLane: options.flow === true, createdFlowLane: creation !== undefined, ...(live ? { live } : {}) });
  let redaction: RunRedactionAttestation | undefined;
  const providerFailures = runProviderFailureLog({ secrets, live }); const startTrace = new ExtensionStartTrace({ secrets }); const uiReview = new UiReviewRecorder({ runsDirectory: options.runsDirectory, runId, secrets }); // Screenshots and the overlay's state, for <runId>.ui-review.local.json (`run-scenario/ui-review/`). The run's second tier of evidence: what a refused provider call said, kept locally and never published (`provider-failure/`).
  const evidence = effectiveEvidencePolicy(scenario.evidencePolicy, options.evidence);
  setFacilityStage("bundle.initialize");
  const bundle = new EvidenceBundle({ rootDirectory: options.runsDirectory, runId, scenarioId: scenario.id, redaction: { secrets }, evidencePolicy: evidence.capture });
  await bundle.initialize();
  const startedAt = new Date().toISOString();
  let topology: RunningTopology | undefined;
  let context: BrowserContext | undefined;
  let extensionPage: Page | undefined;
  let scenarioPage: Page | undefined;
  let networkGuard: DeterministicNetworkGuard | undefined;
  let recordingStarted = false;
  let browserVersion = "unavailable";
  let verdict: "passed" | "failed" = "failed";
  // A build that stopped to ask at the task's declared permission point: its verdict is `stopped_for_permission`, never a pass (`lane-rules/built-flow.ts`).
  let permissionStop: FlowLanePermissionStop | undefined;
  // The Lab playing the person at a check only a person may pass (`person-simulation/`): started before a Flow lane builds or runs, finished in cleanup.
  let labPerson: LabPerson | undefined;
  let failureCategory: RunnerFailureCategory | undefined;
  let failureMessage: string | undefined;
  let facilityFailure: RunEvaluation["facilityFailure"] = null;
  let existingPreflight: ExistingFluxIQPreflight | undefined;
  let existingExecution: ExistingFlowExecution | undefined;
  let panelVerification: FluxIQPanelVerificationOutcome | undefined;
  let stepRunner: ScenarioStepRunner | undefined;
  let consoleErrors: ConsoleErrorWatch | undefined;
  // Pictures of what the person watching sees -- page, extension panel and overlay in one frame -- taken without moving focus and bounded to 4 s,
  // at the run's own moments and every 15 s while it works (`run-scenario/window-capture/`). Playwright captures, removed 2026-09-25, cost 30 s
  // each and photographed a background `about:blank`; this photographs the run's own window, found by its profile directory.
  const screenshotAdapter = createRunScreenshotAdapter({ session: () => (context && topology ? { context, profileDir: topology.allocation.browserProfileDir, scenarioOrigin: topology.scenarioOrigin } : undefined), log: line => process.stderr.write(`${line}\n`) });
  const capture = new EvidenceCaptureController(bundle, evidence.capture, screenshotAdapter);
  const periodicCapture = new PeriodicCapture({ policy: evidence.capture, trigger: (summary, details) => capture.trigger({ ...evidenceEvent(runId, scenario.id, undefined, "checkpoint", summary), details }) });
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
      // Recorded before the verdict is judged, so a run refused for an unsafe dependency still carries the package it read.
      const exported = await exportRunClonePackage(target, { runId, runsDirectory: options.runsDirectory });
      cloneState.clonePackage = exported.clonePackage;
      cloneState.clonePackageHash = exported.clonePackageHash;
      if (cloneState.clonePackage.compatibility.verdict !== "compatible") throw new RunnerFailure("environment.missing", "Source Flow dependencies are not safe to clone into isolation");
    }
    const credentials = target.mode === "isolated" || target.mode === "persistent-isolated" ? configuredCredentials(environment) : undefined;
    const topologyTarget = target.mode === "clone" ? { mode: "isolated" as const } : target;
    const topologyRunsDirectory = topologyTarget.mode === "persistent-isolated"
      ? options.runsDirectory
      : path.join(options.runsDirectory, ".work");
    const ownsIsolatedCore = topologyTarget.mode === "isolated" || topologyTarget.mode === "persistent-isolated";
    topology = await startTopology({ repositoryRoot: options.repositoryRoot, fluxiqRepositoryRoot: options.fluxiqRepositoryRoot, runsDirectory: topologyRunsDirectory, runId, seed, target: topologyTarget, scenarioEntrypoint: labPaths.scenarioEntrypoint, hostModulePath: labPaths.hostModulePath, copyStartupFailureLogs: logsDirectory => copyProcessLogs(bundle, logsDirectory), ...(ownsIsolatedCore && labPaths.hostPrebuilt ? { prepareHost: false } : {}), ...(ownsIsolatedCore ? { bootstrapIdentity: coreIdentityRequired({ clone: target.mode === "clone", flowLane, scenario, recorded: recordingWorkflow.expected }), ...(credentials ? { credentials } : {}) } : {}) });
    let existingControl: ExistingFluxIQControlClient | undefined;
    if (target.mode === "existing") {
      existingControl = await openExistingFluxIQControl(target, options.runsDirectory);
      existingPreflight = await preflightExistingFluxIQ(existingControl, target);
      topology = { ...topology, gatewayUrl: existingPreflight.gatewayUrl, control: existingControl };
    }
    topology.control?.recordProviderFailuresTo(providerFailures);
    if (target.mode === "clone") {
      if (!topology.control || !topology.authorizationPin || !cloneState.clonePackage) throw new RunnerFailure("environment.missing", "Isolated clone destination did not provide authenticated Core control");
      const destinationControl = topology.control;
      const destinationDefinitions = await destinationControl.listNativeNodeDefinitions(topology.projectId ?? "");
      const destinationAssessment = cloneDestinationAssessment(cloneState.clonePackage, destinationDefinitions);
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
    const launched = await launchBrowser(topology, extensionPath);
    ({ context, browserVersion } = launched); await startTrace.attach(context); // The extension start, timestamped, for extension-start.local.json.
    periodicCapture.start();
    const scenarioOrigins = new Set(scenarioNetworkOrigins(topology.scenarioOrigin));
    const isScenarioUrl = (url: string) => { try { return scenarioOrigins.has(new URL(url).origin); } catch { return false; } };
    networkGuard = await installRunNetworkGuard(context, topology, [...scenarioOrigins]);
    const consoleWatch = consoleErrors = new ConsoleErrorWatch(context, isScenarioUrl);
    const extensionControl = extensionPage = await extensionControlPage(context); startTrace.observePage(extensionControl, "control");
    browserVersion = await browserVersionFromCdp(context, extensionPage);
    // The existing and clone lanes replay a pre-existing Flow, so their variant
    // is armed before the page opens. The two Flow lanes must not arm here: each
    // presents the unarmed rendering first and arms when it prepares the page it
    // explores or runs, or the drift would break the recording it builds a Flow from.
    if (workflow.variant && !flowLane) await armScenarioVariant(topology.scenarioOrigin, topology.allocation.controllerToken, scenario.id, workflow.variant);
    const page = scenarioPage = await context.newPage();
    await openScenarioStart(page, topology.scenarioOrigin, scenario);
    await page.bringToFront(); uiReview.attach({ context, scenarioPage: page, controlPage: extensionControl });
    // The extension panel beside the fixture, for whoever watches a headed run. It never fails the run; the mode that ran is kept in the bundle.
    await bundle.writeStructured("snapshots/live-panel.json", await openLivePanel(extensionControl, { enabled: options.livePanel !== false, headless: launched.headless, scenarioOrigin: topology.scenarioOrigin, log: line => process.stderr.write(`${line}\n`) }));
    await assertExpectedFacts(pageFacts.atLoad, playwrightScenarioFactProbe(page));
    // What either Flow lane is handed: present the page, publish what the Flow did, and consult the fixture oracle.
    const flowRunHooks = <E extends { observation: RunLaneObservation; run: PersistedFlowRunOutcome }>(activeTopology: RunningTopology, publish: (evidence: E) => Promise<void>) => ({
      prepareFlowPage: async (moment?: "build" | "playback") => {
        // A task whose variant is armed after the build has FluxIQ explore the unarmed page, and its Flow meet the variant:
        // the site changes after the Flow was made. The fixture starts unarmed, so the build's page is simply not armed,
        // and the armed facts are not checked against a page that was not armed.
        const unarmedBuild = moment === "build" && creation?.task.variantArmedAfterBuild === true;
        if (workflow.variant && !unarmedBuild) await armScenarioVariant(activeTopology.scenarioOrigin, activeTopology.allocation.controllerToken, scenario.id, workflow.variant);
        // Where this leaves the tab (`lane-rules/flow-start-page.ts`): the fixture's entry point, or, for a task whose
        // instruction is to go somewhere, the blank tab a browser opens on -- so reaching the page is the Flow's own
        // first step rather than the harness's, and a Flow that cannot reach it fails where a person would see it fail.
        const startPage = flowStartPage({ task: creation?.task, moment, armedFacts: pageFacts.afterArm });
        // Runs before every Flow run and every exploration. The reset and any arm are server-side, and the tab still shows
        // wherever the recording or the exploration ended, so it is loaded again: unarmed, or the Flow starts on that last
        // page; armed, or a drift variant is judged against a page that never drifted. Load the entry point, not a reload.
        if (startPage !== "blank-tab") {
          await openScenarioStart(page, activeTopology.scenarioOrigin, scenario);
          // The rendering the Flow meets is now on screen. Check the armed facts here (none for an unarmed run), so
          // "the fixture did not arm as declared" cannot arrive disguised as "the generated Flow failed". A tab that is
          // about to be blanked loads only for this proof, and pays one extra load of the entry point for it.
          if (!unarmedBuild) await assertExpectedFacts(pageFacts.afterArm, playwrightScenarioFactProbe(page));
        }
        // Blanking also clears whatever the exploration left on screen, which is the other half of what the load was for.
        // Every fixture tab, not just this one: a navigation run from a blank tab cannot take over the page in front
        // (`apps/extension/src/runtime/navigation-target.ts`), so it drives the last tab the worker drove -- or opens
        // one -- and an exploration can therefore end somewhere other than here. A Flow left one fixture tab open
        // would start on a page it never reached, which is the thing this whole rule exists to stop.
        if (startPage !== "scenario-start-page") for (const open of [page, ...context!.pages().filter(other => other !== page && isScenarioUrl(other.url()))]) await open.goto(BLANK_TAB_URL); if (moment !== "build") uiReview.phase("flow-run");
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
    // `--replays N`: approve the repair this run produced, apply it, and replay the Flow N times with no model, so "the model fixed it" becomes "the Flow
    // works without the model"; without the option nothing happens. `checkGoal` is the scenario's own final state, never the proposal-only one the run was
    // held to. A created Flow's lane judged no declared repair, so the repair lane judges it first, and rebuilds its inputs by the created lane's rule.
    const proveRepair = (control: ProveLiveRepairControl, activeTopology: RunningTopology, projectId: string, lane: LiveRepairLaneInput["lane"], builtFrom: "recording" | "instruction") => runLiveRepairLane(control, {
      ...(builtFrom === "instruction" ? { rebuildInputs: nodes => createdFlowSecretInputs({ scenarioId: scenario.id, secrets: declaredSecrets, workflow: flowWorkflow, nodes }), ...(repair ? { expectation: repair } : {}) } : {}),
      ...(options.replays === undefined ? {} : { replays: options.replays }), ...(live ? { live } : {}), lane, projectId, facilityRunId: runId, scenarioId: scenario.id, secrets: declaredSecrets, steps: flowWorkflow.recordingScript,
      scenarioOrigin: activeTopology.scenarioOrigin, runToken: activeTopology.allocation.controllerToken, prepare: flowRunHooks(activeTopology, async () => undefined).prepareFlowPage,
      checkGoal: () => findScenarioPageWithExpectedState(context!, page, activeTopology.scenarioOrigin, scenario, workflow).then(found => { scenarioPage = found; return true; }, () => false),
      bundle, publish: details => capture.trigger({ ...evidenceEvent(runId, scenario.id, undefined, "runtime.settle", "The live repair was applied and replayed"), details }),
    });
    const paired = topology.control ? await pairExtension(extensionPage, topology, startTrace) : undefined;
    if (paired) await activateScenarioTab(extensionPage, topology.scenarioOrigin); uiReview.phase("start");
    const stepCapture = new EvidenceCaptureController(bundle, evidence.capture, screenshotAdapter);
    if (target.mode === "existing") {
      if (!paired || !existingControl || !existingPreflight) throw new RunnerFailure("gateway.pairing", "Existing FluxIQ extension pairing did not produce an executable session");
      await existingControl.selectExistingContext(target.projectId);
      const recordingBaseline = recordingIds(await existingControl.listRecordings(target.projectId));
      await runtimeMessage(extensionPage, { type: "fluxiq.startRecording" });
      recordingStarted = true;
      await capture.trigger({ ...evidenceEvent(runId, scenario.id, undefined, "runtime.dispatch", "Execute configured persisted FluxIQ Flow"), details: { projectId: target.projectId, flowId: target.flowId, flowContentHash: existingPreflight.flow.contentHash } });
      existingExecution = await executeExistingPersistedFlow(existingControl, target, runId, persistedFlowRunContext({ scenario, scenarioOrigin: topology.scenarioOrigin, page, seed, facilityRunId: runId }), workflow.expected.actions ?? []);
      actions.push(...flowActionTimings(existingExecution.actions, existingExecution.actionTypes));
      automationFailure = null;
      await bundle.writeStructured("snapshots/existing-flow.json", { projectId: target.projectId, flowId: target.flowId, contentHash: existingPreflight.flow.contentHash, name: existingPreflight.flow.name, updatedAt: existingPreflight.flow.updatedAt });
      await writePersistedFlowSnapshots(bundle, existingExecution);
      scenarioPage = await findScenarioPageWithExpectedState(context, page, topology.scenarioOrigin, scenario, workflow);
      await runtimeMessage(extensionPage, { type: "fluxiq.stopRecording" });
      recordingStarted = false;
      const outcome = await assertCoreRoundTrip(topology, paired.sessionId, recordingBaseline);
      panelVerification = await verifyAuthenticatedFluxIQPanel({ context, origin: target.baseUrl, sessionCookieValue: existingControl.sessionCookieValue(), projectId: target.projectId, flowId: target.flowId, runId: existingExecution.runId });
      if (panelVerification.status !== "verified") throw new RunnerFailure("runtime.behavior", "FluxIQ panel could not verify the exact persisted Flow run");
      await capture.trigger({ ...evidenceEvent(runId, scenario.id, undefined, "runtime.settle", "Persisted FluxIQ Flow and browser state succeeded"), details: { runtimeRunId: existingExecution.runId, actionCount: existingExecution.actions.length, eventCount: existingExecution.events.length, recordingCount: outcome.recordingCount, panelVerification: panelVerification.status } });
    } else if (target.mode === "clone") {
      if (!paired || !topology.control || !topology.authorizationPin || !cloneState.clonePackage || !cloneState.destination || !cloneState.clonePackageHash) throw new RunnerFailure("gateway.pairing", "Cloned Flow destination is not ready for execution");
      const recordingBaseline = recordingIds(await topology.control.listRecordings(cloneState.destination.projectId));
      await runtimeMessage(extensionPage, { type: "fluxiq.startRecording" });
      recordingStarted = true;
      await capture.trigger({ ...evidenceEvent(runId, scenario.id, undefined, "runtime.dispatch", "Execute cloned Flow in isolated FluxIQ"), details: { sourceProjectId: cloneState.clonePackage.source.projectId, sourceFlowId: cloneState.clonePackage.source.flowId, sourceContentHash: cloneState.clonePackage.source.contentHash, destinationProjectId: cloneState.destination.projectId, destinationFlowId: cloneState.destination.flowId, clonePackageHash: cloneState.clonePackageHash } });
      cloneState.execution = await executeExistingPersistedFlow(topology.control, { projectId: cloneState.destination.projectId, flowId: cloneState.destination.flowId }, runId, persistedFlowRunContext({ scenario, scenarioOrigin: topology.scenarioOrigin, page, seed, facilityRunId: runId }), workflow.expected.actions ?? []);
      actions.push(...flowActionTimings(cloneState.execution.actions, cloneState.execution.actionTypes));
      automationFailure = null;
      await writePersistedFlowSnapshots(bundle, cloneState.execution);
      scenarioPage = await findScenarioPageWithExpectedState(context, page, topology.scenarioOrigin, scenario, workflow);
      await runtimeMessage(extensionPage, { type: "fluxiq.stopRecording" });
      recordingStarted = false;
      const outcome = await assertCoreRoundTrip(topology, paired.sessionId, recordingBaseline);
      panelVerification = await verifyAuthenticatedFluxIQPanel({ context, origin: topology.fluxiqOrigin, sessionCookieValue: topology.control.sessionCookieValue(), projectId: cloneState.destination.projectId, flowId: cloneState.destination.flowId, runId: cloneState.execution.runId });
      if (panelVerification.status !== "verified") throw new RunnerFailure("runtime.behavior", "Isolated FluxIQ panel could not verify the exact cloned Flow run");
      await capture.trigger({ ...evidenceEvent(runId, scenario.id, undefined, "runtime.settle", "Cloned Flow and browser state succeeded in isolation"), details: { runtimeRunId: cloneState.execution.runId, actionCount: cloneState.execution.actions.length, eventCount: cloneState.execution.events.length, recordingCount: outcome.recordingCount, sourceHashUnchanged: true, panelVerification: panelVerification.status } });
    } else if (creation) {
      // No recording: FluxIQ explores the page the task's variant renders, which the lane presents, and builds the Flow from the instruction.
      if (!paired || !live || !topology.control || !topology.projectId || !topology.authorizationPin) throw new RunnerFailure("environment.missing", "The created-Flow lane needs a paired extension, a live run, and an authenticated isolated Core with an authorization PIN");
      const control = topology.control; const activeTopology = topology; const createdProjectId = topology.projectId;
      await capture.trigger({ ...evidenceEvent(runId, scenario.id, undefined, "runtime.dispatch", "Build a Flow from the live instruction task and run it"), details: { taskId: creation.task.id, judgeBy: creation.judgement.judgeBy, variantId: workflow.variant?.id ?? null, declaredSecrets: declaredSecrets.map(secret => secret.id) } }); uiReview.phase("build");
      labPerson = await startLabPerson({ control, projectId: createdProjectId, context: context!, scenarioOrigin: topology.scenarioOrigin, runToken: topology.allocation.controllerToken, scenarioId: scenario.id, scenarioLabDist: labPaths.scenarioLabDist, workflowId: flowWorkflow.workflowId, variantId: flowWorkflow.variant?.id, task: creation.task.personCheck, permissions: { point: creation.task.permissionPoint }, write: snapshot => bundle.writeStructured(PERSON_HAND_OFFS_SNAPSHOT, snapshot), publish: handOff => capture.trigger({ ...evidenceEvent(runId, scenario.id, undefined, "runtime.settle", "The Lab played the person at a check FluxIQ handed off"), details: { handOff } }), publishPermission: permissionAnswer => capture.trigger({ ...evidenceEvent(runId, scenario.id, undefined, "runtime.settle", "The Lab answered FluxIQ's permission question as the person"), details: { permissionAnswer } }) });
      const lane = await runCreatedFlowLane({
        control, projectId: topology.projectId, authorizationPin: topology.authorizationPin, request: creation, workflow: flowWorkflow, facilityRunId: runId,
        scenarioOrigin: topology.scenarioOrigin, runToken: topology.allocation.controllerToken, secrets: declaredSecrets,
        // Where the built Flow starts: the page the harness would have opened, told to Core instead of loaded, so the build has to reach it itself (`lane-rules/flow-start-page.ts`).
        startLocation: scenarioStartUrl(topology.scenarioOrigin, scenario),
        authorizeBuild: live.buildAuthorizer(control, activeTopology),
        settleBuild: build => live.settleBuild(build, bundle, details => capture.trigger({ ...evidenceEvent(runId, scenario.id, undefined, "runtime.settle", "The live Flow build finished"), details })),
        // The created Flow's playback runs with the model taking part, so a Flow that fails is repaired rather than refused for want of a model, and its result is judged.
        authorizeRun: live.repairAuthorizer(control, activeTopology),
        settleRun: flowRunId => live.settleRepair(control, { projectId: createdProjectId, runId: flowRunId }, bundle, details => capture.trigger({ ...evidenceEvent(runId, scenario.id, undefined, "runtime.settle", "The created Flow's repair attempt finished"), details })),
        recordIncompleteEvidence: incomplete => bundle.writeStructured("snapshots/flow-lane.json", incomplete),
        ...flowRunHooks(activeTopology, async evidence => {
          await bundle.writeStructured("snapshots/flow-lane.json", createdFlowLaneSnapshot(evidence));
          await writeFlowExtractionMismatches(bundle, scenario, evidence.extraction);
        }),
      });
      // A consequential task run without permission for its act stops to ask at its declared permission point (`flow-lane/creation/permission-point.ts`): correct, but no Flow was built, so the run is `stopped_for_permission` and not a pass (`assertFlowLaneBuiltFlow` below).
      if ("permissionStop" in lane) { permissionStop = { consequence: lane.permissionStop.consequence, control: lane.permissionStop.control }; await capture.trigger({ ...evidenceEvent(runId, scenario.id, undefined, "runtime.settle", "FluxIQ stopped to ask at the task's declared permission point"), details: { consequence: lane.permissionStop.consequence, control: lane.permissionStop.control } }); }
      else { await capture.trigger({ ...evidenceEvent(runId, scenario.id, undefined, "runtime.settle", "The created Flow ran and met the task's judgement"), details: { runtimeRunId: lane.run.runId, actionCount: lane.run.actions.length, flowShape: lane.shape } }); await proveRepair(control, activeTopology, createdProjectId, lane, "instruction"); }
    } else {
      if (paired && topology.authorizationPin) {
        await proveCoreActionRoundTrip({ page, control: topology.control!, sessionId: paired.sessionId, authorizationPin: topology.authorizationPin, publish: (trigger, summary, details) => capture.trigger({ ...evidenceEvent(runId, scenario.id, undefined, trigger, summary), details }), record: (timing, result) => { actions.push(timing); automationFailure ??= automationFailureFromActionResult(result); } });
        // The probe's round trip ran on the start page's own clock: a site that raises an overlay seconds after load (auction-marketplace's
        // app promotion, at 2.5 s) would meet the recording with it up. So the recording starts on the start page as the run first presented it.
        await resetScenarioLab(topology.scenarioOrigin, topology.allocation.controllerToken);
        // The reset disarms the fixture, so a run that armed its variant before the first load arms it again here.
        if (workflow.variant && !flowLane) await armScenarioVariant(topology.scenarioOrigin, topology.allocation.controllerToken, scenario.id, workflow.variant);
        await openScenarioStart(page, topology.scenarioOrigin, scenario);
        await assertExpectedFacts(pageFacts.atLoad, playwrightScenarioFactProbe(page));
      }
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
        await stepCapture.trigger(evidenceEvent(runId, scenario.id, step.id, "step.start", `Start ${step.operation}`));
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
        await stepCapture.trigger({ ...evidenceEvent(runId, scenario.id, step.id, step.operation === "checkpoint" ? "checkpoint" : "step.complete", `Complete ${step.operation}`), ...(extraction ? { details: { recordCount: extraction.records.length } } : {}) });
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
      await capture.trigger({ ...evidenceEvent(runId, scenario.id, undefined, "gateway.action", "Core gateway retained the paired extension session"), details: { sessionCount: outcome.sessionCount } });
      await capture.trigger({ ...evidenceEvent(runId, scenario.id, undefined, "runtime.settle", "Core persisted the completed recording"), details: { recordingCount: outcome.recordingCount, projectId: topology.projectId, recordedEvents, recordingDiscards: discardAudit.discards, recordingDiscardWindow: discardAudit.window, extensionConnectionAfterStop: connectionAfterStop, recordedActions: { extension: completeness.extensionActions, core: completeness.coreActions }, recordings: outcome.finalized.map(item => ({ recordingId: item.recordingId, entryCount: item.entryCount, entriesAppendedAfterFirstPoll: item.entriesAppendedWhileWaiting, finalizationWaitMs: item.waitedMs })) } });
      if (discardAudit.failure) throw discardAudit.failure;
      if (completeness.failure) throw completeness.failure;
      if (options.flow) {
        const control = topology.control;
        const activeTopology = topology;
        const recordingId = outcome.newRecordingIds[0];
        const { projectId, authorizationPin } = topology; if (!projectId || !authorizationPin) throw new RunnerFailure("environment.missing", "The Flow lane needs an authenticated isolated Core with an authorization PIN");
        if (outcome.newRecordingIds.length !== 1 || !recordingId) throw new RunnerFailure("recording.persistence", `The Flow lane builds a Flow from exactly the recording this run produced, and observed ${outcome.newRecordingIds.length} new recordings`);
        await capture.trigger({ ...evidenceEvent(runId, scenario.id, undefined, "runtime.dispatch", "Build a Flow from the run's own recording and run it"), details: { variantId: workflow.variant?.id ?? null, declaredSecrets: declaredSecrets.map(secret => secret.id) } }); uiReview.phase("build");
        // Settled however the lane ends: an overspend or an unreached provider fails a finished run, and a failed lane still leaves its provider calls itemized.
        labPerson = await startLabPerson({ control, projectId, context: context!, scenarioOrigin: activeTopology.scenarioOrigin, runToken: activeTopology.allocation.controllerToken, scenarioId: scenario.id, scenarioLabDist: labPaths.scenarioLabDist, workflowId: flowWorkflow.workflowId, variantId: flowWorkflow.variant?.id, write: snapshot => bundle.writeStructured(PERSON_HAND_OFFS_SNAPSHOT, snapshot), publish: handOff => capture.trigger({ ...evidenceEvent(runId, scenario.id, undefined, "runtime.settle", "The Lab played the person at a check FluxIQ handed off"), details: { handOff } }) });
        const lane = await runLaneWithLiveLlmSettlement({ live, control, projectId, bundle, publish: details => capture.trigger({ ...evidenceEvent(runId, scenario.id, undefined, "runtime.settle", "The live provider run finished"), details }) }, async flowRunIdentified => await runFlowLane({
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
        await capture.trigger({ ...evidenceEvent(runId, scenario.id, undefined, "runtime.settle", "The generated Flow ran and met the workflow's expectations"), details: { runtimeRunId: lane.run.runId, actionCount: lane.run.actions.length, harnessActivations: lane.run.harnessActivations } });
        await proveRepair(control, activeTopology, projectId, lane, "recording");
      }
    }
    // A Flow-lane run that never reached the lane built no Flow, and does not pass on the recording's checks alone.
    assertFlowLaneBuiltFlow({ flowLane, evaluated: target.mode === "isolated" || target.mode === "persistent-isolated", published: flowObservation, permissionStop });
    consoleWatch.assertOnlyAllowed(workflow.expected.allowedConsoleErrors);
    networkGuard.assertNoViolations();
    await capture.trigger(evidenceEvent(runId, scenario.id, undefined, "final", "Scenario completed")); await uiReview.finish("end");
    verdict = "passed";
  } catch (error) {
    failureCategory = classifyRunnerFailure(error);
    failureMessage = error instanceof Error ? error.message : String(error);
    // A failure FluxIQ caused is the product's, verdict or not: a build that ended without a Flow is not a facility fault (`run-scenario/product-failure.ts`).
    const productFailure = productFailureOf(error, { flowLane, flowCreated: flowObservation?.flowCreated });
    if (flowObservation?.reportedVerdict == null && !productFailure) {
      facilityFailure = projectFacilityFailure(error, "finalized-bundle", "scenario.execute");
    }
    // Recorded-event mismatches are types and counts, never page data, so they are published for diagnosis. So now are a `runtime.behavior` failure's, which is the class the created-Flow lane actually raises -- a build that proposed nothing, a build that asked for a permission, a Flow with no extract node -- and whose details were dropped here while a recording's were kept. One of them does carry page data (`assertExtraction`'s record mismatch publishes the expected and the observed record), so the gate is the disclosure rule `snapshots/extraction-mismatches.json` already publishes observed values by: a scenario that declares a replay secret has one on its page by construction, and its details are withheld.
    // So is what the Flow reported when the lane got that far: Core's category and closed-set code, and nothing else of the record.
    const flowReported = flowObservation?.automationFailureReported, extensionStartDetails = extensionStartFailureDetails(error);
    const finalizationWaitDetails = finalizedRecordingWaitFailureDetails(error);
    const pairingWaitDetails = pairingStatusWaitFailureDetails(error);
    const httpTransportDetails = httpTransportFailureDetails(error);
    const topologyReadinessDetails = topologyReadinessFailureDetails(error);
    const failureEvent = { ...evidenceEvent(runId, scenario.id, undefined, "error", failureMessage), details: { failureCategory, ...(error instanceof RunnerFailure && error.details && (error.category === "recording.contract" || (error.category === "runtime.behavior" && !scenario.secrets?.length)) ? { failureDetails: error.details } : {}), ...(finalizationWaitDetails ? { failureDetails: finalizationWaitDetails } : {}), ...(pairingWaitDetails ? { failureDetails: pairingWaitDetails } : {}), ...(extensionStartDetails ? { failureDetails: extensionStartDetails } : {}), ...(httpTransportDetails ? { failureDetails: httpTransportDetails } : {}), ...(topologyReadinessDetails ? { failureDetails: topologyReadinessDetails } : {}), ...(flowReported ? { flowReportedFailure: { category: flowReported.category, ...(flowReported.code === undefined ? {} : { code: flowReported.code }) } } : {}), ...(productFailure ? { productFailure } : {}) } };
    // The picture is taken at the failure, before cleanup changes what is on screen.
    await capture.trigger(failureEvent).catch(() => undefined); await uiReview.finish("failure");
  } finally {
    setFacilityStage("scenario.cleanup");
    await periodicCapture.stop({ finalCapture: verdict !== "passed" }); // A passed run's `final` event already pictured its end.
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
        await capture.trigger({ ...evidenceEvent(runId, scenario.id, undefined, "error", completion.event.summary), details: completion.event.details }).catch(() => undefined);
      }
    }
    // Before the browser closes: a hand-off in progress needs its tab, and the record is written into the bundle still being staged.
    await labPerson?.finish();
    await uiReview.close(); try { await context?.close(); }
    catch (error) {
      const hadPrimaryFailure = failureCategory !== undefined && failureMessage !== undefined;
      const cleanup = cleanupFailureOutcome({ category: failureCategory, message: failureMessage }, "browser", error);
      verdict = "failed"; failureCategory = cleanup.primary.category; failureMessage = cleanup.primary.message;
      if (!hadPrimaryFailure && flowObservation?.reportedVerdict == null) {
        facilityFailure = projectFacilityFailure(error, "finalized-bundle", "scenario.cleanup");
      }
      await capture.trigger({ ...evidenceEvent(runId, scenario.id, undefined, "error", cleanup.event.summary), details: cleanup.event.details }).catch(() => undefined);
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
      await capture.trigger({ ...evidenceEvent(runId, scenario.id, undefined, "runtime.settle", "Core's discard audit was read again before the topology closed"), details: { recordingDiscards: secondRead.discards, recordingDiscardWindow: secondRead.window, discardsAfterFirstRead: secondRead.discards.length - earlier.length, snapshotFetches } }).catch(() => undefined);
      const failure = secondRead.failure;
      if (failure && (failure.category === "recording.persistence" ? failureCategory !== "recording.persistence" : verdict === "passed")) {
        const superseded = failureCategory;
        verdict = "failed"; failureCategory = failure.category; failureMessage = failure.message;
        await capture.trigger({ ...evidenceEvent(runId, scenario.id, undefined, "error", failure.message), details: { failureCategory: failure.category, recordingDiscards: secondRead.discards, ...(superseded ? { supersededFailureCategory: superseded } : {}) } }).catch(() => undefined);
      }
    }
    // Core's decision records, copied while Core still answers: the run root, and Core's
    // store with it, is deleted below for a clone and after `finalize` for every isolated
    // run. Written into staging before the redaction attestation, which scans it with the
    // rest. An existing target is a person's own Core and outlives the run, so it is not read.
    if (topology?.control && topology.projectId && target.mode !== "existing") {
      const decisionTrace = await readDecisionTrace(topology.control, topology.projectId).catch((error: unknown) => ({ unreadable: error instanceof RunnerFailure ? error.category : "read_failed" }));
      await bundle.writeStructured("snapshots/decision-trace.json", decisionTrace).catch(/* best-effort: a diagnostic copy may not fail a run whose verdict is already decided */ () => undefined);
    }
    try { await topology?.close(); }
    catch (error) {
      const hadPrimaryFailure = failureCategory !== undefined && failureMessage !== undefined;
      const cleanup = cleanupFailureOutcome({ category: failureCategory, message: failureMessage }, "topology", error);
      verdict = "failed"; failureCategory = cleanup.primary.category; failureMessage = cleanup.primary.message;
      if (!hadPrimaryFailure && flowObservation?.reportedVerdict == null) {
        facilityFailure = projectFacilityFailure(error, "finalized-bundle", "scenario.cleanup");
      }
      await capture.trigger({ ...evidenceEvent(runId, scenario.id, undefined, "error", cleanup.event.summary), details: cleanup.event.details }).catch(() => undefined);
    }
    if (failureMessage && !bundle.getEvents().some(item => item.trigger === "error" && item.summary === failureMessage)) {
      await capture.trigger({ ...evidenceEvent(runId, scenario.id, undefined, "error", failureMessage), details: { failureCategory } }).catch(() => undefined);
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
        await capture.trigger({ ...evidenceEvent(runId, scenario.id, undefined, "error", message), details: { failureCategory: "security.redaction", ...details } }).catch(() => undefined);
      };
      try {
        // Every target's browser profile is the run allocation's own (never a user's), closed above; a persistent-isolated one outlives the run and is bounded like its workspace.
        const writtenSince = target.mode === "persistent-isolated" ? Date.parse(startedAt) : undefined;
        const profileDir = topology?.allocation.browserProfileDir;
        const extensionStorage = profileDir === undefined ? undefined : { profileDir, dirs: await chromiumExtensionStorageDirs(profileDir), writtenSince };
        redaction = await attestRunRedaction({ literals: redactionLiterals, scopes: runRedactionScopes({ bundleStagingPath: bundle.stagingPath, workspaceStorageDir: topology?.allocation.storageDir, workspaceWrittenSince: writtenSince, extensionStorage }) });
      }
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
        await capture.trigger({ ...evidenceEvent(runId, scenario.id, undefined, "error", cleanup.event.summary), details: cleanup.event.details }).catch(() => undefined);
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
        // A run the facility failed reports no automation result, which the evaluation contract refuses beside one: the probe's
        // succeeded read and a later recording failure together left the run with no finalized bundle at all.
        oracleVerdict, actions, automationFailure: facilityFailure ? undefined : automationFailure,
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
      ? singleRunEvaluation({ runId, verdict, failureCategory, facilityFailure, scenarioId: scenario.id, workflowId: workflow.workflowId, variantId: workflow.variant?.id, repeatIndex: benchReceipt?.cellIdentity.repeatIndex ?? 0, observation, manifest, metrics, events: bundle.getEvents(), wallClockMs: Date.now() - Date.parse(startedAt), llm: live?.usage, bundlePath: bundle.stagingPath, permissionStop })
      : undefined;
    if (evaluation) await bundle.writeStructured("evaluation.json", evaluation);
    if (benchReceipt) await bundle.writeStructured("bench-receipt.json", benchReceipt);
    bundle.registerEvidencePolicy(evidence.capture);
    const finalized = await bundle.finalize({ verdict, metrics });
    await writeProviderFailureSidecar({ runDirectory: finalized.path, runId, log: providerFailures }).catch(/* best-effort: a local diagnostic may not fail a run whose bundle is already sealed */ () => undefined); await writeExtensionStartSidecar({ runDirectory: finalized.path, runId, trace: startTrace, secrets }).catch(/* best-effort: a local diagnostic may not fail a run whose bundle is already sealed */ () => undefined); // After `finalize`, never before: the artifact index is a walk of the staging directory, so a file written there would be published. A clean run writes none.
    return { runId, verdict, path: finalized.path, ...(observation ? { observation } : {}), ...(evaluation ? { evaluation } : {}), ...(failureCategory ? { failureCategory } : {}), ...(permissionStop ? { permissionStop: { verdict: "stopped_for_permission" as const, ...permissionStop } } : {}) };
  } finally {
    if (topology && !topologyStateRemoved && !keepsRunState(environment)) await removeRunOwnedTopologyState(topology).catch(() => undefined);
  }
}

type PairedExtensionStatus = Record<string, unknown> & { connectionState: "connected"; sessionId: string };
async function pairExtension(page: Page, topology: RunningTopology, trace: ExtensionStartTrace): Promise<PairedExtensionStatus> {
  return pairExtensionWithColdEpochRecovery({
    connect: () => trace.timed("connect", async () => (await runtimeMessage(page, { type: "fluxiq.connect", settings: { gatewayUrl: topology.gatewayUrl, coreApiUrl: topology.fluxiqOrigin, autoReconnect: true, captureMutations: true, captureInputValues: true, captureSnapshots: true } })).status, status => ({ connectionState: typeof status?.connectionState === "string" ? status.connectionState : "unreported", lastError: typeof status?.lastError === "string" ? status.lastError : null })),
    readStatus: () => extensionStatus(page),
    approvePairing: referenceCode => trace.timed("approve", () => topology.control!.approvePairing(referenceCode)),
  });
}
/** The facts `finalStateFacts` chooses: the final state, then a positive primary run's playback-goal facts. */
async function assertFinalState(page: Page, scenario: WebScenario, workflow: ResolvedScenarioWorkflow) { await assertExpectedFacts(finalStateFacts(scenario, workflow), playwrightScenarioFactProbe(page)); }
async function findScenarioPageWithExpectedState(context: BrowserContext, fallback: Page, origin: string, scenario: WebScenario, workflow: ResolvedScenarioWorkflow): Promise<Page> { for (const candidate of context.pages().filter(item => !item.isClosed() && item.url().startsWith(`${origin}/`)).reverse()) { try { await assertFinalState(candidate, scenario, workflow); return candidate; } catch {} } await assertFinalState(fallback, scenario, workflow); return fallback; }
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

async function copyProcessLogs(bundle: EvidenceBundle, logsDir: string) { try { for (const name of await readdir(logsDir)) if (name.endsWith(".log")) await bundle.writeText(`logs/${name}`, await readFile(path.join(logsDir, name), "utf8")); } catch {} }
