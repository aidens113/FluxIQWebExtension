// Coverage of step-recovery.ts: the closed recovery a step row reports is read
// as the contract declares it, and anything outside that shape, or on a row
// that is not a step, is not read at all.

import assert from "node:assert/strict";
import test from "node:test";

import { stepRecovery, type ClientGatewayActivity } from "../index";

function event(detail: ClientGatewayActivity["detail"]): ClientGatewayActivity {
  return { activityId: "run:r1", sequence: 1, subject: { kind: "run", id: "r1", projectId: "p" }, phase: "running", label: "Recovered: Dismiss the sign-in popup", at: "2026-10-09T00:00:00.000Z", ...(detail ? { detail } : {}) };
}

function stepWith(recovery: unknown): ClientGatewayActivity {
  return event({ kind: "step", title: "Dismiss the sign-in popup", status: "succeeded", ref: "node.add", recovery } as ClientGatewayActivity["detail"]);
}

test("a step row's handler recovery is read whole", () => {
  const recovery = { kind: "handler", subject: "Dismiss the sign-in popup", outcome: "succeeded", event: "before", targetId: "handler.popup" } as const;
  assert.deepEqual(stepRecovery(stepWith(recovery)), recovery);
});

test("an event is kept only on a handler recovery, and a route keeps its target", () => {
  assert.deepEqual(stepRecovery(stepWith({ kind: "route", subject: "Back to the cart", outcome: "refused", event: "fail", targetId: "checkpoint.cart" })), { kind: "route", subject: "Back to the cart", outcome: "refused", targetId: "checkpoint.cart" });
});

test("a recovery outside the contract, without a subject, or on a row that is not a step is not read", () => {
  assert.equal(stepRecovery(stepWith({ kind: "teleport", subject: "x", outcome: "succeeded" })), undefined);
  assert.equal(stepRecovery(stepWith({ kind: "entry", subject: "x", outcome: "maybe" })), undefined);
  assert.equal(stepRecovery(stepWith({ kind: "entry", subject: "  ", outcome: "succeeded" })), undefined);
  assert.equal(stepRecovery(stepWith("handler")), undefined);
  assert.equal(stepRecovery(event({ kind: "tool", title: "Clicking", recovery: { kind: "handler", subject: "x", outcome: "succeeded" } } as ClientGatewayActivity["detail"])), undefined);
  assert.equal(stepRecovery(event({ kind: "step", title: "Running step 1 of 3", status: "started" })), undefined);
  assert.equal(stepRecovery(event(undefined)), undefined);
});
