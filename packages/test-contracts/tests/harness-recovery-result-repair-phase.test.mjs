import assert from "node:assert/strict";
import test from "node:test";
// A namespace import, so a member this build does not export fails its own tests rather than the whole file.
import * as contracts from "../dist/index.js";

const { harnessResultRepairOutcomes, harnessResultRepairPhases, validateRunHarnessRecovery } = contracts;

// Core's `resultRepair` marker says where a repair of a wrong answer is while
// it runs (`phase`) and how it ended once settled (`outcome`), so a reader
// follows the repair instead of guessing how long one takes.
const none = { attempted: false, interventions: [], runtimePatchAttempts: [], adaptationIds: [], changeProposalIds: [] };
const marker = (extra) => ({ attempted: true, nodeId: "node.bootstrap.04b8.main.s6", code: "core.result.does_not_answer_request", ...extra });

const issuesOf = (value) => {
  const result = validateRunHarnessRecovery(value);
  return result.valid ? [] : result.issues.map((issue) => `${issue.path} ${issue.message}`);
};

test("Core's phases and outcomes are the closed vocabularies", () => {
  assert.deepEqual([...harnessResultRepairPhases], ["reauthoring", "rerunning", "settled"]);
  assert.deepEqual([...harnessResultRepairOutcomes], ["answered", "unverified", "stopped", "not_rerun", "rerun_failed"]);
});

test("an unfinished repair states its phase and no outcome", () => {
  for (const phase of ["reauthoring", "rerunning"]) {
    assert.deepEqual(issuesOf({ ...none, resultRepair: marker({ phase }) }), [], phase);
  }
  assert.deepEqual(issuesOf({ ...none, resultRepair: marker({ phase: "rerunning", outcome: "answered" }) }), ["$.resultRepair.outcome must be absent unless the repair has settled"]);
});

test("a settled repair names each of Core's outcomes, and must name one", () => {
  for (const outcome of harnessResultRepairOutcomes) {
    assert.deepEqual(issuesOf({ ...none, resultRepair: marker({ phase: "settled", outcome }) }), [], outcome);
  }
  assert.deepEqual(issuesOf({ ...none, resultRepair: marker({ phase: "settled" }) }), ["$.resultRepair.outcome must name how a settled repair ended"]);
});

test("a record written before Core reported a phase is still read", () => {
  assert.deepEqual(issuesOf({ ...none, resultRepair: marker({}) }), []);
});

test("an unknown phase or outcome is refused", () => {
  assert.deepEqual(issuesOf({ ...none, resultRepair: marker({ phase: "repairing" }) }), ["$.resultRepair.phase must be one of reauthoring, rerunning, settled"]);
  assert.deepEqual(issuesOf({ ...none, resultRepair: marker({ phase: "settled", outcome: "fixed" }) }), ["$.resultRepair.outcome must be one of answered, unverified, stopped, not_rerun, rerun_failed"]);
  assert.deepEqual(issuesOf({ ...none, resultRepair: marker({ phase: "settled", outcome: "The repaired Flow answered." }) }), ["$.resultRepair.outcome must be one of answered, unverified, stopped, not_rerun, rerun_failed"]);
});

test("a result never taken through the entry point has no phase", () => {
  assert.deepEqual(issuesOf({ ...none, resultRepair: { attempted: false, nodeId: null, code: null, phase: "reauthoring" } }), ["$.resultRepair.phase must be absent for a result that was never taken through the failure entry point"]);
});
