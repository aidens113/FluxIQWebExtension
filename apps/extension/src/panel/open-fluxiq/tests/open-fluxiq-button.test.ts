import assert from "node:assert/strict";
import test from "node:test";
import { defaultSettings } from "../../../shared/browser";
import { RUNTIME_MESSAGES } from "../../../shared/constants";
import { fake, withFakeDocument } from "../../chat/tests/fake-dom";
import type { PanelResult, PanelStore } from "../../state";
import { statusWith } from "../../tests/status-fixture";
import { createOpenFluxIQButton } from "../open-fluxiq-button";

const state = (coreApiUrl: string) => statusWith({ settings: { ...defaultSettings(), coreApiUrl } });
function deferred() {
  let resolve!: (value: PanelResult<unknown>) => void;
  return { promise: new Promise<PanelResult<unknown>>((yes) => { resolve = yes; }), resolve };
}
async function flush() { for (let i = 0; i < 6; i++) await Promise.resolve(); }

test("late refusal does not install feedback for an already replaced address", async () => {
  await withFakeDocument(async () => {
    const pending = deferred();
    const view = createOpenFluxIQButton((() => pending.promise) as PanelStore["request"], { label: "Open FluxIQ", look: "small" });
    const root = fake(view.element), button = root.children[0]!, notice = root.children[1]!;
    view.observe(state("http://first.invalid")); button.dispatch("click");
    view.observe(state("http://second.invalid")); pending.resolve({ ok: false, sentence: "Synthetic refused", detail: "Synthetic detail" }); await flush();
    assert.equal(notice.hidden, true); assert.equal(button.disabled, false);
  });
});

test("same-address refusal survives passive updates and clears on retry or address change", async () => {
  await withFakeDocument(async () => {
    let calls = 0;
    const request = (async () => ++calls === 1 ? { ok: false, sentence: "Synthetic refused", detail: "Synthetic detail" } : { ok: true, value: {} }) as PanelStore["request"];
    const view = createOpenFluxIQButton(request, { label: "Open FluxIQ", look: "primary" });
    const root = fake(view.element), button = root.children[0]!, notice = root.children[1]!;
    view.observe(state("http://first.invalid")); button.dispatch("click"); await flush();
    assert.equal(notice.hidden, false); assert.equal(notice.title, "Synthetic detail");
    view.observe(state("http://first.invalid")); assert.equal(notice.hidden, false);
    button.dispatch("click"); await flush(); assert.equal(notice.hidden, true); assert.equal(calls, 2);
  });
});

test("pending acknowledgement rejects repeated activation while retaining the exact message", async () => {
  await withFakeDocument(async () => {
    const pending = deferred(); const messages: string[] = [];
    const request = ((message: { type: string }) => { messages.push(message.type); return pending.promise; }) as PanelStore["request"];
    const view = createOpenFluxIQButton(request, { label: "Open FluxIQ", look: "link" });
    const button = fake(view.element).children[0]!;
    button.dispatch("click"); button.dispatch("click");
    assert.deepEqual(messages, [RUNTIME_MESSAGES.panelOpenFluxIQ]); assert.equal(button.disabled, true);
    pending.resolve({ ok: true, value: {} }); await flush(); assert.equal(button.disabled, false);
  });
});

test("defensive unexpected rejection gives fixed feedback and usable retry", async () => {
  await withFakeDocument(async () => {
    let calls = 0;
    const request = (async () => { if (++calls === 1) throw new Error("synthetic-private-error"); return { ok: true, value: {} }; }) as PanelStore["request"];
    const view = createOpenFluxIQButton(request, { label: "Open FluxIQ", look: "small" });
    const root = fake(view.element), button = root.children[0]!, notice = root.children[1]!;
    button.dispatch("click"); await flush(); assert.equal(button.disabled, false); assert.equal(notice.hidden, false);
    assert.equal(notice.textContent.includes("synthetic-private-error"), false); assert.equal(notice.title.includes("synthetic-private-error"), false);
    button.dispatch("click"); await flush(); assert.equal(calls, 2); assert.equal(notice.hidden, true);
  });
});

test("a later address change clears real failure and preserves icon naming", async () => {
  await withFakeDocument(async () => {
    const view = createOpenFluxIQButton((async () => ({ ok: false, sentence: "Synthetic refused" })) as PanelStore["request"], { label: "Open FluxIQ", look: "icon" });
    const root = fake(view.element), button = root.children[0]!, notice = root.children[1]!;
    assert.equal(button.getAttribute("aria-label"), "Open FluxIQ"); assert.equal(button.getAttribute("title"), "Open FluxIQ");
    view.observe(state("http://first.invalid")); button.dispatch("click"); await flush(); assert.equal(notice.hidden, false);
    view.observe(state("http://second.invalid")); assert.equal(notice.hidden, true);
  });
});

test("optional current-control predicate refuses retired dispatch and preserves standalone activation", async () => withFakeDocument(async () => {
  let current = true, calls = 0;
  const style = { label: "Open FluxIQ", look: "small" as const, canOpen: () => current };
  const view = createOpenFluxIQButton((async () => { calls++; return { ok: true, value: {} }; }) as PanelStore["request"], style);
  const button = fake(view.element).children[0]!;
  current = false; button.dispatch("click"); await flush(); assert.equal(calls, 0); assert.equal(button.disabled, false);
  current = true; button.dispatch("click"); await flush(); assert.equal(calls, 1);
}));
