// Coverage of conversation-relay.ts: which Core endpoint each conversation
// message becomes, with what payload, and that Core's answer -- success or
// failure -- returns exactly as Core gave it. Nothing is remembered between
// calls, so each test builds a fresh relay context and nothing else. Every
// message offers Core the chat's capability ids and says which page the person
// is on, so those rules are covered here too.

import assert from "node:assert/strict";
import test from "node:test";

import { RUNTIME_MESSAGES } from "../../../shared/constants";
import type { PanelRelayResponse } from "../../../shared/protocol";
import { CHAT_CAPABILITIES } from "../chat-capabilities";
import { relayConversation } from "../conversation-relay";
import { acceptedPageUrl } from "../page-url";
import type { PanelRelayContext } from "../relay-context";

function context(
  answers: Record<string, PanelRelayResponse> = {},
  projectId: string | null | undefined = "project-session",
  pageLocation: PanelRelayContext["pageLocation"] = async () => undefined
) {
  const calls: Array<{ endpoint: string; payload: Record<string, unknown> }> = [];
  const value: PanelRelayContext = {
    call: async (endpoint, payload) => {
      calls.push({ endpoint, payload });
      return answers[endpoint] ?? { ok: true, payload: { endpoint } };
    },
    projectId: () => projectId,
    pageLocation
  };
  return { value, calls };
}

const offered = [
  { id: "flow.createHere" },
  { id: "flow.describe" },
  { id: "flow.explore" },
  { id: "flow.improve" },
  { id: "run.execute" },
  { id: "ask.answer" }
];

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

test("a message into a thread is one append-turn offering the chat's six capabilities, and the panel's own after them", async () => {
  const c = context();
  await relayConversation({ type: send, conversationId: "c-1", text: "  Find me cheap flights  " }, c.value);
  await relayConversation({ type: send, conversationId: "c-1", text: "Stop that", capabilities: [{ id: "x" }], onScreen: { runId: "r-1" } }, c.value);
  assert.deepEqual(c.calls, [
    { endpoint: "append-turn", payload: { projectId: "project-session", conversationId: "c-1", text: "Find me cheap flights", capabilities: offered } },
    { endpoint: "append-turn", payload: { projectId: "project-session", conversationId: "c-1", text: "Stop that", capabilities: [...offered, { id: "x" }], onScreen: { runId: "r-1" } } }
  ]);
});

test("the capability list is the frozen six ids Core executes", () => {
  assert.deepEqual(CHAT_CAPABILITIES, offered);
  assert.ok(Object.isFrozen(CHAT_CAPABILITIES));
  assert.ok(CHAT_CAPABILITIES.every((capability) => Object.isFrozen(capability) && Object.keys(capability).join() === "id"));
});

test("a panel capability with an id already offered is dropped, as are repeats and entries that are not objects", async () => {
  const c = context();
  const panelRun = { id: "run.execute", label: "Run", description: "The panel's own wording" };
  await relayConversation({
    type: send,
    conversationId: "c-1",
    text: "Run it",
    capabilities: [panelRun, { id: "panel.stop" }, { id: "panel.stop", label: "again" }, "flow.describe", null, 7, ["x"], { label: "no id" }]
  }, c.value);
  assert.deepEqual(c.calls[0]?.payload.capabilities, [...offered, { id: "panel.stop" }, { label: "no id" }]);
});

test("onScreen carries the panel's string fields and the background's page, and is left out when empty", async () => {
  const c = context({}, "project-session", async () => "https://shop.example/cart?item=4");
  await relayConversation({
    type: send,
    conversationId: "c-1",
    text: "Buy it",
    onScreen: { flowId: " f-1 ", subflowId: "s-1", runId: 9, recordingId: "", extra: "dropped", pageUrl: "https://other.example/" } as never
  }, c.value);
  assert.deepEqual(c.calls[0]?.payload.onScreen, { flowId: "f-1", subflowId: "s-1", pageUrl: "https://shop.example/cart?item=4" });

  const d = context();
  await relayConversation({ type: send, conversationId: "c-1", text: "Hi", onScreen: { runId: "  " } }, d.value);
  await relayConversation({ type: send, conversationId: "c-1", text: "Hi" }, d.value);
  assert.equal(d.calls.length, 2);
  assert.ok(d.calls.every((call) => !("onScreen" in call.payload)));
});

test("with no page from the background, the panel's own pageUrl is used only when it passes the same check", async () => {
  const cases: Array<[unknown, string | undefined]> = [
    ["http://localhost:8080/jobs", "http://localhost:8080/jobs"],
    ["https://example.com/", "https://example.com/"],
    ["chrome-extension://abc/sidepanel/index.html", undefined],
    ["about:blank", undefined],
    ["file:///C:/notes.txt", undefined],
    ["javascript:void(0)", undefined],
    ["not a url", undefined],
    [`https://example.com/${"a".repeat(2048)}`, undefined],
    [42, undefined]
  ];
  for (const [pageUrl, expected] of cases) {
    const c = context();
    await relayConversation({ type: send, conversationId: "c-1", text: "Here", onScreen: { pageUrl } as never }, c.value);
    assert.deepEqual(c.calls[0]?.payload.onScreen, expected === undefined ? undefined : { pageUrl: expected }, String(pageUrl).slice(0, 60));
  }
});

test("a background page that fails the check falls back to the panel's; a pageLocation that throws sends nothing and says why", async () => {
  const bad = context({}, "project-session", async () => "about:blank");
  await relayConversation({ type: send, conversationId: "c-1", text: "Here", onScreen: { pageUrl: "https://panel.example/" } as never }, bad.value);
  assert.deepEqual(bad.calls[0]?.payload.onScreen, { pageUrl: "https://panel.example/" });

  const throwing = context({}, "project-session", async () => {
    throw new Error("tabs unavailable");
  });
  const answered = await relayConversation({ type: send, conversationId: "c-1", text: "Here" }, throwing.value);
  assert.equal(throwing.calls.length, 0);
  assert.equal(answered?.ok, false);
  assert.match(answered && !answered.ok ? answered.error : "", /could not say which page you are on.*tabs unavailable/u);
});

test("the page check accepts http and https up to 2048 characters and nothing else", () => {
  const prefix = "https://example.com/";
  const longest = `${prefix}${"a".repeat(2048 - prefix.length)}`;
  assert.equal(longest.length, 2048);
  assert.equal(acceptedPageUrl(longest), longest);
  assert.equal(acceptedPageUrl(`${longest}a`), undefined);
  assert.equal(acceptedPageUrl("HTTPS://Example.com/x"), "HTTPS://Example.com/x");
  for (const value of ["", "ftp://example.com/", "data:text/html,hi", "moz-extension://abc/popup.html", undefined, null, {}]) {
    assert.equal(acceptedPageUrl(value), undefined);
  }
});

test("an automation's chat opens with kind open on its Flow, and the next message goes to that conversation", async () => {
  const conversation = { conversationId: "c-flow", subject: { kind: "flow", id: "flow-7" } };
  const c = context({ "open-conversation": { ok: true, payload: { conversation } } }, "project-session", async () => "https://jobs.example/search");
  const opened = await relayConversation({ type: send, kind: "open", subjectKind: "flow", subjectId: "flow-7", title: "Apply to jobs" }, c.value);
  assert.deepEqual(opened, { ok: true, payload: { conversation } });
  const conversationId = (opened as { payload: { conversation: { conversationId: string } } }).payload.conversation.conversationId;
  await relayConversation({ type: send, conversationId, text: "Run it" }, c.value);
  assert.deepEqual(c.calls, [
    { endpoint: "open-conversation", payload: { projectId: "project-session", subjectKind: "flow", subjectId: "flow-7", title: "Apply to jobs" } },
    {
      endpoint: "append-turn",
      payload: { projectId: "project-session", conversationId: "c-flow", text: "Run it", capabilities: offered, onScreen: { pageUrl: "https://jobs.example/search" } }
    }
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
    { endpoint: "append-turn", payload: { projectId: "project-session", conversationId: "c-new", text: "Hello", capabilities: offered } }
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

test("a browser just paired, with no project stored, sends once the project is resolved from Core, and is refused only when none is", async () => {
  const c = context({ "open-conversation": { ok: true, payload: { conversation: { conversationId: "conversation-1" } } } });
  let asked = 0;
  const resolved: PanelRelayContext = { ...c.value, projectId: async () => { asked += 1; return "project-core"; } };
  await relayConversation({ type: send, text: "What can you do?" }, resolved);
  assert.equal(asked, 1);
  assert.deepEqual(c.calls.map((call) => [call.endpoint, call.payload.projectId]), [["open-conversation", "project-core"], ["append-turn", "project-core"]]);

  const none = context();
  const refused = await relayConversation({ type: send, text: "What can you do?" }, { ...none.value, projectId: async () => undefined });
  assert.equal(refused?.ok, false);
  assert.equal((refused as { code?: string }).code, "no_project");
  assert.deepEqual(none.calls, []);
});
