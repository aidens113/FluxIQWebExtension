// The model key reading from the background's readiness reply: every state, and every way a read can fail.

import assert from "node:assert/strict";
import test from "node:test";
import type { PanelResult } from "../../../../state";
import { modelKeyFromReply } from "../from-reply";

const reply = (...keys: unknown[]): PanelResult<unknown> => ({ ok: true, value: { ok: true, payload: { keys } } });

test("no enabled key is missing, whether none exists or all are disabled", () => {
  assert.equal(modelKeyFromReply(reply()), "missing");
  assert.equal(modelKeyFromReply(reply({ kind: "llm", enabled: false })), "missing");
});

test("an enabled key that says nothing about being unlocked is ready", () => {
  assert.equal(modelKeyFromReply(reply({ kind: "llm", enabled: true })), "ready");
  assert.equal(modelKeyFromReply(reply({ kind: "llm", enabled: true, unlocked: true })), "ready");
});

test("locked only when every enabled key is locked; one usable key is ready", () => {
  assert.equal(modelKeyFromReply(reply({ enabled: true, unlocked: false, lockedBecause: "signed_out" })), "locked");
  assert.equal(modelKeyFromReply(reply({ enabled: true, unlocked: false }, { enabled: true, unlocked: true })), "ready");
  assert.equal(modelKeyFromReply(reply({ enabled: true, unlocked: false }, { enabled: false })), "locked", "a disabled key does not count");
});

test("a failed read, a reply with no list and a malformed one are unknown, never missing", () => {
  assert.equal(modelKeyFromReply({ ok: false, sentence: "nope" }), "unknown");
  assert.equal(modelKeyFromReply({ ok: true, value: { ok: true, payload: {} } }), "unknown");
  assert.equal(modelKeyFromReply({ ok: true, value: { ok: true, payload: { keys: "x" } } }), "unknown");
  assert.equal(modelKeyFromReply({ ok: true, value: undefined }), "unknown");
});
