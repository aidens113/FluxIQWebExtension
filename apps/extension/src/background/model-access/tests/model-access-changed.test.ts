import assert from "node:assert/strict";
import test from "node:test";

import { modelAccessChangedFor } from "../model-access-changed";

const state = { status: "ready", message: "Your model key works.", key: { id: "secret:private-id", name: "Mine", provider: "anthropic", model: "claude-sonnet-4-5" }, lastCall: null };

test("a pushed model-access state becomes a panel message without the key id", () => {
  const message = modelAccessChangedFor({ modelAccess: state }, 7);
  assert.deepEqual(message, { type: "fluxiq.panel.modelAccessChanged", modelAccess: { ...state, key: { name: "Mine", provider: "anthropic", model: "claude-sonnet-4-5" } }, at: 7 });
  assert.doesNotMatch(JSON.stringify(message), /private-id/u);
});

test("a malformed push is dropped", () => {
  for (const payload of [null, "x", {}, { modelAccess: null }, { modelAccess: { status: "future" } }, { modelAccess: { status: "ready" } }]) {
    assert.equal(modelAccessChangedFor(payload, 1), undefined, JSON.stringify(payload));
  }
});
