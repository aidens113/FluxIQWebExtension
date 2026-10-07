import assert from "node:assert/strict";
import test from "node:test";
import { coreControlResponse } from "../core-control-response.mjs";

test("a Core control HTTP failure is read as its endpoint and status", () => {
  assert.deepEqual(coreControlResponse("FluxIQ control request failed: /api/programs/automation-studio/get-runtime-build-identity (400): Executing Core runtime build identity is unavailable."), { endpoint: "/api/programs/automation-studio/get-runtime-build-identity", status: 400 });
  assert.deepEqual(coreControlResponse("FluxIQ control request failed: /api/session (503)"), { endpoint: "/api/session", status: 503 });
});

test("anything else is not a Core control response", () => {
  for (const text of [null, undefined, "", "Core web panel production build did not succeed", "Core did not become ready", "control request failed: /api/x (40)", "FluxIQ control request failed: /api/x"]) {
    assert.equal(coreControlResponse(text), null, String(text));
  }
});
