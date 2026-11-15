import assert from "node:assert/strict";
import test from "node:test";
import { modelKeyUnavailableLine } from "../unavailable-line";

test("unavailable model configuration offers the actual recovery action", () => {
  assert.match(modelKeyUnavailableLine("upgrade_required"), /Update FluxIQ/u);
  assert.match(modelKeyUnavailableLine({ state: "unavailable", code: "legacy_recovery_required" }), /recover or replace/u);
  assert.match(modelKeyUnavailableLine({ state: "unavailable", code: "host_protection_unavailable" }), /host operator/u);
  assert.match(modelKeyUnavailableLine({ state: "unavailable", code: "ciphertext_invalid" }), /replace it/u);
  for (const code of ["legacy_recovery_required", "host_protection_unavailable", "ciphertext_invalid"] as const) {
    assert.doesNotMatch(modelKeyUnavailableLine({ state: "unavailable", code }), /unlock|password|sign in|revoked/iu);
  }
});
