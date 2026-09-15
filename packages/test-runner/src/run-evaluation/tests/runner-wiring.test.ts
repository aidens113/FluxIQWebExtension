import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
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
test("the runner consults the lane rules: a Core identity and a built Flow on the Flow lane, the probe's start-page step, and the final-state facts", async () => {
  const source = await runnerSource();
  assert.match(source, /import \{ assertFlowLaneBuiltFlow, coreIdentityRequired, finalStateFacts, selectCoreProbeStep \} from "\.\/lane-rules\/index\.js";/u);
  assert.ok(source.includes('bootstrapIdentity: coreIdentityRequired({ clone: target.mode === "clone", flowLane: options.flow === true, scenario, recorded: recordingWorkflow.expected })'), "H2: every Flow-lane run bootstraps a Core identity");
  const at = {
    flowLane: source.indexOf("await runFlowLane({"),
    built: source.indexOf('assertFlowLaneBuiltFlow({ flowLane: options.flow === true, evaluated: target.mode === "isolated" || target.mode === "persistent-isolated", published: flowObservation });'),
    passed: source.indexOf('verdict = "passed";'),
  };
  for (const [name, index] of Object.entries(at)) assert.ok(index > 0, `${name} is in the runner`);
  assert.ok(at.flowLane < at.built && at.built < at.passed, "H2: a Flow-lane run is checked for a built Flow after the lane and before it can pass");
  assert.ok(source.includes("const choice = await selectCoreProbeStep(workflow.recordingScript, "), "H3: the probe types only into a step on the start page");
  assert.ok(source.includes('"The Core action probe was skipped"), details: { reason: choice.reason, stepIds: choice.stepIds } });'), "H3: a skipped probe is published with its reason");
  assert.ok(source.includes("await assertExpectedFacts(finalStateFacts(scenario, workflow), playwrightScenarioFactProbe(page));"), "H5: the final state is judged on the facts the rule chooses");
  assert.equal(/successFacts/u.test(source), false, "H5: the runner holds no second playback-goal rule");
  assert.ok(source.includes("if (extracted) assertExtraction(recordingWorkflow.expected.extracted, step.id, extracted);"), "H1: a paginated extract step follows next, so the recording lane asserts every extract step");
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
 * whose script records no action can never pass it: W04, `product-catalog`'s
 * primary workflow, only reads the page. The runner refuses such a run with the
 * shared check the bench skips it by, before a bundle, Core or a browser exists.
 */
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

  const runsDirectory = await mkdtemp(path.join(os.tmpdir(), "fluxiq-no-flow-lane-"));
  try {
    // The extension path does not exist, so a run the refusal missed stops at `requireExtension`, before Core or a browser.
    const outcome: unknown = await runScenario({ repositoryRoot: root, fluxiqRepositoryRoot: path.join(runsDirectory, "no-core"), runsDirectory, scenarioId: "product-catalog", flow: true, environment: { FLUXIQ_LAB_EXTENSION_PATH: path.join(runsDirectory, "no-extension") } }).then((result) => result, (error: unknown) => error);
    assert.ok(outcome instanceof ProjectedFacilityError, `the run is refused, not run: ${outcome instanceof Error ? outcome.message : JSON.stringify(outcome)}`);
    assert.equal(outcome.category, "fixture.invalid");
    assert.equal(outcome.message, "Scenario attempt failed outside a finalized bundle");
    assert.deepEqual(outcome.facilityFailure, { boundary: "no-final-bundle", stage: "scenario.load", reason: "unclassified" });
    assert.deepEqual(await readdir(runsDirectory), [], "no evidence bundle was created");
  } finally {
    // Retried: a run the refusal missed may still be closing bundle files, and a cleanup error must not hide the assertion.
    await rm(runsDirectory, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});
