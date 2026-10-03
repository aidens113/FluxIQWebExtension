import assert from "node:assert/strict";
import test from "node:test";
// A namespace import, so a member this build does not export fails its own tests rather than the whole file.
import * as contracts from "../dist/index.js";

const { validateRunHarnessRecovery } = contracts;

// Core files each post-run result check as a run intervention. They are not
// recovery, so they travel as `resultChecks`, beside the recovery lists and out
// of `attempted`: a run that needed no recovery and was checked twice reads
// `attempted: false` (run-murwd8le-79e735a8, Cause 12).
const none = { attempted: false, interventions: [], runtimePatchAttempts: [], adaptationIds: [], changeProposalIds: [] };
const check = { kind: "diagnosis", validationOk: true, validationCodes: [] };

const issuesOf = (value) => {
  const result = validateRunHarnessRecovery(value);
  return result.valid ? [] : result.issues.map((issue) => `${issue.path} ${issue.message}`);
};

test("result checks ride beside a recovery that never ran, and do not make it attempted", () => {
  assert.deepEqual(issuesOf({ ...none, resultChecks: [check, { ...check, validationOk: false, validationCodes: ["verification.unsure"] }] }), []);
  assert.deepEqual(issuesOf({ ...none, attempted: true, resultChecks: [check] }), ["$.attempted must be false when Core recorded no intervention, patch attempt, adaptation or change proposal"]);
  assert.deepEqual(issuesOf(none), [], "absent: written before the member existed");
});

test("a result check is held to the intervention's shape, so no sentence travels", () => {
  assert.notDeepEqual(issuesOf({ ...none, resultChecks: [{ ...check, validationCodes: ["a sentence: PRIVATE"] }] }), []);
  assert.notDeepEqual(issuesOf({ ...none, resultChecks: [{ ...check, reason: "PRIVATE" }] }), []);
  assert.notDeepEqual(issuesOf({ ...none, resultChecks: "two" }), []);
});
