import assert from "node:assert/strict";
import test from "node:test";
import { assertCreatedFlowVerificationReady } from "../readiness.js";
test("implementation readiness cannot be changed by a caller or model verdict", () => {
  for (const ignored of [true, { ready: true, verified: true }, { consumed: true }]) {
    assert.throws(() => Reflect.apply(assertCreatedFlowVerificationReady, null, [ignored]), (error: unknown) => !!error && typeof error === "object" && "details" in error && (error.details as Record<string, unknown>).providerInvocation === "not_attempted_by_this_entry");
  }
});
