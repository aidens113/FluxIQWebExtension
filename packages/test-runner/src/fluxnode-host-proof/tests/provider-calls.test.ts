import assert from "node:assert/strict";
import test from "node:test";
import type { ScriptedModelCall } from "../../attempt-lane/scripted-model/index.js";
import { hostProofProviderCalls } from "../provider-calls.js";

test("parallel run counts reconcile every request including unknown and unattributed calls", () => {
  const call = (correlationId?: string): ScriptedModelCall => ({ at: 0, kind: "decision", ordinal: 1, answered: true, ...(correlationId === undefined ? {} : { correlationId }) });
  const calls = [call("a"), call("b"), call("b"), call(), call("unknown")];
  const report = hostProofProviderCalls(calls, ["a", "b"]);
  assert.deepEqual(report, { total: 5, byRun: { a: 1, b: 2 }, unattributed: 1, unknown: 1, distinctRuns: true });
  assert.equal(Object.values(report.byRun).reduce((sum, count) => sum + count, 0) + report.unattributed + report.unknown, report.total);
});

test("returning the same held run cannot count as separate deterministic attempts", () => {
  const report = hostProofProviderCalls([{ at: 0, kind: "decision", ordinal: 1, answered: true, correlationId: "a" }], ["a", "a"]);
  assert.equal(report.distinctRuns, false);
  assert.deepEqual(report.byRun, { a: 1 });
});
