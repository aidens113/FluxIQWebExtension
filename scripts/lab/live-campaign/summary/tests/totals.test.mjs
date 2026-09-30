import assert from "node:assert/strict";
import test from "node:test";
import { totalsOf } from "../index.mjs";

const row = (verdict, fields = {}) => ({ verdict, succeeded: verdict === "passed", judgement: { passed: null }, buildOutcome: null, providerCalls: null, reportedTokens: null, reportedCostUsd: null, ...fields });

test("a permission stop has its own count, in neither passed nor failed", () => {
  const totals = totalsOf([
    row("passed"), row("failed"), row("inconclusive"), row("no-result"),
    row("stopped_for_permission", { buildOutcome: "permission_required" }), row("stopped_for_permission"),
  ]);
  assert.deepEqual([totals.tasks, totals.passed, totals.succeeded, totals.failed, totals.stoppedForPermission, totals.noResult], [6, 1, 1, 2, 2, 1]);
  assert.equal(totals.passed + totals.failed + totals.stoppedForPermission + totals.noResult, totals.tasks, "every row lands in exactly one verdict count");
  assert.equal(totalsOf([]).stoppedForPermission, 0);
});
