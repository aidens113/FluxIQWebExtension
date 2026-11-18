// The model key reading from the background's readiness reply: every state, and every way a read can fail.

import assert from "node:assert/strict";
import test from "node:test";
import type { PanelResult } from "../../../../state";
import { modelKeyFromReply } from "../from-reply";

const reply = (...keys: unknown[]): PanelResult<unknown> => ({ ok: true, value: { ok: true, payload: { keys } } });

test("no supported enabled model key is missing", () => {
  assert.equal(modelKeyFromReply(reply()), "missing");
  assert.equal(modelKeyFromReply(reply({ kind: "llm", enabled: false })), "missing");
  for (const key of [{ kind: "custom", enabled: true }, ...["unsupported", "", null, 42].map((provider) => ({ kind: "llm", provider, enabled: true })), { enabled: true }]) {
    assert.equal(modelKeyFromReply(reply(key)), "missing");
  }
});

test("supported enabled keys without availability retain legacy readiness", () => {
  assert.equal(modelKeyFromReply(reply({ kind: "llm", enabled: true })), "ready");
  assert.equal(modelKeyFromReply(reply({ kind: "llm", enabled: true, unlocked: true })), "ready");
  for (const provider of ["deepseek", "Deep-Seek", "anthropic", "Anthropic Claude"]) {
    assert.equal(modelKeyFromReply(reply({ kind: "llm", provider, enabled: true })), "ready", provider);
  }
});

test("foreign keys visible to an administrator do not establish personal model readiness", () => {
  for (const availability of [{ state: "available" }, { state: "unavailable", code: "ciphertext_invalid" }, null]) {
    assert.equal(modelKeyFromReply(reply({ kind: "llm", enabled: true, heldByYou: false, availability })), "missing");
    assert.equal(modelKeyFromReply(reply({ kind: "llm", enabled: true, heldByYou: false, availability }, { kind: "llm", enabled: true, heldByYou: true })), "ready");
  }
});

test("availability preserves each unavailable cause and explicit available metadata", () => {
  for (const code of ["legacy_recovery_required", "host_protection_unavailable", "ciphertext_invalid"] as const) {
    const availability = { state: "unavailable", code } as const;
    assert.deepEqual(modelKeyFromReply(reply({ kind: "llm", enabled: true, availability })), availability);
    assert.deepEqual(modelKeyFromReply(reply({ kind: "llm", enabled: true, availability }, { kind: "custom", enabled: true })), availability);
  }
  assert.equal(modelKeyFromReply(reply({ kind: "llm", enabled: true, availability: { state: "available" }, unlocked: false })), "ready", "current metadata takes precedence over legacy flags");
});

test("legacy false requires an upgrade and never invents a recovery cause or password step", () => {
  const old = { kind: "llm", enabled: true, unlocked: false, lockedBecause: "signed_out" };
  assert.equal(modelKeyFromReply(reply(old)), "upgrade_required");
  assert.equal(modelKeyFromReply(reply(old, { kind: "llm", enabled: false })), "upgrade_required");
  assert.equal(modelKeyFromReply(reply(old, { kind: "llm", enabled: true })), "ready");
});

test("malformed explicit availability is unknown, not compatible legacy readiness", () => {
  for (const availability of [null, "available", {}, { state: "available", code: "other" }, { state: "unavailable", code: "new_server_code" }]) {
    assert.equal(modelKeyFromReply(reply({ kind: "llm", enabled: true, availability, unlocked: true })), "unknown");
  }
  assert.equal(modelKeyFromReply(reply({ kind: "llm", enabled: true, availability: null }, { kind: "llm", enabled: true, availability: { state: "unavailable", code: "ciphertext_invalid" } })), "unknown");
  assert.equal(modelKeyFromReply(reply({ kind: "llm", enabled: true, availability: null }, { kind: "llm", enabled: true, availability: { state: "available" } })), "ready");
});

test("a failed read, a reply with no list and a malformed one are unknown, never missing", () => {
  assert.equal(modelKeyFromReply({ ok: false, sentence: "nope" }), "unknown");
  assert.equal(modelKeyFromReply({ ok: true, value: { ok: true, payload: {} } }), "unknown");
  assert.equal(modelKeyFromReply({ ok: true, value: { ok: true, payload: { keys: "x" } } }), "unknown");
  assert.equal(modelKeyFromReply({ ok: true, value: undefined }), "unknown");
});
