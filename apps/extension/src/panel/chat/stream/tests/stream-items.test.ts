// The chat stream's rules: thread turns and activity rows on one timeline,
// only events with detail as rows, one row per open tool or step, a bound on
// rows, and what a row carries.

import assert from "node:assert/strict";
import test from "node:test";
import type { CoreTurn } from "../../conversation";
import { activityEvent, eventTime } from "../../tests/activity-fixture";
import { buildChatStream, CHAT_ACTIVITY_ROW_LIMIT, type ChatStreamItem } from "../stream-items";

function turn(turnId: string, author = "person"): CoreTurn {
  return { turnId, author, text: turnId, ask: null, attachment: false };
}

function keys(items: ChatStreamItem[]): string[] {
  return items.map((item) => item.key);
}

test("turns and rows interleave by time; history turns come first", () => {
  const recent = [
    activityEvent(1, { detail: { kind: "thought", title: "Reading the page" } }),
    activityEvent(3, { detail: { kind: "note", title: "Found it" } })
  ];
  const { items } = buildChatStream([
    { turn: turn("t0"), at: Number.NEGATIVE_INFINITY },
    { turn: turn("t1", "automation"), at: eventTime(2) },
    { turn: turn("t2"), at: eventTime(4) }
  ], recent);
  assert.deepEqual(keys(items), ["turn:t0", "activity:build-1#1", "turn:t1", "activity:build-1#3", "turn:t2"]);
});

test("on equal times a turn goes first, then everything keeps its own order", () => {
  const recent = [
    activityEvent(1, { detail: { kind: "note", title: "a" }, at: new Date(eventTime(5)).toISOString() }),
    activityEvent(2, { detail: { kind: "note", title: "b" }, at: new Date(eventTime(5)).toISOString() })
  ];
  const { items } = buildChatStream([{ turn: turn("x"), at: eventTime(5) }, { turn: turn("y"), at: eventTime(5) }], recent);
  assert.deepEqual(keys(items), ["turn:x", "turn:y", "activity:build-1#1", "activity:build-1#2"]);
});

test("rows follow sequence even when the relay's list is out of order, and a bad time takes the row before", () => {
  const recent = [
    activityEvent(3, { detail: { kind: "note", title: "third" }, at: "not a time" }),
    activityEvent(1, { detail: { kind: "note", title: "first" } }),
    activityEvent(2, { detail: { kind: "note", title: "second" } })
  ];
  const { items } = buildChatStream([], recent);
  assert.deepEqual(items.map((item) => item.kind === "activity" && item.row.title), ["first", "second", "third"]);
  assert.equal(items[2]!.at, eventTime(2));
});

test("a pure status change is not a row", () => {
  const { items } = buildChatStream([], [activityEvent(1), activityEvent(2, { detail: { kind: "note", title: "row" } }), activityEvent(3)]);
  assert.deepEqual(keys(items), ["activity:build-1#2"]);
});

test("a tool that started and then succeeded is one row, where it first appeared", () => {
  const recent = [
    activityEvent(1, { detail: { kind: "tool", title: "Click Search", ref: "browser.click", status: "started" } }),
    activityEvent(2, { detail: { kind: "note", title: "between" } }),
    activityEvent(3, { detail: { kind: "tool", title: "Click Search", ref: "browser.click", status: "succeeded", text: "Clicked." } })
  ];
  const { items } = buildChatStream([], recent);
  assert.deepEqual(keys(items), ["activity:build-1#1", "activity:build-1#2"]);
  const row = items[0]!.kind === "activity" ? items[0]!.row : undefined;
  assert.equal(row?.status, "succeeded");
  assert.equal(row?.text, "Clicked.");
  assert.equal(row?.sequence, 3);
  assert.equal(row?.at, eventTime(1));
  assert.equal(row?.endAt, eventTime(3), "it ends when its last event arrived");
});

test("a finished row is not reopened, and another unit of work never joins it", () => {
  const recent = [
    activityEvent(1, { detail: { kind: "tool", title: "t", ref: "r", status: "started" } }),
    activityEvent(2, { detail: { kind: "tool", title: "t", ref: "r", status: "failed" } }),
    activityEvent(3, { detail: { kind: "tool", title: "t", ref: "r", status: "started" } }),
    activityEvent(4, { activityId: "run-9", detail: { kind: "tool", title: "t", ref: "r", status: "succeeded" } })
  ];
  assert.deepEqual(keys(buildChatStream([], recent).items), ["activity:build-1#1", "activity:build-1#3", "activity:run-9#4"]);
});

test("at most the limit of rows are kept, the newest; turns are never dropped", () => {
  const recent = Array.from({ length: CHAT_ACTIVITY_ROW_LIMIT + 5 }, (_, index) =>
    activityEvent(index + 1, { detail: { kind: "note", title: `n${index + 1}` } }));
  const rows = buildChatStream([], recent).items.filter((item) => item.kind === "activity");
  assert.equal(rows.length, CHAT_ACTIVITY_ROW_LIMIT);
  assert.equal(rows[0]!.key, "activity:build-1#6");
  const small = buildChatStream([{ turn: turn("t"), at: 0 }], recent, 2);
  assert.deepEqual(keys(small.items), ["turn:t", `activity:build-1#${CHAT_ACTIVITY_ROW_LIMIT + 4}`, `activity:build-1#${CHAT_ACTIVITY_ROW_LIMIT + 5}`]);
  assert.equal(small.partial.has("build-1"), true, "rows were cut from the start of that unit of work");
  assert.deepEqual(keys(buildChatStream([{ turn: turn("t"), at: 0 }], recent, 0).items), ["turn:t"]);
});

test("a row carries its unit of work, trimmed text, status and times; blank text is none; a step is over once anything follows", () => {
  const [full, bare] = buildChatStream([], [
    activityEvent(1, { phase: "running", detail: { kind: "step", title: "Open results", text: "  Step two.  ", ref: " node-2 ", status: "started" } }),
    activityEvent(2, { detail: { kind: "note", title: "Plain", text: "   " } })
  ]).items.map((item) => (item.kind === "activity" ? item.row : undefined));
  assert.deepEqual(full, {
    key: "activity:build-1#1",
    activityId: "build-1",
    kind: "step",
    title: "Open results",
    text: "Step two.",
    status: "succeeded",
    phase: "running",
    at: eventTime(1),
    endAt: eventTime(2),
    sequence: 1,
    opens: false,
    counted: false
  });
  assert.equal(bare?.text, undefined);
});

test("an empty relay state is an empty stream", () => {
  const stream = buildChatStream([], []);
  assert.deepEqual(stream.items, []);
  assert.equal(stream.partial.size, 0);
});
