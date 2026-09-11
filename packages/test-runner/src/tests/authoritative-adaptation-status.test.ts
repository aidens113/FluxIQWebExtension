import assert from "node:assert/strict";
import test from "node:test";
import { isActiveRuntimeAdaptationStatus, resolveAuthoritativeAdaptationStatus } from "../authoritative-adaptation-status.js";

test("a pre-read reverted status wins over stale applied readiness detail", () => {
  const statuses = new Map<string, string>([["adaptation.target", "reverted"]]);
  const resolved = resolveAuthoritativeAdaptationStatus("adaptation.target", statuses, "applied", "applied");
  assert.equal(resolved, "reverted");
  assert.equal(isActiveRuntimeAdaptationStatus(resolved), false);
});

test("an unseen adaptation uses the latest summary before detail fallback", () => {
  const statuses = new Map<string, string>();
  assert.equal(resolveAuthoritativeAdaptationStatus("adaptation.new", statuses, "proposed", "reverted"), "proposed");
  assert.equal(isActiveRuntimeAdaptationStatus("proposed"), true);
  assert.equal(resolveAuthoritativeAdaptationStatus("adaptation.detail-only", statuses, undefined, "validated"), "validated");
});

test("the workaround does not override unrelated later status transitions", () => {
  const statuses = new Map<string, string>([["adaptation.target", "proposed"], ["adaptation.reverted", "reverted"]]);
  assert.equal(resolveAuthoritativeAdaptationStatus("adaptation.target", statuses, "applied", "proposed"), "applied");
  assert.equal(resolveAuthoritativeAdaptationStatus("adaptation.reverted", statuses, "validated", "applied"), "validated");
  assert.equal(isActiveRuntimeAdaptationStatus("applied"), true);
  assert.equal(isActiveRuntimeAdaptationStatus("validated"), true);
});
