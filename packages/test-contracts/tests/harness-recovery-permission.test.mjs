import assert from "node:assert/strict";
import test from "node:test";
// A namespace import, so a member this build does not export fails its own tests rather than the whole file.
import * as contracts from "../dist/index.js";

const { validateRunHarnessRecovery, harnessPatchPermissionOutcomes } = contracts;

// What the recovery's permission gate said about a repair that would lastingly
// act (Week 2 exit, L5): `permissionOutcome` in closed words, and
// `permissionRequired` exactly when the repair was held back as the request a
// person answers. Absent in a record written before either existed.
const held = { kind: "temporary_target_override", proposalOnly: null, executed: false, preflightOk: false, issueCodes: ["runtime_patch.permission_required"], adaptationCreated: false, changeProposalCreated: false, permissionOutcome: "required", permissionRequired: true };
const record = (attempt) => ({ attempted: true, interventions: [], runtimePatchAttempts: [attempt], adaptationIds: [], changeProposalIds: [] });
const issuesOf = (value) => {
  const result = validateRunHarnessRecovery(value);
  return result.valid ? [] : result.issues.map((issue) => `${issue.path} ${issue.message}`);
};

test("the gate's outcomes are exported, and each reads on a patch attempt", () => {
  assert.deepEqual([...harnessPatchPermissionOutcomes], ["permitted", "required", "undeclared", "not_asked"]);
  assert.deepEqual(issuesOf(record(held)), []);
  for (const permissionOutcome of ["permitted", "undeclared", "not_asked"]) {
    assert.deepEqual(issuesOf(record({ ...held, permissionOutcome, permissionRequired: false })), [], permissionOutcome);
  }
  assert.deepEqual(issuesOf(record({ ...held, permissionOutcome: null, permissionRequired: null })), [], "no gate asked");
  const { permissionOutcome: _outcome, permissionRequired: _required, ...before } = held;
  assert.deepEqual(issuesOf(record(before)), [], "written before the fields existed");
});

test("a held patch is held only by a request, never while it ran, and in closed words only", () => {
  assert.deepEqual(issuesOf(record({ ...held, permissionOutcome: "permitted" })), ["$.runtimePatchAttempts[0].permissionRequired must be true only for a patch the gate held back as a request"]);
  assert.deepEqual(issuesOf(record({ ...held, executed: true })), ["$.runtimePatchAttempts[0].permissionRequired cannot be true for a patch Core states it executed"]);
  assert.equal(issuesOf(record({ ...held, permissionOutcome: "Neither its instruction nor a grant allows that" })).length > 0, true);
  assert.equal(issuesOf(record({ ...held, permissionRequired: "yes" })).length > 0, true);
});
