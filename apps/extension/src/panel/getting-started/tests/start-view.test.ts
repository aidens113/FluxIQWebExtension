import assert from "node:assert/strict";
import test from "node:test";
import { RUNTIME_MESSAGES } from "../../../shared/constants";
import type { ExtensionStatus } from "../../../shared/protocol";
import { fake, withFakeDocument } from "../../chat/tests/fake-dom";
import type { PanelContext } from "../../shell";
import type { PanelResult, PanelStore } from "../../state";
import { statusWith } from "../../tests/status-fixture";
import { startGuide } from "../start-steps";
import { createStartView } from "../start-view";

function pendingRequest() {
  let resolve!: (value: PanelResult<unknown>) => void;
  let reject!: (reason: unknown) => void;
  return { promise: new Promise<PanelResult<unknown>>((yes, no) => { resolve = yes; reject = no; }), resolve, reject };
}
async function flush() { for (let i = 0; i < 6; i++) await Promise.resolve(); }

for (const action of ["connect", "disconnect"] as const) {
  test(`late ${action} refusal does not contradict an already observed goal`, async () => {
    await withFakeDocument(async () => {
      const pending = pendingRequest();
      let status = statusWith({ connectionState: action === "connect" ? "disconnected" : "connecting" });
      const calls: string[] = [];
      const store = { current: () => status, subscribe: () => () => undefined, request: async (message: { type: string }) => { calls.push(message.type); return pending.promise; } } as PanelStore;
      const view = createStartView({ store, surface: "popup" } as PanelContext, () => undefined);
      view.render(startGuide(status, false), status);
      const root = fake(view.element), connect = root.descendants().find((node) => node.id === "connectButton")!;
      connect.dispatch("click");
      assert.equal(connect.disabled, true);
      status = statusWith({ connectionState: action === "connect" ? "connected" : "disconnected", paired: true });
      view.render(startGuide(status, false), status);
      assert.equal(connect.disabled, true);
      pending.resolve({ ok: false, sentence: "Synthetic operation refused" }); await flush();
      assert.equal(root.byClass("notice").at(-1)!.hidden, true);
      assert.equal(connect.disabled, false);
      assert.deepEqual(calls, [action === "connect" ? RUNTIME_MESSAGES.connect : RUNTIME_MESSAGES.disconnect]);
    });
  });
}

test("unmet goal retains refusal until retry or a later matching status", async () => {
  await withFakeDocument(async () => {
    let status: ExtensionStatus = statusWith();
    let calls = 0;
    const store = { current: () => status, subscribe: () => () => undefined, request: async () => { calls++; return { ok: false, sentence: "Synthetic operation refused" }; } } as PanelStore;
    const view = createStartView({ store, surface: "sidepanel" } as PanelContext, () => undefined);
    view.render(startGuide(status, false), status);
    const root = fake(view.element), connect = root.descendants().find((node) => node.id === "connectButton")!, notice = root.byClass("notice").at(-1)!;
    connect.dispatch("click"); await flush(); assert.equal(notice.hidden, false); assert.equal(notice.textContent, "Synthetic operation refused");
    view.render(startGuide(status, false), status); assert.equal(notice.hidden, false);
    connect.dispatch("click"); await flush(); assert.equal(calls, 2);
    status = statusWith({ connectionState: "connected", paired: true }); view.render(startGuide(status, false), status);
    assert.equal(notice.hidden, true);
  });
});

test("pending acknowledgement guards repeated activation across status redraw", async () => {
  await withFakeDocument(async () => {
    const pending = pendingRequest(), status = statusWith(); let calls = 0;
    const store = { current: () => status, subscribe: () => () => undefined, request: async () => { calls++; return pending.promise; } } as PanelStore;
    const view = createStartView({ store, surface: "popup" } as PanelContext, () => undefined);
    view.render(startGuide(status, false), status);
    const connect = fake(view.element).descendants().find((node) => node.id === "connectButton")!;
    connect.dispatch("click"); view.render(startGuide(status, false), status); connect.dispatch("click");
    assert.equal(calls, 1); pending.resolve({ ok: true, value: {} }); await flush(); assert.equal(connect.disabled, false);
  });
});

test("unexpected rejection releases controls with fixed retry feedback", async () => {
  await withFakeDocument(async () => {
    const status = statusWith(); let calls = 0;
    const store = { current: () => status, subscribe: () => () => undefined, request: async () => { if (++calls === 1) throw new Error("synthetic-private-detail"); return { ok: true, value: {} }; } } as PanelStore;
    const view = createStartView({ store, surface: "popup" } as PanelContext, () => undefined);
    view.render(startGuide(status, false), status);
    const root = fake(view.element), connect = root.descendants().find((node) => node.id === "connectButton")!, notice = root.byClass("notice").at(-1)!;
    connect.dispatch("click"); await flush(); assert.equal(connect.disabled, false); assert.equal(notice.hidden, false);
    assert.equal(notice.textContent.includes("synthetic-private-detail"), false);
    connect.dispatch("click"); await flush(); assert.equal(calls, 2); assert.equal(notice.hidden, true);
  });
});
