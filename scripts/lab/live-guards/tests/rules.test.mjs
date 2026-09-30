// Each live-run rule refuses what it exists to refuse and admits the rest,
// and the override files let a run past only the rules that allow it.

import assert from "node:assert/strict";
import test from "node:test";
import { checkBalanceStop, checkPreviousDebug, checkRelaunchLoop, checkSpendBudget, checkUnchangedRerun, evaluateLiveGuards, guardFiles } from "../index.mjs";

const NOW = new Date(2026, 8, 30, 12, 0, 0).getTime();
const at = (msAgo) => new Date(NOW - msAgo).toISOString();
const MINUTE = 60_000;

function state(overrides = {}) {
  return {
    now: NOW,
    launch: { instance: "slot-1", task: "bigbox-retail/bigbox-retail-pickup-cart" },
    budget: { ok: true, maxUsd: 1, window: "day" },
    stopBalance: null,
    entries: [],
    fingerprint: "sha256:current",
    hasDebug: () => true,
    debugPath: (runId) => `debugs/${runId}.md`,
    files: guardFiles("/slots"),
    ...overrides,
  };
}

const finish = (fields) => ({ event: "finish", launchId: "launch-x", at: at(60 * MINUTE), instance: "slot-1", task: "bigbox-retail/bigbox-retail-pickup-cart", runId: "run-a", verdict: "failed", totalEstimatedCostUsd: 0.1, balanceFailure: null, fingerprint: "sha256:current", exitCode: 1, ...fields });
const start = (msAgo, instance = "slot-1") => ({ event: "start", launchId: `launch-${msAgo}`, at: at(msAgo), pid: 1, instance, scenarioId: "bigbox-retail", task: "t", fingerprint: "f", repositoryRoot: "/r", runsDirectory: "/runs", overridden: [] });

test("budget: no budget file refuses every live run, and the override file cannot lift it", () => {
  const refusal = checkSpendBudget(state({ budget: { ok: false, reason: "no live spend budget is set: /slots/spend-budget.json does not exist" } }));
  assert.equal(refusal.rule, "budget");
  assert.equal(refusal.overridable, false);
  assert.match(refusal.why, /no live spend budget is set/u);
  assert.match(refusal.remedy, /spend-budget\.json/u);
  const evaluated = evaluateLiveGuards(state({ budget: { ok: false, reason: "no live spend budget is set" } }), new Set(["budget"]));
  assert.deepEqual(evaluated.refusals.map((each) => each.rule), ["budget"]);
});

test("budget: refuses once today's spend has reached maxUsd, admits below it, and ignores yesterday", () => {
  const yesterday = new Date(2026, 8, 29, 23, 59).toISOString();
  const below = [finish({ runId: "run-1", totalEstimatedCostUsd: 0.6 }), finish({ runId: "run-2", totalEstimatedCostUsd: 0.39, at: at(MINUTE) }), finish({ runId: "run-0", totalEstimatedCostUsd: 5, at: yesterday })];
  assert.equal(checkSpendBudget(state({ entries: below })), null);
  const reached = [...below, finish({ runId: "run-3", totalEstimatedCostUsd: 0.01 })];
  const refusal = checkSpendBudget(state({ entries: reached }));
  assert.equal(refusal.rule, "budget");
  assert.equal(refusal.overridable, true);
  assert.match(refusal.why, /\$1\.0000 over 3 run\(s\)/u);
  assert.deepEqual(evaluateLiveGuards(state({ entries: reached, fingerprint: "sha256:changed" }), new Set(["budget"])), { refusals: [], overridden: ["budget"] });
});

test("balance: a STOP-balance file refuses every run, whatever override files exist", () => {
  assert.equal(checkBalanceStop(state()), null);
  const stopped = state({ stopBalance: "Run run-a ended on an empty balance at deepseek: Insufficient Balance.\nmore" });
  const refusal = checkBalanceStop(stopped);
  assert.equal(refusal.rule, "balance");
  assert.match(refusal.why, /Insufficient Balance\.$/u);
  assert.match(refusal.remedy, /STOP-balance by hand/u);
  assert.deepEqual(evaluateLiveGuards(stopped, new Set(["balance", "budget", "loop", "debug", "unchanged"])).refusals.map((each) => each.rule), ["balance"]);
});

test("unchanged: a failed task is not rerun on the same source, but is after a change, after a pass, or for another task", () => {
  const failed = [finish({})];
  const refusal = checkUnchangedRerun(state({ entries: failed }));
  assert.equal(refusal.rule, "unchanged");
  assert.match(refusal.why, /run-a, which ended failed/u);
  assert.equal(checkUnchangedRerun(state({ entries: failed, fingerprint: "sha256:changed" })), null);
  assert.equal(checkUnchangedRerun(state({ entries: [finish({ verdict: "passed" })] })), null);
  assert.equal(checkUnchangedRerun(state({ entries: [finish({ task: "other/task" })] })), null);
  assert.equal(checkUnchangedRerun(state({ entries: [finish({ instance: "slot-2" })] })), null);
  // Only the latest run of the task counts: a later pass clears an earlier failure.
  assert.equal(checkUnchangedRerun(state({ entries: [finish({ runId: "run-old" }), finish({ runId: "run-new", verdict: "passed", at: at(MINUTE) })] })), null);
  assert.deepEqual(evaluateLiveGuards(state({ entries: failed }), new Set(["unchanged"])).overridden, ["unchanged"]);
});

test("debug: the next live run waits for the previous run's debug file, in any task", () => {
  const entries = [finish({ runId: "run-undebugged", task: "other/task", verdict: "passed" })];
  const refusal = checkPreviousDebug(state({ entries, hasDebug: (runId) => runId !== "run-undebugged" }));
  assert.equal(refusal.rule, "debug");
  assert.match(refusal.why, /run-undebugged, has no debug file at debugs\/run-undebugged\.md/u);
  assert.equal(checkPreviousDebug(state({ entries, hasDebug: () => true })), null);
  // A launch that produced no run has nothing to debug.
  assert.equal(checkPreviousDebug(state({ entries: [finish({ runId: null })], hasDebug: () => false })), null);
  assert.equal(checkPreviousDebug(state({ entries: [finish({ instance: "slot-2" })], hasDebug: () => false })), null);
});

test("loop: a fourth start within 30 minutes on one instance is refused; older starts and other instances do not count", () => {
  const two = [start(5 * MINUTE), start(10 * MINUTE)];
  assert.equal(checkRelaunchLoop(state({ entries: two })), null);
  const three = [...two, start(29 * MINUTE)];
  const refusal = checkRelaunchLoop(state({ entries: three }));
  assert.equal(refusal.rule, "loop");
  assert.match(refusal.why, /already started 3 live runs/u);
  assert.match(refusal.remedy, new RegExp(new Date(NOW + MINUTE).toISOString().replace(/[.]/gu, "\\.")));
  assert.equal(checkRelaunchLoop(state({ entries: [...two, start(31 * MINUTE)] })), null);
  assert.equal(checkRelaunchLoop(state({ entries: [...two, start(1 * MINUTE, "slot-2")] })), null);
});

test("evaluation reports every refusing rule, in order, so one refusal names them all", () => {
  const evaluated = evaluateLiveGuards(state({ stopBalance: "stopped", entries: [finish({}), start(1 * MINUTE), start(2 * MINUTE), start(3 * MINUTE)], hasDebug: () => false }), new Set());
  assert.deepEqual(evaluated.refusals.map((each) => each.rule), ["balance", "loop", "debug", "unchanged"]);
});
