// Coverage of send-answer.ts: whether Core's answer to a sent message says it
// started work, which is what keeps the starting status up after the answer.

import assert from "node:assert/strict";
import test from "node:test";

import { sendStartedWork } from "../send-answer";

const answer = (execution: unknown) => ({ ok: true, payload: { turn: { turnId: "t1" }, response: { decision: { kind: "invoke" }, execution } } });

test("an answer whose command started work is a start", () => {
  assert.equal(sendStartedWork(answer({ capabilityId: "build", status: "started", summary: "Building", flowId: "f1" })), true);
  // A first message: the relay puts the opened thread beside append-turn's payload.
  assert.equal(sendStartedWork({ ok: true, payload: { conversation: { conversationId: "c1" }, ...answer({ status: "started" }).payload } }), true);
});

test("an answer that ran nothing, finished at once, or failed is not a start; nor is a failed send or a shape Core never sends", () => {
  assert.equal(sendStartedWork(answer(null)), false, "Core answered in words only");
  assert.equal(sendStartedWork(answer({ status: "done", summary: "Renamed" })), false);
  assert.equal(sendStartedWork(answer({ status: "failed", summary: "No", error: "x" })), false);
  assert.equal(sendStartedWork({ ok: true, payload: { turn: { turnId: "t1" } } }), false, "a turn stored without capabilities");
  assert.equal(sendStartedWork({ ok: true, payload: { turn: {}, response: null } }), false);
  assert.equal(sendStartedWork({ ok: false, code: "failed", error: "down" }), false);
  for (const odd of [undefined, null, "started", 3, [], { ok: true }, { ok: true, payload: "x" }]) assert.equal(sendStartedWork(odd), false);
});
