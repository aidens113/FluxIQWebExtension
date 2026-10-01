import assert from "node:assert/strict";
import test from "node:test";
import { defaultSettings } from "../../../shared/browser";
import { RUNTIME_MESSAGES } from "../../../shared/constants";
import type { ExtensionStatus } from "../../../shared/protocol";
import { fake, withFakeDocument } from "../../chat/tests/fake-dom";
import type { PanelContext } from "../../shell";
import type { PanelResult, PanelStore } from "../../state";
import { createSettingsView } from "../settings-view";

const tick = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function modelDocument(): void {
  const doc = document as unknown as { createElement(tag: string): unknown; hasFocus(): boolean };
  const create = doc.createElement;
  doc.hasFocus = () => false;
  doc.createElement = (tag) => Object.assign(create(tag) as object, { ownerDocument: doc });
}

for (const action of ["disconnect", "save", "forget"] as const) {
  for (const outcome of ["refused", "rejected"] as const) {
    test(`settings mutation lock survives status refresh and recovers: ${action} ${outcome}`, async () => {
      await withFakeDocument(async () => {
        modelDocument();
        const status: ExtensionStatus = { connectionState: "connected", recordingState: "idle", gatewayUrl: defaultSettings().gatewayUrl, settings: defaultSettings(), clientId: "fixture", paired: true, queueSize: 0, eventCount: 0, recentActivities: [] };
        let push!: (status: ExtensionStatus) => void;
        const calls: string[] = [];
        let finish!: (result: PanelResult<unknown>) => void;
        let reject!: (error: Error) => void;
        const store: PanelStore = {
          current: () => status,
          subscribe(listener) { push = listener; listener(status); return () => undefined; },
          request: ((message: { type: string }) => {
            calls.push(message.type);
            return new Promise<PanelResult<unknown>>((resolve, refuse) => { finish = resolve; reject = refuse; });
          }) as PanelStore["request"]
        };
        const view = createSettingsView({ store, surface: "popup" } as PanelContext, () => undefined);
        await tick();
        const root = fake(view.element);
        const find = (id: string) => root.descendants().find((node) => node.id === id)!;
        const save = find("saveSettingsButton");
        const disconnect = find("disconnectButton");
        const forget = root.descendants().find((node) => node.textContent === "Forget" && node.tagName === "BUTTON")!;
        const start = action === "save" ? save : action === "disconnect" ? disconnect : forget;
        start.dispatch("click");
        push(status);
        assert.equal(save.disabled, true);
        assert.equal(disconnect.disabled, true);
        assert.equal(forget.disabled, true);
        // Direct dispatch also exercises the internal guard beyond native disabled clicks.
        save.dispatch("click"); disconnect.dispatch("click"); forget.dispatch("click");
        assert.equal(calls.length, 1);
        assert.equal(find("gatewayUrl").disabled, false);
        if (outcome === "refused") finish({ ok: false, sentence: "Request refused" });
        else reject(new Error("private synthetic exception must never be displayed"));
        await tick();
        assert.equal(save.disabled, false);
        assert.equal(disconnect.disabled, false);
        assert.equal(forget.disabled, false);
        assert.equal(root.byClass("danger")[0]!.hidden, false);
        assert.equal(root.textContent.includes("private synthetic"), false);
        start.dispatch("click");
        assert.equal(calls.length, 2);
        finish({ ok: true, value: {} });
        await tick();
      });
    });
  }
}

for (const outcome of ["refused", "rejected"] as const) {
test(`Save holds the mutation lock through reconnect while preserving newer edits: ${outcome}`, async () => {
  await withFakeDocument(async () => {
    modelDocument();
    const status: ExtensionStatus = { connectionState: "connected", recordingState: "idle", gatewayUrl: defaultSettings().gatewayUrl, settings: defaultSettings(), clientId: "fixture", paired: true, queueSize: 0, eventCount: 0, recentActivities: [] };
    let push!: (status: ExtensionStatus) => void;
    const calls: string[] = [];
    let reconnect!: (result: PanelResult<unknown>) => void;
    let reject!: (error: Error) => void;
    const store: PanelStore = {
      current: () => status,
      subscribe(listener) { push = listener; listener(status); return () => undefined; },
      request: (async (message: { type: string }) => {
        calls.push(message.type);
        if (message.type === RUNTIME_MESSAGES.connect) return await new Promise<PanelResult<unknown>>((resolve, refuse) => { reconnect = resolve; reject = refuse; });
        return { ok: true, value: {} };
      }) as PanelStore["request"]
    };
    const root = fake(createSettingsView({ store, surface: "sidepanel" } as PanelContext, () => undefined).element);
    await tick();
    const find = (id: string) => root.descendants().find((node) => node.id === id)!;
    const gateway = find("gatewayUrl");
    gateway.value = "ws://127.0.0.1:4888/client"; gateway.dispatch("input");
    find("saveSettingsButton").dispatch("click");
    await tick();
    gateway.value = "ws://127.0.0.1:4999/client"; gateway.dispatch("input");
    push(status);
    assert.equal(find("saveSettingsButton").disabled, true);
    find("disconnectButton").dispatch("click");
    find("saveSettingsButton").dispatch("click");
    assert.deepEqual(calls, [RUNTIME_MESSAGES.panelSaveSettings, RUNTIME_MESSAGES.connect]);
    if (outcome === "refused") reconnect({ ok: false, sentence: "Reconnect refused" });
    else reject(new Error("private synthetic reconnect exception"));
    await tick(); push(status);
    assert.equal(gateway.value, "ws://127.0.0.1:4999/client");
    assert.equal(find("saveSettingsButton").disabled, false);
    assert.equal(root.byClass("danger")[0]!.textContent, outcome === "refused" ? "Reconnect refused" : "Couldn't finish saving and connecting. Try Save again.");
    assert.equal(root.textContent.includes("private synthetic"), false);
  });
});
}
