// Coverage of step-skip.ts: the closed skip a step row reports is read as the
// contract declares it, and anything outside that shape, or on a row that is
// not a step, is not read at all (t416).

import assert from "node:assert/strict";
import test from "node:test";

import { stepSkip, type ClientGatewayActivity } from "../index";

function event(detail: ClientGatewayActivity["detail"]): ClientGatewayActivity {
  return { activityId: "run:r1", sequence: 1, subject: { kind: "run", id: "r1", projectId: "p" }, phase: "running", label: "Already done for Lin Zhao", at: "2026-10-10T00:00:00.000Z", ...(detail ? { detail } : {}) };
}

function stepWith(skipped: unknown): ClientGatewayActivity {
  return event({ kind: "step", title: "Already done for Lin Zhao", status: "succeeded", ref: "n4.confirm", skipped } as ClientGatewayActivity["detail"]);
}

test("each of the contract's reasons is read, with its subject trimmed", () => {
  assert.deepEqual(stepSkip(stepWith({ reason: "already_done", subject: " Lin Zhao " })), { reason: "already_done", subject: "Lin Zhao" });
  assert.deepEqual(stepSkip(stepWith({ reason: "optional_absent", subject: "Not now" })), { reason: "optional_absent", subject: "Not now" });
  assert.deepEqual(stepSkip(stepWith({ reason: "state_routed" })), { reason: "state_routed" });
});

test("a blank or non-string subject is left out", () => {
  assert.deepEqual(stepSkip(stepWith({ reason: "already_done", subject: "  " })), { reason: "already_done" });
  assert.deepEqual(stepSkip(stepWith({ reason: "already_done", subject: 4 })), { reason: "already_done" });
});

test("a skip outside the contract, or on a row that is not a step, is not read; an older row without the field reads none", () => {
  assert.equal(stepSkip(stepWith({ reason: "guessed" })), undefined);
  assert.equal(stepSkip(stepWith("already_done")), undefined);
  assert.equal(stepSkip(stepWith(null)), undefined);
  assert.equal(stepSkip(event({ kind: "tool", title: "Clicking", skipped: { reason: "already_done" } } as ClientGatewayActivity["detail"])), undefined);
  assert.equal(stepSkip(event({ kind: "step", title: "Already done for Lin Zhao", status: "succeeded", ref: "n4.confirm" })), undefined);
  assert.equal(stepSkip(event(undefined)), undefined);
});
