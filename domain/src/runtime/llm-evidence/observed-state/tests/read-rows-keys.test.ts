// A read's rows, declared to Core as `read.<member>` (`../read-rows-keys.ts`, t194 w48).

import assert from "node:assert/strict";
import test from "node:test";
import { WEB_LLM_DENIED_EVIDENCE_KEYS } from "../../denied-keys";
import { WEB_LLM_OBSERVED_STATE_KEYS } from "../observed-state-keys";
import { WEB_LLM_READ_ROWS_KEYS } from "../read-rows-keys";
import { WEB_LLM_VIEW_KEYS } from "../view-keys";

/** Core's rule for a declared key (`AS/runtime/llm/harness-options/registry.ts`): a property name, or one member of one. */
const CORE_KEY = /^[A-Za-z_][A-Za-z0-9_]{0,63}(?:\.[A-Za-z_][A-Za-z0-9_]{0,63})?$/u;

test("names a read's kept rows, its rejected rows and their note, each inside the read", () => {
  assert.deepEqual([...WEB_LLM_READ_ROWS_KEYS], ["read.extracted", "read.rejectedRows", "read.rejectedRowsNote"]);
  // What stays of a replaced read is its account: counts, pages, the first rows, where the rest are.
  for (const kept of ["read.extraction", "read.validation", "read.firstRows", "read.restOfRows", "read.origin", "read", "extracted"]) {
    assert.equal(WEB_LLM_READ_ROWS_KEYS.includes(kept), false, kept);
  }
});

test("is declared with the page as one list Core accepts", () => {
  assert.deepEqual([...WEB_LLM_VIEW_KEYS], [...WEB_LLM_OBSERVED_STATE_KEYS, ...WEB_LLM_READ_ROWS_KEYS]);
  assert.ok(WEB_LLM_VIEW_KEYS.length <= 32);
  for (const key of WEB_LLM_VIEW_KEYS) {
    assert.match(key, CORE_KEY);
    for (const part of key.split(".")) assert.equal(WEB_LLM_DENIED_EVIDENCE_KEYS.includes(part), false, key);
  }
  assert.ok(Object.isFrozen(WEB_LLM_VIEW_KEYS) && Object.isFrozen(WEB_LLM_READ_ROWS_KEYS));
});
