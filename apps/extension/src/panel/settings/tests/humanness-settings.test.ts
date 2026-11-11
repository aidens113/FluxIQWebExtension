// Humanness: the slider's value is clamped and rounded on save, sent as `humanness`, and reads as 0 when absent.

import assert from "node:assert/strict";
import test from "node:test";
import { defaultSettings } from "../../../shared/browser";
import { RUNTIME_MESSAGES } from "../../../shared/constants";
import type { ExtensionStatus } from "../../../shared/protocol";
import { fake, withFakeDocument } from "../../chat/tests/fake-dom";
import type { PanelContext } from "../../shell";
import type { PanelStore } from "../../state";
import { normaliseHumanness, readHumanness, withHumanness, type HumannessSettings } from "../humanness";
import { createSettingsView } from "../settings-view";

const tick = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const status = (settings: HumannessSettings): ExtensionStatus => ({ connectionState: "connected", recordingState: "idle", gatewayUrl: defaultSettings().gatewayUrl, settings, clientId: "fixture", paired: true, queueSize: 0, eventCount: 0, recentActivities: [], projectId: "project-1" });

test("humanness is rounded and clamped to 0-100; anything else is 0", () => {
  assert.equal(normaliseHumanness(42.6), 43);
  assert.equal(normaliseHumanness(-5), 0);
  assert.equal(normaliseHumanness(250), 100);
  assert.equal(normaliseHumanness("35"), 35);
  for (const bad of [undefined, null, "", "abc", Number.NaN, Infinity]) assert.equal(normaliseHumanness(bad), 0, String(bad));
});

test("absent humanness reads as 0, a stored one as itself, and withHumanness carries the clamped value", () => {
  assert.equal(readHumanness(defaultSettings()), 0);
  assert.equal(readHumanness(undefined), 0);
  assert.equal(readHumanness({ ...defaultSettings(), humanness: 60 }), 60);
  assert.equal(withHumanness(defaultSettings(), 999).humanness, 100);
  assert.equal(withHumanness(defaultSettings(), 12.4).humanness, 12);
});

test("the slider shows the saved humanness, and Save sends the edited value as humanness", async () => {
  const scope = globalThis as unknown as { chrome?: unknown };
  const previous = scope.chrome;
  scope.chrome = {
    runtime: { lastError: undefined, onMessage: { addListener() {}, removeListener() {} }, sendMessage() {} },
    storage: { local: { get: (_k: unknown, done: (items: Record<string, unknown>) => void) => done({}), set: (_v: unknown, done?: () => void) => done?.(), remove: (_k: unknown, done?: () => void) => done?.() } }
  };
  try {
    await withFakeDocument(async () => {
      const doc = document as unknown as { createElement(tag: string): unknown; hasFocus(): boolean };
      const create = doc.createElement;
      doc.hasFocus = () => false;
      doc.createElement = (tag) => Object.defineProperty(create(tag) as object, "ownerDocument", { value: doc, enumerable: true });
      const sent: unknown[] = [];
      const current = status({ ...defaultSettings(), humanness: 40 });
      const store: PanelStore = {
        current: () => current,
        subscribe(listener) {
          listener(current);
          return () => undefined;
        },
        request: (async (message: unknown) => {
          sent.push(message);
          return { ok: true, value: {} };
        }) as PanelStore["request"]
      };
      const view = createSettingsView({ store, surface: "popup" } as PanelContext, () => undefined);
      view.shown();
      await tick();
      const root = fake(view.element);
      const find = (id: string) => root.descendants().find((node) => node.id === id)!;
      const slider = find("humanness") as unknown as { value: string; getAttribute(name: string): string | null; dispatch(type: string): void };
      assert.equal(slider.value, "40");
      assert.equal(slider.getAttribute("min"), "0");
      assert.equal(slider.getAttribute("max"), "100");
      assert.equal(slider.getAttribute("step"), "5");
      slider.value = "177.4";
      slider.dispatch("input");
      slider.dispatch("change");
      (find("saveSettingsButton") as unknown as { dispatch(type: string): void }).dispatch("click");
      await tick();
      const save = sent.find((message) => (message as { type: string }).type === RUNTIME_MESSAGES.panelSaveSettings) as { settings: { humanness?: number } };
      assert.ok(save, "a save was sent");
      assert.equal(save.settings.humanness, 100);
    });
  } finally {
    scope.chrome = previous;
  }
});
