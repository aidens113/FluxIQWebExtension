import assert from "node:assert/strict";
import test from "node:test";
import { approvedClientModelReadiness } from "../readiness.js";

const reply = (...keys: unknown[]) => ({ ok: true, payload: { keys } });
const llm = { kind: "llm", enabled: true };

test("readiness is metadata, with absent legacy status and explicit old refusal handled distinctly", () => {
  assert.equal(approvedClientModelReadiness(reply()), "missing");
  assert.equal(approvedClientModelReadiness(reply(llm)), "available");
  assert.equal(approvedClientModelReadiness(reply({ ...llm, unlocked: false })), "unavailable:upgrade_required");
  for (const code of ["legacy_recovery_required", "host_protection_unavailable", "ciphertext_invalid"]) {
    assert.equal(approvedClientModelReadiness(reply({ ...llm, availability: { state: "unavailable", code } })), `unavailable:${code}`);
  }
  assert.equal(approvedClientModelReadiness(reply({ ...llm, availability: { state: "available" }, unlocked: false })), "available");
});

test("unsupported/custom secrets never establish readiness and failed reads stay unknown", () => {
  for (const key of [{ ...llm, kind: "custom" }, { ...llm, provider: "other" }, { ...llm, provider: "" }, { ...llm, enabled: false }, { ...llm, heldByYou: false, availability: { state: "available" } }, { ...llm, heldByYou: false, availability: null }]) {
    assert.equal(approvedClientModelReadiness(reply(key)), "missing");
  }
  for (const provider of ["Deep-Seek", "Anthropic Claude"]) assert.equal(approvedClientModelReadiness(reply({ ...llm, provider })), "available");
  for (const value of [undefined, { ok: false }, { ok: false, payload: { keys: [llm] } }, { ok: true, payload: {} }, reply({ ...llm, availability: null }), reply({ ...llm, availability: { state: "unavailable", code: "new" } })]) {
    assert.equal(approvedClientModelReadiness(value), "unknown");
  }
});
