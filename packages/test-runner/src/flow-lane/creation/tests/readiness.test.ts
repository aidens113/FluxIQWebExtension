import assert from "node:assert/strict";
import test from "node:test";
import { assertCreatedFlowVerificationReady, createdFlowVerificationReady } from "../readiness.js";

const refusedBeforeProvider = (mode: unknown) => (error: unknown) => !!error && typeof error === "object" && "details" in error
  && (error.details as Record<string, unknown>).code === "lab.candidate_verification_unavailable"
  && (error.details as Record<string, unknown>).providerInvocation === "not_attempted_by_this_entry"
  && (error.details as Record<string, unknown>).authoringMode === (typeof mode === "string" ? mode : "unrecognized");

test("a legacy-mode Core admits created-Flow qualification", () => {
  assert.doesNotThrow(() => assertCreatedFlowVerificationReady("legacy"));
  assert.equal(createdFlowVerificationReady("legacy"), true);
});

test("a candidate-mode Core is refused before any provider call", () => {
  assert.throws(() => assertCreatedFlowVerificationReady("candidate"), refusedBeforeProvider("candidate"));
  assert.equal(createdFlowVerificationReady("candidate"), false);
});

test("readiness cannot be changed by a caller or model verdict: only Core's exact legacy mode admits", () => {
  for (const ignored of [undefined, true, "Legacy", " legacy", { ready: true, verified: true }, { consumed: true }]) {
    assert.throws(() => Reflect.apply(assertCreatedFlowVerificationReady, null, [ignored]), refusedBeforeProvider(ignored));
  }
});
