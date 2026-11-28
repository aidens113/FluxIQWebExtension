// The thread list's two conversation methods (the list and New chat): each sends one background
// message with its fields written by name, and a refusal reaches the list in
// the words it came with through the panel's real request path.

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { RUNTIME_MESSAGES } from "../../../../shared/constants";
import { panelRequest } from "../../../state";
import { createExtensionChatTransport } from "../create-extension-chat-transport";
import { sendRecorder } from "./send-recorder";

const NO_PUSHES = () => () => undefined;

test("the list reads kind list-all with the project and page size it was asked for, and nothing else", async () => {
  const recorder = sendRecorder({ ok: true, value: { ok: true, payload: { conversations: [{ conversationId: "c1" }] } } });
  const port = createExtensionChatTransport(recorder.request, NO_PUSHES).conversation;
  assert.deepEqual(await port.listAllThreads!({ projectId: "p1", limit: 25 }), { ok: true, value: { conversations: [{ conversationId: "c1" }] } });
  await port.listAllThreads!({ limit: 50 });
  assert.deepEqual(recorder.sent, [
    { type: RUNTIME_MESSAGES.panelConversationRead, kind: "list-all", projectId: "p1", limit: 25 },
    { type: RUNTIME_MESSAGES.panelConversationRead, kind: "list-all", limit: 50 }
  ]);
});

test("New chat is a fresh open, never a message", async () => {
  const recorder = sendRecorder({ ok: true, value: { ok: true, payload: { conversation: { conversationId: "c9" } } } });
  const port = createExtensionChatTransport(recorder.request, NO_PUSHES).conversation;
  assert.deepEqual(await port.newThread!({ projectId: "p1", subjectKind: "project" }), { ok: true, value: { conversation: { conversationId: "c9" } } });
  await port.newThread!({ subjectKind: "panel" });
  assert.deepEqual(recorder.sent, [
    { type: RUNTIME_MESSAGES.panelConversationSend, kind: "open", fresh: true, projectId: "p1", subjectKind: "project" },
    { type: RUNTIME_MESSAGES.panelConversationSend, kind: "open", fresh: true, subjectKind: "panel" }
  ]);
});

test("the extension's conversation port has no Rename or Delete: managing chats is the FluxIQ panel's", () => {
  const port = createExtensionChatTransport(sendRecorder({ ok: true, value: {} }).request, NO_PUSHES).conversation;
  assert.equal(port.renameThread, undefined);
  assert.equal(port.deleteThread, undefined);
});

// The background's reply goes through `panelRequest` as it does in the panel,
// whose general sentence would otherwise read "Something went wrong.".
function replyWith(t: TestContext, reply: unknown) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "chrome");
  const runtime = { lastError: undefined, sendMessage: (_message: unknown, respond: (answer: unknown) => void) => respond(reply) };
  Object.defineProperty(globalThis, "chrome", { configurable: true, value: { runtime } });
  t.after(() => { if (previous) Object.defineProperty(globalThis, "chrome", previous); else Reflect.deleteProperty(globalThis, "chrome"); });
}

test("the relay's own refusals keep their words too, on New chat", async (t) => {
  const noProject = "Make a project in the FluxIQ panel, or send a message and FluxIQ makes one.";
  replyWith(t, { ok: false, code: "no_project", error: noProject });
  const port = createExtensionChatTransport(panelRequest, NO_PUSHES).conversation;
  assert.deepEqual(await port.newThread!({ subjectKind: "panel" }), { ok: false, sentence: noProject, detail: noProject, code: "no_project" });
});

test("a failure with no code keeps the panel's own sentence and cause", async () => {
  const recorder = sendRecorder({ ok: false, sentence: "The extension restarted. Close this panel and open it again.", detail: "no answer" });
  const port = createExtensionChatTransport(recorder.request, NO_PUSHES).conversation;
  assert.deepEqual(await port.newThread!({ subjectKind: "panel" }), {
    ok: false,
    sentence: "The extension restarted. Close this panel and open it again.",
    detail: "no answer",
    cause: "the extension's background didn't answer"
  });
});
