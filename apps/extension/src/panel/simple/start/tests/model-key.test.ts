// The model key state, read from the modelReadiness relay's reply.

import assert from "node:assert/strict";
import test from "node:test";
import { modelKeyFromReply } from "../model-key";

test("an extension without the relay: unknown, not missing", () => {
  assert.equal(modelKeyFromReply({ ok: false, sentence: "x", unsupported: true }), "unknown");
});

test("an enabled LLM key: present", () => {
  assert.equal(modelKeyFromReply({ ok: true, value: { ok: true, payload: { keys: [{ kind: "llm", provider: "openai", enabled: true }] } } }), "present");
});

test("only custom or disabled keys: missing", () => {
  const keys = [{ kind: "custom", enabled: true }, { kind: "llm", enabled: false }];
  assert.equal(modelKeyFromReply({ ok: true, value: { ok: true, payload: { keys } } }), "missing");
});

test("a reply without a key list: unknown", () => {
  assert.equal(modelKeyFromReply({ ok: true, value: { ok: true, payload: {} } }), "unknown");
});
