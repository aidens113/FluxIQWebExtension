// What a run's re-author spent, from Core's record of the run.

import assert from "node:assert/strict";
import test from "node:test";
import { readLiveLlmReauthor } from "../reauthor-record.js";

const scope = { projectId: "project-1", runId: "run-1" };

test("a run with no re-author record reads as absent, and an unreadable detail says so", async () => {
  const absent = await readLiveLlmReauthor({ automationStudioCall: async () => ({ runDetail: { metadata: {} } }) }, scope);
  assert.deepEqual(absent, { source: "absent", attempts: [], calls: 0, uncountedAttempts: 0, totalEstimatedCostUsd: 0 });
  const unreadable = await readLiveLlmReauthor({ automationStudioCall: async () => { throw new Error("gone"); } }, scope);
  assert.equal(unreadable.source, "unreadable");
  assert.equal(unreadable.totalEstimatedCostUsd, 0);
});

test("an attempt with no adaptation and no loop is costed but uncounted, and nothing but counts and ids is kept", async () => {
  const record = await readLiveLlmReauthor({
    automationStudioCall: async (endpoint) => {
      assert.equal(endpoint, "get-flow-run-detail", "no adaptation to read, so none is read");
      return { runDetail: { summary: { flowId: "flow-1" }, metadata: { resultReauthor: { attempts: [{ attempt: 1, routed: true, code: "flow_bootstrap.provider_timeout", reason: "The page said: private text", accounting: { estimatedCostUsd: 0.01, inputTokens: 5_000, outputTokens: 100 } }] } } } };
    },
  }, scope);
  assert.deepEqual(record, {
    source: "run-detail",
    attempts: [{ attempt: 1, try: null, adaptationId: null, calls: null, callsFrom: "not_recorded", inputTokens: 5_000, outputTokens: 100, estimatedCostUsd: 0.01, ending: null }],
    calls: 0,
    uncountedAttempts: 1,
    totalEstimatedCostUsd: 0.01,
  });
  assert.equal(JSON.stringify(record).includes("private text"), false);
});

// Shapes from run-musp39u8-9ac026ab's decision trace: two failed re-author
// builds, each with its loop's decisions and a closed ending but no
// `totalProviderCallCount`.
test("a failed build is counted from its loop's decisions and keeps its closed ending, never its message", async () => {
  const builds = [
    { attempt: 1, routed: true, code: "flow_bootstrap.evidence_budget_exhausted", accounting: { inputTokens: 730_779, outputTokens: 3_080, estimatedCostUsd: 0.049579026 }, evidenceLoop: { iterationCount: 37, decisionCount: 37, toolCallCount: 18, steps: [] }, ending: { kind: "budget_exhausted", bound: "rounds", message: "Could not finish the private list", notDone: [{ id: "a1", quote: "private quote", todo: "x" }], tried: { rounds: 6, decisions: 37, stepsInFlow: 7, tested: "not_tested" } } },
    { attempt: 2, routed: true, code: "flow_bootstrap.evidence_budget_exhausted", accounting: { inputTokens: 634_212, outputTokens: 2_981, estimatedCostUsd: 0.043878096 }, evidenceLoop: { iterationCount: 32, decisionCount: 32, toolCallCount: 17, steps: [] }, ending: { kind: "budget_exhausted", bound: "cost", tried: { rounds: 5, decisions: 32, stepsInFlow: 7, tested: "not_tested", stops: [{ round: 1, stopped: "budget" }, { round: 2, stopped: "made up" }] } } },
  ];
  const record = await readLiveLlmReauthor({ automationStudioCall: async () => ({ runDetail: { summary: { flowId: "flow-1" }, metadata: { resultReauthor: { attempts: builds } } } }) }, scope);
  assert.deepEqual(record.attempts.map((item) => [item.attempt, item.calls, item.callsFrom, item.estimatedCostUsd]), [
    [1, 37, "loop_decisions", 0.049579026],
    [2, 32, "loop_decisions", 0.043878096],
  ]);
  assert.deepEqual(record.attempts[0]?.ending, { kind: "budget_exhausted", bound: "rounds", tried: { rounds: 6, decisions: 37, stepsInFlow: 7, tested: "not_tested" } });
  // A stop outside Core's closed words is dropped rather than published.
  assert.deepEqual(record.attempts[1]?.ending, { kind: "budget_exhausted", bound: "cost", tried: { rounds: 5, decisions: 32, stepsInFlow: 7, tested: "not_tested", stops: [{ round: 1, stopped: "budget" }] } });
  assert.equal(record.calls, 69);
  assert.equal(record.uncountedAttempts, 0);
  assert.equal(JSON.stringify(record).includes("private"), false);
});

test("an ending keeps only the words Core allows on its kind, and an unknown kind publishes none", async () => {
  const attempts = [
    { attempt: 1, ending: { kind: "gave up because of private text", tried: { rounds: 1, decisions: 1, stepsInFlow: 0, tested: "not_tested" } } },
    { attempt: 2 },
    // `bound` belongs to `budget_exhausted` alone, and `noRoute` to `not_doable` and `not_finished` (Core's `build-ending.ts`).
    { attempt: 3, ending: { kind: "provider_unavailable", bound: "cost", tried: { rounds: 1, decisions: 4, stepsInFlow: 0, tested: "not_tested", noRoute: { kind: "no_progress" } } } },
    { attempt: 4, ending: { kind: "not_finished", tried: { rounds: 2, decisions: 9, stepsInFlow: 3, tested: "replay_failed", noRoute: { kind: "judged_unachievable" } } } },
    { attempt: 5, ending: { kind: "not_doable", tried: { rounds: 2, decisions: 9, stepsInFlow: 3, tested: "replay_failed", noRoute: { kind: "judged_unachievable" } } } },
  ];
  const record = await readLiveLlmReauthor({ automationStudioCall: async () => ({ runDetail: { metadata: { resultReauthor: { attempts } } } }) }, scope);
  assert.deepEqual(record.attempts.map((item) => item.ending), [
    null,
    null,
    { kind: "provider_unavailable", tried: { rounds: 1, decisions: 4, stepsInFlow: 0, tested: "not_tested" } },
    { kind: "not_finished", tried: { rounds: 2, decisions: 9, stepsInFlow: 3, tested: "replay_failed" } },
    { kind: "not_doable", tried: { rounds: 2, decisions: 9, stepsInFlow: 3, tested: "replay_failed", noRoute: { kind: "judged_unachievable" } } },
  ]);
  assert.equal(JSON.stringify(record).includes("private"), false);
});

// Core writes no `try` (t262): a build that failed on a named transient
// provider request is built again once on the same brief, and both builds are
// consecutive entries with the same `attempt` and the same brief record
// (`reauthor-build.ts`, `reauthor.ts`).
const refutedBrief = { instructionId: "core.result_repair.brief", chars: 812, findingCodes: ["result.missing_rows"], fixLines: 2, advised: false, earlierAttempts: 0 };
const stepBrief = { instructionId: "core.step_failure_repair.brief", chars: 640, nodeId: "node-3" };
const timedOut = { routed: true, code: "flow_bootstrap.provider_timeout", stage: "provider_request", retryable: true, providerInvocation: "attempted", providerResponse: "not_received" };

test("a refuted-result rebuild after a provider timeout is try 2 of the same attempt, and the next attempt starts at try 1", async () => {
  const attempts = [
    { attempt: 1, ...timedOut, brief: refutedBrief },
    { attempt: 1, routed: true, adaptationId: "adaptation-1", applied: true, brief: refutedBrief },
    { attempt: 2, ...timedOut, brief: { ...refutedBrief, earlierAttempts: 1 } },
    // The same brief record with its fields in another order: it is compared by value, not by key order.
    { attempt: 2, routed: true, code: "flow_bootstrap.not_doable", stage: "provider_output_validation", retryable: false, brief: { earlierAttempts: 1, advised: false, fixLines: 2, findingCodes: ["result.missing_rows"], chars: 812, instructionId: "core.result_repair.brief" } },
  ];
  const record = await readLiveLlmReauthor({ automationStudioCall: async () => ({ runDetail: { metadata: { resultReauthor: { attempts } } } }) }, scope);
  assert.deepEqual(record.attempts.map((item) => [item.attempt, item.try]), [[1, 1], [1, 2], [2, 1], [2, 2]]);
});

test("on the failed-step route, which records no attempt, a rebuild is told from a later re-author by the failure before it", async () => {
  const attempts = [
    { ...timedOut, brief: stepBrief },
    { routed: true, code: "flow_bootstrap.evidence_budget_exhausted", stage: "provider_output_validation", retryable: true, brief: stepBrief },
    // The same constant brief id again, after a build that was not a transient request failure: a new re-author, not a rebuild.
    { ...timedOut, brief: stepBrief },
    // A rebuild is never rebuilt: there is no try 3.
    { ...timedOut, brief: stepBrief },
    { ...timedOut, brief: stepBrief },
    // An entry with no brief is not a build on one.
    { routed: false, code: "reauthor.refused" },
  ];
  const record = await readLiveLlmReauthor({ automationStudioCall: async () => ({ runDetail: { metadata: { resultReauthor: { attempts } } } }) }, scope);
  assert.deepEqual(record.attempts.map((item) => [item.attempt, item.try]), [[null, 1], [null, 2], [null, 1], [null, 2], [null, 1], [null, null]]);
});

test("a build after a different brief, a different attempt or a failure Core does not rebuild is a first try", async () => {
  const attempts = [
    { attempt: 1, ...timedOut, brief: refutedBrief },
    { attempt: 1, ...timedOut, brief: { ...refutedBrief, chars: 900 } },
    { attempt: 2, ...timedOut, brief: { ...refutedBrief, chars: 900 } },
    { attempt: 3, routed: true, code: "flow_bootstrap.provider_http_error", stage: "provider_request", retryable: false, brief: { ...refutedBrief, chars: 900 } },
    // Same brief and attempt, after a failure that was not retryable: Core did not rebuild it.
    { attempt: 3, ...timedOut, brief: { ...refutedBrief, chars: 900 } },
  ];
  const record = await readLiveLlmReauthor({ automationStudioCall: async () => ({ runDetail: { metadata: { resultReauthor: { attempts } } } }) }, scope);
  assert.deepEqual(record.attempts.map((item) => item.try), [1, 1, 1, 1, 1]);
});
