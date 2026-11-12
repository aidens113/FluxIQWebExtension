import assert from "node:assert/strict";
import test from "node:test";
import type { ScriptedModelCall } from "../../attempt-lane/scripted-model/index.js";
import { hostProofAttemptFailure } from "../attempt-failure.js";

const refused: ScriptedModelCall = { at: 0, kind: "evidence_tool_decision", ordinal: 25, answered: false, correlationId: "run-a", refused: "No reply" };
const calls: readonly ScriptedModelCall[] = [refused, { at: 0, kind: "evidence_tool_decision", ordinal: 13, answered: true, correlationId: "run-b" }];

test("the refusing attempt names its own request and ordinal", () => {
  const failure = hostProofAttemptFailure({ name: "proof.a", ordinal: 1, status: "stopped", runId: "run-a", calls, diagnosticFailure: refused });
  assert.equal(failure.code, "script_refusal");
  assert.match(failure.message, /its own evidence_tool_decision request 25 was refused/u);
});

test("another attempt stopped by the shared diagnostic names the originating run", () => {
  const failure = hostProofAttemptFailure({ name: "proof.b", ordinal: 1, status: "stopped", runId: "run-b", calls, diagnosticFailure: refused });
  assert.equal(failure.code, "diagnostic_cancelled");
  assert.match(failure.message, /diagnostic was cancelled by run-a's evidence_tool_decision request 25/u);
  assert.doesNotMatch(failure.message, /its own.*refused/u);
});

test("an unrelated refused request does not explain an uncancelled attempt", () => {
  const failure = hostProofAttemptFailure({ name: "proof.b", ordinal: 1, status: "failed", runId: "run-b", calls });
  assert.equal(failure.code, "unexpected_result");
  assert.doesNotMatch(failure.message, /refused|cancelled/u);
});
