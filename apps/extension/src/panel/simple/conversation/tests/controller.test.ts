// The conversation card's rules (UI audit, section 4, "3. Conversation card"):
// Core's thread shown and fed, never owned; the "Open FluxIQ" fallback on
// `unsupported` and on a refused token; and errors that end with their cause, neither outliving it nor
// wiped the moment they appear.

import assert from "node:assert/strict";
import test from "node:test";
import { RUNTIME_MESSAGES } from "../../../../shared/constants";
import { createConversationController } from "../controller";
import { TURN_WINDOW } from "../thread-tail";
import { fakeCore, REFUSED, UNREACHABLE, UNSUPPORTED } from "./fake-core";

async function connectedController(core: ReturnType<typeof fakeCore>) {
  const controller = createConversationController((message) => core.request(message), () => undefined);
  controller.setConnected(true);
  await controller.refresh();
  return controller;
}

test("the most recent open thread is read and its turns are what Core said", async () => {
  const core = fakeCore(3);
  const controller = await connectedController(core);
  const state = controller.state();
  assert.equal(state.mode, "thread");
  assert.deepEqual(state.turns.map((turn) => [turn.author, turn.text]), [["person", "message 1"], ["automation", "message 2"], ["person", "message 3"]]);
  assert.deepEqual(core.sent[0], { type: RUNTIME_MESSAGES.panelConversationRead, kind: "list", status: "open", limit: 1 });
});

test("no thread yet: the empty face, and the first message opens one", async () => {
  const core = fakeCore(0, false);
  const controller = await connectedController(core);
  assert.equal(controller.state().mode, "empty");
  assert.equal(await controller.send("Find laptops under $900"), true);
  const send = core.sent.find((message) => message.type === RUNTIME_MESSAGES.panelConversationSend);
  assert.equal(send?.conversationId, undefined, "no thread id: the relay opens one first");
  assert.deepEqual(controller.state().turns.map((turn) => turn.text), ["Find laptops under $900", "Working on: Find laptops under $900"]);
});

test("a thread whose revision has not moved is not read again", async () => {
  const core = fakeCore(2);
  const controller = await connectedController(core);
  const reads = core.sent.length;
  await controller.refresh();
  assert.equal(core.sent.length, reads + 1, "only the list, no get");
  core.say("automation", "Found 24 products. Want a CSV?");
  await controller.refresh();
  assert.equal(controller.state().turns.at(-1)?.text, "Found 24 products. Want a CSV?");
});

test("only the last turns are kept, read forward from an anchor", async () => {
  const core = fakeCore(TURN_WINDOW + 7);
  const controller = await connectedController(core);
  const turns = controller.state().turns;
  assert.equal(turns.length, TURN_WINDOW);
  assert.equal(turns.at(-1)?.text, `message ${TURN_WINDOW + 7}`);
  core.say("automation", "one more");
  await controller.refresh();
  const lastGet = core.sent.filter((message) => message.kind === "get").at(-1);
  assert.equal(lastGet?.sinceTurnId, "turn-7", "re-read from the turn before the first one on screen");
  assert.equal(controller.state().turns.length, TURN_WINDOW);
  assert.equal(controller.state().turns.at(-1)?.text, "one more");
});

test("unsupported on read: the card falls back to Open FluxIQ and stops asking", async () => {
  const core = fakeCore(2);
  core.failNext.set(`${RUNTIME_MESSAGES.panelConversationRead}:list`, UNSUPPORTED);
  const controller = await connectedController(core);
  assert.equal(controller.state().mode, "fallback");
  assert.equal(controller.state().fallbackReason, "unsupported");
  const asked = core.sent.length;
  await controller.refresh();
  assert.equal(await controller.send("hello"), false);
  assert.equal(core.sent.length, asked, "nothing more is sent to a background that does not know the messages");
});

test("unsupported on send also falls back", async () => {
  const core = fakeCore(1);
  const controller = await connectedController(core);
  core.failNext.set(RUNTIME_MESSAGES.panelConversationSend, UNSUPPORTED);
  assert.equal(await controller.send("hello"), false);
  assert.equal(controller.state().mode, "fallback");
  assert.equal(controller.state().fallbackReason, "unsupported");
});

test("a failed send keeps its error until the next send, which clears it at once", async () => {
  const core = fakeCore(1);
  const controller = await connectedController(core);
  core.failNext.set(RUNTIME_MESSAGES.panelConversationSend, UNREACHABLE);
  assert.equal(await controller.send("hello"), false, "the composer keeps the words");
  assert.equal(controller.state().sendError, "Couldn't send that. Try again.");
  await controller.refresh();
  assert.equal(controller.state().sendError, "Couldn't send that. Try again.", "a poll does not wipe it");
  const again = controller.send("hello");
  assert.equal(controller.state().sendError, undefined, "sending again clears the old error");
  assert.equal(controller.state().sending, true);
  assert.equal(await again, true);
  assert.equal(controller.state().sendError, undefined);
});

test("a read error keeps what was on screen, and clears on the next good read", async () => {
  const core = fakeCore(2);
  const controller = await connectedController(core);
  core.failNext.set(`${RUNTIME_MESSAGES.panelConversationRead}:list`, UNREACHABLE);
  await controller.refresh();
  assert.equal(controller.state().readError, "Couldn't load the conversation.");
  assert.equal(controller.state().mode, "thread", "what was on screen stays");
  await controller.refresh();
  assert.equal(controller.state().readError, undefined);
});

test("a read error before anything loaded never claims there is no conversation", async () => {
  // Every read fails: connecting reads once and the refresh below queues another.
  const controller = createConversationController(async () => UNREACHABLE as never, () => undefined);
  controller.setConnected(true);
  await controller.refresh();
  assert.equal(controller.state().mode, "loading");
  assert.equal(controller.state().readError, "Couldn't load the conversation.");
});

test("disconnecting disables the composer and clears errors nobody can act on; reconnecting reads again", async () => {
  const core = fakeCore(1);
  const controller = await connectedController(core);
  core.failNext.set(RUNTIME_MESSAGES.panelConversationSend, UNREACHABLE);
  await controller.send("hello");
  controller.setConnected(false);
  assert.equal(controller.state().mode, "offline");
  assert.equal(controller.state().sendError, undefined);
  assert.equal(await controller.send("hello"), false);
  const before = core.sent.length;
  controller.setConnected(true);
  await controller.refresh();
  assert.ok(core.sent.length > before);
  assert.equal(controller.state().mode, "thread");
});

test("answering a question sends answer-ask and re-reads; an answer error ends once the question is settled", async () => {
  const core = fakeCore(1);
  const ask = { askId: "ask-1", kind: "confirm", status: "pending", options: null, answer: null };
  core.say("automation", "Delete 3 old drafts?", ask);
  const controller = await connectedController(core);

  core.failNext.set(RUNTIME_MESSAGES.panelConversationAnswer, UNREACHABLE);
  await controller.answer("ask-1", "grant");
  assert.equal(controller.state().answerErrors.get("ask-1"), "Couldn't send your answer. Try again.");

  await controller.answer("ask-1", "grant");
  const sent = core.sent.filter((message) => message.type === RUNTIME_MESSAGES.panelConversationAnswer).at(-1);
  assert.deepEqual(sent, { type: RUNTIME_MESSAGES.panelConversationAnswer, askId: "ask-1", kind: "grant", value: undefined, projectId: "project-1" });
  assert.equal(controller.state().turns.at(-1)?.ask?.status, "answered");
  assert.equal(controller.state().answerErrors.size, 0);
});

test("an unreadable answer from Core is a read error, not a blank card", async () => {
  const controller = createConversationController(async (message) => {
    if (message.kind === "list") return { ok: true, value: { ok: true, payload: { conversations: [{ conversationId: "c", projectId: "p", revision: 2 }] } } } as never;
    return { ok: true, value: { ok: true, payload: { conversation: { turns: "nope" } } } } as never;
  }, () => undefined);
  controller.setConnected(true);
  await controller.refresh();
  assert.equal(controller.state().readError, "Couldn't load the conversation.");
  assert.equal(controller.state().mode, "loading");
});

test("a refused token falls back to Open FluxIQ instead of an error, and stops asking", async () => {
  const core = fakeCore(2);
  core.failNext.set(`${RUNTIME_MESSAGES.panelConversationRead}:list`, REFUSED);
  const controller = await connectedController(core);
  assert.equal(controller.state().mode, "fallback");
  assert.equal(controller.state().fallbackReason, "refused");
  assert.equal(controller.state().readError, undefined, "no \"Couldn't load\" for a refusal that retrying cannot fix");
  const asked = core.sent.length;
  await controller.refresh();
  assert.equal(await controller.send("hello"), false);
  assert.equal(core.sent.length, asked);
});

test("a refused send falls back too, never showing \"Try again\"", async () => {
  const core = fakeCore(1);
  const controller = await connectedController(core);
  core.failNext.set(RUNTIME_MESSAGES.panelConversationSend, REFUSED);
  assert.equal(await controller.send("hello"), false);
  assert.equal(controller.state().mode, "fallback");
  assert.equal(controller.state().sendError, undefined);
});

test("a refused fallback ends when the connection drops and comes back; unsupported does not", async () => {
  const core = fakeCore(2);
  core.failNext.set(`${RUNTIME_MESSAGES.panelConversationRead}:list`, REFUSED);
  const controller = await connectedController(core);
  controller.setConnected(false);
  assert.equal(controller.state().mode, "offline");
  controller.setConnected(true);
  await controller.refresh();
  assert.equal(controller.state().mode, "thread", "paired again: the thread is read");

  const old = fakeCore(2);
  old.failNext.set(`${RUNTIME_MESSAGES.panelConversationRead}:list`, UNSUPPORTED);
  const stuck = await connectedController(old);
  stuck.setConnected(false);
  stuck.setConnected(true);
  await stuck.refresh();
  assert.equal(stuck.state().fallbackReason, "unsupported");
});

test("other relay codes are error sentences beside the thread, not the fallback", async () => {
  const core = fakeCore(2);
  const controller = await connectedController(core);
  core.failNext.set(`${RUNTIME_MESSAGES.panelConversationRead}:list`, { ok: false, sentence: "Can't reach FluxIQ.", detail: "fetch failed", code: "unreachable" });
  await controller.refresh();
  assert.equal(controller.state().mode, "thread");
  assert.equal(controller.state().readError, "Couldn't load the conversation.");
});
