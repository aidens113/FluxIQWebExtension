import assert from "node:assert/strict";
import test from "node:test";
import { liveLlmExplorationRecord, readLiveLlmExploration } from "../exploration-record.js";

/**
 * The exploration record is the only thing in a Lab bundle that says what a
 * repair run actually looked at. These pin the two properties that make it
 * worth having: it never reads as "explored nothing" when Core published
 * nothing, and it never carries a sentence Core wrote.
 */

function trace(stages: unknown): unknown {
  return { runDetail: { metadata: { recoveryTrace: { schemaVersion: "automation-studio.recovery-trace.v1", stages, refused: [] } } } };
}

const EXPLORED = {
  stage: "exploration",
  status: "completed",
  providerCalled: true,
  reason: "The exploration found the control behind the disclosure.",
  detail: {
    requested: true, outcome: "evidence_gathered", endedBy: "evidence_gathered",
    actions: 5, observedActions: 4, refusedActions: 1, unusableDecisions: 0,
    providerCalls: 6, evidenceBytes: 12_288, durationMs: 14_000,
  },
};

test("an exploration Core recorded is read as its counts, its outcome and the code that ended it", async () => {
  const record = await readLiveLlmExploration(
    { automationStudioCall: async (endpoint, payload) => { assert.equal(endpoint, "get-flow-run-detail"); assert.equal(payload.runId, "run-1"); return trace([EXPLORED]); } },
    { projectId: "project-1", runId: "run-1" },
  );
  assert.equal(record.source, "recovery-trace");
  assert.equal(record.status, "completed");
  assert.equal(record.providerCalled, true);
  assert.equal(record.requested, true);
  assert.equal(record.outcome, "evidence_gathered");
  assert.equal(record.endedBy, "evidence_gathered");
  assert.deepEqual(record.counts, { actions: 5, observedActions: 4, refusedActions: 1, unusableDecisions: 0, providerCalls: 6, evidenceBytes: 12_288, durationMs: 14_000 });
  assert.equal(JSON.stringify(record).includes("control behind the disclosure"), false, "the record carries Core's own sentence");
});

test("a limit that ended an exploration is named, and so is the guard that ended a repeating one", () => {
  const stopped = liveLlmExplorationRecord({ recoveryTrace: { stages: [{ ...EXPLORED, status: "failed", detail: { ...EXPLORED.detail, outcome: "budget_exhausted", endedBy: "llm_run_budget.tokens", stopReason: "token_budget" } }] } });
  assert.equal(stopped.outcome, "budget_exhausted");
  assert.equal(stopped.endedBy, "llm_run_budget.tokens");
  assert.equal(stopped.stopReason, "token_budget");
  const repeating = liveLlmExplorationRecord({ recoveryTrace: { stages: [{ ...EXPLORED, status: "failed", detail: { ...EXPLORED.detail, outcome: "no_progress", endedBy: "llm_evidence_loop.repeat_without_progress", noProgressReason: "repeated_request" } }] } });
  assert.equal(repeating.outcome, "no_progress");
  assert.equal(repeating.noProgressReason, "repeated_request");
});

test("a run with no exploration is absent, never an exploration that did nothing", () => {
  for (const metadata of [undefined, {}, { recoveryTrace: { stages: [] } }, { recoveryTrace: { stages: [{ stage: "diagnosis", status: "completed", providerCalled: true }] } }]) {
    const record = liveLlmExplorationRecord(metadata);
    assert.equal(record.source, "absent", JSON.stringify(metadata));
    assert.equal(record.counts.actions, null);
    assert.equal(record.counts.providerCalls, null);
    assert.equal(record.outcome, null);
  }
  // A skipped stage is still a stage Core published, and says the plan asked for nothing.
  const skipped = liveLlmExplorationRecord({ recoveryTrace: { stages: [{ stage: "exploration", status: "skipped", providerCalled: false, detail: { requested: false } }] } });
  assert.equal(skipped.source, "recovery-trace");
  assert.equal(skipped.status, "skipped");
  assert.equal(skipped.requested, false);
  assert.equal(skipped.counts.actions, null);
});

test("a trace that cannot be read, or a read that fails, says so rather than reading as absent", async () => {
  assert.equal(liveLlmExplorationRecord({ recoveryTrace: { stages: "not a list" } }).source, "unreadable");
  const unreadable = await readLiveLlmExploration({ automationStudioCall: async () => { throw new Error("run detail unavailable"); } }, { projectId: "project-1", runId: "run-1" });
  assert.equal(unreadable.source, "unreadable");
  assert.equal(unreadable.counts.durationMs, null);
});

test("anything that is not a code, a flag or a count is dropped rather than recorded", () => {
  const record = liveLlmExplorationRecord({
    recoveryTrace: {
      stages: [{
        stage: "exploration", status: "Completed With Spaces", providerCalled: "yes",
        detail: { requested: 1, outcome: "the model looked at the page", endedBy: "", actions: -1, observedActions: 1.5, providerCalls: "6", evidenceBytes: 10, durationMs: 20 },
      }],
    },
  });
  assert.equal(record.status, null, "a status with spaces is prose, not a code");
  assert.equal(record.providerCalled, null);
  assert.equal(record.requested, null);
  assert.equal(record.outcome, null, "an outcome with spaces is prose, not a code");
  assert.equal(record.endedBy, null);
  assert.deepEqual(record.counts, { actions: null, observedActions: null, refusedActions: null, unusableDecisions: null, providerCalls: null, evidenceBytes: 10, durationMs: 20 });
});

test("tool ids and result codes are recorded when Core publishes them, and said to be absent when it does not", () => {
  const today = liveLlmExplorationRecord({ recoveryTrace: { stages: [EXPLORED] } });
  assert.deepEqual(today.toolIds, []);
  assert.deepEqual(today.resultCodes, []);
  assert.equal(today.toolDetail, "not-published", "Core does not publish the exploration's per-step trace on a run detail");
  // The read is already here, so the day Core publishes them the bundle records them.
  const published = liveLlmExplorationRecord({
    recoveryTrace: {
      stages: [{ ...EXPLORED, detail: { ...EXPLORED.detail, toolIds: ["web.dom.read_structure", "web.browser.navigate", "web.dom.read_structure", "a tool with spaces"], resultCodes: ["ok", "llm_evidence_tool.refused"] } }],
    },
  });
  assert.deepEqual(published.toolIds, ["web.browser.navigate", "web.dom.read_structure"], "deduplicated, sorted, and prose dropped");
  assert.deepEqual(published.resultCodes, ["llm_evidence_tool.refused", "ok"]);
  assert.equal(published.toolDetail, "recorded");
});
