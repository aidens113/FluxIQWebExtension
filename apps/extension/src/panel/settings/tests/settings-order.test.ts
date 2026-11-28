import assert from "node:assert/strict";
import test from "node:test";
import { defaultSettings } from "../../../shared/browser";
import type { ExtensionStatus } from "../../../shared/protocol";
import type { ModelAccessState } from "@fluxiq/ui-components";
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

test("settings read top down: connection, model, panel links, behaviour, permissions, appearance, help, then Advanced holding the addresses and Forget", async () => {
  await withChrome(() => withFakeDocument(async () => {
    modelDocument();
    const settings = view(status(), READY);
    settings.shown();
    await tick();
    const root = fake(settings.element);
    const groups = root.descendants().filter((node) => node.className.includes("settings-group ") || node.className === "settings-group").map((node) => node.getAttribute("aria-label"));
    assert.deepEqual(groups, ["Connection", "AI key", "In the FluxIQ panel", "Behaviour", "Permissions", "Appearance", "Help", "Advanced"]);
    const advanced = root.descendants().find((node) => node.tagName === "DETAILS")!;
    const inside = (id: string) => advanced.descendants().some((node) => node.id === id);
    for (const id of ["gatewayUrl", "coreApiUrl"]) assert.equal(inside(id), true, id);
    for (const id of ["autoReconnect", "captureMutations", "captureInputValues", "captureSnapshots", "requestsEnabled", "saveSettingsButton", "disconnectButton"]) {
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

test("the card's one action opens the FluxIQ panel at AI keys; Try now reads again and opens nothing", async () => {
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
    const action = root.descendants().find((node) => node.tagName === "BUTTON" && !node.hidden && node.textContent === "Open in FluxIQ panel")!;
    action.dispatch("click");
    await tick();
    assert.deepEqual(sent.filter((message) => message.type === "fluxiq.panel.openFluxIQ"), [{ type: "fluxiq.panel.openFluxIQ", purpose: "model-key" }]);
  }));
});

test("the key card only shows the key: no form, no write message, and the line that sends the person to the FluxIQ panel", async () => {
  await withChrome(() => withFakeDocument(async () => {
    modelDocument();
    const sent: Array<Record<string, unknown>> = [];
    const store = storeWith(status(), recordingRequest(sent));
    const readModelKey = async (): Promise<ModelKeyReading> => ({ kind: "no-key" });
    const settings = createSettingsView({ store, surface: "popup" } as PanelContext, () => undefined, { setup: { readModelKey } });
    settings.shown();
    await tick();
    const root = fake(settings.element);
    assert.equal(root.descendants().filter((node) => node.tagName === "INPUT" && node.getAttribute("type") === "password").length, 0, "no key field");
    assert.match(root.textContent, /Add or change your AI key in the FluxIQ panel/u);
    assert.equal(root.descendants().some((node) => node.tagName === "BUTTON" && !node.hidden && ["Save and check", "Add a key", "Add another key", "Replace key", "Remove"].includes(node.textContent)), false, "no button that writes a key is shown");
    assert.deepEqual(sent.filter((message) => String(message.type).startsWith("fluxiq.panel.modelKey")), []);
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
  assert.match(projectLine(status({ projectId: null })), /No project yet\. FluxIQ makes one when you send your first message/);
  assert.equal(projectLine(status({ projectName: " Company website " })), "Project: “Company website”");
  assert.equal(projectLine(status({ projectName: "Company website" })).includes("project-1"), false);
  assert.match(projectLine(status({ connectionState: "disconnected" })), /Connect to FluxIQ/);
});

test("projects and humanness are links into the FluxIQ panel, never controls here, and Save sends no humanness", async () => {
  await withChrome(() => withFakeDocument(async () => {
    modelDocument();
    const sent: Array<Record<string, unknown>> = [];
    const store = storeWith(status({ projectName: "Company website", settings: defaultSettings() }), recordingRequest(sent));
    const settings = createSettingsView({ store, surface: "popup" } as PanelContext, () => undefined);
    settings.shown();
    await tick();
    const root = fake(settings.element);
    assert.equal(root.byClass("settings-project-name")[0]!.textContent, "Project: “Company website”");
    const ids = root.descendants().map((node) => node.id);
    for (const gone of ["changeProjectButton", "humanness"]) assert.equal(ids.includes(gone), false, `${gone} is no longer here`);
    const named = (name: string) => root.descendants().find((node) => node.tagName === "BUTTON" && node.textContent === name);
    named("Manage projects in the FluxIQ panel")!.dispatch("click");
    await tick();
    named("Change humanness in the FluxIQ panel")!.dispatch("click");
    await tick();
    assert.deepEqual(sent.filter((message) => message.type === "fluxiq.panel.openFluxIQ"), [{ type: "fluxiq.panel.openFluxIQ", purpose: "projects" }, { type: "fluxiq.panel.openFluxIQ" }]);
    const toggle = root.descendants().find((node) => node.id === "autoReconnect")!;
    (toggle as unknown as { checked: boolean }).checked = !(toggle as unknown as { checked: boolean }).checked;
    toggle.dispatch("change");
    root.descendants().find((node) => node.id === "saveSettingsButton")!.dispatch("click");
    await tick();
    const save = sent.find((message) => message.type === "fluxiq.panel.saveSettings") as { settings: Record<string, unknown> } | undefined;
    assert.ok(save);
    assert.equal("humanness" in save.settings, false);
  }));
});

test("the AI key card follows the pushed key state at once, with no second read", async () => {
  await withChrome(() => withFakeDocument(async () => {
    modelDocument();
    let reads = 0;
    let push: ((state: ModelAccessState | null) => void) | undefined;
    const setup = {
      readModelKey: async (): Promise<ModelKeyReading> => {
        reads += 1;
        return { kind: "no-key" };
      },
      subscribeModelKey: (listener: (state: ModelAccessState | null) => void) => ((push = listener), () => undefined)
    };
    const settings = createSettingsView({ store: storeWith(status()), surface: "popup" } as PanelContext, () => undefined, { setup });
    settings.shown();
    await tick();
    const root = fake(settings.element);
    assert.equal(reads, 1);
    assert.ok(root.textContent.includes("No key"));
    push!({ kind: "no-credit", provider: "Anthropic", keyName: "Work key" });
    assert.ok(root.textContent.includes("No credit"));
    assert.equal(root.descendants().some((node) => node.tagName === "BUTTON" && !node.hidden && node.textContent === "Replace key"), false, "no Replace key: the panel changes keys");
    push!({ kind: "ready", provider: "Anthropic", keyName: "Work key" });
    assert.ok(root.textContent.includes("Anthropic is ready, using Work key."));
    assert.equal(reads, 1, "pushes read nothing");
  }));
});
