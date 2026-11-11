// The thread list's four conversation methods: each sends one background
// message with its fields written by name, and a refusal reaches the list in
// the words it came with -- Core's own for `conversation_run_active` -- through
// the panel's real request path.

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { RUNTIME_MESSAGES } from "../../../../shared/constants";
import { panelRequest } from "../../../state";
import { createExtensionChatTransport } from "../create-extension-chat-transport";
import { sendRecorder } from "./send-recorder";

const NO_PUSHES = () => () => undefined;
const RUN_ACTIVE = "This conversation is still being used by work that is running. Stop it or let it finish, then try again.";

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

test("New chat is a fresh open, never a message; Rename and Delete are their own two messages", async () => {
  const recorder = sendRecorder({ ok: true, value: { ok: true, payload: { conversation: { conversationId: "c9" } } } });
  const port = createExtensionChatTransport(recorder.request, NO_PUSHES).conversation;
  assert.deepEqual(await port.newThread!({ projectId: "p1", subjectKind: "project" }), { ok: true, value: { conversation: { conversationId: "c9" } } });
  await port.newThread!({ subjectKind: "panel" });
  await port.renameThread!({ projectId: "p1", conversationId: "c1", title: "Lamps" });
  await port.renameThread!({ conversationId: "c2", title: "Desks" });
  await port.deleteThread!({ projectId: "p1", conversationId: "c1" });
  await port.deleteThread!({ conversationId: "c2" });
  assert.deepEqual(recorder.sent, [
    { type: RUNTIME_MESSAGES.panelConversationSend, kind: "open", fresh: true, projectId: "p1", subjectKind: "project" },
    { type: RUNTIME_MESSAGES.panelConversationSend, kind: "open", fresh: true, subjectKind: "panel" },
    { type: "fluxiq.panel.conversationRename", projectId: "p1", conversationId: "c1", title: "Lamps" },
    { type: "fluxiq.panel.conversationRename", conversationId: "c2", title: "Desks" },
    { type: "fluxiq.panel.conversationDelete", projectId: "p1", conversationId: "c1" },
    { type: "fluxiq.panel.conversationDelete", conversationId: "c2" }
  ]);
});

test("a delete answers Core's payload as sent", async () => {
  const recorder = sendRecorder({ ok: true, value: { ok: true, payload: { deleted: true, conversationId: "c1" } } });
  const port = createExtensionChatTransport(recorder.request, NO_PUSHES).conversation;
  assert.deepEqual(await port.deleteThread!({ projectId: "p1", conversationId: "c1" }), { ok: true, value: { deleted: true, conversationId: "c1" } });
});

// The background's reply goes through `panelRequest` as it does in the panel,
// whose general sentence would otherwise read "Something went wrong.".
function replyWith(t: TestContext, reply: unknown) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "chrome");
  const runtime = { lastError: undefined, sendMessage: (_message: unknown, respond: (answer: unknown) => void) => respond(reply) };
  Object.defineProperty(globalThis, "chrome", { configurable: true, value: { runtime } });
  t.after(() => { if (previous) Object.defineProperty(globalThis, "chrome", previous); else Reflect.deleteProperty(globalThis, "chrome"); });
}

test("Core's refusal to delete a thread whose work still runs reaches the list in Core's own sentence", async (t) => {
  replyWith(t, { ok: false, code: "failed", httpStatus: 409, error: RUN_ACTIVE });
  const port = createExtensionChatTransport(panelRequest, NO_PUSHES).conversation;
  assert.deepEqual(await port.deleteThread!({ projectId: "p1", conversationId: "c1" }), { ok: false, sentence: RUN_ACTIVE, detail: RUN_ACTIVE, code: "failed" });
});

test("the relay's own refusals keep their words too, on New chat and Rename", async (t) => {
  const noProject = "FluxIQ has not said which project this browser belongs to yet. Connect, then try again.";
  replyWith(t, { ok: false, code: "no_project", error: noProject });
  const port = createExtensionChatTransport(panelRequest, NO_PUSHES).conversation;
  assert.deepEqual(await port.newThread!({ subjectKind: "panel" }), { ok: false, sentence: noProject, detail: noProject, code: "no_project" });
  assert.deepEqual(await port.renameThread!({ conversationId: "c1", title: "x" }), { ok: false, sentence: noProject, detail: noProject, code: "no_project" });
});

test("a failure with no code keeps the panel's own sentence and cause", async () => {
  const recorder = sendRecorder({ ok: false, sentence: "The extension restarted. Close this panel and open it again.", detail: "no answer" });
  const port = createExtensionChatTransport(recorder.request, NO_PUSHES).conversation;
  assert.deepEqual(await port.deleteThread!({ conversationId: "c1" }), {
    ok: false,
    sentence: "The extension restarted. Close this panel and open it again.",
    detail: "no answer",
    cause: "the extension's background didn't answer"
  });
});

test("Core's refusal code reaches the list as coreCode, and the code stays failed, never refused", async (t) => {
  replyWith(t, { ok: false, code: "failed", httpStatus: 409, coreCode: "conversation_run_active", error: RUN_ACTIVE });
  const port = createExtensionChatTransport(panelRequest, NO_PUSHES).conversation;
  assert.deepEqual(await port.deleteThread!({ conversationId: "c1" }), { ok: false, sentence: RUN_ACTIVE, detail: RUN_ACTIVE, code: "failed", coreCode: "conversation_run_active" });
});
