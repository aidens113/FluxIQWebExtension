// The live campaign's row says why a run failed on the facility. A Core
// refusal names Core's 4xx and its sentence (A8 run run-mv85un8j-beb734f5 read
// only "unclassified" though Core had said why), and the sentence is screened
// again before it is printed.

import assert from "node:assert/strict";
import test from "node:test";
import { coreRefusalOf, describeFacilityFailure } from "../facility-failure.mjs";

const SETTINGS = "/api/programs/automation-studio/update-flow-settings";
const REFUSED = { boundary: "finalized-bundle", stage: "scenario.execute", reason: "core.refused", endpoint: SETTINGS, httpStatus: 400, refusal: "LLM execution limit is invalid." };

test("a Core refusal prints its status, route and Core's sentence", () => {
  assert.equal(describeFacilityFailure(REFUSED), `core.refused 400 at ${SETTINGS} (finalized-bundle, scenario.execute): "LLM execution limit is invalid."`);
  assert.equal(describeFacilityFailure({ ...REFUSED, httpStatus: 403, refusal: undefined }), `core.refused 403 at ${SETTINGS} (finalized-bundle, scenario.execute)`);
});

test("a refusal sentence that fails screening is dropped, and the status and route still print", () => {
  for (const refusal of ["Bearer RAW_SENTINEL", "password=RAW_SENTINEL", "Session 9f2c4e1a7b3d5f6e8a0c2e4f6a8b0d1c3e5f7a9b is unknown", `two${String.fromCharCode(10)}lines`, "x".repeat(241), 42]) {
    const line = describeFacilityFailure({ ...REFUSED, refusal });
    assert.equal(line, `core.refused 400 at ${SETTINGS} (finalized-bundle, scenario.execute)`, String(refusal));
    assert.deepEqual(coreRefusalOf({ ...REFUSED, refusal }), { endpoint: SETTINGS, httpStatus: 400 });
  }
});

test("a refusal without a valid route or 4xx is not read as one, and other reasons print as before", () => {
  for (const mutation of [{ httpStatus: 500 }, { httpStatus: "400" }, { endpoint: "/private/RAW_SENTINEL" }, { endpoint: undefined }]) {
    assert.equal(coreRefusalOf({ ...REFUSED, ...mutation }), null, JSON.stringify(mutation));
    assert.equal(describeFacilityFailure({ ...REFUSED, ...mutation }).includes("LLM execution limit"), false);
  }
  assert.equal(coreRefusalOf({ boundary: "finalized-bundle", stage: "scenario.execute", reason: "http.abort", operationStage: "project.select", endpoint: SETTINGS, httpStatus: 400, refusal: "x" }), null);
  assert.equal(describeFacilityFailure({ boundary: "finalized-bundle", stage: "scenario.execute", reason: "http.timeout", operationStage: "control.request", timeoutMs: 30_000 }), "http.timeout at control.request after 30000 ms (finalized-bundle, scenario.execute)");
  assert.equal(describeFacilityFailure(null), null);
});
