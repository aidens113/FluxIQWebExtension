import assert from "node:assert/strict";
import test from "node:test";
import { defaultSettings } from "../../../shared/browser";
import { RUNTIME_MESSAGES } from "../../../shared/constants";
import type { ExtensionStatus, FluxIQSettings } from "../../../shared/protocol";
import { fake, withFakeDocument } from "../../chat/tests/fake-dom";
import type { PanelContext } from "../../shell";
import type { PanelResult, PanelStore } from "../../state";
import { CONNECTION_DRAFT_KEY } from "../draft-store";
import { createSettingsView } from "../settings-view";

for (const scenario of ["unchanged", "address", "toggle", "retyped", "failed", "reconnect-failed"] as const) {
  test(`settings pending save keeps subsequent edits: ${scenario}`, async () => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, "chrome");
    const storage = new Map<string, unknown>();
    Object.defineProperty(globalThis, "chrome", { configurable: true, value: {
      runtime: { lastError: undefined },
      storage: { local: {
        get: (_keys: string[], done: (items: object) => void) => done(Object.fromEntries(storage)),
        set: (items: Record<string, unknown>, done: () => void) => { for (const [key, value] of Object.entries(items)) storage.set(key, value); done(); },
        remove: (key: string, done: () => void) => { storage.delete(key); done(); }
      } }
    } });
    try {
      await withFakeDocument(async () => {
        let status: ExtensionStatus = {
          connectionState: "connected", recordingState: "idle", gatewayUrl: defaultSettings().gatewayUrl,
          settings: defaultSettings(), clientId: "fixture", paired: true, queueSize: 0, eventCount: 0, recentActivities: []
        };
        let push!: (status: ExtensionStatus) => void;
        let finish!: (result: PanelResult<unknown>) => void;
        const calls: Array<{ type: string; settings?: FluxIQSettings }> = [];
        const store: PanelStore = {
          current: () => status,
          subscribe(listener) { push = listener; listener(status); return () => undefined; },
          request: (async (message: { type: string; settings?: FluxIQSettings }) => {
            calls.push(message);
            if (message.type === RUNTIME_MESSAGES.panelSaveSettings) return await new Promise<PanelResult<unknown>>((resolve) => { finish = resolve; });
            return scenario === "reconnect-failed" ? { ok: false, sentence: "Reconnect failed" } : { ok: true, value: {} };
          }) as PanelStore["request"]
        };
        const view = createSettingsView({ store, surface: "popup" } as PanelContext, () => undefined);
        await Promise.resolve();
        const root = fake(view.element);
        const find = (id: string) => root.descendants().find((node) => node.id === id)!;
        const gateway = find("gatewayUrl");
        gateway.value = "ws://127.0.0.1:4888/client";
        gateway.dispatch("input");
        const save = find("saveSettingsButton");
        save.dispatch("click");
        assert.equal(save.disabled, true);
        assert.equal(gateway.disabled, false);
        if (scenario === "address") { gateway.value = "ws://127.0.0.1:4999/client"; gateway.dispatch("input"); }
        if (scenario === "toggle") {
          (find("captureSnapshots") as unknown as { checked: boolean }).checked = false;
          find("captureSnapshots").dispatch("change");
        }
        if (scenario === "retyped") {
          gateway.value = "ws://127.0.0.1:4999/client"; gateway.dispatch("input");
          gateway.value = "ws://127.0.0.1:4888/client"; gateway.dispatch("input");
        }
        const submitted = calls[0]!.settings!;
        status = { ...status, settings: submitted };
        push(status);
        finish(scenario === "failed" ? { ok: false, sentence: "Save failed" } : { ok: true, value: {} });
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        push(status);
        const newer = scenario === "address" || scenario === "toggle" || scenario === "retyped";
        const kept = storage.get(CONNECTION_DRAFT_KEY) as FluxIQSettings | undefined;
        assert.equal(gateway.value, scenario === "address" ? "ws://127.0.0.1:4999/client" : submitted.gatewayUrl);
        assert.equal(kept !== undefined, newer || scenario === "failed");
        const draftNotice = root.descendants().find((node) => node.textContent === "You have changes that aren't saved yet.")!;
        assert.equal(draftNotice.hidden, !(newer || scenario === "failed"));
        if (newer) {
          assert.equal(kept!.gatewayUrl, gateway.value);
          assert.equal(root.byClass("success-line")[0]!.textContent, "Saved the earlier settings. Your newer changes aren't saved yet.");
        }
        if (scenario === "toggle") {
          assert.equal(kept!.captureSnapshots, false);
          assert.equal((find("captureSnapshots") as unknown as { checked: boolean }).checked, false);
        }
        if (scenario === "unchanged") assert.equal(root.byClass("success-line")[0]!.textContent, "Saved.");
        if (scenario === "failed" || scenario === "reconnect-failed") assert.equal(root.byClass("danger")[0]!.hidden, false);
        assert.deepEqual(calls.map((call) => call.type), scenario === "failed" ? [RUNTIME_MESSAGES.panelSaveSettings] : [RUNTIME_MESSAGES.panelSaveSettings, RUNTIME_MESSAGES.connect]);
        assert.equal(calls[0]!.settings!.gatewayUrl, "ws://127.0.0.1:4888/client", "reconnect uses the submitted settings, not later edits");
        assert.equal(save.disabled, false);
      });
    } finally {
      if (previous) Object.defineProperty(globalThis, "chrome", previous);
      else Reflect.deleteProperty(globalThis, "chrome");
    }
  });
}
