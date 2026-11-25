// The page keys this domain declares to Core (`../observed-state-keys.ts`).

import assert from "node:assert/strict";
import test from "node:test";
import { WEB_LLM_DENIED_EVIDENCE_KEYS } from "../../denied-keys";
import { WEB_LLM_OBSERVED_STATE_KEYS } from "../observed-state-keys";

test("names the element packet's view members, and nothing a step said", () => {
  assert.deepEqual([...WEB_LLM_OBSERVED_STATE_KEYS], ["elements", "dialogs", "blockedBy", "pageView", "judgeState"]);
  for (const kept of ["location", "ok", "status", "pageChanged", "control", "read", "detail", "inFlow"]) {
    assert.equal(WEB_LLM_OBSERVED_STATE_KEYS.includes(kept), false, kept);
  }
});

test("declares the keyed page view, which Core's judge and build tests read as the page, and not the old page string", () => {
  // Core's window delivers `pageView` through its page channel and takes it out of this group there; its other
  // readers (the judge's start and end views, a build test's step observation) find the page only by this key
  // (t1036 Lab run `run-mwvsbihx-e60f9f0f`, `judge_evidence.before_state_missing`).
  assert.equal(WEB_LLM_OBSERVED_STATE_KEYS.includes("pageView"), true);
  assert.equal(WEB_LLM_OBSERVED_STATE_KEYS.includes("page"), false);
});

test("is a list Core accepts: plain property names, none of them denied, at most 32", () => {
  assert.ok(WEB_LLM_OBSERVED_STATE_KEYS.length <= 32);
  for (const key of WEB_LLM_OBSERVED_STATE_KEYS) {
    assert.match(key, /^[A-Za-z_][A-Za-z0-9_]{0,63}$/u);
    assert.equal(WEB_LLM_DENIED_EVIDENCE_KEYS.includes(key), false, key);
  }
  assert.ok(Object.isFrozen(WEB_LLM_OBSERVED_STATE_KEYS));
});
