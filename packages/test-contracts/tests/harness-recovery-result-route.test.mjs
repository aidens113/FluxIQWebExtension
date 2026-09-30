import assert from "node:assert/strict";
import test from "node:test";
// A namespace import, so a member this build does not export fails its own tests rather than the whole file.
import * as contracts from "../dist/index.js";

const { harnessResultReauthorRefusals, validateRunHarnessRecovery } = contracts;

// `resultReauthor` and `resultRepair` are why a run that answered wrongly was
// or was not repaired. Core computes the decision, records it on the run, and
// it reached no bundle: six live runs in a row published empty patch, adaptation
// and proposal lists with a `null` refusal, which reads as a repair loop
// switched off, and the cause was twice attributed to the wrong gate.
const none = { attempted: false, interventions: [], runtimePatchAttempts: [], adaptationIds: [], changeProposalIds: [] };
const ADAPTATION_ID = "adaptation.run.one.flow_bootstrap_extend.1700";

const issuesOf = (value) => {
  const result = validateRunHarnessRecovery(value);
  return result.valid ? [] : result.issues.map((issue) => `${issue.path} ${issue.message}`);
};

const refused = (refusal) => ({ routed: false, refusal, adaptationId: null, applied: false, failureCode: null });
const routed = (extra) => ({ routed: true, refusal: null, adaptationId: null, applied: false, failureCode: null, ...extra });

test("each gate that can close the route to the build loop is a stated reason", () => {
  assert.deepEqual([...harnessResultReauthorRefusals], ["not_a_wrong_answer", "flow_unavailable", "adaptations_not_permitted"]);
  for (const refusal of harnessResultReauthorRefusals) {
    assert.deepEqual(issuesOf({ ...none, resultReauthor: refused(refusal) }), [], refusal);
  }
  // A word Core adds later is read rather than failing the run that carried it.
  assert.deepEqual(issuesOf({ ...none, resultReauthor: refused("flow_is_a_subflow") }), [], "a fifth word");
});

test("a route that was taken records the adaptation it produced, whether it reached the Flow, and what failed", () => {
  assert.deepEqual(issuesOf({ ...none, resultReauthor: routed({ adaptationId: ADAPTATION_ID, applied: true }) }), [], "built and applied");
  assert.deepEqual(issuesOf({ ...none, resultReauthor: routed({ adaptationId: ADAPTATION_ID, failureCode: "flow_bootstrap.apply_failed" }) }), [], "built and not applied");
  assert.deepEqual(issuesOf({ ...none, resultReauthor: routed({ failureCode: "flow_bootstrap.extend_failed" }) }), [], "never built");
});

// The three shapes that would let a refusal and a route be read as each other.
test("a refusal and a route cannot borrow each other's members", () => {
  assert.deepEqual(issuesOf({ ...none, resultReauthor: { ...refused("flow_unavailable"), routed: true } }), ["$.resultReauthor.refusal must be null for a route that was taken"]);
  assert.deepEqual(issuesOf({ ...none, resultReauthor: { ...refused("flow_unavailable"), adaptationId: ADAPTATION_ID } }), ["$.resultReauthor.adaptationId must be null for a run that was never routed"]);
  assert.deepEqual(issuesOf({ ...none, resultReauthor: { ...refused("flow_unavailable"), applied: true } }), ["$.resultReauthor.applied cannot be true for a run that was never routed"]);
  assert.deepEqual(issuesOf({ ...none, resultReauthor: { ...refused("flow_unavailable"), failureCode: "flow_bootstrap.extend_failed" } }), ["$.resultReauthor.failureCode must be null for a run that was never routed: a refusal is named by refusal, not by a failure"]);
});

test("nothing free-text travels in either record", () => {
  assert.deepEqual(issuesOf({ ...none, resultReauthor: refused("The run failed for something other than its answer.") }), ["$.resultReauthor.refusal must be a kind name of at most 64 lowercase words joined by underscores"]);
  assert.deepEqual(issuesOf({ ...none, resultReauthor: routed({ failureCode: "The build could not extend the Flow." }) }), ["$.resultReauthor.failureCode must be an issue code, never an issue message"]);
  assert.deepEqual(issuesOf({ ...none, resultRepair: { attempted: true, nodeId: "the second extract step", code: null } }), ["$.resultRepair.nodeId must be a Core identifier of at most 256 characters"]);
  assert.deepEqual(issuesOf({ ...none, resultRepair: { attempted: true, nodeId: null, code: "The run stored eight rows where thirteen were expected." } }), ["$.resultRepair.code must be an issue code, never an issue message"]);
  assert.deepEqual(issuesOf({ ...none, resultReauthor: refused("flow_unavailable"), resultRepair: { attempted: true, nodeId: null, code: null, reason: "because" } }), ["$.resultRepair.reason unknown property"]);
});

// Absent and null are different facts and neither is a decision: a run Core
// never took to the route did not refuse it, and a run whose record this
// reader could not parse did not decline to route either. Publishing either as
// a "not attempted" record is the silence this pair exists to end.
test("an absent record is absent, an unreadable one is null, and neither is a stated decision", () => {
  assert.deepEqual(issuesOf(none), [], "absent: Core wrote nothing, or wrote it before the members existed");
  assert.deepEqual(issuesOf({ ...none, resultReauthor: null, resultRepair: null }), [], "null: Core wrote something this record cannot read");
  assert.deepEqual(issuesOf({ ...none, resultRepair: { attempted: true, nodeId: "node.bootstrap.04b8.main.s6", code: "core.result.does_not_answer_request" } }), [], "the marker alone: the verdict reached the entry point and no route was recorded");
  // A marker that says the result never entered names no node it entered on.
  assert.deepEqual(issuesOf({ ...none, resultRepair: { attempted: false, nodeId: "node.bootstrap.04b8.main.s6", code: null } }), ["$.resultRepair.nodeId must be null for a result that was never taken through the failure entry point"]);
});
