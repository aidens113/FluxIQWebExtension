import assert from "node:assert/strict";
import test from "node:test";
import { RUNTIME_MESSAGES } from "../../../shared/constants";
import { fake, withFakeDocument } from "../../chat/tests/fake-dom";
import type { PanelStore } from "../../state";
import { createOpenFluxIQButton } from "../open-fluxiq-button";

async function flush() {
  for (let i = 0; i < 6; i++) await Promise.resolve();
}

async function pressed(style: { purpose?: "model-key" | "ask" }): Promise<Record<string, unknown>[]> {
  const sent: Record<string, unknown>[] = [];
  const request = (async (message: Record<string, unknown>) => {
    sent.push(message);
    return { ok: true, value: {} };
  }) as unknown as PanelStore["request"];
  await withFakeDocument(async () => {
    const view = createOpenFluxIQButton(request, { label: "Open FluxIQ", look: "small", ...style });
    fake(view.element).children[0]!.dispatch("click");
    await flush();
  });
  return sent;
}

test("a button made for a model key asks the background for the keys page", async () => {
  assert.deepEqual(await pressed({ purpose: "model-key" }), [{ type: RUNTIME_MESSAGES.panelOpenFluxIQ, purpose: "model-key" }]);
});

test("a button for a question, or with no purpose, sends the plain open", async () => {
  assert.deepEqual(await pressed({ purpose: "ask" }), [{ type: RUNTIME_MESSAGES.panelOpenFluxIQ }]);
  assert.deepEqual(await pressed({}), [{ type: RUNTIME_MESSAGES.panelOpenFluxIQ }]);
});
