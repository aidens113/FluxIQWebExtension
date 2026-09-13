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
    { runPersistedFlow: async () => { throw new RunnerFailure("runtime.behavior", "Flow finished with status failed"); } },
    { summary: { runId: "run.one", status: "failed" }, actionAttempts: [attempt({ status: "failed", failure })] },
  );
  const outcome = await executeRecordedFlowRun(client, { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab" });
  assert.equal(outcome.status, "failed");
  assert.deepEqual(outcome.failure, failure);
  assert.equal(outcome.actions[0]?.status, "failed");
});

test("a failure record Core's own parser rejects is treated as absent, never half-read", async () => {
  // Core forbids this category from being retryable, so the record is dropped whole.
  const { client } = control({}, { summary: { runId: "run.one", status: "failed" }, actionAttempts: [attempt({ status: "failed", failure: { category: "blocked_by_capability_or_policy", retryable: true } })] });
  const outcome = await executeRecordedFlowRun(client, { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab" });
  assert.equal(outcome.failure, null);
});

test("harness activations and extracted records come from Core's run detail", async () => {
  const { client } = control({}, {
    interventions: [{ interventionId: "one" }, { interventionId: "two" }],
    actionAttempts: [attempt({ definitionId: "web.dom.extract_list", metadata: { result: { extracted: [{ name: "Alpha" }, { name: "Beta" }] } } })],
  });
  const outcome = await executeRecordedFlowRun(client, { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab" });
  assert.equal(outcome.harnessActivations, 2);
  assert.deepEqual(outcome.extracted, [[{ name: "Alpha" }, { name: "Beta" }]]);
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
 * `L-replay` Defect 4: Core records how it resolved each target, the Core store
 * is deleted when the run ends, and the bundle kept none of it. Core's run
 * detail carries the record at `metadata.targetResolution`.
 */
test("Core's target resolution travels with the attempt, rebuilt from its closed fields only", async () => {
  // The candidate id Core takes from a page's own `id` or `testId` attribute,
  // and the signal names, are left behind: only the status and numbers travel.
  const unresolved = { status: "unresolved_no_candidates", candidateCount: 0, minimumConfidence: 0.55, candidateId: "email-address", matchedSignals: ["testId"], failedSignals: ["accessibleName"] };
  const { client } = control({}, { actionAttempts: [attempt({ metadata: { regionId: "region.one", targetResolution: unresolved } })] });
  const outcome = await executeRecordedFlowRun(client, { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab" });
  assert.deepEqual(outcome.actions[0]?.targetResolution, { status: "unresolved_no_candidates", candidateCount: 0, minimumConfidence: 0.55 });
  const serialised = JSON.stringify(outcome);
  for (const left of ["email-address", "matchedSignals", "failedSignals", "accessibleName"]) assert.equal(serialised.includes(left), false, `${left} must not travel`);

  const matched = { status: "matched", candidateCount: 2, minimumConfidence: 0.55, confidence: 0.884, normalizedScore: 0.94 };
  const { client: scored } = control({}, { actionAttempts: [attempt({ metadata: { targetResolution: matched } })] });
  assert.deepEqual((await executeRecordedFlowRun(scored, { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab" })).actions[0]?.targetResolution, matched);
});

test("an attempt with no target resolution, or one Core does not write, carries none", async () => {
  const { client: plain } = control();
  const outcome = await executeRecordedFlowRun(plain, { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab" });
  assert.equal(Object.hasOwn(outcome.actions[0] ?? {}, "targetResolution"), false);
  const invalid = [
    { status: "guessed", candidateCount: 1, minimumConfidence: 0.5 },
    { status: "matched", minimumConfidence: 0.5 },
    { status: "matched", candidateCount: "2", minimumConfidence: 0.5 },
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
