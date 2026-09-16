import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../failure.js";
import { executeRecordedFlowRun, type PersistedFlowRunControl } from "../persisted-flow-run.js";

const attempt = (overrides: Record<string, unknown> = {}) => ({ attemptId: "attempt.one", nodeId: "node.one", definitionId: "web.dom.type", order: 0, status: "succeeded", startedAt: 1_000, finishedAt: 1_030, ...overrides });

function control(overrides: Partial<Record<string, unknown>> = {}, detail: Record<string, unknown> = {}) {
  const calls: string[] = [];
  const client = {
    selectExistingContext: async () => { calls.push("select"); },
    startPersistedFlow: async () => { calls.push("start"); return { runId: "run.one" }; },
    runPersistedFlow: async () => { calls.push("run"); return { session: { runId: "run.one", status: "succeeded" } }; },
    automationStudioCall: async (endpoint: string) => {
      calls.push(endpoint);
      return { runDetail: { summary: { runId: "run.one", status: "succeeded" }, actionAttempts: [attempt()], interventions: [], ...detail } };
    },
    ...overrides,
  } as unknown as PersistedFlowRunControl;
  return { client, calls };
}

test("an attempt is identified by its node, because every recorded action shares one node definition", async () => {
  // Core stores definitionId "builtin.policy.action" for all of them and drops the node inputs.
  const { client } = control({}, { actionAttempts: [attempt({ definitionId: "builtin.policy.action", nodeId: "recorded.one" })] });
  const outcome = await executeRecordedFlowRun(client, { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab", actionTypes: new Map([["recorded.one", "web.dom.type"]]) });
  assert.equal(outcome.actions[0]?.actionType, "web.dom.type");

  const { client: unmapped } = control({}, { actionAttempts: [attempt({ definitionId: "builtin.policy.action", nodeId: "other" })] });
  const fallback = await executeRecordedFlowRun(unmapped, { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab", actionTypes: new Map() });
  assert.equal(fallback.actions[0]?.actionType, "builtin.policy.action");
});

test("a clean Flow run reports its actions and no failure", async () => {
  const { client, calls } = control();
  const outcome = await executeRecordedFlowRun(client, { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab" });
  assert.equal(outcome.runId, "run.one");
  assert.equal(outcome.status, "succeeded");
  assert.equal(outcome.failure, null);
  assert.deepEqual(outcome.actions.map(action => [action.actionType, action.status, action.durationMs]), [["web.dom.type", "succeeded", 30]]);
  assert.equal(outcome.harnessActivations, 0);
  assert.deepEqual(calls, ["select", "start", "run", "get-flow-run-detail"]);
});

test("a failed Flow is a result, not a runner fault: the structured failure survives to be asserted", async () => {
  const failure = { category: "auth_required", code: "session.expired", retryable: false };
  const { client } = control(
    { runPersistedFlow: async () => ({ session: { runId: "run.one", status: "failed" } }) },
    { summary: { runId: "run.one", status: "failed" }, actionAttempts: [attempt({ status: "failed", failure })] },
  );
  const outcome = await executeRecordedFlowRun(client, { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab" });
  assert.equal(outcome.status, "failed");
  assert.deepEqual(outcome.failure, failure);
  assert.equal(outcome.actions[0]?.status, "failed");
});

test("a bounded run timeout or abort waits through an empty running detail for terminal durable attempts", async () => {
  for (const bounded of ["timeout", "abort"] as const) {
    const original = new RunnerFailure("runtime.behavior", `synthetic ${bounded}`, { details: { bounded, timeoutMs: 30_000 } });
    let reads = 0;
    const { client } = control({
      runPersistedFlow: async () => { throw original; },
      automationStudioCall: async () => {
        reads += 1;
        return reads === 1
          ? { runDetail: { summary: { runId: "run.one", status: "running" }, actionAttempts: [], interventions: [] } }
          : { runDetail: { summary: { runId: "run.one", status: "succeeded" }, actionAttempts: [attempt()], interventions: [] } };
      },
    });
    const clock = { value: 0 };
    const outcome = await executeRecordedFlowRun(
      client,
      { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab" },
      {},
      { now: () => clock.value, sleep: async ms => { clock.value += ms; }, timeoutMs: 1_000, intervalMs: 100 },
    );
    assert.equal(outcome.status, "succeeded", bounded);
    assert.equal(outcome.actions.length, 1, bounded);
    assert.equal(reads, 2, bounded);
  }
});

test("a bounded run failure with no terminal durable evidence preserves the original failure", async () => {
  const original = new RunnerFailure("runtime.behavior", "synthetic bounded timeout", { details: { bounded: "timeout", timeoutMs: 30_000 } });
  let reads = 0;
  const { client } = control({
    runPersistedFlow: async () => { throw original; },
    automationStudioCall: async () => {
      reads += 1;
      return { runDetail: { summary: { runId: "run.one", status: "running" }, actionAttempts: [], interventions: [] } };
    },
  });
  const clock = { value: 0 };
  await assert.rejects(
    () => executeRecordedFlowRun(
      client,
      { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab" },
      {},
      { now: () => clock.value, sleep: async ms => { clock.value += ms; }, timeoutMs: 250, intervalMs: 100 },
    ),
    error => error === original,
  );
  assert.equal(reads, 3);
});

test("a non-bounded run failure is rethrown without reading a run detail", async () => {
  const original = new RunnerFailure("runtime.behavior", "synthetic non-bounded failure");
  const { client, calls } = control({ runPersistedFlow: async () => { throw original; } });
  await assert.rejects(
    () => executeRecordedFlowRun(client, { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab" }),
    error => error === original,
  );
  assert.deepEqual(calls, ["select", "start"]);
});

test("a failure record Core's own parser rejects is treated as absent, never half-read", async () => {
  // Core forbids this category from being retryable, so the record is dropped whole.
  const { client } = control({}, { summary: { runId: "run.one", status: "failed" }, actionAttempts: [attempt({ status: "failed", failure: { category: "blocked_by_capability_or_policy", retryable: true } })] });
  const outcome = await executeRecordedFlowRun(client, { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab" });
  assert.equal(outcome.failure, null);
});

/**
 * A run's extracted records are in Core's run datasets, never in its run
 * detail: Core replaces a stored attempt's rows with a `$dataset` marker
 * holding their count (`service/summaries/conversions.ts`). The detail names
 * the datasets (K5) and `get-run-dataset-page` returns their rows (K8).
 */
function datasetControl(pages: Array<Record<string, unknown>>, detail: Record<string, unknown> = {}) {
  const requests: Array<Record<string, unknown>> = [];
  const { client } = control({
    automationStudioCall: async (endpoint: string, payload: Record<string, unknown>) => {
      if (endpoint !== "get-run-dataset-page") {
        return { runDetail: { summary: { runId: "run.one", status: "succeeded" }, interventions: [], actionAttempts: [attempt({ definitionId: "builtin.policy.action", nodeId: "node.extract", metadata: { recordCount: 3 } })], ...detail } };
      }
      requests.push(payload);
      const page = pages[requests.length - 1];
      if (!page) throw new Error("The reader asked for a page Core does not have");
      return { dataset: page };
    },
  });
  return { client, requests };
}

const summary = (overrides: Record<string, unknown> = {}) => ({ runId: "run.one", datasetId: "catalog", nodeIds: ["node.extract"], recordCount: 3, truncated: false, invalidCount: 0, ...overrides });
const schema = { schemaVersion: "0.1", fields: [{ id: "name", label: "Name", valueType: "string" }, { id: "price", label: "Price", valueType: "string" }] };

test("a run's records are read from its datasets, every page of them, with a missing field restored as null", async () => {
  const { client, requests } = datasetControl(
    [
      { summary: summary(), schema, rows: [{ name: "Alpha", price: "1.00" }, { name: "Beta" }], nextCursor: "cursor.two" },
      { summary: summary(), schema, rows: [{ name: "Gamma", price: "3.00" }], nextCursor: null },
    ],
    { datasets: [summary()] },
  );
  const outcome = await executeRecordedFlowRun(client, { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab" });
  assert.equal(outcome.extracted.length, 1);
  // The second page is read only because the first page's cursor was followed.
  assert.deepEqual(outcome.extracted[0]?.records, [{ name: "Alpha", price: "1.00" }, { name: "Beta", price: null }, { name: "Gamma", price: "3.00" }]);
  assert.deepEqual(requests.map(request => request.cursor), [null, "cursor.two"]);
  assert.deepEqual(requests.map(request => request.limit), [200, 200]);
  assert.equal(outcome.extracted[0]?.pages, 2);
  assert.equal(outcome.extractedNonStringValues, 0);
  // The attempt says how many rows it captured, and how long it took, so a duration can be attributed to the dataset its node wrote.
  assert.equal(outcome.actions[0]?.recordCount, 3);
  assert.deepEqual([...outcome.extractionDurationsByNode], [["node.extract", 30]]);
});

/** X0.7 on this lane: a stored cell that is not a string is left out of the record and counted, never read as text. */
test("a dataset cell that is not a string is counted rather than carried, and a repeated cursor ends the read", async () => {
  const { client, requests } = datasetControl(
    [
      { summary: summary({ recordCount: 2 }), schema, rows: [{ name: "Alpha", price: 4 }, { name: "Beta", price: "2.00", extra: "seen" }], nextCursor: "cursor.same" },
      { summary: summary({ recordCount: 2 }), schema, rows: [], nextCursor: "cursor.same" },
    ],
    { datasets: [summary({ recordCount: 2 })] },
  );
  const outcome = await executeRecordedFlowRun(client, { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab" });
  // The number cell is left out of the record entirely rather than restored as null: `null` means the page held no value, and a cell the reader could not carry is not that.
  assert.deepEqual(outcome.extracted[0]?.records, [{ name: "Alpha" }, { name: "Beta", price: "2.00", extra: "seen" }]);
  assert.equal(outcome.extractedNonStringValues, 1, "the number cell is counted, and the extra string column is carried so it can be reported as unexpected");
  assert.equal(requests.length, 2, "a cursor Core did not advance ends the read instead of looping forever");
});

/** A reader that returned fewer rows than Core stored would understate an extraction, turning a record regression into a missing one. */
test("a dataset whose rows do not add up to the count Core stored is refused", async () => {
  const { client } = datasetControl(
    [{ summary: summary(), schema, rows: [{ name: "Alpha" }], nextCursor: null }],
    { datasets: [summary()] },
  );
  await assert.rejects(
    () => executeRecordedFlowRun(client, { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab" }),
    (error: unknown) => error instanceof RunnerFailure && error.category === "runtime.behavior" && /stored 3 record\(s\) .* and returned 1/.test(error.message),
  );
});

test("a run whose detail lists no dataset reads none, and asks Core for none", async () => {
  const { client, calls } = control();
  const outcome = await executeRecordedFlowRun(client, { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab" });
  assert.deepEqual(outcome.extracted, []);
  assert.equal(outcome.extractedNonStringValues, 0);
  assert.deepEqual(calls, ["select", "start", "run", "get-flow-run-detail"]);
});

test("harness activations come from the run detail's interventions", async () => {
  const { client } = control({}, { interventions: [{ interventionId: "one" }, { interventionId: "two" }] });
  assert.equal((await executeRecordedFlowRun(client, { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab" })).harnessActivations, 2);
});

test("a run with no durable action, or a detail for another run, is refused", async () => {
  const { client: empty } = control({}, { actionAttempts: [] });
  await assert.rejects(
    () => executeRecordedFlowRun(empty, { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab" }),
    (error: unknown) => error instanceof RunnerFailure && error.category === "action.dispatch",
  );
  const { client: other } = control({}, { summary: { runId: "run.other", status: "succeeded" } });
  await assert.rejects(() => executeRecordedFlowRun(other, { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab" }), /different run/);
});

/**
 * Lab Stage 2, W19: the click failed as `auth_required` 3 of 3, but no bundle
 * file held Core's `comparisonStatus`, so no run could quote `blocked`. Core's
 * run detail carries it on the attempt itself.
 */
test("each attempt carries Core's transition comparison status when Core reports one, and only in the shape of Core's names", async () => {
  const run = { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab" };
  const { client } = control({}, {
    summary: { runId: "run.one", status: "failed" },
    actionAttempts: [attempt({ comparisonStatus: "matched" }), attempt({ attemptId: "attempt.two", nodeId: "node.two", order: 1, status: "failed", comparisonStatus: "blocked" })],
  });
  assert.deepEqual((await executeRecordedFlowRun(client, run)).actions.map(action => action.comparisonStatus), ["matched", "blocked"]);

  const { client: plain } = control();
  assert.equal(Object.hasOwn((await executeRecordedFlowRun(plain, run)).actions[0] ?? {}, "comparisonStatus"), false, "absent when Core compared nothing");
  for (const comparisonStatus of ["", "Blocked", "blocked by Demo Customer", "missing-expected-state", "a".repeat(65), 7, { status: "blocked" }]) {
    const { client: unnamed } = control({}, { actionAttempts: [attempt({ comparisonStatus })] });
    const read = await executeRecordedFlowRun(unnamed, run);
    assert.equal(Object.hasOwn(read.actions[0] ?? {}, "comparisonStatus"), false, JSON.stringify(comparisonStatus));
  }
});

/**
 * `L-replay` Defect 4: Core records how it resolved each target, the Core store
 * is deleted when the run ends, and the bundle kept none of it. Core's run
 * detail carries the record at `metadata.targetResolution`.
 */
test("Core's target resolution travels with the attempt, rebuilt from its closed fields only", async () => {
  // Core's no-candidates record applied no floor, so it carries none (Core `nodes/contracts.ts`).
  // The candidate id Core takes from a page's own `id` or `testId` attribute,
  // and the signal names, are left behind: only the status and numbers travel.
  const unresolved = { status: "unresolved_no_candidates", candidateCount: 0, candidateId: "email-address", matchedSignals: ["testId"], failedSignals: ["accessibleName"] };
  const { client } = control({}, { actionAttempts: [attempt({ metadata: { regionId: "region.one", targetResolution: unresolved } })] });
  const outcome = await executeRecordedFlowRun(client, { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab" });
  assert.deepEqual(outcome.actions[0]?.targetResolution, { status: "unresolved_no_candidates", candidateCount: 0 });
  const serialised = JSON.stringify(outcome);
  for (const left of ["email-address", "matchedSignals", "failedSignals", "accessibleName"]) assert.equal(serialised.includes(left), false, `${left} must not travel`);
  // A floor beside a no-candidates status, as Core wrote before `0e6d3ac`, is read past: that variant claims none.
  const { client: floored } = control({}, { actionAttempts: [attempt({ metadata: { targetResolution: { ...unresolved, minimumConfidence: 0.55 } } })] });
  assert.deepEqual((await executeRecordedFlowRun(floored, { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab" })).actions[0]?.targetResolution, { status: "unresolved_no_candidates", candidateCount: 0 });

  const matched = { status: "matched", candidateCount: 2, minimumConfidence: 0.55, confidence: 0.884, normalizedScore: 0.94 };
  const below = { status: "below_confidence", candidateCount: 3, minimumConfidence: 0.55, confidence: 0.41 };
  for (const scoredRecord of [matched, below]) {
    const { client: scored } = control({}, { actionAttempts: [attempt({ metadata: { targetResolution: scoredRecord } })] });
    assert.deepEqual((await executeRecordedFlowRun(scored, { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab" })).actions[0]?.targetResolution, scoredRecord);
  }
});

test("an attempt with no target resolution, or one Core does not write, carries none", async () => {
  const { client: plain } = control();
  const outcome = await executeRecordedFlowRun(plain, { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab" });
  assert.equal(Object.hasOwn(outcome.actions[0] ?? {}, "targetResolution"), false);
  const invalid = [
    { status: "guessed", candidateCount: 1, minimumConfidence: 0.5 },
    { status: "matched", minimumConfidence: 0.5 },
    { status: "matched", candidateCount: "2", minimumConfidence: 0.5 },
    // A scored record without its floor, and a no-candidates record that counted some.
    { status: "matched", candidateCount: 1, confidence: 0.9 },
    { status: "unresolved_no_candidates", candidateCount: 2 },
    ["matched"],
  ];
  for (const targetResolution of invalid) {
    const { client } = control({}, { actionAttempts: [attempt({ metadata: { targetResolution } })] });
    const read = await executeRecordedFlowRun(client, { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab" });
    assert.equal(read.actions[0]?.targetResolution, undefined, JSON.stringify(targetResolution));
  }
});

/**
 * The bench's evidence-size measure. Core captures a sanitized packet before
 * and after each web action and serves both at the run detail's
 * `metadata.stateRefs`; the packet is page content, so only its size and its
 * truncation flag may leave Core's store.
 */
const utf8Bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value), "utf8");

test("each packet Core captured around an attempt travels as its UTF-8 size and truncation flag, never as content", async () => {
  const before = { schemaVersion: "web-llm-evidence.v1", title: "Compte — démo", url: "http://127.0.0.1:4310/scenarios/account", elements: [{ selector: "#email-address", label: "Adresse électronique" }], truncated: false };
  const after = { ...before, title: "Signed in as private.person", truncated: true };
  const ref = (point: string, summary: Record<string, unknown>) => ({ stateSnapshotId: `web.state.${point}`, stateRef: `web.state.${point}@attempt.one:${point}`, capturedAt: 1_010, summary });
  const { client } = control({}, { actionAttempts: [attempt({ metadata: { stateRefs: { beforeAction: ref("before_action", before), afterAction: ref("after_action", after), stateDiff: { changedPaths: ["title"] } } } })] });
  const outcome = await executeRecordedFlowRun(client, { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab" });
  assert.deepEqual(outcome.actions[0]?.evidencePackets, [
    { point: "beforeAction", bytes: utf8Bytes(before), truncated: false },
    { point: "afterAction", bytes: utf8Bytes(after), truncated: true },
  ]);
  // Bytes, not characters: the non-ASCII title makes the two differ.
  assert.notEqual(utf8Bytes(before), JSON.stringify(before).length);
  const serialised = JSON.stringify(outcome);
  for (const content of ["démo", "127.0.0.1", "#email-address", "Adresse", "private.person", "web.state.", "stateRef", "changedPaths"]) assert.equal(serialised.includes(content), false, `${content} must not travel`);
});

test("an attempt with no packet, or a summary that is not one, carries no evidence packets", async () => {
  const { client: plain } = control();
  const outcome = await executeRecordedFlowRun(plain, { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab" });
  assert.equal(Object.hasOwn(outcome.actions[0] ?? {}, "evidencePackets"), false);
  const invalid = [
    { stateRefs: { beforeAction: { stateSnapshotId: "web.state.1" } } },
    { stateRefs: { afterAction: { summary: { title: "no truncation flag" } } } },
    { stateRefs: { beforeAction: { summary: { truncated: "false" } } } },
    { stateRefs: { beforeAction: { summary: [{ truncated: false }] } } },
    { stateRefs: [{ summary: { truncated: false } }] },
  ];
  for (const metadata of invalid) {
    const { client } = control({}, { actionAttempts: [attempt({ metadata })] });
    const read = await executeRecordedFlowRun(client, { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab" });
    assert.equal(read.actions[0]?.evidencePackets, undefined, JSON.stringify(metadata));
  }
  // A packet beside a summary that is not one: only the packet is measured.
  const { client: mixed } = control({}, { actionAttempts: [attempt({ metadata: { stateRefs: { beforeAction: { summary: { title: "t" } }, afterAction: { summary: { truncated: false } } } } })] });
  const read = await executeRecordedFlowRun(mixed, { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab" });
  assert.deepEqual(read.actions[0]?.evidencePackets, [{ point: "afterAction", bytes: utf8Bytes({ truncated: false }), truncated: false }]);
});

/**
 * `i-w15-w28-flow-order`, W28 run 2: Core started the Flow at its last scroll,
 * which succeeded with no outgoing edge, and failed the run with three nodes
 * unvisited. No attempt failed, so nothing in the run said it had stopped.
 */
test("a failed run whose every attempt succeeded, with action nodes never attempted, is recorded as a stop, by counts", async () => {
  const run = { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab" };
  const actionTypes = new Map([["recorded.click.one", "web.dom.click"], ["recorded.click.two", "web.dom.click"], ["recorded.scroll.one", "web.dom.scroll"], ["recorded.scroll.two", "web.dom.scroll"]]);
  const failedRun = { summary: { runId: "run.one", status: "failed" }, metadata: { currentNodeId: "recorded.scroll.two", terminalFailureReason: "Node recorded.scroll.two completed without an outgoing edge before the Flow visited every node." } };
  const { client } = control({}, { ...failedRun, actionAttempts: [attempt({ nodeId: "recorded.scroll.two" })] });
  const outcome = await executeRecordedFlowRun(client, { ...run, actionTypes });
  assert.deepEqual(outcome.stoppedWithoutFailedAttempt, { attemptedActions: 1, unvisitedActions: 3 });
  assert.equal(outcome.failure, null);
  for (const left of ["recorded.scroll.two", "outgoing edge"]) assert.equal(JSON.stringify(outcome).includes(left), false, `${left} must not travel`);
  const { client: retried } = control({}, { ...failedRun, actionAttempts: [attempt({ nodeId: "recorded.click.one" }), attempt({ attemptId: "attempt.two", nodeId: "recorded.click.one", order: 1 })] });
  assert.deepEqual((await executeRecordedFlowRun(retried, { ...run, actionTypes })).stoppedWithoutFailedAttempt, { attemptedActions: 1, unvisitedActions: 3 }, "a node attempted twice is one action");

  const notAStop: Array<[string, Record<string, unknown>, ReadonlyMap<string, string> | undefined]> = [
    ["an attempt that failed", { ...failedRun, actionAttempts: [attempt({ nodeId: "recorded.click.one", status: "failed", failure: { category: "target_not_found", code: "web.target.not_found", retryable: true } })] }, actionTypes],
    ["an attempt that timed out", { ...failedRun, actionAttempts: [attempt({ nodeId: "recorded.click.one", status: "timed_out" })] }, actionTypes],
    ["an attempt that was cancelled", { ...failedRun, actionAttempts: [attempt({ nodeId: "recorded.click.one", status: "cancelled" })] }, actionTypes],
    ["every action node attempted", { ...failedRun, actionAttempts: [...actionTypes.keys()].map((nodeId, order) => attempt({ attemptId: `attempt.${order}`, nodeId, order })) }, actionTypes],
    ["a run Core did not fail", { actionAttempts: [attempt({ nodeId: "recorded.scroll.two" })] }, actionTypes],
    ["no action map", { ...failedRun, actionAttempts: [attempt({ nodeId: "recorded.scroll.two" })] }, undefined],
  ];
  for (const [shape, detail, types] of notAStop) {
    const { client: other } = control({}, detail);
    const read = await executeRecordedFlowRun(other, { ...run, ...(types ? { actionTypes: types } : {}) });
    assert.equal(Object.hasOwn(read, "stoppedWithoutFailedAttempt"), false, shape);
  }
});

/**
 * `g-runner-start-guard`: where a run started is the recording position of its
 * first attempt, in Core's `order`, on a node the candidate order names. An
 * attempt on another node, or one that names no node, is passed over, a retried
 * start is still the start, and the position travels without the node's id.
 */
test("the run's start is the recording position of its first attempt on a recorded node, and is absent without an order or such an attempt", async () => {
  const run = { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab" };
  const candidateOrder = new Map([["recorded.click.one", 0], ["recorded.close", 2]]);
  // Listed out of order on purpose: Core's `order` decides.
  const attempts = [
    attempt({ attemptId: "attempt.close", nodeId: "recorded.close", order: 2 }),
    attempt({ attemptId: "attempt.control", nodeId: "builtin.start", order: 0 }),
    attempt({ attemptId: "attempt.close.retry", nodeId: "recorded.close", order: 3 }),
    attempt({ attemptId: "attempt.click", nodeId: "recorded.click.one", order: 4 }),
    attempt({ attemptId: "attempt.unnamed", nodeId: undefined, order: 1 }),
  ];
  const { client } = control({}, { actionAttempts: attempts });
  const outcome = await executeRecordedFlowRun(client, { ...run, candidateOrder });
  assert.equal(outcome.startCandidateIndex, 2);
  assert.equal(JSON.stringify(outcome).includes("recorded.close"), false, "a position, never a node id");
  const { client: first } = control({}, { actionAttempts: [attempt({ nodeId: "recorded.click.one" })] });
  assert.equal((await executeRecordedFlowRun(first, { ...run, candidateOrder })).startCandidateIndex, 0, "position 0 is a start, not an absence");
  const { client: unordered } = control({}, { actionAttempts: attempts });
  assert.equal(Object.hasOwn(await executeRecordedFlowRun(unordered, run), "startCandidateIndex"), false, "no order");
  const { client: controlOnly } = control({}, { actionAttempts: [attempt({ nodeId: "builtin.start" })] });
  assert.equal(Object.hasOwn(await executeRecordedFlowRun(controlOnly, { ...run, candidateOrder }), "startCandidateIndex"), false, "no attempt on a recorded node");
});
