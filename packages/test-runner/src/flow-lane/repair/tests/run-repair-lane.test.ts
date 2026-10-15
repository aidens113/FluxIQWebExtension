import assert from "node:assert/strict";
import test from "node:test";
import type { RunHarnessRecovery } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../../failure.js";
import { createdFlowSecretInputs } from "../../creation/index.js";
import { runLiveRepairLane, type LiveRepairLaneInput } from "../run-repair-lane.js";
import type { ProveLiveRepairControl } from "../prove-repair.js";
import { resetProducerResponse } from "../../tests/reset-producer-response.js";
import { RUN_ADAPTATION_SNAPSHOT } from "../../../run-evaluation/adaptation/index.js";

/**
 * The lane end to end, against a fake Core: approve, apply, replay, publish,
 * judge. The two outcomes that matter most are at the ends of it -- a repair
 * that replays without the model passes, and a refusal task that proposed
 * nothing passes without applying or replaying anything.
 */

const RECOVERED: RunHarnessRecovery = {
  attempted: true,
  interventions: [{ kind: "runtime_patch", validationOk: true, validationCodes: [] }],
  runtimePatchAttempts: [{ kind: "temporary_target_override", proposalOnly: true, executed: false, preflightOk: true, issueCodes: [], adaptationCreated: true, changeProposalCreated: true }],
  adaptationIds: ["adaptation-1"],
  changeProposalIds: ["proposal-1"],
};

const REFUSED: RunHarnessRecovery = {
  attempted: true,
  interventions: [{ kind: "diagnosis", validationOk: true, validationCodes: [] }],
  runtimePatchAttempts: [],
  adaptationIds: [],
  changeProposalIds: [],
};

/** The edit Core's re-author built and applied inside the run, as the run records it. */
const REAUTHORED = "adaptation.bootstrap.reauthored";
const RESULT_REPAIRED: RunHarnessRecovery = {
  attempted: false, interventions: [], runtimePatchAttempts: [], adaptationIds: [], changeProposalIds: [],
  resultReauthor: { routed: true, refusal: null, adaptationId: REAUTHORED, applied: true, code: null },
} as unknown as RunHarnessRecovery;
const JUDGED_ROWS = [{ name: "Alpha" }, { name: "Gamma" }];
const JUDGED = [{ datasetId: "products", nodeIds: ["node.one"], recordCount: 2, storeTruncated: false, invalidCount: 0, records: JUDGED_ROWS, nonStringValues: 0, pages: 1 }];

const attempt = { attemptId: "attempt.one", nodeId: "node.one", definitionId: "web.dom.click", order: 0, status: "succeeded", startedAt: 1_000, finishedAt: 1_030 };

/** What the recovery's proposal pointed at, as Core's adaptation stores it: the page's one submit control. */
const APPLY_CHANGES = { tagName: "button", accessibleName: "Apply changes", metadata: { controlType: "submit" } };

/** The step the repair re-points, as the saved Flow holds it before the repair. */
const SAVED_STEP = { id: "node.one", definitionId: "web.output.dom-click", parameterValues: { target: { tagName: "button", accessibleName: "Save" } } };

function lane(options: { recovery?: RunHarnessRecovery; replays?: number; applyRefused?: boolean; providerCalls?: number; accounting?: boolean; inert?: boolean; reauthorRevisions?: boolean; goal?: boolean; target?: Record<string, unknown>; nodes?: unknown[]; replayRows?: (replay: number) => Record<string, unknown>[] } = {}) {
  const endpoints: string[] = [];
  const written: Array<{ path: string; value: any }> = [];
  const published: Record<string, unknown>[] = [];
  const reset: number[] = [];
  let applied = false;
  let replaysRun = 0;
  const control = {
    selectExistingContext: async () => undefined,
    startPersistedFlow: async () => ({ runId: "run.replay" }),
    runPersistedFlow: async () => { replaysRun += 1; return { session: { runId: "run.replay", status: "succeeded" } }; },
    getRunDetail: async () => ({
      summary: { runId: "run.replay", projectId: "project-1", flowId: "flow-1", status: "succeeded", routeDecisionCount: 0, subflowEntryCount: 0, actionAttemptCount: 1, updatedAt: 1 },
      routeDecisions: [], subflows: [], actionAttempts: [], interventions: [],
      // Core states a zero accounting for a run that asked no model; `accounting: false` is a Core that stated none.
      ...(options.providerCalls === undefined ? (options.accounting === false ? {} : { providerCallCount: 0 }) : { providerCallCount: options.providerCalls }),
    }),
    automationStudioCall: async (endpoint: string, payload: Record<string, unknown>) => {
      endpoints.push(endpoint + (payload.action ? `:${String(payload.action)}` : ""));
      // Applying re-points the saved step onto the repaired control, unless `inert`: Core said applied and changed nothing.
      if (endpoint === "get-flow") return { flow: { flowId: payload.flowId, nodes: [applied && !options.inert ? { ...SAVED_STEP, parameterValues: { target: options.target ?? APPLY_CHANGES } } : SAVED_STEP, ...(options.nodes ?? [])], edges: [] } };
      if (endpoint === "list-flow-subflows") return { subflows: [] };
      if (endpoint === "get-flow-adaptation" && payload.adaptationId === REAUTHORED) return { adaptation: { adaptationId: REAUTHORED, status: "applied", ...(options.reauthorRevisions === false ? {} : { metadata: { phase9: { baseRevision: 3, appliedRevision: 4 } } }) } };
      if (endpoint === "get-run-dataset-page") { const rows = options.replayRows?.(replaysRun) ?? []; return { dataset: { schema: { fields: [{ id: "name" }] }, rows, nextCursor: null } }; }
      if (endpoint === "get-flow-adaptation") return { adaptation: { adaptationId: "adaptation-1", status: applied ? "applied" : "proposed", proposalId: "proposal-1", patch: [{ kind: "edit_action_target", targetId: "node.one", after: options.target ?? APPLY_CHANGES }], riskLevel: "low", validationResults: [{ kind: "trial", status: "succeeded", checkedAt: 1 }], ...(applied ? { appliedTo: [{ kind: "action_target", id: "node.one" }] } : {}), metadata: { phase9: { baseRevision: 3, ...(applied ? { appliedRevision: 4 } : {}) } } } };
      if (endpoint === "review-flow-adaptation") {
        if (payload.action === "apply") {
          if (options.applyRefused) throw new RunnerFailure("environment.missing", "Automation Studio call failed: review-flow-adaptation");
          applied = true;
        }
        return { adaptation: { adaptationId: "adaptation-1" } };
      }
      const rows = options.replayRows?.(replaysRun);
      // The lane's own run created the repair and spent on it; a replay created nothing and Core states it spent nothing.
      const own = payload.runId === "run.lane";
      const spent = own ? { calls: 3, inputTokens: 30, outputTokens: 6, totalTokens: 36, estimatedCostUsd: 0.002 } : { calls: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0 };
      // A replay is read once Core has saved its verdict (`replay-repair.ts`), as Core saves it for a run with no model to ask.
      const verdict = own ? {} : { resultVerification: { status: "unverified", performed: false, code: "core.result.no_model_available" } };
      return { runDetail: { summary: { runId: own ? "run.lane" : "run.replay", projectId: "project-1", status: "succeeded" }, actionAttempts: [attempt], interventions: [], adaptationIds: own ? ["adaptation-1"] : [], metadata: { llmGate: { costAccounting: spent }, ...verdict }, ...(rows ? { datasets: [{ datasetId: "products", nodeIds: ["node.one"], recordCount: rows.length, truncated: false, invalidCount: 0 }] } : {}) } };
    },
  } as unknown as ProveLiveRepairControl;
  const input: LiveRepairLaneInput = {
    ...(options.replays === undefined ? {} : { replays: options.replays }),
    live: { repairsFlow: true, describeRepair: () => ({ task: "repair", purpose: "explore_and_adapt" }) },
    lane: { flowId: "flow-1", run: { harnessRecovery: options.recovery ?? RECOVERED } },
    projectId: "project-1", facilityRunId: "run-lab", scenarioId: "identity-drift",
    secrets: [], steps: [],
    scenarioOrigin: "http://127.0.0.1:1/", runToken: "token",
    prepare: async () => undefined,
    checkGoal: async () => options.goal ?? true,
    bundle: { writeStructured: async (path: string, value: unknown) => { written.push({ path, value }); } },
    publish: async (details: Record<string, unknown>) => { published.push(details); },
  };
  // The reset is the lane's own and goes through `fetch`; the fixture origin is
  // unreachable, so it is replaced rather than served, in the producer's own
  // shape. Only the POST is a reset; the GET is the health read confirming it.
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_url: string, init?: { method?: string }) => {
    if (init?.method === "POST") reset.push(reset.length + 1);
    return resetProducerResponse(init?.method);
  }) as unknown as typeof fetch;
  return { control, input, endpoints, written, published, reset, restore: () => { globalThis.fetch = originalFetch; } };
}

test("a repair is approved, applied and replayed, and the proof is published before it is judged", async (t) => {
  const fake = lane({ replays: 2 });
  t.after(fake.restore);
  const proof = await runLiveRepairLane(fake.control, fake.input);
  assert.ok(proof);
  assert.equal(proof.task, "repair");
  assert.equal(proof.purpose, "explore_and_adapt");
  assert.equal(proof.application.outcome, "applied");
  assert.equal(proof.replaysRequested, 2);
  assert.deepEqual(proof.replays.map((replay) => [replay.outcome, replay.providerCalls, replay.goalPassed]), [["ran", 0, true], ["ran", 0, true]]);
  assert.deepEqual(fake.reset, [1, 2], "each replay resets the fixture before arming it");
  assert.deepEqual(fake.written.map((entry) => entry.path), ["snapshots/repair-lane.json"], "a lane run with no run id is not measured");
  assert.equal(fake.written[0]?.value.application.outcome, "applied");
  assert.deepEqual(fake.published[0]?.application, "applied");
  assert.equal(fake.published[0]?.flowChange, "changed");
  assert.ok(fake.endpoints.includes("review-flow-adaptation:approve"));
  assert.ok(fake.endpoints.includes("review-flow-adaptation:apply"));
});

test("a refusal task proposed nothing, so nothing is applied, nothing is replayed, and the run does not fail", async (t) => {
  const fake = lane({ replays: 2, recovery: REFUSED });
  t.after(fake.restore);
  const proof = await runLiveRepairLane(fake.control, fake.input);
  assert.ok(proof);
  assert.equal(proof.application.outcome, "no_proposal");
  assert.deepEqual(proof.replays, []);
  assert.deepEqual(fake.reset, [], "a refusal task must not replay");
  assert.equal(fake.endpoints.filter((endpoint) => endpoint.startsWith("review-flow-adaptation")).length, 0);
  assert.equal(fake.written[0]?.value.application.outcome, "no_proposal");
});

test("without --replays the lane does nothing at all", async (t) => {
  const fake = lane({});
  t.after(fake.restore);
  assert.equal(await runLiveRepairLane(fake.control, fake.input), undefined);
  assert.deepEqual(fake.endpoints, []);
  assert.deepEqual(fake.written, []);
});

test("a provider-free run has no repair to apply, whatever --replays says", async (t) => {
  const fake = lane({ replays: 1 });
  t.after(fake.restore);
  const { live: _live, ...withoutLive } = fake.input;
  assert.equal(await runLiveRepairLane(fake.control, withoutLive), undefined);
  assert.deepEqual(fake.endpoints, []);
});

test("--replays 0 applies the repair and proves nothing, which is what it says", async (t) => {
  const fake = lane({ replays: 0 });
  t.after(fake.restore);
  const proof = await runLiveRepairLane(fake.control, fake.input);
  assert.equal(proof?.application.outcome, "applied");
  assert.deepEqual(proof?.replays, []);
  assert.deepEqual(fake.reset, []);
});

test("a repair Core would not apply fails the run, and the evidence is written first", async (t) => {
  const fake = lane({ replays: 1, applyRefused: true });
  t.after(fake.restore);
  await assert.rejects(
    runLiveRepairLane(fake.control, fake.input),
    (error: unknown) => error instanceof RunnerFailure && error.category === "runtime.behavior" && /could not be applied: 1 adaptation\(s\) ended proposed rather than applied \(a review was refused: environment.missing\)/u.test(error.message),
  );
  assert.equal(fake.written[0]?.value.application.outcome, "not_applied", "the proof was not published before the judgement");
  assert.deepEqual(fake.reset, [], "a repair that was not applied must not be replayed");
});

test("a replay that called the model fails the run as the thing it is: a repair that is not deterministic", async (t) => {
  const fake = lane({ replays: 2, providerCalls: 1 });
  t.after(fake.restore);
  await assert.rejects(
    runLiveRepairLane(fake.control, fake.input),
    (error: unknown) => error instanceof RunnerFailure && /is not deterministic: 2 of 2 replay\(s\) called the model/u.test(error.message),
  );
  assert.equal(fake.written[0]?.value.replays.length, 2);
});

test("a replay whose goal did not hold fails the run, naming the replays that missed it", async (t) => {
  const fake = lane({ replays: 1, goal: false });
  t.after(fake.restore);
  await assert.rejects(
    runLiveRepairLane(fake.control, fake.input),
    (error: unknown) => error instanceof RunnerFailure && /did not hold: 1 of 1 replay\(s\) did not reach the fixture's expected final state/u.test(error.message),
  );
});

/**
 * A Flow FluxIQ built from an instruction: its playback ran under the
 * model taking part, so its repair is the same kind of proposal. A scenario's
 * declared repair, which once held such a proposal to a named control, is
 * retired (t559), so the proposal is applied and replayed like any other.
 */
function createdLane(options: Parameters<typeof lane>[0] = {}) {
  const fake = lane(options);
  const input: LiveRepairLaneInput = {
    ...fake.input,
    // The created lane's own rule, as the runner hands it in.
    rebuildInputs: (nodes) => createdFlowSecretInputs({ scenarioId: fake.input.scenarioId, secrets: fake.input.secrets, workflow: { recordingScript: [] }, nodes }),
    live: { repairsFlow: true, describeRepair: () => ({ task: "create-flow", purpose: "diagnose_and_adapt" }) },
  };
  return { ...fake, input };
}

test("a created Flow's proposal is applied and replayed under the intent that made it, with no declared repair judged", async (t) => {
  const fake = createdLane({ replays: 1 });
  t.after(fake.restore);
  const proof = await runLiveRepairLane(fake.control, fake.input);
  assert.deepEqual([proof?.task, proof?.purpose, proof?.application.outcome], ["create-flow", "diagnose_and_adapt", "applied"]);
  assert.deepEqual(proof?.replays.map((replay) => [replay.outcome, replay.providerCalls, replay.goalPassed]), [["ran", 0, true]]);
  assert.equal("declaredRepair" in (fake.written[0]?.value ?? {}), false);
  assert.equal("declaredRepair" in (fake.published[0] ?? {}), false);
});

test("a created Flow's run inputs are rebuilt by the rule its caller hands in, here the created lane's, which refuses a Flow asking for files before anything is applied", async (t) => {
  const uploading = { id: "node.upload", definitionId: "web.output.dom-upload", parameterValues: { selector: "#file", upload: { $state: { path: "web.upload.file" } } }, metadata: { outputActionId: "web.dom.upload" } };
  const fake = createdLane({ replays: 1, nodes: [uploading] });
  t.after(fake.restore);
  await assert.rejects(runLiveRepairLane(fake.control, fake.input), /asks the run for files on 1 node\(s\)/u);
  assert.equal(fake.endpoints.some((endpoint) => endpoint.startsWith("review-flow-adaptation")), false);
  // The recorded rule reads a node's nested parameters only, so the same flat node asks it for nothing.
  const recorded = lane({ replays: 1, nodes: [uploading] });
  t.after(recorded.restore);
  assert.equal((await runLiveRepairLane(recorded.control, recorded.input))?.application.outcome, "applied");
});

// A wrong answer Core repaired inside the run: its re-author built an edit,
// applied it, re-ran the same run and had the answer judged again. There is no
// proposal to approve, so the lane used to find none, replay nothing and pass.
test("a wrong-answer repair applied in the run is replayed without the model, and each replay must return the judged rows", async (t) => {
  const fake = lane({ replays: 2, recovery: RESULT_REPAIRED, replayRows: () => JUDGED_ROWS });
  t.after(fake.restore);
  const proof = await runLiveRepairLane(fake.control, { ...fake.input, lane: { flowId: "flow-1", run: { harnessRecovery: RESULT_REPAIRED, extracted: JUDGED } } });
  assert.ok(proof);
  assert.deepEqual(proof.adaptationIds, [REAUTHORED]);
  assert.equal(proof.application.outcome, "applied");
  assert.deepEqual(proof.replays.map((replay) => [replay.outcome, replay.providerCalls, replay.datasetsReproduced]), [["ran", 0, true], ["ran", 0, true]]);
  // Nothing was approved or applied again.
  assert.equal(fake.endpoints.filter((endpoint) => endpoint.startsWith("review-flow-adaptation")).length, 0);
  assert.equal(fake.published[0]?.repair, "result_reauthor");
});

test("a wrong-answer repair whose replay returns other rows is not deterministic, and fails the run", async (t) => {
  const fake = lane({ replays: 2, recovery: RESULT_REPAIRED, replayRows: (replay) => replay === 2 ? [{ name: "Alpha" }, { name: "Beta" }, { name: "Gamma" }] : JUDGED_ROWS });
  t.after(fake.restore);
  await assert.rejects(
    runLiveRepairLane(fake.control, { ...fake.input, lane: { flowId: "flow-1", run: { harnessRecovery: RESULT_REPAIRED, extracted: JUDGED } } }),
    (error: unknown) => error instanceof RunnerFailure && /not deterministic: 1 of 2 replay\(s\) stored other rows than the run that was judged right/u.test(error.message),
  );
  assert.deepEqual(fake.written[0]?.value.replays.map((replay: { datasetsReproduced: boolean | null }) => replay.datasetsReproduced), [true, false]);
});

// A failed step Core re-authored on a form task: the same run marker as a
// wrong answer, but the run stored no rows, so there is no dataset to
// reproduce. Each replay is judged on its goal alone.
for (const [label, extracted] of [["stored no rows", []], ["records no extraction", undefined]] as const) {
  test(`a failed-step re-author of a Flow that ${label} is replayed goal-only, without the model`, async (t) => {
    const fake = lane({ replays: 2, recovery: RESULT_REPAIRED });
    t.after(fake.restore);
    const run = { harnessRecovery: RESULT_REPAIRED, ...(extracted === undefined ? {} : { extracted: [...extracted] }) };
    const proof = await runLiveRepairLane(fake.control, { ...fake.input, lane: { flowId: "flow-1", run } });
    assert.ok(proof);
    assert.deepEqual(proof.adaptationIds, [REAUTHORED]);
    assert.equal(proof.application.outcome, "applied");
    assert.deepEqual(proof.replays.map((replay) => [replay.outcome, replay.providerCalls, replay.goalPassed, replay.datasetsReproduced]), [["ran", 0, true, null], ["ran", 0, true, null]]);
    assert.deepEqual(fake.reset, [1, 2]);
    assert.equal(fake.endpoints.filter((endpoint) => endpoint.startsWith("review-flow-adaptation")).length, 0, "nothing is approved or applied again");
    assert.equal(fake.published[0]?.repair, "result_reauthor");
  });
}

test("a goal-only re-author replay that misses the fixture goal fails the run", async (t) => {
  const fake = lane({ replays: 1, recovery: RESULT_REPAIRED, goal: false });
  t.after(fake.restore);
  await assert.rejects(
    runLiveRepairLane(fake.control, { ...fake.input, lane: { flowId: "flow-1", run: { harnessRecovery: RESULT_REPAIRED, extracted: [] } } }),
    (error: unknown) => error instanceof RunnerFailure && /did not hold: 1 of 1 replay\(s\) did not reach the fixture's expected final state/u.test(error.message),
  );
  assert.equal(fake.written[0]?.value.replays[0]?.datasetsReproduced, null);
  assert.equal(fake.published[0]?.repair, "result_reauthor");
});

// A held re-author (t267) that Core then did not keep. Core approves the edit,
// holds it unapplied for the run's judged whole run, and rejects it when that
// run is refuted -- or leaves it held when the run never settles. The lane used
// to keep only an `applied` re-author, so it dropped this one, found no
// proposal and passed with 0 replays: a repair that was never kept read as one
// that was proven.
const notKept = (fields: Record<string, unknown>): RunHarnessRecovery => ({
  attempted: false, interventions: [], runtimePatchAttempts: [], adaptationIds: [], changeProposalIds: [],
  resultReauthor: { routed: true, refusal: null, adaptationId: REAUTHORED, applied: false, failureCode: null, held: true, ...fields },
} as RunHarnessRecovery);

for (const [label, fields, reason, message] of [
  ["Core rejected after its judged run", { notAppliedReason: "refuted" }, "refuted", /^The run re-wrote the Flow, but the re-write was not kept \(refuted\), so there is no repair to replay$/u],
  ["Core left held and unsettled", {}, null, /^The run re-wrote the Flow and held the re-write for its judged run, but it was never settled, so it was not kept and there is no repair to replay$/u],
] as const) {
  test(`a re-author ${label} is never a proven repair: the record says so, is published, and the run fails`, async (t) => {
    const recovery = notKept(fields);
    const fake = lane({ replays: 2, recovery });
    t.after(fake.restore);
    await assert.rejects(
      runLiveRepairLane(fake.control, { ...fake.input, lane: { flowId: "flow-1", run: { harnessRecovery: recovery, extracted: JUDGED } } }),
      (error: unknown) => error instanceof RunnerFailure && error.category === "runtime.behavior" && message.test(error.message),
    );
    assert.deepEqual(fake.written.map((entry) => entry.path), ["snapshots/repair-lane.json"], "the record is written before the run fails");
    assert.deepEqual(fake.written[0]?.value, {
      task: "repair", purpose: "explore_and_adapt", repair: "result_reauthor",
      resultReauthor: { adaptationId: REAUTHORED, kept: false, held: true, notAppliedReason: reason },
      application: null, replaysRequested: 2, replays: [], adaptationGate: { counted: false, reason: "reauthor_not_kept" },
    });
    assert.deepEqual(fake.published, [{ repair: "result_reauthor", kept: false, held: true, notAppliedReason: reason, application: null, replaysRequested: 2, replays: [], adaptationGate: { counted: false, reason: "reauthor_not_kept" } }]);
    assert.deepEqual(fake.reset, [], "nothing is replayed");
    assert.deepEqual(fake.endpoints, [], "nothing is judged, approved or applied: there is nothing kept to apply");
  });
}

test("an applied held re-author is unchanged: replayed N times without the model", async (t) => {
  const recovery = notKept({ applied: true });
  const fake = lane({ replays: 3, recovery });
  t.after(fake.restore);
  const proof = await runLiveRepairLane(fake.control, { ...fake.input, lane: { flowId: "flow-1", run: { harnessRecovery: recovery, extracted: [] } } });
  assert.ok(proof);
  assert.equal(proof.application.outcome, "applied");
  assert.equal(proof.replays.length, 3);
  assert.deepEqual(proof.replays.map((replay) => replay.providerCalls), [0, 0, 0]);
  assert.equal(fake.published[0]?.repair, "result_reauthor");
});

test("no re-author marker and no proposal is unchanged: recorded as no_proposal, 0 replays, and the run does not fail", async (t) => {
  const fake = lane({ replays: 2, recovery: REFUSED });
  t.after(fake.restore);
  const proof = await runLiveRepairLane(fake.control, fake.input);
  assert.equal(proof?.application.outcome, "no_proposal");
  assert.deepEqual(proof?.replays, []);
  assert.equal("resultReauthor" in (fake.written[0]?.value ?? {}), false);
});

/**
 * Adaptation plan G1: the proof records the saved Flow before and after the
 * apply, an applied repair that left the Flow's steps unchanged fails, a replay
 * Core kept no accounting for is unknown rather than zero, and the run's
 * persistence and reuse measurements are written from the same facts.
 */
test("the proof records the saved Flow's hashes before and after the apply, and the run's persistence and reuse are measured", async (t) => {
  const fake = lane({ replays: 1 });
  t.after(fake.restore);
  const proof = await runLiveRepairLane(fake.control, { ...fake.input, lane: { flowId: "flow-1", run: { harnessRecovery: RECOVERED, runId: "run.lane" } } });
  assert.equal(proof?.application.flow?.change, "changed");
  const record = fake.written[0]?.value;
  assert.equal(fake.written[0]?.path, "snapshots/repair-lane.json");
  assert.match(record.application.flow.before.contentHash, /^[0-9a-f]{64}$/u);
  assert.notEqual(record.application.flow.before.stepsHash, record.application.flow.after.stepsHash);
  assert.deepEqual(record.application.adaptations.map((item: { baseRevision: number; appliedRevision: number }) => [item.baseRevision, item.appliedRevision]), [[3, 4]]);
  assert.equal(fake.written[1]?.path, RUN_ADAPTATION_SNAPSHOT);
  const measured = fake.written[1]?.value;
  assert.deepEqual(measured.adaptationPersistence, { adaptations: [{ adaptationId: "adaptation-1", status: "applied", baseRevision: 3, appliedRevision: 4 }] });
  // Core's legacy apply re-points the node without stamping it, so the replay is matched to the change by where Core says it applied it.
  assert.deepEqual(measured.adaptationReuse, { exercisedAdaptationIds: ["adaptation-1"], providerCalls: 0, interventions: 0, resume: null });
  assert.equal(measured.adaptationCost.providerCalls, 3, "the cost is the run that made the repair, not its replay");
});

test("a repair Core reports applied that left the saved Flow's steps unchanged fails the run, with the evidence written first", async (t) => {
  const fake = lane({ replays: 1, inert: true });
  t.after(fake.restore);
  await assert.rejects(
    runLiveRepairLane(fake.control, fake.input),
    (error: unknown) => error instanceof RunnerFailure && error.category === "runtime.behavior" && /^Core reported the repair applied, but the saved Flow's steps are unchanged/u.test(error.message),
  );
  assert.equal(fake.written[0]?.value.application.outcome, "applied");
  assert.equal(fake.written[0]?.value.application.flow.change, "unchanged");
  assert.equal(fake.published[0]?.flowChange, "unchanged");
});

test("a replay Core kept no provider accounting for fails the run as unknown, as `lab replay` does", async (t) => {
  const fake = lane({ replays: 1, accounting: false });
  t.after(fake.restore);
  await assert.rejects(
    runLiveRepairLane(fake.control, fake.input),
    (error: unknown) => error instanceof RunnerFailure && /^Core published no provider call accounting for 1 of 1 replay\(s\) of the applied Flow/u.test(error.message),
  );
  assert.equal(fake.written[0]?.value.replays[0]?.providerCalls, null);
  assert.deepEqual(fake.published[0]?.replays, [{ index: 1, outcome: "ran", providerCalls: null, goalPassed: true, datasetsReproduced: null }]);
});

test("a re-author Core applied in the run whose record shows no change to the Flow is unproven, and fails", async (t) => {
  const fake = lane({ replays: 1, recovery: RESULT_REPAIRED, reauthorRevisions: false });
  t.after(fake.restore);
  await assert.rejects(
    runLiveRepairLane(fake.control, { ...fake.input, lane: { flowId: "flow-1", run: { harnessRecovery: RESULT_REPAIRED, extracted: [] } } }),
    (error: unknown) => error instanceof RunnerFailure && /^Core applied the repair inside the run, and neither the saved Flow nor Core's record/u.test(error.message),
  );
  assert.equal(fake.written[0]?.value.application.flow.change, "unseen_in_run");
});

/**
 * t512: every record the lane writes says whether the run counts toward the
 * adaptation gate (plan, "Gate oracle"), and the lane still writes its record
 * when the created Flow's oracle failed (run-mv6v2hx5-f448e662, where the
 * failure threw before the lane and left no record at all).
 */
const ABSORBED: RunHarnessRecovery = { attempted: false, interventions: [], runtimePatchAttempts: [], adaptationIds: [], changeProposalIds: [] };

test("a drift absorbed or never met is recorded and published as not counting toward the gate", async (t) => {
  const fake = lane({ replays: 1, recovery: ABSORBED });
  t.after(fake.restore);
  const proof = await runLiveRepairLane(fake.control, fake.input);
  assert.equal(proof?.application.outcome, "no_proposal");
  assert.deepEqual(fake.written[0]?.value.adaptationGate, { counted: false, reason: "no_recovery_attempted" });
  assert.deepEqual(fake.published[0]?.adaptationGate, { counted: false, reason: "no_recovery_attempted" });
});

test("a recovery that proposed nothing is recorded as not counting toward the gate", async (t) => {
  const fake = lane({ replays: 1, recovery: REFUSED });
  t.after(fake.restore);
  await runLiveRepairLane(fake.control, fake.input);
  assert.deepEqual(fake.written[0]?.value.adaptationGate, { counted: false, reason: "no_proposal" });
});

test("an applied repair that moved the steps and replayed with no model counts toward the gate", async (t) => {
  const fake = lane({ replays: 1 });
  t.after(fake.restore);
  await runLiveRepairLane(fake.control, fake.input);
  assert.deepEqual(fake.written[0]?.value.adaptationGate, { counted: true, reason: "counted" });
  assert.deepEqual(fake.published[0]?.adaptationGate, { counted: true, reason: "counted" });
});

test("an applied repair replayed 0 times does not count toward the gate", async (t) => {
  const fake = lane({ replays: 0 });
  t.after(fake.restore);
  await runLiveRepairLane(fake.control, fake.input);
  assert.deepEqual(fake.written[0]?.value.adaptationGate, { counted: false, reason: "no_replay" });
});

test("a replay that missed the goal is recorded as not counting before the run fails", async (t) => {
  const fake = lane({ replays: 1, goal: false });
  t.after(fake.restore);
  await assert.rejects(runLiveRepairLane(fake.control, fake.input), RunnerFailure);
  assert.deepEqual(fake.written[0]?.value.adaptationGate, { counted: false, reason: "replay_failed" });
});

test("a created Flow whose oracle failed still has its repair lane recorded, beside the failure, with nothing applied or replayed", async (t) => {
  const fake = lane({ replays: 1 });
  t.after(fake.restore);
  const laneFailure = { category: "runtime.behavior", code: "lab.extraction_mismatch" };
  const proof = await runLiveRepairLane(fake.control, { ...fake.input, lane: { flowId: "flow-1", run: { harnessRecovery: RECOVERED, runId: "run.lane" }, observation: { oracleVerdict: "failed", reportedVerdict: "passed" } }, laneFailure } as LiveRepairLaneInput);
  assert.equal(proof, undefined);
  assert.equal(fake.endpoints.filter((endpoint) => endpoint.startsWith("review-flow-adaptation")).length, 0, "a repair from a run judged wrong is never approved onto the Flow");
  assert.deepEqual(fake.reset, []);
  const record = fake.written[0]?.value;
  assert.equal(fake.written[0]?.path, "snapshots/repair-lane.json");
  assert.deepEqual(record.laneFailure, laneFailure);
  assert.equal(record.application, null);
  assert.deepEqual(record.adaptationIds, ["adaptation-1"]);
  assert.equal(record.recoveryAttempted, true);
  assert.deepEqual(record.replays, []);
  assert.deepEqual(record.adaptationGate, { counted: false, reason: "oracle_failed" });
  assert.deepEqual(fake.published[0]?.adaptationGate, { counted: false, reason: "oracle_failed" });
  assert.equal(fake.written[1]?.path, RUN_ADAPTATION_SNAPSHOT, "the lane run's own adaptations are still measured");
  assert.equal(fake.written[1]?.value.adaptationReuse, null, "no replay ran, so reuse is unmeasured");
});

// run-mv9v3u68-6efbd7ae (A8 wave 15): the oracle passed, the Lab read the run as failed, and the record said `oracle_failed`.
test("a created Flow whose oracle passed and whose run was reported failed names the product's failure, never oracle_failed", async (t) => {
  const fake = lane({ replays: 1 });
  t.after(fake.restore);
  const laneFailure = { category: "runtime.behavior", code: null };
  const observation = { oracleVerdict: "passed" as const, reportedVerdict: "failed" as const };
  await runLiveRepairLane(fake.control, { ...fake.input, lane: { flowId: "flow-1", run: { harnessRecovery: RECOVERED, runId: "run.lane" }, observation }, laneFailure } as LiveRepairLaneInput);
  assert.deepEqual(fake.written[0]?.value.adaptationGate, { counted: false, reason: "flow_reported_failure" });
  assert.deepEqual(fake.published[0]?.adaptationGate, { counted: false, reason: "flow_reported_failure" });
});
