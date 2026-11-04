import assert from "node:assert/strict";
import test from "node:test";
import { defaultSettings } from "../../../shared/browser";
import type { ExtensionStatus } from "../../../shared/protocol";
import { fake, withFakeDocument } from "../../chat/tests/fake-dom";
import type { ModelKeyReading } from "../../getting-started";
import type { PanelContext } from "../../shell";
import type { PanelStore } from "../../state";
import { approvalLine } from "../approval-line";
import { modelKeyLine } from "../model-key-line";
import { projectLine } from "../project-line";
import { createSettingsView } from "../settings-view";

const tick = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const status = (extra: Partial<ExtensionStatus> = {}): ExtensionStatus => ({ connectionState: "connected", recordingState: "idle", gatewayUrl: defaultSettings().gatewayUrl, settings: defaultSettings(), clientId: "fixture", paired: true, queueSize: 0, eventCount: 0, recentActivities: [], projectId: "project-1", ...extra });

function modelDocument(): void {
  const doc = document as unknown as { createElement(tag: string): unknown; hasFocus(): boolean };
  const create = doc.createElement;
  doc.hasFocus = () => false;
  doc.createElement = (tag) => Object.defineProperty(create(tag) as object, "ownerDocument", { value: doc, enumerable: true });
}

/** A browser with no stored values and a runtime that hears nothing, for as long as `body` runs. */
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

function view(current: ExtensionStatus, reading: ModelKeyReading | "none") {
  const store: PanelStore = {
    current: () => current,
    subscribe(listener) {
      listener(current);
      return () => undefined;
    },
    request: (async () => ({ ok: true, value: {} })) as PanelStore["request"]
  };
  return createSettingsView({ store, surface: "popup" } as PanelContext, () => undefined, reading === "none" ? {} : { setup: { readModelKey: async () => reading } });
}

test("settings read top down: connection, project, model key, on the page, help, then Advanced holding the addresses, switches and Forget", async () => {
  await withChrome(() => withFakeDocument(async () => {
    modelDocument();
    const settings = view(status(), "ready");
    settings.shown();
    await tick();
    const root = fake(settings.element);
    const groups = root.descendants().filter((node) => node.className.includes("settings-group ") || node.className === "settings-group").map((node) => node.getAttribute("aria-label"));
    assert.deepEqual(groups, ["Connection", "Project", "Model key", "Status on the page", "Help", "Advanced"]);
    const advanced = root.descendants().find((node) => node.tagName === "DETAILS")!;
    const inside = (id: string) => advanced.descendants().some((node) => node.id === id);
    for (const id of ["gatewayUrl", "coreApiUrl", "autoReconnect", "captureMutations", "captureInputValues", "captureSnapshots", "saveSettingsButton", "disconnectButton"]) assert.equal(inside(id), true, id);
    assert.equal(advanced.descendants().some((node) => node.textContent === "Forget this pairing"), true);
    assert.equal(advanced.textContent.includes("spend"), false, "no spending setting is drawn");
    assert.equal(root.textContent.includes("Your model key is ready."), true);
    assert.equal(root.textContent.includes("FluxIQ approved this browser."), true);
  }));
});

test("Advanced starts open so the labels the Lab fills are on screen", async () => {
  await withChrome(() => withFakeDocument(async () => {
    modelDocument();
    const settings = view(status({ connectionState: "disconnected" }), "none");
    settings.shown();
    await tick();
    const advanced = fake(settings.element).descendants().find((node) => node.tagName === "DETAILS")! as unknown as { open: boolean };
    assert.equal(advanced.open, true);
  }));
});

test("the key line follows the reading, and an unreadable key never claims anything", () => {
  assert.equal(modelKeyLine("ready", true), "Your model key is ready.");
  assert.match(modelKeyLine("missing", true), /no model key yet/);
  assert.match(modelKeyLine("locked", true), /Unlock it in FluxIQ/);
  assert.match(modelKeyLine("unknown", true), /Couldn't check/);
  assert.match(modelKeyLine("ready", false), /Connect to FluxIQ/);
});

test("approval and project are said in words, never as codes", () => {
  assert.equal(approvalLine(status()), "FluxIQ approved this browser.");
  assert.match(approvalLine(status({ connectionState: "pairing" })), /Waiting for you to approve/);
  assert.match(approvalLine(status({ connectionState: "disconnected", paired: false })), /isn't approved yet/);
  assert.match(approvalLine(status({ connectionState: "disconnected" })), /approved this browser earlier/);
  assert.match(projectLine(status()), /project you chose in FluxIQ/);
  assert.equal(projectLine(status()).includes("project-1"), false);
  assert.match(projectLine(status({ projectId: null })), /No project is chosen/);
  assert.match(projectLine(status({ connectionState: "disconnected" })), /Connect to FluxIQ/);
});
