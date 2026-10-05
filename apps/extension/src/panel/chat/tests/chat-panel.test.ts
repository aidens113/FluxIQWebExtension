// The mounted chat, end to end under a fake DOM: `open` switches between the
// latest thread and an automation's (with the context line and its way back),
// what the person sends goes to the thread on screen, an example prompt only
// fills the composer, the chat has no header of its own, and a settled
// build's every step stays in the chat as its own message, between the
// person's message and the answer.

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
    const mine = { activityId: "run:r1", sequence: 2, subject: { kind: "run", id: "r1", projectId: "project-1", flowId: "flow-7" }, phase: "running", label: "y", at: at(2), detail: { kind: "step", title: "Open the price page", status: "started" } };
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

test("a run waiting on the person in a thread not on screen shows in the latest chat, and one click brings its Continue and Stop", async () => {
  // A run started from the automations tab: Core parks its person-needed ask
  // in the run's own thread (subject run), which no chat on screen shows.
  await withFakeDocument(async () => {
    const ask = "FluxIQ needs you: complete the check on this page, then press Continue.";
    const core = targetCore([
      {
        conversationId: "conv-run-r1",
        subjectKind: "run",
        subjectId: "r1",
        turns: [{ turnId: "q1", author: "automation", text: ask, ask: { askId: "ask-1", kind: "choice", status: "pending", options: [{ id: "done", label: "Continue" }, { id: "stop", label: "Stop" }] } }]
      },
      { conversationId: "conv-latest", subjectKind: "project", subjectId: "project-1", turns: [{ turnId: "l1", author: "person", text: "Find cheap lamps" }] }
    ]);
    const at = new Date(Date.UTC(2026, 8, 30, 12, 0, 5)).toISOString();
    const waiting = { activityId: "run:r1", sequence: 5, subject: { kind: "run", id: "r1", projectId: "project-1", flowId: "flow-7" }, phase: "waiting_permission", label: ask, at, detail: { kind: "ask", title: "Asked the person to complete a check", status: "started", ref: "ask-1" } };
    const display = { activityId: "run:r1", subjectKind: "run", phase: "waiting_permission", headline: "Waiting for you: answer in the FluxIQ panel", detail: ask, step: null, working: false, outcome: "waiting", sequence: 5 };
    const state = { current: waiting, display, recent: [waiting], overlay: "expanded", live: true };
    const request = async <T>(message: PanelMessage): Promise<PanelResult<T>> =>
      message.type === ACTIVITY_MESSAGES.read ? { ok: true, value: { ok: true, state } as T } : core.request<T>(message);
    const globals = globalThis as { chrome?: unknown };
    const before = globals.chrome;
    globals.chrome = { runtime: { onMessage: { addListener: () => undefined, removeListener: () => undefined } } };
    const chat = createChatPanel(request, () => ({ element: document.createElement("a") as HTMLElement, observe: () => undefined }));
    try {
      chat.render(CONNECTED);
      chat.setActive(true);
      await settle();
      const root = fake(chat.element);
      assert.deepEqual(words(root), ["Find cheap lamps"]);
      const live = root.byClass("chat-live")[0]!;
      assert.equal(live.hidden, false, "the latest chat shows the wait");
      assert.equal(live.getAttribute("data-state"), "waiting");
      assert.equal(root.byClass("chat-live-detail")[0]!.textContent, ask);
      const action = root.byClass("chat-live-action")[0]!;
      assert.equal(action.hidden, false);
      assert.equal(action.textContent, "Show the question");

      action.dispatch("click");
      assert.deepEqual(chat.target(), { kind: "question", activityId: "run:r1", subjectKind: "run", subjectId: "r1", title: "The run's question", projectId: "project-1" });
      assert.equal(root.byClass("chat-context")[0]!.hidden, false);
      assert.equal(root.byClass("chat-context-name")[0]!.textContent, "The run's question");
      assert.equal(root.byClass("chat-context-kind")[0]!.hidden, true);
      await settle();
      const listed = core.sent.filter((message) => message.type === RUNTIME_MESSAGES.panelConversationRead && message.kind === "list").at(-1);
      assert.equal(listed?.subjectKind, "run");
      assert.equal(listed?.subjectId, "r1");
      assert.equal(words(root).length, 1);
      assert.match(words(root)[0]!, /complete the check on this page/u);
      assert.equal(root.byClass("chat-live-action")[0]!.hidden, true, "the question is on screen now");
      const buttons = root.byClass("small-button");
      assert.deepEqual(buttons.map((button) => button.textContent), ["Continue", "Stop"]);

      buttons[0]!.dispatch("click");
      await settle();
      const answered = core.sent.filter((message) => message.type === RUNTIME_MESSAGES.panelConversationAnswer);
      assert.deepEqual(answered.map((message) => [message.askId, message.kind, message.value]), [["ask-1", "choice", "done"]]);

      root.byClass("chat-context-back")[0]!.dispatch("click");
      assert.deepEqual(chat.target(), { kind: "latest", projectId: "project-1" });
      await settle();
      assert.deepEqual(words(root), ["Find cheap lamps"]);
    } finally {
      chat.setActive(false);
      globals.chrome = before;
    }
  });
});

test("a settled build's every decision stays as its own message, with its reason, between the message and the answer", async () => {
  await withFakeDocument(async () => {
    const second = (value: number) => Date.UTC(2026, 8, 30, 12, 0, 0) + value * 1_000;
    const core = targetCore([{
      conversationId: "conv-latest",
      subjectKind: "project",
      subjectId: "project-1",
      turns: [
        { turnId: "p1", author: "person", text: "Get me a quote", createdAt: second(0) },
        { turnId: "a1", author: "automation", text: "Your quote form is ready.", createdAt: second(500) }
      ]
    }]);
    const subject = { kind: "build", id: "b1", projectId: "project-1" };
    const history: unknown[] = [];
    const recent: unknown[] = [];
    for (let index = 1; index <= 80; index += 1) {
      const at = new Date(second(index * 5)).toISOString();
      const title = `Clicking button ${index}`;
      const decided = { activityId: "build:b1", sequence: index * 3, subject, phase: "exploring", label: title, at, detail: { kind: "thought", title, text: `Reason ${index}.`, status: "succeeded" } };
      const acted = { activityId: "build:b1", sequence: index * 3 + 1, subject, phase: "exploring", label: title, at, detail: { kind: "tool", title, ref: "core.run_node", status: "succeeded" } };
      history.push(decided, acted);
      recent.push({ activityId: "build:b1", sequence: index * 3 - 1, subject, phase: "thinking", label: "Deciding", at, detail: { kind: "thought", title: "Deciding the next step", status: "started" } }, decided, acted);
    }
    const display = { activityId: "build:b1", subjectKind: "build", phase: "done", headline: "Flow ready", detail: null, step: null, working: false, outcome: "done", sequence: 241 };
    const state = { current: recent.at(-1), display, recent: recent.slice(-60), history, overlay: "expanded", live: true };
    const request = async <T>(message: PanelMessage): Promise<PanelResult<T>> =>
      message.type === ACTIVITY_MESSAGES.read ? { ok: true, value: { ok: true, state } as T } : core.request<T>(message);
    const globals = globalThis as { chrome?: unknown };
    const before = globals.chrome;
    globals.chrome = { runtime: { onMessage: { addListener: () => undefined, removeListener: () => undefined } } };
    const chat = createChatPanel(request, () => ({ element: document.createElement("a") as HTMLElement, observe: () => undefined }));
    try {
      chat.render(CONNECTED);
      chat.setActive(true);
      await settle();
      const root = fake(chat.element);
      const stream = root.byClass("chat-stream")[0]!.children.filter((child) => !child.hidden);
      assert.equal(stream.length, 82);
      assert.equal(stream[0]!.getAttribute("data-author"), "person");
      assert.equal(stream[81]!.getAttribute("data-author"), "fluxiq");
      const steps = root.byClass("chat-step-msg");
      assert.equal(steps.length, 80, "all 80 decisions, not only the relay's last 60 events");
      assert.equal(steps[0]!.byClass("chat-step-title")[0]!.textContent, "Clicking button 1");
      assert.equal(steps[0]!.byClass("chat-step-text")[0]!.textContent, " — Reason 1.");
      assert.equal(steps[0]!.byClass("chat-card-outcome")[0]!.textContent, "Done");
      assert.equal(steps[0]!.byClass("chat-card")[0]!.getAttribute("aria-label"), "Click: Done");
      assert.equal(root.byClass("chat-work").length, 0, "no fold");
    } finally {
      chat.setActive(false);
      globals.chrome = before;
    }
  });
});
