import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { RUNTIME_MESSAGES } from "../../../shared/constants";
import { fake, withFakeDocument } from "../../chat/tests/fake-dom";
import type { PanelContext } from "../../shell";
import { panelRequest, type PanelStore } from "../../state";
import { statusWith } from "../../tests/status-fixture";
import { createSetupCard } from "../setup-card";
import { startGuide } from "../start";

function setupStore(t: TestContext, calls: unknown[] = []): PanelStore {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "chrome");
  const runtime = { lastError: undefined, sendMessage: (message: unknown, respond: (answer: unknown) => void) => {
    calls.push(message);
    respond({ ok: true });
  } };
  Object.defineProperty(globalThis, "chrome", { configurable: true, value: { runtime } });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, "chrome", previous);
    else Reflect.deleteProperty(globalThis, "chrome");
  });
  return { current: () => undefined, subscribe: () => () => {}, request: panelRequest };
}

test("configuration reminder leaves connected work usable and opens ordinary settings", async (t) => {
  await withFakeDocument(async () => {
    const calls: unknown[] = [];
    const store = setupStore(t, calls);
    const card = createSetupCard({ store, surface: "popup" } as PanelContext);
    const status = statusWith({ connectionState: "connected", paired: true });
    const guide = startGuide(status, false, undefined, "missing");
    card.render(guide, status);
    const root = fake(card.element);
    assert.equal(guide.gated, false);
    assert.equal(root.hidden, false);
    assert.equal(root.getAttribute("aria-label"), "Model configuration");
    assert.match(root.textContent, /Saved Flows.*can still run/u);
    root.descendants().find((node) => node.tagName === "BUTTON" && node.textContent === "Open FluxIQ")!.dispatch("click");
    await Promise.resolve();
    assert.deepEqual(calls, [{ type: RUNTIME_MESSAGES.panelOpenFluxIQ, purpose: "model-key" }]);
    root.descendants().find((node) => node.tagName === "BUTTON" && node.textContent === "Not now")!.dispatch("click");
    assert.equal(root.hidden, true);
  });
});

test("unavailable configuration shows its cause and clears after a fresh available reading", async (t) => {
  await withFakeDocument(async () => {
    const store = setupStore(t);
    const card = createSetupCard({ store, surface: "sidepanel" } as PanelContext);
    const status = statusWith({ connectionState: "connected", paired: true });
    card.render(startGuide(status, false, undefined, { state: "unavailable", code: "host_protection_unavailable" }), status);
    const root = fake(card.element);
    assert.equal(root.hidden, false);
    assert.match(root.textContent, /host operator/u);
    assert.match(root.textContent, /connected and approved/u);
    assert.doesNotMatch(root.textContent, /unlock|password/iu);
    card.render(startGuide(status, false, undefined, "ready"), status);
    assert.equal(root.hidden, true);
  });
});
