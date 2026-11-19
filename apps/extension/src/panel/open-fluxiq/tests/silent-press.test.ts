// A host presses Open FluxIQ itself (the key card's actions): a silent button draws no button, `press` opens, and
// only a failure shows.

import assert from "node:assert/strict";
import test from "node:test";
import { RUNTIME_MESSAGES } from "../../../shared/constants";
import { fake, withFakeDocument } from "../../chat/tests/fake-dom";
import type { PanelStore } from "../../state";
import { createOpenFluxIQButton } from "../open-fluxiq-button";

async function flush() {
  for (let i = 0; i < 6; i++) await Promise.resolve();
}

test("press opens the keys page as the button does, with no button drawn", async () => {
  await withFakeDocument(async () => {
    const sent: Record<string, unknown>[] = [];
    const request = (async (message: Record<string, unknown>) => {
      sent.push(message);
      return { ok: true, value: {} };
    }) as unknown as PanelStore["request"];
    const control = createOpenFluxIQButton(request, { label: "Open FluxIQ", look: "silent", purpose: "model-key" });
    assert.equal(fake(control.element).children[0]!.hidden, true);
    control.press();
    await flush();
    assert.deepEqual(sent, [{ type: RUNTIME_MESSAGES.panelOpenFluxIQ, purpose: "model-key" }]);
  });
});

test("a failed press shows the failure line, and the control stays usable", async () => {
  await withFakeDocument(async () => {
    const request = (async () => ({ ok: false, sentence: "no", detail: "refused" })) as unknown as PanelStore["request"];
    const control = createOpenFluxIQButton(request, { label: "Open FluxIQ", look: "silent", purpose: "model-key" });
    control.press();
    await flush();
    const notice = fake(control.element).children[1]!;
    assert.equal(notice.hidden, false);
    assert.match(notice.textContent, /Couldn't open FluxIQ/u);
    assert.equal(fake(control.element).children[0]!.disabled, false);
  });
});
