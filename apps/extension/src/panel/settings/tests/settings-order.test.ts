import assert from "node:assert/strict";
import test from "node:test";
import { defaultSettings } from "../../../shared/browser";
import type { ExtensionStatus } from "../../../shared/protocol";
import { KEY_WRITE_MESSAGES } from "../../chat";
import { fake, withFakeDocument } from "../../chat/tests/fake-dom";
import type { ModelKeyReading } from "../../getting-started";
import type { PanelContext } from "../../shell";
import type { PanelStore } from "../../state";
import { recordingRequest, storeWith } from "./store-fixture";
import { approvalLine } from "../approval-line";
import { projectLine } from "../project-line";
import { createSettingsView } from "../settings-view";

const READY: ModelKeyReading = { kind: "ready", provider: "Anthropic", keyName: "Work key" };
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

function view(current: ExtensionStatus, reading: ModelKeyReading | "none", changeProject?: () => void) {
  const store: PanelStore = {
    current: () => current,
    subscribe(listener) {
      listener(current);
      return () => undefined;
    },
    request: (async () => ({ ok: true, value: {} })) as PanelStore["request"]
  };
  return createSettingsView({ store, surface: "popup" } as PanelContext, () => undefined, { ...(reading === "none" ? {} : { setup: { readModelKey: async () => reading } }), ...(changeProject === undefined ? {} : { changeProject }) });
}

test("settings read top down: connection, model, behaviour, permissions, appearance, help, then Advanced holding the addresses and Forget", async () => {
  await withChrome(() => withFakeDocument(async () => {
    modelDocument();
    const settings = view(status(), READY);
    settings.shown();
    await tick();
    const root = fake(settings.element);
    const groups = root.descendants().filter((node) => node.className.includes("settings-group ") || node.className === "settings-group").map((node) => node.getAttribute("aria-label"));
    assert.deepEqual(groups, ["Connection", "AI key", "Behaviour", "Permissions", "Appearance", "Help", "Advanced"]);
    const advanced = root.descendants().find((node) => node.tagName === "DETAILS")!;
    const inside = (id: string) => advanced.descendants().some((node) => node.id === id);
    for (const id of ["gatewayUrl", "coreApiUrl"]) assert.equal(inside(id), true, id);
    for (const id of ["autoReconnect", "captureMutations", "captureInputValues", "captureSnapshots", "requestsEnabled", "saveSettingsButton", "disconnectButton", "humanness"]) {
      assert.equal(inside(id), false, `${id} is out of Advanced`);
      assert.equal(root.descendants().some((node) => node.id === id), true, `${id} keeps its id`);
    }
    const permissions = root.descendants().find((node) => node.getAttribute("aria-label") === "Permissions")!;
    for (const id of ["captureMutations", "captureInputValues", "captureSnapshots", "requestsEnabled"]) assert.equal(permissions.descendants().some((node) => node.id === id), true, `${id} is under Permissions`);
    assert.equal(advanced.descendants().some((node) => node.textContent === "Forget this pairing"), true);
    assert.equal(advanced.textContent.includes("spend"), false, "no spending setting is drawn");
    assert.equal(root.textContent.includes("Anthropic is ready, using Work key."), true);
    assert.equal(root.textContent.includes("FluxIQ approved this browser."), true);
  }));
});

test("Advanced starts closed: a person reads what they care about first", async () => {
  await withChrome(() => withFakeDocument(async () => {
    modelDocument();
    const settings = view(status({ connectionState: "disconnected" }), "none");
    settings.shown();
    await tick();
    const advanced = fake(settings.element).descendants().find((node) => node.tagName === "DETAILS")! as unknown as { open: boolean };
    assert.equal(advanced.open, false);
  }));
});

test("the Model section is the shared key card: each state in its words, read through the one setup port", async () => {
  const states: Array<[ModelKeyReading, RegExp]> = [
    [{ kind: "no-key" }, /Add an AI key to start/u],
    [{ kind: "cant-open", keyName: "Work key" }, /can't read it any more/u],
    [{ kind: "not-accepted", provider: "Anthropic", keyName: "Work key" }, /did not accept Work key/u],
    [{ kind: "unreachable", provider: "Anthropic" }, /couldn't reach Anthropic/u],
    [{ kind: "update-fluxiq" }, /too old/u],
    ["unknown", /Couldn't check your AI key just now/u]
  ];
  for (const [reading, words] of states) {
    await withChrome(() => withFakeDocument(async () => {
      modelDocument();
      const settings = view(status(), reading);
      settings.shown();
      await tick();
      assert.match(fake(settings.element).textContent, words);
    }));
  }
});

test("the Model section says to connect, and reads nothing, while the browser is not connected", async () => {
  await withChrome(() => withFakeDocument(async () => {
    modelDocument();
    let reads = 0;
    const store = storeWith(status({ connectionState: "disconnected" }));
    const readModelKey = async (): Promise<ModelKeyReading> => {
      reads += 1;
      return READY;
    };
    const settings = createSettingsView({ store, surface: "popup" } as PanelContext, () => undefined, { setup: { readModelKey } });
    settings.shown();
    await tick();
    const root = fake(settings.element);
    assert.match(root.textContent, /Connect to FluxIQ to see your AI key./u);
    assert.equal(reads, 0);
    assert.equal(root.byClass("model-key-card").length, 0);
  }));
});

test("the card's Open FluxIQ and Change model open FluxIQ's Settings at AI keys; Try now reads again and opens nothing", async () => {
  await withChrome(() => withFakeDocument(async () => {
    modelDocument();
    const sent: Array<Record<string, unknown>> = [];
    let reads = 0;
    const store = storeWith(status(), recordingRequest(sent));
    const readModelKey = async (): Promise<ModelKeyReading> => {
      reads += 1;
      return reads === 1 ? { kind: "unreachable", provider: "Anthropic" } : READY;
    };
    const settings = createSettingsView({ store, surface: "popup" } as PanelContext, () => undefined, { setup: { readModelKey } });
    settings.shown();
    await tick();
    const root = fake(settings.element);
    const named = (name: string) => root.descendants().find((node) => node.tagName === "BUTTON" && node.textContent === name);
    named("Try now")!.dispatch("click");
    await tick();
    assert.equal(reads, 2);
    assert.deepEqual(sent.filter((message) => message.type === "fluxiq.panel.openFluxIQ"), []);
    assert.match(root.textContent, /Anthropic is ready/u);
    named("Change model")!.dispatch("click");
    await tick();
    assert.deepEqual(sent.filter((message) => message.type === "fluxiq.panel.openFluxIQ"), [{ type: "fluxiq.panel.openFluxIQ", purpose: "model-key" }]);
  }));
});

test("Save sends the key once to the background, with no password, and shows its refusal in its own words", async () => {
  await withChrome(() => withFakeDocument(async () => {
    modelDocument();
    const sent: Array<Record<string, unknown>> = [];
    const unknownMessage = "The extension doesn't know that request yet.";
    const request = (async (message: Record<string, unknown>) => {
      sent.push(message);
      return message.type === KEY_WRITE_MESSAGES.save ? { ok: true, value: { ok: false, sentence: unknownMessage } } : { ok: true, value: {} };
    }) as unknown as PanelStore["request"];
    const store = storeWith(status(), request);
    const readModelKey = async (): Promise<ModelKeyReading> => ({ kind: "no-key" });
    const settings = createSettingsView({ store, surface: "popup" } as PanelContext, () => undefined, { setup: { readModelKey } });
    settings.shown();
    await tick();
    const root = fake(settings.element);
    const named = (name: string) => root.descendants().find((node) => node.tagName === "BUTTON" && node.textContent === name);
    named("Add a key")!.dispatch("click");
    const fields = root.descendants().filter((node) => node.tagName === "INPUT" && node.getAttribute("type") === "password");
    assert.equal(fields.length, 1, "one key field and no password field");
    fields[0]!.value = "sk-ant-PASTED-0001";
    named("Save and check")!.dispatch("click");
    await tick();
    const writes = sent.filter((message) => message.type === KEY_WRITE_MESSAGES.save);
    assert.deepEqual(writes, [{ type: KEY_WRITE_MESSAGES.save, provider: "anthropic", key: "sk-ant-PASTED-0001", name: "Anthropic key" }]);
    assert.equal(sent.filter((message) => JSON.stringify(message).includes("PASTED")).length, 1, "the value is in that one message only");
    assert.match(root.textContent, new RegExp(unknownMessage.replace(/[.']/gu, "."), "u"));
    assert.equal(root.textContent.includes("PASTED"), false);
  }));
});

test("model access trouble preserves connected and approved status", async () => {
  await withChrome(() => withFakeDocument(async () => {
    modelDocument();
    const settings = view(status(), { kind: "cant-open", keyName: "Work key" });
    settings.shown();
    await tick();
    const text = fake(settings.element).textContent;
    assert.match(text, /can't read it any more/u);
    assert.match(text, /FluxIQ approved this browser/u);
    assert.doesNotMatch(text, /unlock|vault|seal|credential|scope|token|bidsb/iu);
  }));
});

test("approval and project are said in words, never as codes", () => {
  assert.equal(approvalLine(status()), "FluxIQ approved this browser.");
  assert.match(approvalLine(status({ connectionState: "pairing" })), /Waiting for you to approve/);
  assert.match(approvalLine(status({ connectionState: "disconnected", paired: false })), /isn't approved yet/);
  for (const connectionState of ["disconnected", "error", "reconnecting"] as const) assert.equal(approvalLine(status({ connectionState })), "Not connected. Connect again.", connectionState);
  assert.equal(approvalLine(status({ connectionState: "error", enrolmentRefusalCode: "enrolment.revoked" })), "Access was removed. Connect again to ask for approval.");
  assert.match(projectLine(status()), /the one you chose in FluxIQ/);
  assert.equal(projectLine(status()).includes("project-1"), false);
  assert.match(projectLine(status({ projectId: null })), /No project is chosen yet. Choose one with Change/);
  assert.equal(projectLine(status({ projectName: " Company website " })), "Project: “Company website”");
  assert.equal(projectLine(status({ projectName: "Company website" })).includes("project-1"), false);
  assert.match(projectLine(status({ connectionState: "disconnected" })), /Connect to FluxIQ/);
});

test("the Project row names the project and its Change button opens the switcher, only while connected", async () => {
  await withChrome(() => withFakeDocument(async () => {
    modelDocument();
    let opened = 0;
    const settings = view(status({ projectName: "Company website" }), READY, () => { opened += 1; });
    settings.shown();
    await tick();
    const root = fake(settings.element);
    assert.equal(root.byClass("settings-project-name")[0]!.textContent, "Project: “Company website”");
    const change = root.descendants().find((node) => node.id === "changeProjectButton")!;
    assert.equal(change.hidden, false);
    change.dispatch("click");
    assert.equal(opened, 1);
    const away = view(status({ connectionState: "disconnected" }), "none", () => { opened += 1; });
    away.shown();
    await tick();
    assert.equal(fake(away.element).descendants().find((node) => node.id === "changeProjectButton")!.hidden, true);
  }));
});
