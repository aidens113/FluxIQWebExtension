// Coverage of conversation-relay.ts: which Core endpoint each conversation
// message becomes, with what payload, and that Core's answer -- success or
// failure -- returns exactly as Core gave it. Nothing is remembered between
// calls, so each test builds a fresh relay context and nothing else.

import assert from "node:assert/strict";
import test from "node:test";

import { RUNTIME_MESSAGES } from "../../../shared/constants";
import type { PanelRelayResponse } from "../../../shared/protocol";
import { relayConversation } from "../conversation-relay";
import type { PanelRelayContext } from "../relay-context";

function context(answers: Record<string, PanelRelayResponse> = {}, projectId: string | null | undefined = "project-session") {
  const calls: Array<{ endpoint: string; payload: Record<string, unknown> }> = [];
  const value: PanelRelayContext = {
    call: async (endpoint, payload) => {
      calls.push({ endpoint, payload });
      return answers[endpoint] ?? { ok: true, payload: { endpoint } };
    },
    projectId: () => projectId
  };
  return { value, calls };
}

const read = RUNTIME_MESSAGES.panelConversationRead;
const send = RUNTIME_MESSAGES.panelConversationSend;
const answer = RUNTIME_MESSAGES.panelConversationAnswer;

test("a list reads the session's project by default, every project on an explicit null, and a named one as named", async () => {
  const c = context();
  await relayConversation({ type: read, kind: "list" }, c.value);
  await relayConversation({ type: read, kind: "list", projectId: null, limit: 5, status: "open" }, c.value);
  await relayConversation({ type: read, kind: "list", projectId: "project-2", subjectKind: "run", subjectId: "run-1" }, c.value);
  assert.deepEqual(c.calls, [
    { endpoint: "list-conversations", payload: { projectId: "project-session" } },
    { endpoint: "list-conversations", payload: { projectId: null, status: "open", limit: 5 } },
    { endpoint: "list-conversations", payload: { projectId: "project-2", subjectKind: "run", subjectId: "run-1" } }
  ]);
});

test("a list with no project known anywhere asks across every project", async () => {
  const c = context({}, null);
  await relayConversation({ type: read, kind: "list" }, c.value);
  assert.deepEqual(c.calls, [{ endpoint: "list-conversations", payload: { projectId: null } }]);
});

test("the project's own thread: a project subject with no id is given the project's id, which Core needs whole", async () => {
  const c = context();
  await relayConversation({ type: read, kind: "list", status: "open", limit: 1, subjectKind: "project" }, c.value);
  await relayConversation({ type: read, kind: "list", projectId: "project-2", subjectKind: "project" }, c.value);
  await relayConversation({ type: read, kind: "list", subjectKind: "project", subjectId: "project-9" }, c.value);
  assert.deepEqual(c.calls, [
    { endpoint: "list-conversations", payload: { projectId: "project-session", status: "open", subjectKind: "project", subjectId: "project-session", limit: 1 } },
    { endpoint: "list-conversations", payload: { projectId: "project-2", subjectKind: "project", subjectId: "project-2" } },
    { endpoint: "list-conversations", payload: { projectId: "project-session", subjectKind: "project", subjectId: "project-9" } }
  ]);
});

test("the project's own thread with no project known is refused before Core is called, never widened to every thread", async () => {
  const noProject = { ok: false, code: "no_project", error: "FluxIQ has not said which project this browser belongs to yet. Connect, then try again." };
  const c = context({}, null);
  assert.deepEqual(await relayConversation({ type: read, kind: "list", subjectKind: "project" }, c.value), noProject);
  const d = context();
  assert.deepEqual(await relayConversation({ type: read, kind: "list", projectId: null, subjectKind: "project" }, d.value), noProject);
  assert.deepEqual([...c.calls, ...d.calls], []);
});

test("a get reads one thread, from a turn when given", async () => {
  const c = context();
  const reply = await relayConversation({ type: read, kind: "get", conversationId: "c-1", sinceTurnId: "t-9", limit: 20 }, c.value);
  assert.deepEqual(c.calls, [{ endpoint: "get-conversation", payload: { projectId: "project-session", conversationId: "c-1", sinceTurnId: "t-9", limit: 20 } }]);
  assert.deepEqual(reply, { ok: true, payload: { endpoint: "get-conversation" } });
});

test("a get without a thread, or with no project, is refused before Core is called", async () => {
  const c = context({}, null);
  assert.deepEqual(await relayConversation({ type: read, kind: "get", conversationId: "c-1" }, c.value), {
    ok: false, code: "no_project", error: "FluxIQ has not said which project this browser belongs to yet. Connect, then try again."
  });
  const d = context();
  assert.deepEqual(await relayConversation({ type: read, kind: "get" }, d.value), { ok: false, code: "invalid_request", error: "Say which conversation to read." });
  assert.deepEqual([...c.calls, ...d.calls], []);
});

test("a message into a thread is one append-turn, with an empty capability list so Core answers it", async () => {
  const c = context();
  await relayConversation({ type: send, conversationId: "c-1", text: "  Find me cheap flights  " }, c.value);
  await relayConversation({ type: send, conversationId: "c-1", text: "Stop that", capabilities: [{ id: "x" }], onScreen: { runId: "r-1" } }, c.value);
  assert.deepEqual(c.calls, [
    { endpoint: "append-turn", payload: { projectId: "project-session", conversationId: "c-1", text: "Find me cheap flights", capabilities: [] } },
    { endpoint: "append-turn", payload: { projectId: "project-session", conversationId: "c-1", text: "Stop that", capabilities: [{ id: "x" }], onScreen: { runId: "r-1" } } }
  ]);
});

test("a first message opens its thread, sends into it, and the reply carries the opened conversation beside Core's answer", async () => {
  const conversation = { conversationId: "c-new", projectId: "project-session", title: null };
  const c = context({
    "open-conversation": { ok: true, payload: { conversation } },
    "append-turn": { ok: true, payload: { turn: { turnId: "t-1" }, response: { text: "On it." }, problem: null } }
  });
  const reply = await relayConversation({ type: send, text: "Hello", title: "Flights" }, c.value);
  assert.deepEqual(c.calls, [
    { endpoint: "open-conversation", payload: { projectId: "project-session", title: "Flights" } },
    { endpoint: "append-turn", payload: { projectId: "project-session", conversationId: "c-new", text: "Hello", capabilities: [] } }
  ]);
  assert.deepEqual(reply, { ok: true, payload: { conversation, turn: { turnId: "t-1" }, response: { text: "On it." }, problem: null } });
});

test("open alone opens a thread and sends nothing", async () => {
  const c = context();
  await relayConversation({ type: send, kind: "open", subjectKind: "flow", subjectId: "f-1" }, c.value);
  assert.deepEqual(c.calls, [{ endpoint: "open-conversation", payload: { projectId: "project-session", subjectKind: "flow", subjectId: "f-1" } }]);
});

test("an empty message is refused, and a failed open sends nothing and comes back as Core said it", async () => {
  const c = context();
  assert.deepEqual(await relayConversation({ type: send, conversationId: "c-1", text: "   " }, c.value), { ok: false, code: "invalid_request", error: "There is no message to send." });
  assert.deepEqual(c.calls, []);

  const refused: PanelRelayResponse = { ok: false, code: "refused", httpStatus: 403, error: "This endpoint is not available to a paired client." };
  const d = context({ "open-conversation": refused });
  assert.deepEqual(await relayConversation({ type: send, text: "Hello" }, d.value), refused);
  assert.deepEqual(d.calls.map((entry) => entry.endpoint), ["open-conversation"]);
});

test("an answer names the ask and its kind, and keeps a value only when it is text", async () => {
  const c = context();
  await relayConversation({ type: answer, askId: "ask-1", kind: "approve" }, c.value);
  await relayConversation({ type: answer, askId: "ask-2", kind: "reply", value: "Use the blue one", projectId: "project-2" }, c.value);
  await relayConversation({ type: answer, askId: "ask-3", kind: "reply", value: 7 }, c.value);
  assert.deepEqual(c.calls, [
    { endpoint: "answer-ask", payload: { projectId: "project-session", askId: "ask-1", kind: "approve" } },
    { endpoint: "answer-ask", payload: { projectId: "project-2", askId: "ask-2", kind: "reply", value: "Use the blue one" } },
    { endpoint: "answer-ask", payload: { projectId: "project-session", askId: "ask-3", kind: "reply" } }
  ]);
  assert.deepEqual(await relayConversation({ type: answer, askId: "ask-1" }, c.value), { ok: false, code: "invalid_request", error: "Say which question this answers, and how." });
});

test("any other message is not the relay's", async () => {
  assert.equal(await relayConversation({ type: RUNTIME_MESSAGES.panelStopRun }, context().value), undefined);
});
