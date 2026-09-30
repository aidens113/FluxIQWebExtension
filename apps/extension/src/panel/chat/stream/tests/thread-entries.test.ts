// How the chat folds work under the turns it led to: a run of rows before a
// FluxIQ turn is that turn's, a run before the person's turn stands alone,
// the run after the last turn is the live line's while FluxIQ works, and runs
// split by unit of work.

import assert from "node:assert/strict";
import test from "node:test";
import type { CoreTurn } from "../../../simple/conversation";
import { activityEvent, eventTime } from "../../tests/activity-fixture";
import { buildChatStream } from "../stream-items";
import { buildChatThread, type ChatThread } from "../thread-entries";

function turn(turnId: string, author: string): CoreTurn {
  return { turnId, author, text: turnId, ask: null, attachment: false };
}

function tool(sequence: number, title: string, activityId = "build-1") {
  return activityEvent(sequence, { activityId, detail: { kind: "tool", title, ref: `tool.${title}`, status: "succeeded" } });
}

function shape(thread: ChatThread): unknown {
  return {
    entries: thread.entries.map((entry) => entry.kind === "turn"
      ? [entry.key, entry.work.map((group) => group.rows.map((row) => row.title))]
      : [entry.key, entry.group.rows.map((row) => row.title)]),
    live: thread.live.map((group) => group.rows.map((row) => row.title))
  };
}

test("the work before a FluxIQ turn folds under that turn; the person's turn gets none", () => {
  const items = buildChatStream([
    { turn: turn("ask", "person"), at: eventTime(0) },
    { turn: turn("answer", "automation"), at: eventTime(10) }
  ], [tool(1, "read"), tool(2, "click"), tool(3, "check")]);
  assert.deepEqual(shape(buildChatThread(items, false)), {
    entries: [["turn:ask", []], ["turn:answer", [["read", "click", "check"]]]],
    live: []
  });
});

test("while FluxIQ works, the work after the last turn is the live line's; once it stops it stands alone", () => {
  const items = buildChatStream([{ turn: turn("ask", "person"), at: eventTime(0) }], [tool(1, "read"), tool(2, "click")]);
  assert.deepEqual(shape(buildChatThread(items, true)), { entries: [["turn:ask", []]], live: [["read", "click"]] });
  const settled = buildChatThread(items, false);
  assert.deepEqual(shape(settled), { entries: [["turn:ask", []], ["work:activity:build-1#1", ["read", "click"]]], live: [] });
});

test("a run splits by unit of work, and each group spans its own times", () => {
  const items = buildChatStream(
    [{ turn: turn("answer", "automation"), at: eventTime(20) }],
    [tool(1, "a"), tool(2, "b"), tool(5, "c", "run-1"), tool(9, "d", "run-1")]
  );
  const thread = buildChatThread(items, false);
  const first = thread.entries[0]!;
  assert.equal(first.kind, "turn");
  if (first.kind !== "turn") return;
  assert.deepEqual(first.work.map((group) => [group.activityId, group.rows.length, group.endAt - group.startAt]), [
    ["build-1", 2, 1_000],
    ["run-1", 2, 4_000]
  ]);
});

test("work that led to no answer stands where it happened, before the person's next turn", () => {
  const items = buildChatStream([
    { turn: turn("first", "person"), at: eventTime(0) },
    { turn: turn("second", "person"), at: eventTime(5) }
  ], [tool(1, "read"), tool(6, "late")]);
  assert.deepEqual(shape(buildChatThread(items, true)), {
    entries: [["turn:first", []], ["work:activity:build-1#1", ["read"]], ["turn:second", []]],
    live: [["late"]]
  });
});

test("a group keeps its key when it moves from the live line to the turn that answered", () => {
  const recent = [tool(1, "read"), tool(2, "click")];
  const before = buildChatThread(buildChatStream([{ turn: turn("ask", "person"), at: eventTime(0) }], recent), true);
  const after = buildChatThread(buildChatStream([
    { turn: turn("ask", "person"), at: eventTime(0) },
    { turn: turn("answer", "automation"), at: eventTime(3) }
  ], recent), true);
  const answer = after.entries[1]!;
  assert.equal(answer.kind, "turn");
  if (answer.kind !== "turn") return;
  assert.equal(answer.work[0]!.key, before.live[0]!.key);
  assert.deepEqual(after.live, []);
});
