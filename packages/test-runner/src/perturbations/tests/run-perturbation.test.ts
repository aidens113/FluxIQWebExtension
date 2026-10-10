import assert from "node:assert/strict";
import test from "node:test";
import { parseRunPerturbation } from "../run-perturbation.js";

test("each declared shape is read back as itself", () => {
  assert.deepEqual(parseRunPerturbation({ kind: "drop-action-result", afterCommittingActs: 2 }), { kind: "drop-action-result", afterCommittingActs: 2 });
  assert.deepEqual(parseRunPerturbation({ kind: "stop-service-worker", onSiteRequest: "/api/*/confirm-request" }), { kind: "stop-service-worker", onSiteRequest: "/api/*/confirm-request" });
});

test("anything else is refused rather than run unperturbed", () => {
  for (const value of [
    null, [], "drop-action-result", {},
    { kind: "drop-action-result" },
    { kind: "drop-action-result", afterCommittingActs: 0 },
    { kind: "drop-action-result", afterCommittingActs: 1.5 },
    { kind: "drop-action-result", afterCommittingActs: 1, extra: true },
    { kind: "stop-service-worker", onSiteRequest: "api/confirm" },
    { kind: "stop-service-worker", onSiteRequest: "/api/confirm?x=1" },
    { kind: "stop-service-worker", onSiteRequest: "/api/confirm", afterCommittingActs: 1 },
    { kind: "drop-frames", afterCommittingActs: 1 },
  ]) assert.throws(() => parseRunPerturbation(value), Error, JSON.stringify(value));
});
