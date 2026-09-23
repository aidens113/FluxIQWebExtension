import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { WebScenario } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../failure.js";
import { ProjectedFacilityError } from "../../facility-failure/index.js";
import { runScenario } from "../../run-scenario.js";

/**
 * That the runner *calls* the evaluator is not something a unit of the
 * evaluator can show, and running `runScenario` needs the whole Lab. A new
 * evaluation nothing reads would be the same defect as the lane observation it
 * was built to rescue, so the wiring is checked here at the call site: the
 * runner builds the evaluation, persists it inside the bundle where
 * `lab inspect` hashes it, and returns it so `lab run` prints it.
 */
const root = path.resolve(import.meta.dirname, "..", "..", "..", "..", "..");
const runnerSource = () => readFile(path.join(root, "packages", "test-runner", "src", "run-scenario.ts"), "utf8");

test("the runner evaluates every run it observes, exactly once", async () => {
  const source = await runnerSource();
  assert.equal(source.match(/singleRunEvaluation\(/gu)?.length, 1, "one evaluation per run, built in one place");
  assert.match(source, /const evaluation = observation\s*\r?\n\s*\? singleRunEvaluation\(/u, "no observation, no evaluation: the existing and clone targets run on no evaluation lane");
  assert.match(source, /import \{ singleRunEvaluation \} from "\.\/run-evaluation\/index\.js";/u, "through the barrel the bench also evaluates through");
});

test("the runner tracks closed facility stages and wires one nullable diagnostic into evaluation", async () => {
  const source = await runnerSource();
  const at = {
    load: source.indexOf('setFacilityStage("scenario.load")'),
    initialize: source.indexOf('setFacilityStage("bundle.initialize")'),
    execute: source.indexOf('setFacilityStage("scenario.execute")'),
    cleanup: source.indexOf('setFacilityStage("scenario.cleanup")'),
    publish: source.indexOf('setFacilityStage("bundle.publish")'),
  };
  for (const [name, index] of Object.entries(at)) assert.ok(index > 0, `${name} stage is tracked`);
  assert.ok(at.load < at.initialize && at.initialize < at.execute && at.execute < at.cleanup && at.cleanup < at.publish);
  assert.equal(source.match(/let facilityFailure: RunEvaluation\["facilityFailure"\] = null/gu)?.length, 1);
  assert.match(source, /singleRunEvaluation\(\{[^}]*\bfacilityFailure\b/u);
  assert.match(source, /projectFacilityFailure\(error, "no-final-bundle", facilityStage\)/u);
  assert.equal(source.match(/const hadPrimaryFailure = failureCategory !== undefined && failureMessage !== undefined;/gu)?.length, 4);
  assert.equal(source.match(/if \(!hadPrimaryFailure && flowObservation\?\.reportedVerdict == null\)/gu)?.length, 4);
  assert.equal(source.includes("actions.length === 0"), false, "recorded actions do not suppress a later facility failure");
});

test("the runner publishes safe finalization-wait details and preserves primary failures across cleanup", async () => {
  const source = await runnerSource();
  assert.ok(source.includes("const finalizationWaitDetails = finalizedRecordingWaitFailureDetails(error);"), "the wait's narrow safe projection is selected");
  assert.ok(source.includes("...(finalizationWaitDetails ? { failureDetails: finalizationWaitDetails } : {})"), "the projection reaches the error event");
  assert.equal(source.match(/cleanupFailureOutcome\(/gu)?.length, 4, "browser, topology and both clone completion paths share the precedence rule");
  assert.equal(source.match(/details: (?:cleanup|completion)\.event\.details/gu)?.length, 4, "every completion failure appends its own labelled event");
});

test("the focused pairing lifecycle owns both timeout stages and publishes their safe details", async () => {
  const source = await runnerSource();
  assert.match(source, /pairExtensionWithColdEpochRecovery\(\{/u);
  assert.ok(source.includes("const pairingWaitDetails = pairingStatusWaitFailureDetails(error);"));
  assert.ok(source.includes("...(pairingWaitDetails ? { failureDetails: pairingWaitDetails } : {})"));
});

test("the runner publishes only the closed HTTP transport projection in its durable error event", async () => {
  const source = await runnerSource();
  assert.match(source, /import \{[^}]*\bhttpTransportFailureDetails\b[^}]*\} from "\.\/http-control\/index\.js";/u);
  assert.ok(source.includes("const httpTransportDetails = httpTransportFailureDetails(error);"), "the caught startup failure is passed through the closed projector");
  assert.ok(source.includes("...(httpTransportDetails ? { failureDetails: httpTransportDetails } : {})"), "the projection reaches the durable error event");
  assert.equal(source.includes("failureDetails: error.details } : {}), ...(httpTransportDetails"), false, "HTTP details are not spread directly into the event");
});

test("the runner publishes only the closed topology-readiness projection in its durable error event", async () => {
  const source = await runnerSource();
  assert.match(source, /import \{[^}]*\btopologyReadinessFailureDetails\b[^}]*\} from "\.\/http-control\/index\.js";/u);
  assert.ok(source.includes("const topologyReadinessDetails = topologyReadinessFailureDetails(error);"));
  assert.ok(source.includes("...(topologyReadinessDetails ? { failureDetails: topologyReadinessDetails } : {})"));
  assert.equal(source.includes("failureDetails: error.details } : {}), ...(topologyReadinessDetails"), false);
});

test("the focused extension-readiness lifecycle validates the worker before opening any page", async () => {
  const source = await runnerSource();
  assert.match(source, /import \{[^}]*\bawaitExtensionWorker\b[^}]*\} from "\.\/run-lifecycle\/index\.js";/u);
  const ready = source.indexOf("await awaitExtensionWorker(context)");
  const page = source.indexOf("context.newPage()", ready);
  assert.ok(ready > 0 && page > ready, "worker readiness precedes creation of the extension control page");
  assert.equal(source.includes('waitForEvent("serviceworker"'), false, "the old unvalidated ten-second wait is gone");
});

test("scripted navigation is bound only after recording is confirmed and each step waits for acknowledgement and cleanup", async () => {
  const source = await runnerSource();
  const confirmed = source.indexOf('await pollStatus(extensionControl, value => value.recordingState === "recording")');
  const bound = source.indexOf("scriptedNavigation: createScriptedNavigationDriver(extensionControl)");
  const loop = source.indexOf("for (const step of recordingWorkflow.recordingScript)", bound);
  const run = source.indexOf("await runner.run(step)", loop);
  const complete = source.indexOf('"step.complete"', run);
  const stop = source.indexOf('type: "fluxiq.stopRecording"', loop);
  for (const [name, index] of Object.entries({ confirmed, bound, loop, run, complete, stop })) assert.ok(index > 0, `${name} is in the runner`);
  assert.ok(confirmed < bound && bound < loop, "no intent can arm before the extension reports recording");
  assert.ok(loop < run && run < complete, "step.complete waits for the injected driver's acknowledgement and cleanup");
  assert.ok(complete < stop, "recording stops only after every scripted step settles");
  assert.equal(source.match(/createScriptedNavigationDriver\(/gu)?.length, 1, "one control-page-bound driver is created for the recording lane");
});

test("the evaluation is a hashed artifact of the bundle, written before it is sealed", async () => {
  const source = await runnerSource();
  const manifestWritten = source.indexOf('bundle.writeStructured("run.json", manifest)');
  const written = source.indexOf('bundle.writeStructured("evaluation.json", evaluation)');
  const finalized = source.indexOf("await bundle.finalize(");
  assert.ok(written > 0, "the evaluation is persisted in the run bundle");
  assert.ok(finalized > 0);
  assert.ok(manifestWritten > 0 && manifestWritten < written, "the evaluation reads the manifest the run just wrote");
  // Written after finalization it would be an unlisted file the artifact index
  // does not cover, so `lab inspect` would never verify it.
  assert.ok(written < finalized, "evaluation.json is written before the bundle is finalized, so it enters the artifact index");
});

test("a supervisor run id and strict campaign receipt are bound before bundle finalization", async () => {
  const source = await runnerSource();
  assert.match(source, /const runId = options\.runId \?\? `run-/u, "the existing random id remains the default");
  assert.ok(source.includes("assertSafeScenarioRunId(runId);"), "a supplied id is validated before it reaches a path");
  assert.ok(source.includes("options.benchReceipt ? createBenchReceipt(options.benchReceipt, runId) : undefined"), "the receipt is strictly created with that same id");
  assert.ok(source.includes("repeatIndex: benchReceipt?.cellIdentity.repeatIndex ?? 0"), "campaign evaluation identity comes from the receipt while standalone runs remain repeat zero");
  const receipt = source.indexOf('bundle.writeStructured("bench-receipt.json", benchReceipt)');
  const evaluation = source.indexOf('bundle.writeStructured("evaluation.json", evaluation)');
  const finalized = source.indexOf("await bundle.finalize(");
  assert.ok(evaluation > 0 && receipt > evaluation, "the receipt follows the evaluation it will allow recovery to locate");
  assert.ok(finalized > receipt, "the receipt is hashed into the bundle before finalization");
});

test("the redaction attestation scans once Core has stopped and its logs are in the bundle, before cleanup, the manifest and finalization", async () => {
  const source = await runnerSource();
  assert.equal(source.match(/attestRunRedaction\(/gu)?.length, 1, "one attestation per run, in one place");
  const at = {
    closed: source.indexOf("await topology?.close();"),
    logsCopied: source.indexOf("await copyProcessLogs(bundle, "),
    attested: source.indexOf("redaction = await attestRunRedaction("),
    cloneCleanup: source.indexOf("await removeRunOwnedTopologyState(topology);"),
    manifest: source.indexOf("await createRunManifest({"),
    finalized: source.indexOf("await bundle.finalize("),
    isolatedCleanup: source.indexOf("await removeRunOwnedTopologyState(topology).catch("),
  };
  for (const [name, index] of Object.entries(at)) assert.ok(index > 0, `${name} is in the runner`);
  assert.ok(at.closed < at.attested, "Core has stopped, so nothing still appends to the recording or trace being scanned");
  assert.ok(at.logsCopied < at.attested, "the copied Core and gateway logs are inside the bundle being scanned");
  assert.ok(at.attested < at.cloneCleanup, "the clone cleanup deletes the workspace the scan reads");
  assert.ok(at.attested < at.isolatedCleanup, "so does the isolated cleanup");
  assert.ok(at.attested < at.manifest, "the manifest's verdict and redactionState read the result");
  assert.ok(at.attested < at.finalized, "finalize renames the staging directory the scan reads");
  assert.match(source, /await createRunManifest\(\{[^}]*\bredaction\b[^}]*\}\)/u, "the manifest derives redactionState from the attestation");
  assert.ok(source.includes('bundle.writeStructured("snapshots/redaction-attestation.json", redaction)'), "the result is a bundle artifact");
  assert.ok(source.includes('failureCategory = "security.redaction"'), "a finding fails the run as security.redaction");
  assert.ok(
    source.includes('runRedactionScopes({ bundleStagingPath: bundle.stagingPath, workspaceStorageDir: topology?.allocation.storageDir, workspaceWrittenSince: target.mode === "persistent-isolated" ? Date.parse(startedAt) : undefined })'),
    "a persistent-isolated workspace is bounded to what this run wrote since it started, and every other target's workspace is scanned whole",
  );
});

test("Core's audit of discarded recording messages is read after the round trip, published, and fails the run before the Flow lane", async () => {
  const source = await runnerSource();
  assert.equal(source.match(/readRecordingDiscards\(/gu)?.length, 2, "once after the round trip, and once more before the topology closes");
  const at = {
    roundTrip: source.indexOf("const outcome = await assertCoreRoundTrip(topology, paired?.sessionId, recordingBaseline);"),
    audited: source.indexOf("readRecordingDiscards(await topology.control.gatewaySnapshot(), discardScope)"),
    connection: source.indexOf("const connectionAfterStop = await runtimeMessage(extensionControl, { type: \"fluxiq.getStatus\" })"),
    settled: source.indexOf('"Core persisted the completed recording"'),
    failed: source.indexOf("if (discardAudit.failure) throw discardAudit.failure;"),
    flowLane: source.indexOf("await runFlowLane({"),
  };
  for (const [name, index] of Object.entries(at)) assert.ok(index > 0, `${name} is in the runner`);
  assert.ok(at.roundTrip < at.audited && at.roundTrip < at.connection, "read once Core has finalized the recording");
  assert.ok(at.audited < at.settled && at.connection < at.settled, "both are read before the settle event that publishes them");
  assert.ok(at.settled < at.failed, "the discards are in the bundle before the run fails on them");
  assert.ok(at.failed < at.flowLane, "a recording that reached Core short never becomes a Flow");
  assert.match(source, /"Core persisted the completed recording"\), details: \{[^}]*recordingDiscards: discardAudit\.discards, recordingDiscardWindow: discardAudit\.window, extensionConnectionAfterStop: connectionAfterStop/u, "the first read's discards are published with the window it judged them in");
  assert.match(source, /discardWindowFrom = Date\.now\(\);\s*const startResponse = await runtimeMessage\(extensionControl, \{ type: "fluxiq\.startRecording" \}\)/u, "the window opens just before the extension is asked to start recording, after the Core action probe");
  assert.ok(source.includes("const discardScope: RecordingDiscardScope = { recordingIds: outcome.newRecordingIds, sessionId: paired?.sessionId, from: discardWindowFrom };"), "both reads are bounded by that window");
});

test("Core's discard audit is read a second time, after the Flow lane and the browser close and before the topology closes, and unioned with the first", async () => {
  const source = await runnerSource();
  const at = {
    firstRead: source.indexOf("const discardAudit = readRecordingDiscards(await topology.control.gatewaySnapshot(), discardScope);"),
    kept: source.indexOf("firstDiscardRead = { scope: discardScope, discards: discardAudit.discards };"),
    firstFailed: source.indexOf("if (discardAudit.failure) throw discardAudit.failure;"),
    flowLane: source.indexOf("await runFlowLane({"),
    browserClosed: source.indexOf("await context?.close();"),
    secondRead: source.indexOf("readRecordingDiscards(await topology.control.gatewaySnapshot().catch(() => undefined), { ...firstDiscardRead.scope, until: discardWindowUntil }, earlier)"),
    published: source.indexOf("\"Core's discard audit was read again before the topology closed\"), details: { recordingDiscards: secondRead.discards, recordingDiscardWindow: secondRead.window, discardsAfterFirstRead: "),
    topologyClosed: source.indexOf("await topology?.close();"),
  };
  for (const [name, index] of Object.entries(at)) assert.ok(index > 0, `${name} is in the runner`);
  assert.ok(at.firstRead < at.kept && at.kept < at.firstFailed, "the first read is kept before it can throw, so a run it fails is still read again");
  assert.ok(at.flowLane < at.secondRead, "after the Flow lane finishes");
  assert.ok(at.browserClosed < at.secondRead, "once the browser has closed, so no message is still to come");
  assert.ok(at.secondRead < at.published && at.published < at.topologyClosed, "read and published while Core, whose audit is in memory, is still running");
  assert.ok(
    source.includes('failure.category === "recording.persistence" ? failureCategory !== "recording.persistence" : verdict === "passed"'),
    "an action either read finds discarded fails the run as recording.persistence; an audit the second read cannot get fails only a run that had passed",
  );
  assert.ok(source.includes("flowDispatchStarting: at => { discardWindowUntil = at; },"), "the second read's window closes when the Flow lane reports it is dispatching the Flow, whose runtime confirmations Core audits against the finalized recording");
  // Lab Stage 2, W19 run 1: one failed snapshot fetch failed a run whose Flow had met its expectations.
  assert.match(
    source,
    /do \{\s*snapshotFetches \+= 1;\s*secondRead = readRecordingDiscards\(await topology\.control\.gatewaySnapshot\(\)\.catch\(\(\) => undefined\), \{ \.\.\.firstDiscardRead\.scope, until: discardWindowUntil \}, earlier\);\s*\} while \(secondRead\.window\.excluded === null && snapshotFetches < 2\);/u,
    "a snapshot the second read could not fetch or read is fetched once more, and no more, before the read fails closed",
  );
  assert.ok(source.includes("discardsAfterFirstRead: secondRead.discards.length - earlier.length, snapshotFetches }"), "the number of fetches is published beside the read");
});

/**
 * The four harness fixes from `i-bench-triage` are rules in `lane-rules/` and a
 * change to the extract reader, each tested there; what no unit can show is that
 * the runner consults them, so the call sites are pinned here.
 */
test("the runner consults the lane rules: a Core identity and a built Flow on the Flow lane, the Core action probe, and the final-state facts", async () => {
  const source = await runnerSource();
  assert.match(source, /import \{ assertFlowLaneBuiltFlow, coreIdentityRequired, finalStateFacts, flowStartPage \} from "\.\/lane-rules\/index\.js";/u);
  // L1: the probe reads a mark it planted on the start page, which no overlay can refuse, instead of typing into a
  // field in a fresh tab that restarted the site's load-timed overlays. It lives in its own module and is tested there.
  assert.match(source, /import \{ proveCoreActionRoundTrip \} from "\.\/core-action-probe\/index\.js";/u);
  assert.equal(/web\.dom\.type|waitForEvent\("page"|coreProbeTargetUsable|selectCoreProbeStep/u.test(source), false, "L1: the runner neither types, opens a tab, nor picks a step for the probe");
  // Both Flow lanes -- the one built from the run's recording and the one built from a live instruction task -- are the Flow lane here.
  assert.ok(source.includes("const flowLane = options.flow === true || creation !== undefined;"), "H2: a created-Flow run is a Flow-lane run");
  assert.ok(source.includes('bootstrapIdentity: coreIdentityRequired({ clone: target.mode === "clone", flowLane, scenario, recorded: recordingWorkflow.expected })'), "H2: every Flow-lane run bootstraps a Core identity");
  const at = {
    flowLane: source.indexOf("await runFlowLane({"),
    built: source.indexOf('assertFlowLaneBuiltFlow({ flowLane, evaluated: target.mode === "isolated" || target.mode === "persistent-isolated", published: flowObservation });'),
    passed: source.indexOf('verdict = "passed";'),
  };
  for (const [name, index] of Object.entries(at)) assert.ok(index > 0, `${name} is in the runner`);
  assert.ok(at.flowLane < at.built && at.built < at.passed, "H2: a Flow-lane run is checked for a built Flow after the lane and before it can pass");
  const probe = {
    call: source.indexOf("await proveCoreActionRoundTrip({ page, control: topology.control!, sessionId: paired.sessionId, authorizationPin: topology.authorizationPin,"),
    reset: source.indexOf("await resetScenarioLab(topology.scenarioOrigin, topology.allocation.controllerToken);"),
    recording: source.indexOf('const startResponse = await runtimeMessage(extensionControl, { type: "fluxiq.startRecording" })'),
  };
  const reload = source.indexOf("await openScenarioStart(page, topology.scenarioOrigin, scenario);", probe.reset);
  for (const [name, index] of Object.entries({ ...probe, reload })) assert.ok(index > 0, `probe ${name} is in the runner`);
  // The probe's round trip runs on the start page's clock, so the recording starts on the start page loaded afresh.
  assert.ok(probe.call < probe.reset && probe.reset < reload && reload < probe.recording, "L1: the probe, then a reset and a fresh load, then the recording");
  assert.ok(source.includes("oracleVerdict, actions, automationFailure: facilityFailure ? undefined : automationFailure,"), "a facility failure publishes no probe verdict beside it");
  assert.ok(source.includes("await assertExpectedFacts(finalStateFacts(scenario, workflow), playwrightScenarioFactProbe(page));"), "H5: the final state is judged on the facts the rule chooses");
  assert.equal(/successFacts/u.test(source), false, "H5: the runner holds no second playback-goal rule");
  assert.ok(source.includes("assertExtraction(recordingWorkflow.expected.extracted, step.id, extraction.records, extraction.observed);"), "H1: the recording lane asserts every extract step, against what the read itself reported");
});

/**
 * The recording lane measures its own extraction, and nothing else can. Only
 * the run knows which steps ran, and only FluxIQ's own read reports the pages
 * it covered -- so a lane that dropped either would leave `paginationAccuracy`
 * with no lane able to fill it, which is exactly the state this replaced.
 *
 * Pinned at the call site for the reason the evaluation above is: no unit of
 * `runExtractionMeasurements` can show that the runner keeps each read, keeps
 * it before the assertion that may throw, and publishes what it measured.
 */
test("the recording lane reads through FluxIQ's own extraction and publishes what it measured", async () => {
  const source = await runnerSource();
  assert.equal(source.match(/createExtractionIntentDriver\(/gu)?.length, 1, "one control-page-bound extraction seam for the recording lane");
  assert.ok(source.includes("const extractionIntent = paired ? { extractionIntent: createExtractionIntentDriver(extensionControl) } : {};"), "FluxIQ reads only when the extension holds an automation tab to read from");
  const at = {
    bound: source.indexOf("const extractionIntent = paired ?"),
    kept: source.indexOf("reads.set(step.id, extraction);"),
    asserted: source.indexOf("assertExtraction(recordingWorkflow.expected.extracted, step.id, extraction.records, extraction.observed);"),
    measured: source.indexOf("? runExtractionMeasurements({ script: recordingWorkflow.recordingScript, expected: recordingWorkflow.expected.extracted, read: extractionRead })"),
    evaluated: source.indexOf("? singleRunEvaluation({"),
  };
  for (const [name, index] of Object.entries(at)) assert.ok(index > 0, `${name} is in the runner`);
  assert.ok(at.bound < at.kept && at.kept < at.asserted, "a step's read is kept before the expectation that may throw, so a failing step is still measured");
  assert.ok(at.asserted < at.measured && at.measured < at.evaluated, "the measurements reach the evaluation the run publishes");
  assert.ok(source.includes("extraction: extractionRead"), "a run that never ran the script publishes null, which the contract reads as unmeasured");
});

test("the evaluation reaches the caller, so lab run reports it without a bench", async () => {
  const source = await runnerSource();
  assert.match(source, /export type RunScenarioResult = \{[^{}]*evaluation\?: RunEvaluation[^{}]*\};/u);
  // `cli.ts` prints the whole result of a `lab run`, so returning it is what
  // puts the judgement in front of whoever ran the scenario.
  assert.ok(source.includes("...(evaluation ? { evaluation } : {})"), "the result carries the evaluation");
});

/**
 * `lab run --flow` builds its Flow from the run's own recording, so a workflow
 * whose script records no action can never pass it. The runner refuses such a
 * run with the shared check the bench skips it by, before a bundle, Core or a
 * browser exists.
 *
 * This used to run W04, `product-catalog`'s primary workflow, which only reads
 * the page. Since X5.1 an extract step records a `web.dom.extract_list`, so W04
 * and W08 reach the Flow lane and **no Lab fixture is a no-action workflow any
 * more** — every one of the registry's workflows records something. The rule is
 * still live contract (`flowLaneExclusion` refuses a script of only
 * `waitForState`, `checkpoint` and `waitForDownload`), so the case is
 * constructed here rather than borrowed from a fixture that changed underneath
 * it: a scenario registry of this test's own, loaded through the same
 * `FLUXIQ_LAB_SCENARIO_ENTRYPOINT` an instanced Lab is built with. The run is
 * still a real `runScenario`, and the coverage no longer depends on which
 * fixtures happen to extract.
 */
const NO_ACTION_SCENARIO: WebScenario = {
  schemaVersion: "0.1",
  id: "no-action-workflow",
  title: "A workflow whose recording script records no action",
  tags: ["fixture-defect"],
  seed: 1,
  startPath: "/",
  capabilities: [],
  networkPolicy: "loopback-only",
  // Only the runner's own waits and checks, which record nothing.
  recordingScript: [
    { id: "wait", operation: "waitForState", target: "[data-testid=ready]" },
    { id: "confirm", operation: "checkpoint" },
  ],
  expected: {},
};

/** A scenario-lab dist holding only this test's registry, which `loadScenarioManifest` imports as it does the Lab's own. */
async function noActionScenarioLab(): Promise<string> {
  const dist = await mkdtemp(path.join(os.tmpdir(), "fluxiq-no-flow-lane-lab-"));
  await writeFile(path.join(dist, "package.json"), JSON.stringify({ type: "module" }), "utf8");
  await writeFile(path.join(dist, "registry.js"), `export const listScenarioManifests = () => [${JSON.stringify(NO_ACTION_SCENARIO)}];\n`, "utf8");
  return dist;
}

test("a Flow-lane run of a workflow whose script records no action is refused as fixture.invalid before a bundle, Core or a browser exists", async () => {
  const source = await runnerSource();
  assert.match(source, /import \{[^}]*\bflowLaneExclusion\b[^}]*\} from "@fluxiq-web-extension\/test-contracts";/u, "the runner reads the check the bench plans with");
  assert.equal(source.match(/flowLaneExclusion\(/gu)?.length, 1, "one refusal, in one place");
  assert.ok(source.includes("const noFlowLane = options.flow ? flowLaneExclusion(workflow.recordingScript) : undefined;"), "only a Flow-lane run is refused: the recording lane still runs the workflow");
  const at = {
    resolved: source.indexOf("const workflow = resolveWorkflow(scenario, options, target);"),
    bundle: source.indexOf("await bundle.initialize();"),
    extension: source.indexOf("await requireExtension(extensionPath);"),
    topology: source.indexOf("topology = await startTopology({"),
  };
  for (const [name, index] of Object.entries(at)) assert.ok(index > 0, `${name} is in the runner`);
  assert.ok(at.resolved < at.bundle && at.bundle < at.extension && at.extension < at.topology, "the workflow is resolved, and refused, before anything is created or started");

  const scenarioLab = await noActionScenarioLab();
  const runsDirectory = await mkdtemp(path.join(os.tmpdir(), "fluxiq-no-flow-lane-"));
  try {
    // The extension path does not exist, so a run the refusal missed stops at `requireExtension`, before Core or a browser.
    const outcome: unknown = await runScenario({ repositoryRoot: root, fluxiqRepositoryRoot: path.join(runsDirectory, "no-core"), runsDirectory, scenarioId: NO_ACTION_SCENARIO.id, flow: true, environment: { FLUXIQ_LAB_SCENARIO_ENTRYPOINT: path.join(scenarioLab, "server.js"), FLUXIQ_LAB_EXTENSION_PATH: path.join(runsDirectory, "no-extension") } }).then((result) => result, (error: unknown) => error);
    assert.ok(outcome instanceof ProjectedFacilityError, `the run is refused, not run: ${outcome instanceof Error ? outcome.message : JSON.stringify(outcome)}`);
    assert.equal(outcome.category, "fixture.invalid");
    // What the command line prints: the generic sentence, then the runner's own reason.
    assert.match(outcome.message, /^Scenario attempt failed outside a finalized bundle: A Flow run was refused: /u);
    assert.deepEqual(outcome.facilityFailure, { boundary: "no-final-bundle", stage: "scenario.load", reason: "unclassified" });
    // The reason is the no-action one, so a refusal for any other fixture defect -- an
    // unknown scenario, or a manifest this test built wrong -- cannot pass as this case.
    assert.match(
      outcome.cause instanceof Error ? outcome.cause.message : "",
      /^A Flow run was refused: .*no step of the workflow's recordingScript records an action \(operations: waitForState, checkpoint\)/u,
      "the refusal is the Flow-lane exclusion, naming the operations of the script it read",
    );
    assert.deepEqual(await readdir(runsDirectory), [], "no evidence bundle was created");
  } finally {
    // Retried: a run the refusal missed may still be closing bundle files, and a cleanup error must not hide the assertion.
    await rm(runsDirectory, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    await rm(scenarioLab, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});

/**
 * The other half of the same rule, which only the runner's source shape pinned
 * before: the recording lane records the workflow, so it is never refused. The
 * same fixture run without `--flow` passes the exclusion and stops only where
 * any run without a built extension stops.
 */
test("the same workflow is not refused on the recording lane, which records it", async () => {
  const scenarioLab = await noActionScenarioLab();
  const runsDirectory = await mkdtemp(path.join(os.tmpdir(), "fluxiq-no-flow-lane-recording-"));
  try {
    const outcome: unknown = await runScenario({ repositoryRoot: root, fluxiqRepositoryRoot: path.join(runsDirectory, "no-core"), runsDirectory, scenarioId: NO_ACTION_SCENARIO.id, environment: { FLUXIQ_LAB_SCENARIO_ENTRYPOINT: path.join(scenarioLab, "server.js"), FLUXIQ_LAB_EXTENSION_PATH: path.join(runsDirectory, "no-extension") } }).then((result) => result, (error: unknown) => error);
    assert.ok(outcome instanceof ProjectedFacilityError, `the run fails on the environment, not on the fixture: ${outcome instanceof Error ? outcome.message : JSON.stringify(outcome)}`);
    assert.equal(outcome.category, "environment.missing", "the recording lane runs this workflow: it reaches the missing extension, rather than being refused as fixture.invalid");
  } finally {
    await rm(runsDirectory, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    await rm(scenarioLab, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});

/**
 * The harness stops reaching the page for a Flow that was asked to reach it.
 *
 * `prepareFlowPage` loaded the fixture's entry point before every Flow run, so
 * a `navigate-and-extract` Flow with no navigation node in it played back as
 * though it had one (`run-mudwci8d-de88aa32`, 2026-09-23). The rule is in
 * `lane-rules/flow-start-page.ts` and tested there; what no unit can show is
 * that the runner obeys it -- that the load is now conditional, and that the
 * tab really is left blank -- so the call site is pinned here.
 */
test("the runner leaves a Flow that must reach its own page on a blank tab, and proves any arming before it does", async () => {
  const source = await runnerSource();
  assert.match(source, /const startPage = flowStartPage\(\{ task: creation\?\.task, moment, armedFacts: pageFacts\.afterArm \}\);/u, "the runner asks the rule rather than deciding again");
  assert.equal(source.match(/flowStartPage\(/gu)?.length, 1, "one decision, taken in the one hook both Flow lanes and the repair lane prepare through");
  const at = {
    decide: source.indexOf("const startPage = flowStartPage({"),
    load: source.indexOf('if (startPage !== "blank-tab") {'),
    armedFacts: source.indexOf("if (!unarmedBuild) await assertExpectedFacts(pageFacts.afterArm, playwrightScenarioFactProbe(page));"),
    blank: source.indexOf('if (startPage !== "scenario-start-page") await page.goto(BLANK_TAB_URL);'),
  };
  for (const [name, index] of Object.entries(at)) assert.ok(index > 0, `${name} is in the runner`);
  assert.ok(at.decide < at.load && at.load < at.armedFacts && at.armedFacts < at.blank, "the armed rendering is proved on a loaded page, and only then is the tab blanked");
  assert.match(source, /const BLANK_TAB_URL = "about:blank";/u, "the blank tab is a browser page the extension refuses to automate, so only a navigation can leave it");
  // The one remaining load in the hook is the conditional one: nothing reaches the fixture for a Flow that was told to.
  assert.equal(source.slice(at.decide, at.blank).match(/await openScenarioStart\(/gu)?.length, 1);
});
