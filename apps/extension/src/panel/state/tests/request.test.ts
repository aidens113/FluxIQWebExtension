// panelRequest keeps Core's refusal code as `coreCode`, apart from the relay's `code`.

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { panelRequest } from "../request";

function replyWith(t: TestContext, reply: unknown): void {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "chrome");
  const runtime = { lastError: undefined, sendMessage: (_message: unknown, respond: (answer: unknown) => void) => respond(reply) };
  Object.defineProperty(globalThis, "chrome", { configurable: true, value: { runtime } });
  t.after(() => { if (previous) Object.defineProperty(globalThis, "chrome", previous); else Reflect.deleteProperty(globalThis, "chrome"); });
}

const SENTENCE = "This conversation is still being used by work that is running.";

test("a Core refusal reaches the result with its code and Core's sentence, and the relay code stays failed", async (t) => {
  replyWith(t, { ok: false, code: "failed", coreCode: "conversation_run_active", error: SENTENCE });
  const result = await panelRequest({ type: "x" });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.coreCode, "conversation_run_active");
    assert.equal(result.code, "failed");
    assert.equal(result.detail, SENTENCE);
  }
});

test("an oversized or malformed core code is dropped", async (t) => {
  replyWith(t, { ok: false, code: "failed", coreCode: `x${"y".repeat(80)}`, error: SENTENCE });
  const long = await panelRequest({ type: "x" });
  assert.ok(!long.ok && long.coreCode === undefined);
  replyWith(t, { ok: false, code: "failed", coreCode: "Bearer abc def", error: SENTENCE });
  const spaced = await panelRequest({ type: "x" });
  assert.ok(!spaced.ok && spaced.coreCode === undefined);
});

test("an authority error behaves as before and carries no coreCode", async (t) => {
  replyWith(t, { ok: false, code: "failed", diagnosticCode: "automation.instructions_required", error: "x" });
  assert.deepEqual(await panelRequest({ type: "x" }), { ok: false, code: "automation.instructions_required", sentence: "Author task instructions in FluxIQ before this automation can run or resume." });
});
