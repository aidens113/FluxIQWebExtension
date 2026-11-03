// Each port of the extension's chat transport sends the message the panel sent
// before the chat moved into `@fluxiq/ui-components`, and flattens the reply
// the way the port promises.

import assert from "node:assert/strict";
import test from "node:test";
import { ACTIVITY_MESSAGES } from "../../../../shared/activity/index";
import { RUNTIME_MESSAGES } from "../../../../shared/constants";
import { createExtensionChatTransport } from "../create-extension-chat-transport";
import { sendRecorder } from "./send-recorder";

const NO_PUSHES = () => () => undefined;

test("listing a thread sends the conversation read of kind list and answers the relay's payload", async () => {
  const recorder = sendRecorder({ ok: true, value: { ok: true, payload: { conversations: [{ conversationId: "c1" }] } } });
  const transport = createExtensionChatTransport(recorder.request, NO_PUSHES);
  const query = { subjectKind: "flow" as const, subjectId: "flow-1", projectId: "p1", status: "open" as const, limit: 1 };
  const result = await transport.conversation.listThreads(query);
  assert.deepEqual(recorder.sent, [{ type: RUNTIME_MESSAGES.panelConversationRead, kind: "list", ...query }]);
  assert.deepEqual(result, { ok: true, value: { conversations: [{ conversationId: "c1" }] } });
});

test("reading a thread sends the conversation read of kind get and answers the relay's payload", async () => {
  const recorder = sendRecorder({ ok: true, value: { ok: true, payload: { conversation: { turns: [] } } } });
  const transport = createExtensionChatTransport(recorder.request, NO_PUSHES);
  const query = { projectId: "p1", conversationId: "c1", sinceTurnId: "t4", limit: 50 };
  const result = await transport.conversation.readThread(query);
  assert.deepEqual(recorder.sent, [{ type: RUNTIME_MESSAGES.panelConversationRead, kind: "get", ...query }]);
  assert.deepEqual(result, { ok: true, value: { conversation: { turns: [] } } });
});

test("sending and answering carry their fields as the panel always sent them", async () => {
  const recorder = sendRecorder({ ok: true, value: { ok: true } });
  const transport = createExtensionChatTransport(recorder.request, NO_PUSHES);
  const message = { text: "Run it", conversationId: undefined, projectId: "p1", subjectKind: "flow" as const, subjectId: "f1", title: "Tracker", onScreen: { flowId: "f1", recordingId: "r1" } };
  const sent = await transport.conversation.send(message);
  const answered = await transport.conversation.answer({ askId: "a1", kind: "choice", value: "continue", projectId: "p1" });
  assert.deepEqual(recorder.sent, [
    { type: RUNTIME_MESSAGES.panelConversationSend, ...message },
    { type: RUNTIME_MESSAGES.panelConversationAnswer, askId: "a1", kind: "choice", value: "continue", projectId: "p1" }
  ]);
  assert.deepEqual(sent, { ok: true, value: {} });
  assert.deepEqual(answered, { ok: true, value: {} });
});

test("activity reads and overlay changes answer the relay's state", async () => {
  const state = { overlay: "collapsed" };
  const recorder = sendRecorder({ ok: true, value: { ok: true, state } });
  const transport = createExtensionChatTransport(recorder.request, NO_PUSHES);
  const read = await transport.activity.read();
  const changed = await transport.activity.setOverlay?.("hidden");
  assert.deepEqual(recorder.sent, [{ type: ACTIVITY_MESSAGES.read }, { type: ACTIVITY_MESSAGES.setOverlay, overlay: "hidden" }]);
  assert.deepEqual(read, { ok: true, value: { state } });
  assert.deepEqual(changed, { ok: true, value: { state } });
});

test("stop sends the stop message with the target and flattens cancellationRequested", async () => {
  const target = { projectId: "p1", flowId: "f1" };
  const requested = sendRecorder({ ok: true, value: { ok: true, payload: { cancellationRequested: true } } });
  assert.deepEqual(await createExtensionChatTransport(requested.request, NO_PUSHES).runs.stop(target), { ok: true, value: {} });
  assert.deepEqual(requested.sent, [{ type: RUNTIME_MESSAGES.panelStopRun, ...target }]);
  const ended = sendRecorder({ ok: true, value: { ok: true, payload: { cancellationRequested: false } } });
  assert.deepEqual(await createExtensionChatTransport(ended.request, NO_PUSHES).runs.stop({ projectId: "p1", runId: "r1" }), { ok: true, value: { cancellationRequested: false } });
  assert.deepEqual(ended.sent, [{ type: RUNTIME_MESSAGES.panelStopRun, projectId: "p1", runId: "r1" }]);
});

test("take over and hand back send their messages, and a nested refusal is a failed result that keeps its code", async () => {
  const target = { projectId: "p1", runId: "r1" };
  const accepted = sendRecorder({ ok: true, value: { ok: true } });
  const transport = createExtensionChatTransport(accepted.request, NO_PUSHES);
  assert.deepEqual(await transport.runs.takeOver(target), { ok: true, value: undefined });
  assert.deepEqual(await transport.runs.handBack(target), { ok: true, value: undefined });
  assert.deepEqual(accepted.sent, [
    { type: RUNTIME_MESSAGES.panelTakeOverRun, ...target },
    { type: RUNTIME_MESSAGES.panelHandBackRun, ...target }
  ]);
  const refused = sendRecorder({ ok: true, value: { ok: false, sentence: "Author instructions first.", code: "automation.instructions_required" } });
  const refusing = createExtensionChatTransport(refused.request, NO_PUSHES);
  const expected = { ok: false, sentence: "Author instructions first.", code: "automation.instructions_required" };
  assert.deepEqual(await refusing.runs.takeOver(target), expected);
  assert.deepEqual(await refusing.runs.handBack(target), expected);
  assert.deepEqual(await refusing.runs.stop({ projectId: "p1", runId: "r1" }), expected);
});

test("opening a run's instructions sends the open message with the run id", async () => {
  const recorder = sendRecorder({ ok: true, value: { ok: true } });
  const result = await createExtensionChatTransport(recorder.request, NO_PUSHES).runs.openInstructions?.("r1");
  assert.deepEqual(recorder.sent, [{ type: RUNTIME_MESSAGES.panelOpenFluxIQ, runId: "r1" }]);
  assert.deepEqual(result, { ok: true, value: undefined });
});

test("listing recordings sends the list message and answers the items of the relay's page", async () => {
  const recorder = sendRecorder({ ok: true, value: { ok: true, recordings: { items: [{ id: "rec-1" }] } } });
  const transport = createExtensionChatTransport(recorder.request, NO_PUSHES);
  const result = await transport.recordings?.list({ page: 1, pageSize: 25 });
  assert.deepEqual(recorder.sent, [{ type: RUNTIME_MESSAGES.listRecordings, page: 1, pageSize: 25 }]);
  assert.deepEqual(result, { ok: true, value: { items: [{ id: "rec-1" }] } });
});

test("reading model keys sends the readiness message and answers the keys", async () => {
  const recorder = sendRecorder({ ok: true, value: { ok: true, payload: { keys: [{ enabled: true }] } } });
  const result = await createExtensionChatTransport(recorder.request, NO_PUSHES).models?.readKeys();
  assert.deepEqual(recorder.sent, [{ type: RUNTIME_MESSAGES.panelModelReadiness }]);
  assert.deepEqual(result, { ok: true, value: { keys: [{ enabled: true }] } });
});
