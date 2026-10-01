import assert from "node:assert/strict";
import test from "node:test";
import { fake, withFakeDocument } from "../../tests/fake-dom";
import { createComposer } from "../composer";
import type { ConversationState } from "../controller";

const ready: ConversationState = { mode: "thread", turns: [], reading: false, sending: false, answering: new Set(), answerErrors: new Map() };

for (const scenario of ["unchanged", "edited", "retyped", "filled", "failed", "composition"] as const) {
  test(`composer pending send preserves the correct draft: ${scenario}`, async () => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key)
    } });
    try {
      await withFakeDocument(async () => {
        let finish!: (sent: boolean) => void;
        const calls: string[] = [];
        const composer = createComposer((text) => { calls.push(text); return new Promise((resolve) => { finish = resolve; }); });
        composer.render(ready);
        const root = fake(composer.element);
        const box = root.descendants().find((node) => node.id === "conversationInput")!;
        const send = root.descendants().find((node) => node.id === "conversationSendButton")!;
        composer.fill("submitted");
        if (scenario === "composition") {
          box.dispatch("compositionstart");
          box.dispatch("keydown", { key: "Enter", preventDefault: () => assert.fail("IME Enter must not submit") });
          assert.equal(calls.length, 0);
          box.dispatch("compositionend");
        }
        send.dispatch("click");
        composer.render({ ...ready, sending: true });
        assert.equal(box.disabled, false);
        if (scenario === "edited" || scenario === "composition") { box.value = "newer words"; box.dispatch("input"); }
        if (scenario === "retyped") {
          box.value = "changed"; box.dispatch("input");
          box.value = "submitted"; box.dispatch("input");
        }
        if (scenario === "filled") composer.fill("example for later");
        finish(scenario !== "failed");
        await Promise.resolve();
        composer.render({ ...ready, ...(scenario === "failed" ? { sendError: "Try again" } : {}) });
        const expected = scenario === "unchanged" ? "" : scenario === "edited" || scenario === "composition" ? "newer words" : scenario === "filled" ? "example for later" : "submitted";
        assert.equal(box.value, expected);
        assert.equal(values.get("fluxiq.ui.conversationDraft") ?? "", expected);
        assert.deepEqual(calls, ["submitted"], "typing/fill/composition never sends automatically");
        assert.equal(send.disabled, expected === "");
        if (scenario === "failed") assert.equal(root.byClass("notice")[0]!.hidden, false);
      });
    } finally {
      if (previous) Object.defineProperty(globalThis, "localStorage", previous);
      else Reflect.deleteProperty(globalThis, "localStorage");
    }
  });
}
