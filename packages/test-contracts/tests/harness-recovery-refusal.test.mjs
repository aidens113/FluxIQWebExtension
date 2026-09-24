import assert from "node:assert/strict";
import test from "node:test";
// A namespace import, so a member this build does not export fails its own tests rather than the whole file.
import * as contracts from "../dist/index.js";

const { validateRunHarnessRecovery } = contracts;

// `refusalCode` is why a failed run got no repair, and `refusalRung` is which
// rung of Core's loop decided: carried so "recovery was not allowed to start",
// "recovery was not needed" and "recovery ran and declined" stop reading as one
// another. Both are closed words, like every other string in the record, so
// Core's sentence for the refusal cannot ride along.
const none = { attempted: false, interventions: [], runtimePatchAttempts: [], adaptationIds: [], changeProposalIds: [] };
const tried = { ...none, attempted: true, interventions: [{ kind: "diagnosis", validationOk: true, validationCodes: [] }] };
const patched = { ...tried, runtimePatchAttempts: [{ kind: "temporary_target_override", proposalOnly: false, executed: true, preflightOk: true, issueCodes: [], adaptationCreated: true, changeProposalCreated: false }] };

const issuesOf = (value) => {
  const result = validateRunHarnessRecovery(value);
  return result.valid ? [] : result.issues.map((issue) => `${issue.path} ${issue.message}`);
};

test("a refused recovery states the gate's code, and a record from before the field still reads", () => {
  for (const refusalCode of ["llm.gate.training_mode", "llm.gate.training_budget_exhausted", "llm.gate.known_recovery", "llm.gate.manual_intervention"]) {
    assert.deepEqual(issuesOf({ ...none, refusalCode, refusalRung: "gate" }), [], refusalCode);
  }
  assert.deepEqual(issuesOf({ ...none, refusalCode: null }), [], "no refusal recorded");
  assert.deepEqual(issuesOf(none), [], "absent: written before the field existed");
  assert.deepEqual(issuesOf({ ...tried, refusalCode: null }), [], "an attempted recovery that refused nothing");
});

// Live run `run-muesyox4-930bef98` (2026-09-23): the recovery engaged, spent
// two diagnosis interventions, the second validated, and it then made no patch
// attempt, recorded no adaptation, proposed no change -- and stated no reason,
// because a refusal was refused for any `attempted` recovery. That is the one
// outcome most in need of an explanation, so it is the one that had none.
test("a recovery that engaged and repaired nothing may say why, and which rung declined", () => {
  assert.deepEqual(issuesOf({ ...tried, refusalCode: "llm.runtime_patch_goal_unachievable", refusalRung: "plan" }), [], "the plan asked for no patch");
  assert.deepEqual(issuesOf({ ...tried, refusalCode: "llm.runtime_patch_permission_required", refusalRung: "exploration" }), [], "a person has to answer first");
  assert.deepEqual(issuesOf({ ...tried, refusalCode: "llm.runtime_patch_diagnosis_call_failed", refusalRung: "diagnosis" }), [], "the diagnosis produced nothing to continue from");
  // An older Core names no rung. That is a stated reason without an attributed
  // rung, not an unattributed refusal, and it still reads.
  assert.deepEqual(issuesOf({ ...tried, refusalCode: "llm.runtime_patch_not_requested" }), [], "a reason with no rung");
});

test("a refusal code is a code, names a rung Core owns, and never sits beside a repair", () => {
  assert.deepEqual(issuesOf({ ...none, refusalCode: "Current training mode or settings do not allow LLM intervention." }), ["$.refusalCode must be an issue code, never an issue message"]);
  assert.deepEqual(issuesOf({ ...none, refusalCode: 7 }), ["$.refusalCode must be an issue code, never an issue message"]);
  assert.deepEqual(issuesOf({ ...tried, refusalCode: "llm.runtime_patch_goal_unachievable", refusalRung: "stage four" }), ["$.refusalRung must be one of gate, diagnosis, plan, exploration, resolution"]);
  // A rung with nothing to attribute says a refusal happened without saying
  // what it was, which is the silence in another shape.
  assert.deepEqual(issuesOf({ ...tried, refusalRung: "plan" }), ["$.refusalRung must be null unless a refusal code names what it declined"]);
  // A recovery that produced a repair is described by what it produced.
  assert.deepEqual(issuesOf({ ...patched, refusalCode: "llm.runtime_patch_goal_unachievable", refusalRung: "plan" }), ["$.refusalCode must be null when the recovery produced a patch attempt, an adaptation or a change proposal"]);
});
