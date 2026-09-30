// How the chat folds work above the turns it led to: one fold per FluxIQ
// answer, however many units of work led to it; work before the person's
// turn stands alone; the work after the last turn is the live line's while
// FluxIQ works; a fold keeps its key when it moves; and a partial fold's time
// starts at the person's message.

import assert from "node:assert/strict";
import test from "node:test";
import type { CoreTurn } from "../../conversation";
import { activityEvent, eventTime } from "../../tests/activity-fixture";
import { buildChatStream } from "../stream-items";
import { buildChatThread, type ChatThread } from "../thread-entries";

function turn(turnId: string, author: string): CoreTurn {
  return { turnId, author, text: turnId, ask: null, attachment: false };
}

function note(sequence: number, title: string, activityId = "build-1") {
  return activityEvent(sequence, { activityId, detail: { kind: "note", title, status: "succeeded" } });
}

function shape(thread: ChatThread): unknown {
  return {
    entries: thread.entries.map((entry) => entry.kind === "turn"
      ? [entry.key, entry.work?.rows.map((row) => row.title) ?? null]
      : [entry.key, entry.fold.rows.map((row) => row.title)]),
    live: thread.live?.rows.map((row) => row.title) ?? null
  };
}

test("the work before a FluxIQ turn is one fold above it, even across units of work; the person's turn gets none", () => {
  const stream = buildChatStream([
    { turn: turn("ask", "person"), at: eventTime(0) },
    { turn: turn("answer", "automation"), at: eventTime(10) }
  ], [note(1, "read"), note(2, "click"), note(5, "run it", "run-1")]);
  assert.deepEqual(shape(buildChatThread(stream, false)), {
    entries: [["turn:ask", null], ["turn:answer", ["read", "click", "run it"]]],
    live: null
  });
});

test("while FluxIQ works, the work after the last turn is the live line's; once it stops it stands alone", () => {
  const stream = buildChatStream([{ turn: turn("ask", "person"), at: eventTime(0) }], [note(1, "read"), note(2, "click")]);
  assert.deepEqual(shape(buildChatThread(stream, true)), { entries: [["turn:ask", null]], live: ["read", "click"] });
  assert.deepEqual(shape(buildChatThread(stream, false)), { entries: [["turn:ask", null], ["work:build-1", ["read", "click"]]], live: null });
});

test("work that led to no answer stands where it happened, before the person's next turn", () => {
  const stream = buildChatStream([
    { turn: turn("first", "person"), at: eventTime(0) },
    { turn: turn("second", "person"), at: eventTime(5) }
  ], [note(1, "read"), note(6, "late")]);
  assert.deepEqual(shape(buildChatThread(stream, true)), {
    entries: [["turn:first", null], ["work:build-1", ["read"]], ["turn:second", null]],
    live: ["late"]
  });
});

test("a fold keeps its key when it moves from the live line to the turn that answered", () => {
  const recent = [note(1, "read"), note(2, "click")];
  const before = buildChatThread(buildChatStream([{ turn: turn("ask", "person"), at: eventTime(0) }], recent), true);
  const after = buildChatThread(buildChatStream([
    { turn: turn("ask", "person"), at: eventTime(0) },
    { turn: turn("answer", "automation"), at: eventTime(3) }
  ], recent), true);
  const answer = after.entries[1]!;
  assert.equal(answer.kind, "turn");
  if (answer.kind !== "turn") return;
  assert.equal(answer.work?.key, before.live?.key);
  assert.equal(after.live, null);
});

test("a fold spans its rows' times; a partial one starts at the person's message instead", () => {
  const turns = [
    { turn: turn("ask", "person"), at: eventTime(0) },
    { turn: turn("answer", "automation"), at: eventTime(200) }
  ];
  const recent = [note(100, "late step"), note(180, "last step")];
  const whole = buildChatThread(buildChatStream(turns, recent), false).entries[1]!;
  assert.equal(whole.kind === "turn" && whole.work !== null && [whole.work.complete, whole.work.endAt - whole.work.startAt].join(), "true,80000");
  const cut = buildChatThread(buildChatStream(turns, recent, 1), false).entries[1]!;
  assert.equal(cut.kind === "turn" && cut.work !== null && [cut.work.complete, cut.work.endAt - cut.work.startAt].join(), "false,180000");
});

test("a partial fold far from the person's message, or after an answer, keeps its own rows' time", () => {
  const turns = [
    { turn: turn("old ask", "person"), at: eventTime(0) - 3_600_000 },
    { turn: turn("answer", "automation"), at: eventTime(0) - 3_500_000 }
  ];
  const recent = [note(100, "late step"), note(180, "last step")];
  const thread = buildChatThread(buildChatStream(turns, recent, 1), false);
  const work = thread.entries[2]!;
  assert.equal(work.kind === "work" && [work.fold.complete, work.fold.endAt - work.fold.startAt].join(), "false,0");
  const far = buildChatThread(buildChatStream([{ turn: turn("ask", "person"), at: eventTime(0) - 3_600_000 }], recent, 1), false).entries[1]!;
  assert.equal(far.kind === "work" && far.fold.endAt - far.fold.startAt, 0, "an hour-old message did not start this work");
});
