// The closed code a failed run's terminal reason is reported as. Core writes
// one of four fixed sentences or the run trace's own message
// (`summaries/conversions.ts`, `runtimeTerminalFailureReason`); only the code
// ever leaves the journey.

import assert from "node:assert/strict";
import test from "node:test";
import { classifyTerminalFailureReason } from "../failure-log.js";

test("each of Core's fixed terminal sentences has its own code", () => {
  assert.equal(classifyTerminalFailureReason("Recovery ladder exhausted all known recovery candidates."), "terminal.recovery_exhausted");
  assert.equal(classifyTerminalFailureReason("Recovery ladder stopped at LLM diagnosis fallback because no deterministic recovery resolved the failure."), "terminal.recovery_diagnosis_only");
  assert.equal(classifyTerminalFailureReason("Run failed before recovery lookup produced a candidate."), "terminal.no_recovery_candidate");
  assert.equal(classifyTerminalFailureReason("Run failed after recovery was selected."), "terminal.recovery_selected_failed");
  assert.equal(classifyTerminalFailureReason("  Recovery ladder exhausted all known recovery candidates.  "), "terminal.recovery_exhausted");
});

test("any other reason is the trace's message, and none is absent -- the text itself is never the code", () => {
  const trace = "Could not find the element labelled Account number 4411";
  assert.equal(classifyTerminalFailureReason(trace), "terminal.trace_message");
  assert.equal(classifyTerminalFailureReason(undefined), "terminal.absent");
  assert.equal(classifyTerminalFailureReason("   "), "terminal.absent");
});
