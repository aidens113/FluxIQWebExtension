// The mounted chat, end to end under a fake DOM: `open` switches between the
// latest thread and an automation's (with the context line and its way back),
// what the person sends goes to the thread on screen, an example prompt only
// fills the composer, and the chat has no header of its own.

import assert from "node:assert/strict";
import test from "node:test";
import { ACTIVITY_MESSAGES } from "../../../shared/activity/index";
import { RUNTIME_MESSAGES } from "../../../shared/constants";
import type { ExtensionStatus } from "../../../shared/protocol";
import type { PanelMessage, PanelResult } from "../../state";
import { createChatPanel, type ChatPanel } from "../chat-panel";
import { targetCore, type TargetCore } from "../conversation/tests/target-core";
import type { ChatTarget } from "../target";
import { fake, withFakeDocument, type FakeElement } from "./fake-dom";

const CONNECTED = { connectionState: "connected" } as unknown as ExtensionStatus;
const AUTOMATION: ChatTarget = { kind: "automation", flowId: "flow-7", name: "Price tracker" };
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function mount(core: TargetCore): ChatPanel {
  const request = async <T>(message: PanelMessage): Promise<PanelResult<T>> => core.request<T>(message);
  const opener = () => ({ element: document.createElement("a") as HTMLElement, observe: () => undefined });
  const chat = createChatPanel(request, opener);
  chat.render(CONNECTED);
  return chat;
}

function twoThreads(): TargetCore {
  return targetCore([
    { conversationId: "conv-flow", subjectKind: "flow", subjectId: "flow-7", turns: [{ turnId: "f1", author: "automation", text: "Price tracker is ready." }] },
    { conversationId: "conv-latest", subjectKind: "project", subjectId: "project-1", turns: [{ turnId: "l1", author: "person", text: "Find cheap lamps" }] }
  ]);
}

function words(root: FakeElement): string[] {
  return root.byClass("chat-msg").map((message) => message.textContent);
}

test("open switches threads, shows the automation's name with a way back, and tells who listens", async () => {
  await withFakeDocument(async () => {
    const core = twoThreads();
    const chat = mount(core);
    const heard: ChatTarget[] = [];
    chat.onTargetChange((target) => heard.push(target));
    await settle();
    const root = fake(chat.element);
    assert.deepEqual(words(root), ["Find cheap lamps"]);
    const context = root.byClass("chat-context")[0]!;
    assert.equal(context.hidden, true, "the latest chat needs no context line");

    chat.open(AUTOMATION);
    assert.deepEqual(chat.target(), AUTOMATION);
    assert.equal(context.hidden, false);
    assert.equal(root.byClass("chat-context-name")[0]!.textContent, "Price tracker");
    assert.deepEqual(words(root), [], "the latest thread's turns are gone at once");
    await settle();
    assert.deepEqual(words(root), ["Price tracker is ready."]);

    root.byClass("chat-context-back")[0]!.dispatch("click");
    assert.deepEqual(chat.target(), { kind: "latest" });
    await settle();
    assert.deepEqual(words(root), ["Find cheap lamps"]);
    assert.deepEqual(heard, [AUTOMATION, { kind: "latest" }]);
    assert.equal(root.byClass("chat-header").length + root.byClass("chat-overlay").length, 0, "no header of its own");
  });
});

test("what the person sends goes to the thread on screen", async () => {
  await withFakeDocument(async () => {
    const core = twoThreads();
    const chat = mount(core);
    await settle();
    chat.open(AUTOMATION);
    await settle();
    const root = fake(chat.element);
    const box = root.descendants().find((element) => element.id === "conversationInput")!;
    box.value = "Run it now";
    box.dispatch("input");
    box.dispatch("keydown", { key: "Enter", shiftKey: false, isComposing: false, keyCode: 13, preventDefault: () => undefined });
    await settle();
    const sent = core.sent.filter((message) => message.type === RUNTIME_MESSAGES.panelConversationSend);
    assert.equal(sent.length, 1);
    assert.equal(sent[0]!.conversationId, "conv-flow");
    assert.deepEqual(core.thread("conv-latest")?.turns.length, 1, "the latest thread got nothing");
    await settle();
    assert.deepEqual(words(root), ["Price tracker is ready.", "Run it now"]);
    assert.equal(box.value, "", "the box empties once FluxIQ has the message");
  });
});

test("an empty automation chat offers examples that fill the composer and send nothing", async () => {
  await withFakeDocument(async () => {
    const core = targetCore([]);
    const chat = mount(core);
    chat.open({ kind: "automation", flowId: "flow-9", name: "Job alerts" });
    await settle();
    const root = fake(chat.element);
    const empty = root.byClass("chat-empty")[0]!;
    assert.equal(empty.hidden, false);
    assert.equal(root.byClass("chat-empty-title")[0]!.textContent, "Ask about Job alerts");
    const examples = root.byClass("chat-example");
    assert.equal(examples.length, 3);
    examples[0]!.dispatch("click");
    const box = root.descendants().find((element) => element.id === "conversationInput")!;
    assert.equal(box.value, examples[0]!.textContent);
    assert.equal(core.sent.some((message) => message.type === RUNTIME_MESSAGES.panelConversationSend), false);
    assert.equal(box.placeholder, "Message FluxIQ about Job alerts");
  });
});

test("an automation's chat shows only that automation's live work", async () => {
  await withFakeDocument(async () => {
    const core = twoThreads();
    const at = (second: number) => new Date(Date.UTC(2026, 8, 30, 12, 0, second)).toISOString();
    const other = { activityId: "run:r2", sequence: 1, subject: { kind: "run", id: "r2", projectId: "p", flowId: "flow-8" }, phase: "running", label: "x", at: at(1), detail: { kind: "step", title: "Open the other site", status: "started" } };
    const mine = { activityId: "run:r1", sequence: 2, subject: { kind: "run", id: "r1", projectId: "p", flowId: "flow-7" }, phase: "running", label: "y", at: at(2), detail: { kind: "step", title: "Open the price page", status: "started" } };
    const state = { current: mine, display: null, recent: [other, mine], overlay: "expanded", live: true };
    const request = async <T>(message: PanelMessage): Promise<PanelResult<T>> =>
      message.type === ACTIVITY_MESSAGES.read ? { ok: true, value: { ok: true, state } as T } : core.request<T>(message);
    const globals = globalThis as { chrome?: unknown };
    const before = globals.chrome;
    globals.chrome = { runtime: { onMessage: { addListener: () => undefined, removeListener: () => undefined } } };
    const chat = createChatPanel(request, () => ({ element: document.createElement("a") as HTMLElement, observe: () => undefined }));
    try {
      chat.render(CONNECTED);
      chat.setActive(true);
      chat.open(AUTOMATION);
      await settle();
      const titles = fake(chat.element).byClass("chat-step-title").map((element) => element.textContent);
      assert.deepEqual(titles, ["Open the price page"]);
      chat.open({ kind: "latest" });
      await settle();
      assert.deepEqual(fake(chat.element).byClass("chat-step-title").map((element) => element.textContent), ["Open the other site", "Open the price page"]);
    } finally {
      chat.setActive(false);
      globals.chrome = before;
    }
  });
});

test("a panel that names the automation itself can leave the chat's context line out", async () => {
  await withFakeDocument(async () => {
    const core = twoThreads();
    const request = async <T>(message: PanelMessage): Promise<PanelResult<T>> => core.request<T>(message);
    const chat = createChatPanel(request, () => ({ element: document.createElement("a") as HTMLElement, observe: () => undefined }), { contextLine: false });
    chat.render(CONNECTED);
    chat.open(AUTOMATION);
    await settle();
    const root = fake(chat.element);
    assert.equal(root.byClass("chat-context").length, 0);
    assert.deepEqual(words(root), ["Price tracker is ready."]);
  });
});
