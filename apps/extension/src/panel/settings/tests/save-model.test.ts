// The save model: "Save changes" shows only while something is unsaved, and the pairing line says
// so only when the pairing lasts just for the browser session.

import assert from "node:assert/strict";
import test from "node:test";
import { defaultSettings } from "../../../shared/browser";
import type { ExtensionStatus } from "../../../shared/protocol";
import { fake, withFakeDocument } from "../../chat/tests/fake-dom";
import type { PanelContext } from "../../shell";
import type { PanelStore } from "../../state";
import { BROWSER_SESSION_PAIRING_LINE, durabilityLine } from "../durability-line";
import { createSettingsView } from "../settings-view";

const tick = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const status = (extra: Partial<ExtensionStatus> = {}): ExtensionStatus => ({ connectionState: "connected", recordingState: "idle", gatewayUrl: defaultSettings().gatewayUrl, settings: defaultSettings(), clientId: "fixture", paired: true, queueSize: 0, eventCount: 0, recentActivities: [], projectId: "project-1", ...extra });

async function withChrome(body: () => Promise<void>): Promise<void> {
  const scope = globalThis as unknown as { chrome?: unknown };
  const previous = scope.chrome;
  scope.chrome = {
    runtime: { lastError: undefined, onMessage: { addListener() {}, removeListener() {} }, sendMessage() {} },
    storage: { local: { get: (_keys: unknown, done: (items: Record<string, unknown>) => void) => done({}), set: (_values: unknown, done?: () => void) => done?.(), remove: (_key: unknown, done?: () => void) => done?.() } }
  };
  try {
    await body();
  } finally {
    scope.chrome = previous;
  }
}

function mount(current: ExtensionStatus) {
  const doc = document as unknown as { createElement(tag: string): unknown; hasFocus(): boolean };
  const create = doc.createElement;
  doc.hasFocus = () => false;
  doc.createElement = (tag) => Object.defineProperty(create(tag) as object, "ownerDocument", { value: doc, enumerable: true });
  const store: PanelStore = {
    current: () => current,
    subscribe(listener) {
      listener(current);
      return () => undefined;
    },
    request: (async () => ({ ok: true, value: {} })) as PanelStore["request"]
  };
  const view = createSettingsView({ store, surface: "popup" } as PanelContext, () => undefined);
  view.shown();
  return fake(view.element);
}

test("Save changes is hidden until something changes, keeps the Save name and id, and goes away after saving", async () => {
  await withChrome(() => withFakeDocument(async () => {
    const root = mount(status());
    await tick();
    const find = (id: string) => root.descendants().find((node) => node.id === id)!;
    const save = find("saveSettingsButton");
    const bar = root.descendants().find((node) => node.className.includes("settings-save"))!;
    assert.equal(save.hidden, true);
    assert.equal(bar.hidden, true);
    assert.equal(save.textContent, "Save changes");
    assert.equal(save.getAttribute("aria-label"), "Save");
    const slider = find("humanness");
    slider.value = "35";
    slider.dispatch("input");
    assert.equal(save.hidden, false);
    assert.equal(bar.hidden, false);
    save.dispatch("click");
    await tick();
    assert.equal(save.hidden, true, "nothing is unsaved after the save");
    assert.equal(bar.hidden, false, "the outcome stays on screen");
    assert.equal(root.byClass("success-line")[0]!.textContent, "Saved.");
  }));
});

test("the pairing line appears only for a pairing that lasts the browser session", () => {
  assert.equal(durabilityLine(status({ credentialDurability: "browser_session" })), BROWSER_SESSION_PAIRING_LINE);
  assert.equal(durabilityLine(status({ credentialDurability: "lasting" })), "");
  assert.equal(durabilityLine(status()), "");
  assert.match(BROWSER_SESSION_PAIRING_LINE, /^Paired until you close this browser\./);
});
