import assert from "node:assert/strict";
import test from "node:test";
import { createdFlowBuildFromDiagnostic } from "../index.js";

const loop = { iterationCount: 6, decisionCount: 5, toolCallCount: 4, evidenceBytes: 1200 };
const stopped = {
  code: "flow_bootstrap.evidence_iteration_limit",
  stage: "provider_output_validation",
  retryable: true,
  providerInvocation: "attempted",
  providerResponse: "received",
  evidenceLoop: loop,
};

test("a failed build keeps its actual reader and judge calls separately from loop decisions", () => {
  const record = createdFlowBuildFromDiagnostic({ ...stopped, totalProviderCallCount: 7 }, 100, 400);
  assert.ok(record);
  assert.equal(record.providerCalls, 7);
  assert.equal(record.loopProviderCalls, 5);
  assert.equal(record.evidenceLoop?.decisionCount, 5);
});

test("a legacy failed diagnostic does not present loop decisions as a known build aggregate", () => {
  const record = createdFlowBuildFromDiagnostic(stopped, 100, 400);
  assert.ok(record);
  assert.equal(record.providerCalls, null);
  assert.equal(record.loopProviderCalls, 5);
});

test("a current request refused before sending does not erase earlier settled build calls", () => {
  const record = createdFlowBuildFromDiagnostic({
    code: "flow_bootstrap.provider_resolution_failed",
    stage: "provider_resolution",
    retryable: false,
    providerInvocation: "not_attempted",
    providerResponse: "not_received",
    totalProviderCallCount: 7,
    evidenceLoop: loop,
  }, 100, 400);
  assert.ok(record);
  assert.equal(record.providerCalls, 7);
  assert.equal(record.loopProviderCalls, 5);
  assert.equal(record.providerInvocation, "not_attempted");
});

test("an unsent legacy ending with earlier decisions retains those decisions and an unknown aggregate", () => {
  const record = createdFlowBuildFromDiagnostic({
    code: "flow_bootstrap.provider_resolution_failed", stage: "provider_resolution",
    retryable: false, providerInvocation: "not_attempted", providerResponse: "not_received",
    evidenceLoop: loop,
  }, 100, 400);
  assert.ok(record);
  assert.equal(record.providerCalls, null);
  assert.equal(record.loopProviderCalls, 5);
});
