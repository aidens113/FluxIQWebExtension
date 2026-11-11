// Coverage of thread-change-relay.ts: a rename and a delete are each one Core
// call carrying exactly the fields Core's paired-client narrowing accepts, the
// thread's own project and never the session's in its place, and Core's answer
// -- its refusal included -- comes back as Core gave it.

import assert from "node:assert/strict";
import test from "node:test";

import { RUNTIME_MESSAGES } from "../../../shared/constants";
import type { PanelRelayResponse } from "../../../shared/protocol";
import type { PanelRelayContext } from "../relay-context";
import { relayThreadChange } from "../thread-change-relay";

function context(answers: Record<string, PanelRelayResponse> = {}) {
  const calls: Array<{ endpoint: string; payload: Record<string, unknown> }> = [];
  const asked: string[] = [];
  const value: PanelRelayContext = {
    call: async (endpoint, payload) => {
      calls.push({ endpoint, payload });
      return answers[endpoint] ?? { ok: true, payload: { endpoint } };
    },
    projectId: () => {
      asked.push("projectId");
      return "project-session";
    },
    pageLocation: async () => {
      asked.push("pageLocation");
      return undefined;
    }
  };
  return { value, calls, asked };
}

const rename = RUNTIME_MESSAGES.panelConversationRename;
const remove = RUNTIME_MESSAGES.panelConversationDelete;

test("the two message names are the panel's own", () => {
  assert.equal(rename, "fluxiq.panel.conversationRename");
  assert.equal(remove, "fluxiq.panel.conversationDelete");
});

test("a rename is one rename-conversation carrying the project, the thread and the name, and nothing else", async () => {
  const c = context();
  const answer = await relayThreadChange({ type: rename, projectId: " project-2 ", conversationId: "conv-1", title: "  Lamp hunt ", text: "x", fresh: true, subjectKind: "flow" }, c.value);
  assert.deepEqual(answer, { ok: true, payload: { endpoint: "rename-conversation" } });
  assert.deepEqual(c.calls, [{ endpoint: "rename-conversation", payload: { projectId: "project-2", conversationId: "conv-1", title: "  Lamp hunt " } }]);
});

test("a delete is one delete-conversation carrying the project and the thread, and nothing else", async () => {
  const c = context();
  const answer = await relayThreadChange({ type: remove, projectId: "project-2", conversationId: "conv-1", title: "ignored" }, c.value);
  assert.deepEqual(answer, { ok: true, payload: { endpoint: "delete-conversation" } });
  assert.deepEqual(c.calls, [{ endpoint: "delete-conversation", payload: { projectId: "project-2", conversationId: "conv-1" } }]);
});

test("with no project named, none is sent: Core finds the thread, and the session's project is never put in its place", async () => {
  const c = context();
  await relayThreadChange({ type: rename, conversationId: "conv-1", title: "Lamps" }, c.value);
  await relayThreadChange({ type: remove, projectId: "  ", conversationId: "conv-1" }, c.value);
  assert.deepEqual(c.calls, [
    { endpoint: "rename-conversation", payload: { conversationId: "conv-1", title: "Lamps" } },
    { endpoint: "delete-conversation", payload: { conversationId: "conv-1" } }
  ]);
  assert.deepEqual(c.asked, [], "neither the session's project nor the page is read");
});

test("a change naming no thread, or a rename with no name at all, is refused before Core is called", async () => {
  const c = context();
  assert.deepEqual(await relayThreadChange({ type: rename, title: "Lamps" }, c.value), { ok: false, code: "invalid_request", error: "Say which conversation to rename." });
  assert.deepEqual(await relayThreadChange({ type: rename, conversationId: "conv-1" }, c.value), { ok: false, code: "invalid_request", error: "Give the conversation a name." });
  assert.deepEqual(await relayThreadChange({ type: rename, conversationId: "conv-1", title: 5 }, c.value), { ok: false, code: "invalid_request", error: "Give the conversation a name." });
  assert.deepEqual(await relayThreadChange({ type: remove, conversationId: " " }, c.value), { ok: false, code: "invalid_request", error: "Say which conversation to delete." });
  assert.deepEqual(c.calls, []);
});

test("an empty name goes to Core, which judges names in its own words", async () => {
  const refusal: PanelRelayResponse = { ok: false, code: "failed", httpStatus: 400, error: "A conversation needs a name with words in it." };
  const c = context({ "rename-conversation": refusal });
  assert.deepEqual(await relayThreadChange({ type: rename, conversationId: "conv-1", title: "   " }, c.value), refusal);
  assert.deepEqual(c.calls, [{ endpoint: "rename-conversation", payload: { conversationId: "conv-1", title: "   " } }]);
});

test("Core's refusal to delete a thread whose work still runs comes back exactly as Core gave it", async () => {
  const refusal: PanelRelayResponse = { ok: false, code: "failed", httpStatus: 409, error: "This conversation is still being used by work that is running. Stop it or let it finish, then try again." };
  const c = context({ "delete-conversation": refusal });
  assert.deepEqual(await relayThreadChange({ type: remove, projectId: "project-1", conversationId: "conv-1" }, c.value), refusal);
});

test("any other message is not this relay's", async () => {
  const c = context();
  assert.equal(await relayThreadChange({ type: RUNTIME_MESSAGES.panelConversationRead, kind: "list-all" }, c.value), undefined);
  assert.equal(await relayThreadChange({}, c.value), undefined);
  assert.deepEqual(c.calls, []);
});
