// Answers require a person's activation: the conversation port sends an answer
// only while the panel holds a person's live user activation, fails closed
// where the browser cannot say, and gates nothing but answers.

import assert from "node:assert/strict";
import test from "node:test";
import { RUNTIME_MESSAGES } from "../../../../shared/constants";
import { userActivation } from "../../tests/user-activation";
import { conversationPort } from "../ports";
import { sendRecorder } from "./send-recorder";

const ANSWER = { askId: "ask-1", kind: "grant", value: undefined, projectId: "project-1" };
const TAKEN = { ok: true, value: { ok: true, payload: { ask: { status: "answered" } } } } as const;

test("an answer without an active user activation is not sent and fails", async (t) => {
  userActivation(t, { isActive: false, hasBeenActive: true });
  const recorder = sendRecorder(TAKEN);
  const result = await conversationPort(recorder.request).answer(ANSWER);
  assert.deepEqual(recorder.sent, []);
  assert.deepEqual(result, { ok: false, sentence: "Press the answer yourself to give it." });
});

test("an answer is not sent where the browser has no userActivation", async (t) => {
  userActivation(t, undefined);
  const recorder = sendRecorder(TAKEN);
  const result = await conversationPort(recorder.request).answer(ANSWER);
  assert.deepEqual(recorder.sent, []);
  assert.equal(result.ok, false);
});

test("an answer with an active user activation is sent unchanged", async (t) => {
  userActivation(t, { isActive: true, hasBeenActive: true });
  const recorder = sendRecorder(TAKEN);
  const result = await conversationPort(recorder.request).answer(ANSWER);
  assert.deepEqual(recorder.sent, [{ type: RUNTIME_MESSAGES.panelConversationAnswer, ...ANSWER }]);
  assert.deepEqual(result, { ok: true, value: { ask: { status: "answered" } } });
});

test("the activation reader is injectable and read for each answer", async () => {
  let active = false;
  const recorder = sendRecorder(TAKEN);
  const port = conversationPort(recorder.request, () => active);
  assert.equal((await port.answer(ANSWER)).ok, false);
  active = true;
  assert.equal((await port.answer(ANSWER)).ok, true);
  active = false;
  assert.equal((await port.answer(ANSWER)).ok, false);
  assert.equal(recorder.sent.length, 1);
});

test("reads and sends are not answers and need no activation", async (t) => {
  userActivation(t, { isActive: false, hasBeenActive: false });
  const recorder = sendRecorder(TAKEN);
  const port = conversationPort(recorder.request);
  await port.readThread({ projectId: "project-1", conversationId: "c-1", sinceTurnId: undefined, limit: 50 });
  await port.send({ text: "hello", conversationId: undefined, projectId: "project-1" });
  assert.deepEqual(recorder.sent.map((message) => message.type), [RUNTIME_MESSAGES.panelConversationRead, RUNTIME_MESSAGES.panelConversationSend]);
});
