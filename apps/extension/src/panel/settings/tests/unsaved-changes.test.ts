// The one save model: Save changes saves every field of the form, the draft bar names what is unsaved,
// and the connection address hint no longer quotes a port (discovery supplies the address).

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { defaultSettings } from "../../../shared/browser";
import type { ExtensionStatus } from "../../../shared/protocol";
import { fake, withFakeDocument } from "../../chat/tests/fake-dom";
import type { PanelContext } from "../../shell";
import { SETTING_FIELDS } from "../form-fields";
import { createProblemReportSection } from "../problem-report-section";
import { createSettingsView } from "../settings-view";
import { storeWith } from "./store-fixture";
import { unsavedLabels, unsavedSentence } from "../unsaved-changes";

const tick = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const status = (): ExtensionStatus => ({ connectionState: "connected", recordingState: "idle", gatewayUrl: defaultSettings().gatewayUrl, settings: defaultSettings(), clientId: "fixture", paired: true, queueSize: 0, eventCount: 0, recentActivities: [], projectId: "project-1" });

async function withChrome(body: () => Promise<void>): Promise<void> {
  const scope = globalThis as unknown as { chrome?: unknown };
  const previous = scope.chrome;
  scope.chrome = {
    runtime: { lastError: undefined, onMessage: { addListener() {}, removeListener() {} }, sendMessage() {} },
    storage: { local: { get: (_keys: unknown, done: (items: Record<string, unknown>) => void) => done({}), set: (_values: unknown, done?: () => void) => done?.(), remove: (_key: unknown, done?: () => void) => done?.() } }
  };
  try { await body(); } finally { scope.chrome = previous; }
}

test("the connection address hint quotes no port", () => {
  const gateway = SETTING_FIELDS.addresses.find((field) => field.key === "gatewayUrl")!;
  assert.doesNotMatch(gateway.hint, /4777|ws:\/\//u);
});

test("unsaved labels name every differing setting, in display order", () => {
  const saved = defaultSettings();
  assert.deepEqual(unsavedLabels(saved, saved), []);
  assert.equal(unsavedSentence([]), "");
  const changed = { ...saved, coreApiUrl: `${saved.coreApiUrl}x`, autoReconnect: !saved.autoReconnect };
  const labels = unsavedLabels(changed, saved);
  assert.deepEqual(labels, ["FluxIQ web address", "Reconnect automatically"]);
  assert.equal(unsavedSentence(labels), "Not saved yet: FluxIQ web address, Reconnect automatically.");
  assert.deepEqual(unsavedLabels({ ...saved, gatewayUrl: `  ${saved.gatewayUrl} ` }, saved), [], "padding is not a change");
});

test("the draft bar says what is unsaved after a switch, and clears after Save", async () => {
  await withChrome(() => withFakeDocument(async () => {
    const doc = document as unknown as { createElement(tag: string): unknown; hasFocus(): boolean };
    const create = doc.createElement;
    doc.hasFocus = () => false;
    doc.createElement = (tag) => Object.defineProperty(create(tag) as object, "ownerDocument", { value: doc, enumerable: true });
    const view = createSettingsView({ store: storeWith(status()), surface: "popup" } as PanelContext, () => undefined);
    view.shown();
    const root = fake(view.element);
    await tick();
    const find = (id: string) => root.descendants().find((node) => node.id === id)!;
    const line = () => root.descendants().find((node) => node.textContent.startsWith("Not saved yet") || (node.className.includes("field-hint") && node.className.includes("card-line")))!;
    assert.equal(line().hidden, true);
    const toggle = find("autoReconnect");
    const box = toggle as unknown as { checked: boolean };
    box.checked = !box.checked;
    toggle.dispatch("change");
    assert.equal(line().hidden, false);
    assert.equal(line().textContent, "Not saved yet: Reconnect automatically.");
    find("saveSettingsButton").dispatch("click");
    await tick();
    assert.equal(line().hidden, true, "nothing is listed once saved");
  }));
});

test("Report a problem keeps room for its status line, and the stylesheet keeps a hidden reserved line in layout", async () => {
  await withFakeDocument(async () => {
    const section = fake(createProblemReportSection({ surface: "sidepanel", store: { request: async () => ({ ok: true, value: {} }) } } as unknown as PanelContext));
    assert.ok(section.children[3]!.className.includes("reserved-line"));
  });
  // The test runs from a bundle under `.test-build-scratch/<label>/`: find apps/extension by its manifest.
  let directory = path.dirname(fileURLToPath(import.meta.url));
  while (!existsSync(path.join(directory, "manifest.chrome.json"))) directory = path.dirname(directory);
  const css = readFileSync(path.join(directory, "src", "panel", "settings", "settings.css"), "utf8");
  assert.match(css, /\.reserved-line\[hidden\]\s*\{[^}]*display:\s*block;[^}]*visibility:\s*hidden/u);
  assert.match(css, /\.humanness-status\s*\{[^}]*display:\s*block;[^}]*min-height/u);
  // A report's outcome (up to three lines) and its Save report button both keep their space while hidden.
  assert.match(css, /\.problem-report \.reserved-line\s*\{[^}]*min-height:\s*4\.4em/u);
  assert.match(css, /\.problem-report #saveProblemReport\[hidden\]\s*\{[^}]*visibility:\s*hidden/u);
});
