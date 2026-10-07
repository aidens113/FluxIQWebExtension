import assert from "node:assert/strict";
import test from "node:test";
import { waitForCondition } from "../wait-conditions";

test("text waits reject missing, empty and whitespace predicates without polling", async () => {
  Object.defineProperty(globalThis, "document", { configurable: true, value: { body: { innerText: "literal null is present" } } });
  try {
    for (const condition of ["present", "visible", "absent"] as const) {
      for (const text of [undefined, "", " \t "]) {
        await assert.rejects(waitForCondition({ condition, text, timeoutMs: 5_000 }), /needs a selector or text/u);
      }
    }
    assert.equal((await waitForCondition({ condition: "present", text: "null", timeoutMs: 0 })).ok, true);
    assert.equal((await waitForCondition({ condition: "absent", text: "gone", timeoutMs: 0 })).ok, true);
  } finally { delete (globalThis as { document?: unknown }).document; }
});
