// A read's rows, declared to Core as `read.<member>` (`../read-rows-keys.ts`, t194 w48).

import assert from "node:assert/strict";
import test from "node:test";
import { WEB_LLM_DENIED_EVIDENCE_KEYS } from "../../denied-keys";
import { WEB_LLM_OBSERVED_STATE_KEYS } from "../observed-state-keys";
import { WEB_LLM_READ_ROWS_KEYS } from "../read-rows-keys";
import { WEB_LLM_VIEW_KEYS } from "../view-keys";
import { createWebAutomationLlmEvidenceRuntime } from "../../tools";

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

// fix-judges group 2, R3-3: a repair compares a rerun of the read a judged test
// blamed with the rows Core's check named, and only the domain knows which
// member of a live read's answer is its kept rows rather than its rejected ones.
// Undeclared, only replays (which carry Core's own `readRows`) were compared,
// not the live rerun `run-mux6naez-6c20f26e` made.
test("declares a live read's kept rows to Core as readRowsKey, one of the read's row keys", () => {
  const runtime = createWebAutomationLlmEvidenceRuntime({ eligibleSessionIds: () => [], executeAction: async () => ({ status: "succeeded" }) });
  assert.equal(runtime.readRowsKey, "read.extracted");
  assert.ok(WEB_LLM_READ_ROWS_KEYS.includes(runtime.readRowsKey));
  assert.match(runtime.readRowsKey, CORE_KEY);
});
