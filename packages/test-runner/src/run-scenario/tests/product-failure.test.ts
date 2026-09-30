// A build that ended without a Flow is FluxIQ's failure, not the facility's.
//
// `run-muntc23v-7fcc4110`: the build ended `flow_bootstrap.evidence_unusable_decision`
// and no Flow existed, yet the run was stamped
// `facilityFailure: scenario.execute / unclassified`, because any error with no
// reported verdict was projected as a facility failure.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { projectFacilityFailure } from "../../facility-failure/index.js";
import { RunnerFailure } from "../../failure.js";
import { productFailureOf } from "../product-failure.js";

/** The error the created-Flow lane raises for run 5's build (`flow-lane/creation/lane.ts`). */
function buildWithoutFlow(code?: unknown) {
  return new RunnerFailure("runtime.behavior", `FluxIQ did not build a Flow from the task's instruction (${String(code ?? "no proposal")})`, {
    details: { failure: code === undefined ? undefined : { code, stage: "provider_output_validation" }, providerCalls: 39 },
  });
}

test("a build that ended without a Flow is a product failure with its own category and Core's code", () => {
  assert.deepEqual(productFailureOf(buildWithoutFlow("flow_bootstrap.evidence_unusable_decision"), { flowLane: true, flowCreated: undefined }), {
    code: "flow_lane.flow_not_built",
    buildFailureCode: "flow_bootstrap.evidence_unusable_decision",
  });
  assert.deepEqual(productFailureOf(buildWithoutFlow("flow_bootstrap.evidence_unusable_decision"), { flowLane: true, flowCreated: false }), {
    code: "flow_lane.flow_not_built",
    buildFailureCode: "flow_bootstrap.evidence_unusable_decision",
  });
});

test("a build with no proposal, or a code that is not a closed code, is still not built and carries no code", () => {
  assert.deepEqual(productFailureOf(buildWithoutFlow(), { flowLane: true, flowCreated: undefined }), { code: "flow_lane.flow_not_built" });
  assert.deepEqual(productFailureOf(buildWithoutFlow("The page said: secret 1234"), { flowLane: true, flowCreated: false }), { code: "flow_lane.flow_not_built" });
  assert.deepEqual(productFailureOf(buildWithoutFlow(42), { flowLane: true, flowCreated: false }), { code: "flow_lane.flow_not_built" });
});

test("a product failure after the Flow was built, and one on the recording lane, are the product's too", () => {
  const wrongRecords = new RunnerFailure("runtime.behavior", "The Flow's records did not match");
  assert.deepEqual(productFailureOf(wrongRecords, { flowLane: true, flowCreated: true }), { code: "flow_lane.product_behavior" });
  assert.deepEqual(productFailureOf(wrongRecords, { flowLane: false, flowCreated: undefined }), { code: "recording_lane.product_behavior" });
});

test("real facility failures stay the facility's", () => {
  const crashed = new RunnerFailure("extension.worker", "The extension's service worker stopped");
  const unreachable = new RunnerFailure("process.startup", "FluxIQ did not answer", { details: { operationStage: "control.request", transportCode: "ECONNREFUSED" } });
  const bare = new Error("Target page, context or browser has been closed");
  for (const error of [crashed, unreachable, bare]) {
    assert.equal(productFailureOf(error, { flowLane: true, flowCreated: undefined }), undefined);
  }
  // And the projection they still get is the one they always got.
  assert.equal(projectFacilityFailure(bare, "finalized-bundle", "scenario.execute").reason, "unclassified");
});

test("the spine projects a facility failure only for an error that is not the product's", async () => {
  const source = await readFile(fileURLToPath(new URL("../../../src/run-scenario.ts", import.meta.url)), "utf8");
  assert.match(source, /const productFailure = productFailureOf\(error, \{ flowLane, flowCreated: flowObservation\?\.flowCreated \}\);\s*if \(flowObservation\?\.reportedVerdict == null && !productFailure\) \{\s*facilityFailure = projectFacilityFailure\(error, "finalized-bundle", "scenario\.execute"\);/);
  assert.match(source, /\.\.\.\(productFailure \? \{ productFailure \} : \{\}\)/);
});
