import assert from "node:assert/strict";
import test from "node:test";
// A namespace import, so a member this build does not export fails its own tests rather than the whole file.
import * as contracts from "../dist/index.js";

const { validateRunHarnessRecovery } = contracts;

// `refusalCode` is why a failed run's recovery never started: Core's gate code,
// carried so "recovery was not allowed to start" and "recovery was not needed"
// stop reading as the same `attempted: false`. It is a code, like every other
// string in the record, so Core's sentence for the refusal cannot ride along.
const none = { attempted: false, interventions: [], runtimePatchAttempts: [], adaptationIds: [], changeProposalIds: [] };
const tried = { ...none, attempted: true, interventions: [{ kind: "diagnosis", validationOk: true, validationCodes: [] }] };

const issuesOf = (value) => {
  const result = validateRunHarnessRecovery(value);
  return result.valid ? [] : result.issues.map((issue) => `${issue.path} ${issue.message}`);
};

test("a refused recovery states the gate's code, and a record from before the field still reads", () => {
  for (const refusalCode of ["llm.gate.training_mode", "llm.gate.training_budget_exhausted", "llm.gate.known_recovery", "llm.gate.manual_intervention"]) {
    assert.deepEqual(issuesOf({ ...none, refusalCode }), [], refusalCode);
  }
  assert.deepEqual(issuesOf({ ...none, refusalCode: null }), [], "no refusal recorded");
  assert.deepEqual(issuesOf(none), [], "absent: written before the field existed");
  assert.deepEqual(issuesOf({ ...tried, refusalCode: null }), [], "an attempted recovery refused nothing");
});

test("a refusal code is a code: never Core's sentence, and never beside a recovery that ran", () => {
  assert.deepEqual(issuesOf({ ...none, refusalCode: "Current training mode or settings do not allow LLM intervention." }), ["$.refusalCode must be an issue code, never an issue message"]);
  assert.deepEqual(issuesOf({ ...none, refusalCode: 7 }), ["$.refusalCode must be an issue code, never an issue message"]);
  assert.deepEqual(issuesOf({ ...tried, refusalCode: "llm.gate.training_mode" }), ["$.refusalCode must be null when recovery was attempted"]);
});
