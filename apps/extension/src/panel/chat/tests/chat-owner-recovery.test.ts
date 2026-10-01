import assert from "node:assert/strict";
import test from "node:test";
import { createChatPanel } from "../chat-panel";
import { targetCore } from "../conversation/tests/target-core";
import { fake, withFakeDocument } from "./fake-dom";
import { statusWith } from "../../tests/status-fixture";
import { RUNTIME_MESSAGES as M } from "../../../shared/constants";
import { ACTIVITY_MESSAGES } from "../../../shared/activity/index";
import { activityEvent, relayState } from "./activity-fixture";
import type { PanelMessage, PanelStore } from "../../state";
const settle = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const status = (projectId = "project-1", coreApiUrl = "http://core-a.invalid") => statusWith({ connectionState: "connected", paired: true, projectId, settings: { coreApiUrl, gatewayUrl: "ws://gateway.invalid", autoReconnect: true, captureMutations: false, captureInputValues: false, captureSnapshots: false } });
for (const changed of ["project", "core"] as const) test(`confirmed ${changed} replacement immediately retires old target and turns`, async () => withFakeDocument(async () => {
  const core = targetCore([{ conversationId: "same-id", subjectKind: "flow", subjectId: "f", turns: [{ turnId: "t", author: "person", text: "Old owner message" }] }]);
  const chat = createChatPanel((message) => core.request(message), () => ({ element: document.createElement("a"), observe() {} }));
  chat.render(status()); chat.open({ kind: "automation", flowId: "f", name: "Old automation" }); await settle();
  assert.equal(fake(chat.element).byClass("chat-msg")[0]?.textContent, "Old owner message"); core.hold = true;
  chat.render(changed === "project" ? status("project-2") : status("project-1", "http://core-b.invalid"));
  assert.deepEqual(chat.target(), { kind: "latest" }); assert.equal(fake(chat.element).byClass("chat-msg").length, 0);
  core.hold = false; core.release(); await settle(); chat.setActive(false);
}));
async function runtime(body: (listeners: Set<(message: unknown) => void>) => Promise<void>) {
  const before = Object.getOwnPropertyDescriptor(globalThis, "chrome"); const listeners = new Set<(message: unknown) => void>();
  Object.defineProperty(globalThis, "chrome", { configurable: true, value: { runtime: { onMessage: { addListener: (fn: (message: unknown) => void) => listeners.add(fn), removeListener: (fn: (message: unknown) => void) => listeners.delete(fn) } } } });
  try { await withFakeDocument(() => body(listeners)); } finally { if (before) Object.defineProperty(globalThis, "chrome", before); else Reflect.deleteProperty(globalThis, "chrome"); }
}
const opener = () => ({ element: document.createElement("a"), observe() {} });
const thread = (text: string, ask = false) => targetCore([{ conversationId: "same-id", subjectKind: "project", subjectId: "project-1", turns: [{ turnId: "same-turn", author: "automation", text, ...(ask ? { ask: { askId: "same-ask", kind: "confirm", status: "pending" } } : {}) }] }]);
test("historical first initialization reads once; later never-activated replacement waits for activation", async () => runtime(async () => {
  let core = thread("First owner"); const calls: PanelMessage[] = []; const request: PanelStore["request"] = (message) => { calls.push(message); return core.request(message); };
  const chat = createChatPanel(request, opener); try {
    chat.render(status()); await settle(); assert.equal(fake(chat.element).byClass("chat-msg")[0]!.textContent, "First owner"); const before = calls.length;
    core = thread("Second owner"); chat.render(status("project-2")); await settle(); assert.equal(calls.length, before); assert.equal(fake(chat.element).byClass("chat-msg").length, 0);
    chat.setActive(true); await settle(); assert.equal(fake(chat.element).byClass("chat-msg")[0]!.textContent, "Second owner");
  } finally { chat.setActive(false); }
}));
test("explicit inactive replacement masks history and retained examples until active", async () => runtime(async () => {
  let core = targetCore([]); const chat = createChatPanel((message) => core.request(message), opener); try {
    chat.render(status()); chat.setActive(true); chat.open({ kind: "automation", flowId: "f", name: "Example flow" }); await settle();
    const root = fake(chat.element), oldExample = root.byClass("chat-example")[0]!; chat.setActive(false); const before = core.sent.length;
    chat.render(status("project-2")); oldExample.dispatch("click"); await settle(); assert.equal(core.sent.length, before); assert.equal(root.descendants().find((node) => node.id === "conversationInput")!.value, ""); assert.deepEqual(chat.target(), { kind: "latest" });
    chat.setActive(true); await settle(); assert.ok(core.sent.length > before);
  } finally { chat.setActive(false); }
}));
test("same-ID retained ask cannot answer a replacement owner while current ask remains usable", async () => runtime(async () => {
  let core = thread("Old question", true); const chat = createChatPanel((message) => core.request(message), opener); try {
    chat.render(status()); chat.setActive(true); await settle(); const root = fake(chat.element); const oldAnswer = root.byClass("small-button")[0]!;
    core = thread("New question", true); chat.render(status("project-2")); await settle(); oldAnswer.dispatch("click"); await settle(); assert.equal(core.sent.some((message) => message.type === M.panelConversationAnswer), false);
    root.byClass("small-button")[0]!.dispatch("click"); await settle(); assert.equal(core.sent.filter((message) => message.type === M.panelConversationAnswer).length, 1);
  } finally { chat.setActive(false); }
}));
test("old pending thread and activity completions/listeners cannot publish into new owner", async () => runtime(async (listeners) => {
  const coreA = thread("Old result"), coreB = thread("Current result"); let core = coreA; let finishActivity!: (value: any) => void; let holdActivity = true;
  const request: PanelStore["request"] = <T>(message: PanelMessage) => message.type === ACTIVITY_MESSAGES.read
    ? holdActivity ? new Promise((resolve) => { finishActivity = resolve; }) : Promise.resolve({ ok: true, value: { state: relayState([]) } as T })
    : core.request<T>(message);
  coreA.hold = true; const chat = createChatPanel(request, opener); try {
    chat.render(status()); chat.setActive(true); const oldListener = [...listeners][0]!;
    core = coreB; holdActivity = false; chat.render(status("project-2")); await settle(); assert.equal(fake(chat.element).byClass("chat-msg")[0]!.textContent, "Current result");
    oldListener({ type: ACTIVITY_MESSAGES.changed, state: relayState([activityEvent(1, { detail: { kind: "step", title: "Obsolete step", status: "started" } })]) });
    finishActivity({ ok: true, value: { state: relayState([activityEvent(1)]) } }); coreA.hold = false; coreA.release(); await settle();
    assert.equal(fake(chat.element).byClass("chat-msg")[0]!.textContent, "Current result"); assert.equal(fake(chat.element).byClass("chat-step-title").length, 0); assert.equal(listeners.size, 1);
  } finally { chat.setActive(false); } assert.equal(listeners.size, 0);
}));
test("same-owner missing settings/reconnect and passive name keep target, draft and confirmed turns", async () => runtime(async () => {
  const core = targetCore([{ conversationId: "f", subjectKind: "flow", subjectId: "f", turns: [{ turnId: "t", author: "person", text: "Confirmed" }] }]); const chat = createChatPanel((message) => core.request(message), opener); try {
    chat.render(status()); chat.setActive(true); chat.open({ kind: "automation", flowId: "f", name: "Name" }); await settle(); const root = fake(chat.element), box = root.descendants().find((node) => node.id === "conversationInput")!; box.value = "New draft"; box.dispatch("input");
    chat.render({ ...status(), settings: undefined, connectionState: "disconnected" }); assert.equal(root.byClass("chat-msg")[0]!.textContent, "Confirmed");
    chat.render({ ...status(), settings: undefined, sessionId: "fresh-session", queueSize: 9, activeTabId: 99 }); chat.updateAutomationName({ flowId: "f", name: "Renamed" }); await settle();
    assert.equal(chat.target().kind, "automation"); assert.equal(box.value, "New draft"); assert.equal(root.byClass("chat-msg")[0]!.textContent, "Confirmed"); assert.equal(root.byClass("composer-draft-review")[0]!.hidden, true);
  } finally { chat.setActive(false); }
}));
test("unsupported conversation capability stays mounted-lifetime sticky across owner replacement", async () => runtime(async () => {
  let conversationReads = 0; const request: PanelStore["request"] = <T>(message: PanelMessage) => {
    if (message.type === M.panelConversationRead) { conversationReads++; return Promise.resolve({ ok: false, unsupported: true, sentence: "Unsupported" }); }
    return Promise.resolve({ ok: true, value: { state: relayState([]) } as T });
  };
  const chat = createChatPanel(request, opener); try { chat.render(status()); chat.setActive(true); await settle(); const before = conversationReads; chat.render(status("project-2")); await settle(); assert.equal(conversationReads, before); assert.equal(fake(chat.element).byClass("chat-fallback")[0]!.hidden, false); } finally { chat.setActive(false); }
}));
test("owner reset is coherent before a synchronous target listener activates current reads", async () => runtime(async () => {
  let core = thread("Old"); const chat = createChatPanel((message) => core.request(message), opener); try {
    chat.render(status()); chat.open({ kind: "automation", flowId: "f", name: "Old flow" }); await settle(); let notified = 0;
    chat.onTargetChange((target) => { notified++; assert.deepEqual(target, { kind: "latest" }); assert.equal(fake(chat.element).byClass("chat-msg").length, 0); chat.setActive(true); });
    core = thread("Current"); chat.render(status("project-2")); await settle(); assert.equal(notified, 1); assert.equal(fake(chat.element).byClass("chat-msg")[0]!.textContent, "Current");
  } finally { chat.setActive(false); }
}));
test("retained retired poll callbacks cannot dispatch under a replacement or reactivated owner", async () => runtime(async () => {
  const intervalBefore = Object.getOwnPropertyDescriptor(globalThis, "setInterval"), clearBefore = Object.getOwnPropertyDescriptor(globalThis, "clearInterval"); const callbacks: Array<() => void> = [];
  Object.defineProperty(globalThis, "setInterval", { configurable: true, value: (fn: () => void) => { callbacks.push(fn); return callbacks.length; } }); Object.defineProperty(globalThis, "clearInterval", { configurable: true, value: () => {} });
  const core = thread("Current"); const chat = createChatPanel((message) => core.request(message), opener);
  try {
    chat.render(status()); chat.setActive(true); await settle(); const old = callbacks[0]!; chat.render(status("project-2")); await settle(); const before = core.sent.length;
    old(); await settle(); assert.equal(core.sent.length, before);
    const inactive = callbacks.at(-1)!; chat.setActive(false); chat.setActive(true); await settle(); const resumed = core.sent.length; inactive(); await settle(); assert.equal(core.sent.length, resumed);
  } finally { chat.setActive(false); if (intervalBefore) Object.defineProperty(globalThis, "setInterval", intervalBefore); if (clearBefore) Object.defineProperty(globalThis, "clearInterval", clearBefore); }
}));
