import assert from "node:assert/strict";
import test from "node:test";
import { WEB_AUTOMATION_FAILURE_CODES, webAutomationFailureRecord } from "@fluxiq-web-extension/domain/client";
import { waitForCondition } from "../wait-conditions";

// A blank text wait is a malformed command, refused at once and for good, as a
// blank text assert is (`blankTextRefusal`, one rule for both). It used to throw
// a bare Error, which the failure path classifies as ACTION_FAILED -- retryable
// -- so the same blank wait ran three more times, 2.3-2.6 s against a 2 s
// bound, while the blank assert was refused on its first attempt. The throw now
// carries the assert's closed record: STATE_MISMATCH, not retryable, with the
// same `expected` and the wait's own `actual`.
test("text waits refuse missing, empty and whitespace predicates at once, with the blank assert's non-retryable record", async () => {
  Object.defineProperty(globalThis, "document", { configurable: true, value: { body: { innerText: "literal null is present" } } });
  try {
    for (const condition of ["present", "visible", "absent"] as const) {
      for (const text of [undefined, "", " \t "]) {
        const started = Date.now();
        await assert.rejects(waitForCondition({ condition, text, timeoutMs: 5_000 }), (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.match(error.message, /needs a selector or text/u);
          assert.deepEqual((error as { failure?: unknown }).failure, webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.STATE_MISMATCH, {
            expected: "a nonblank text expectation",
            actual: "the wait named no meaningful text"
          }));
          assert.equal((error as unknown as { failure: { retryable: boolean } }).failure.retryable, false);
          return true;
        }, `${condition} ${JSON.stringify(text)}`);
        assert.ok(Date.now() - started < 1_000, "a malformed wait must not poll");
      }
    }
    assert.equal((await waitForCondition({ condition: "present", text: "null", timeoutMs: 0 })).ok, true);
    assert.equal((await waitForCondition({ condition: "absent", text: "gone", timeoutMs: 0 })).ok, true);
  } finally { delete (globalThis as { document?: unknown }).document; }
});
