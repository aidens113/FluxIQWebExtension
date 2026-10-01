// The page keys this domain declares to Core (`../observed-state-keys.ts`).

import assert from "node:assert/strict";
import test from "node:test";
import { WEB_LLM_DENIED_EVIDENCE_KEYS } from "../../denied-keys";
import { WEB_LLM_OBSERVED_STATE_KEYS } from "../observed-state-keys";

test("names the page in both of its forms, and nothing a step said", () => {
  assert.deepEqual([...WEB_LLM_OBSERVED_STATE_KEYS], ["elements", "dialogs", "blockedBy", "page"]);
  for (const kept of ["location", "ok", "status", "pageChanged", "control", "read", "detail", "inFlow"]) {
    assert.equal(WEB_LLM_OBSERVED_STATE_KEYS.includes(kept), false, kept);
  }
});

test("is a list Core accepts: plain property names, none of them denied, at most 32", () => {
  assert.ok(WEB_LLM_OBSERVED_STATE_KEYS.length <= 32);
  for (const key of WEB_LLM_OBSERVED_STATE_KEYS) {
    assert.match(key, /^[A-Za-z_][A-Za-z0-9_]{0,63}$/u);
    assert.equal(WEB_LLM_DENIED_EVIDENCE_KEYS.includes(key), false, key);
  }
  assert.ok(Object.isFrozen(WEB_LLM_OBSERVED_STATE_KEYS));
});
