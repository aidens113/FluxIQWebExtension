import assert from "node:assert/strict";
import test from "node:test";
import { describeAttemptFailure } from "../attempt-failure.mjs";

const startup = (runPath) => ({
  code: 1, signal: null, stderr: "",
  stdout: `${JSON.stringify({ runId: "run-a", verdict: "failed", path: runPath, failureCategory: "process.startup", evaluation: { failureCategory: "process.startup", facilityFailure: { boundary: "finalized-bundle", stage: "scenario.execute", reason: "unclassified" } } })}\n`,
});

test("a classified startup failure is described by what the run's bundle says failed, not by the facility's 'unclassified'", async () => {
  const failure = await describeAttemptFailure(startup("F:/runs/run-a"), { readFirstFailure: async () => "Core web panel production build did not succeed" });
  assert.equal(failure.description, "process.startup: Core web panel production build did not succeed");
  assert.equal(failure.fingerprint, "process.startup | finalized-bundle/scenario.execute/unclassified | Core web panel production build did not succeed | exit 1");
});

test("two attempts that failed at the same thing fingerprint the same, and different things differently", async () => {
  const build = async () => "Core web panel production build did not succeed";
  const health = async () => "Core did not become ready";
  const first = await describeAttemptFailure(startup("F:/runs/run-a"), { readFirstFailure: build });
  const again = await describeAttemptFailure(startup("F:/runs/run-b"), { readFirstFailure: build });
  const other = await describeAttemptFailure(startup("F:/runs/run-c"), { readFirstFailure: health });
  assert.equal(first.fingerprint, again.fingerprint, "the run id and path are not part of what failed");
  assert.notEqual(first.fingerprint, other.fingerprint);
});

test("a runner refusal is described by its own message", async () => {
  const failure = await describeAttemptFailure({ code: 1, signal: null, stdout: "", stderr: '{"status":"failed","category":"process.startup","message":"Core web panel production build did not succeed"}\n' });
  assert.equal(failure.description, "process.startup: Core web panel production build did not succeed");
});

test("a bare crash carries nothing to compare, so it is not fingerprinted", async () => {
  assert.equal(await describeAttemptFailure({ code: 3221225477, signal: null, stdout: "", stderr: "" }), null);
  assert.equal(await describeAttemptFailure({ code: 139, signal: null, stdout: "", stderr: "Segmentation fault" }), null);
});

const refused = (refusal) => ({
  code: 1, signal: null, stderr: "",
  stdout: `${JSON.stringify({ runId: "run-r", verdict: "failed", path: "F:/runs/run-r", failureCategory: "facility.contract", evaluation: { failureCategory: "facility.contract", facilityFailure: { boundary: "finalized-bundle", stage: "scenario.execute", reason: "core.refused", endpoint: "/api/programs/automation-studio/update-flow-settings", httpStatus: 400, ...(refusal === undefined ? {} : { refusal }) } } })}\n`,
});

// A8 run run-mv85un8j-beb734f5 failed as `unclassified` though Core had said why.
test("a Core refusal is described by Core's status and sentence", async () => {
  const failure = await describeAttemptFailure(refused("LLM execution limit is invalid."), { readFirstFailure: async () => "something the bundle wrote" });
  assert.equal(failure.description, 'facility.contract: core.refused 400 /api/programs/automation-studio/update-flow-settings: "LLM execution limit is invalid."');
  assert.equal(failure.fingerprint, 'facility.contract | finalized-bundle/scenario.execute/core.refused 400 /api/programs/automation-studio/update-flow-settings: "LLM execution limit is invalid." | something the bundle wrote | exit 1');
});

test("a Core refusal sentence that fails screening is not printed", async () => {
  const failure = await describeAttemptFailure(refused("Bearer RAW_SENTINEL"), { readFirstFailure: async () => null });
  assert.equal(failure.description, "facility.contract: core.refused 400 /api/programs/automation-studio/update-flow-settings");
  assert.equal(failure.fingerprint.includes("RAW_SENTINEL"), false);
});
