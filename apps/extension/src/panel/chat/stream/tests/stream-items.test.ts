// The chat stream's rules: thread turns and step messages on one timeline by
// time, turns first on equal times, history turns before everything, a bound
// on step messages that never drops a turn, and no folds: every step message
// is its own item.

import assert from "node:assert/strict";
import test from "node:test";
import type { CoreTurn } from "../../conversation";
import { activityEvent, eventTime } from "../../tests/activity-fixture";
import { buildChatStream, CHAT_STEP_MESSAGE_LIMIT, type ChatStreamItem } from "../stream-items";

function turn(turnId: string, author = "person"): CoreTurn {
  return { turnId, author, text: turnId, ask: null, attachment: false };
}

const note = (sequence: number, title: string, at?: number) =>
  activityEvent(sequence, { detail: { kind: "note", title }, ...(at === undefined ? {} : { at: new Date(at).toISOString() }) });

function keys(items: ChatStreamItem[]): string[] {
  return items.map((item) => item.key);
}

test("turns and step messages interleave by time; history turns come first", () => {
  const events = [
    activityEvent(1, { detail: { kind: "thought", title: "Reading the page", text: "The prices are in the list.", status: "succeeded" } }),
    note(3, "Found it")
  ];
  const { items } = buildChatStream([
    { turn: turn("t0"), at: Number.NEGATIVE_INFINITY },
    { turn: turn("t1", "automation"), at: eventTime(2) },
    { turn: turn("t2"), at: eventTime(4) }
  ], events);
  assert.deepEqual(keys(items), ["turn:t0", "step:build-1#1", "turn:t1", "step:build-1#3", "turn:t2"]);
});

test("on equal times a turn goes first, then everything keeps its own order", () => {
  const events = [note(1, "a", eventTime(5)), note(2, "b", eventTime(5))];
  const { items } = buildChatStream([{ turn: turn("x"), at: eventTime(5) }, { turn: turn("y"), at: eventTime(5) }], events);
  assert.deepEqual(keys(items), ["turn:x", "turn:y", "step:build-1#1", "step:build-1#2"]);
});

test("every step is its own item, however many there are between two turns", () => {
  const events = Array.from({ length: 40 }, (_, index) => note(index + 1, `n${index + 1}`));
  const { items } = buildChatStream([{ turn: turn("ask"), at: eventTime(0) }, { turn: turn("answer", "automation"), at: eventTime(41) }], events);
  assert.equal(items.length, 42);
  assert.equal(items.filter((item) => item.kind === "step").length, 40);
  assert.equal(items[41]!.key, "turn:answer", "the answer comes after the work that led to it");
});

test("at most the limit of step messages are kept, the newest; turns are never dropped", () => {
  const events = Array.from({ length: CHAT_STEP_MESSAGE_LIMIT + 5 }, (_, index) => note(index + 1, `n${index + 1}`));
  const steps = buildChatStream([], events).items.filter((item) => item.kind === "step");
  assert.equal(steps.length, CHAT_STEP_MESSAGE_LIMIT);
  assert.equal(steps[0]!.key, "step:build-1#6");
  const small = buildChatStream([{ turn: turn("t"), at: 0 }], events, 1);
  assert.deepEqual(keys(small.items), ["turn:t", `step:build-1#${CHAT_STEP_MESSAGE_LIMIT + 5}`]);
});

test("an empty relay state is an empty stream", () => {
  assert.deepEqual(buildChatStream([], []).items, []);
});
