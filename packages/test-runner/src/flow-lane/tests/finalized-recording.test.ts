import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../failure.js";
import { awaitFinalizedRecording } from "../finalized-recording.js";

/**
 * A Core whose recording is still being written: entries appear at the virtual
 * times in `appendsAt`, and `endedAt` is stamped at `finalizedAt` — the shape
 * `L-dropped-action` measured, where Core kept appending for 2.4 s after the
 * extension had stopped.
 */
function core(options: { appendsAt: readonly number[]; finalizedAt?: number; recordingId?: string }) {
  const recordingId = options.recordingId ?? "recording.one";
  const clock = { value: 0 };
  const reads: number[] = [];
  return {
    clock,
    reads,
    now: () => clock.value,
    sleep: async (ms: number) => { clock.value += ms; },
    control: {
      automationStudioCall: async (endpoint: string, payload: Record<string, unknown>) => {
        assert.equal(endpoint, "list-recordings");
        assert.equal(payload.summaries, true);
        reads.push(clock.value);
        const eventCount = options.appendsAt.filter(at => at <= clock.value).length;
        const ended = options.finalizedAt !== undefined && clock.value >= options.finalizedAt;
        return { recordings: [{ recordingId, startedAt: 0, ...(ended ? { endedAt: options.finalizedAt } : {}), metadata: { summaryOnly: true, eventCount } }] };
      },
    },
  };
}

const input = { projectId: "project.web", recordingId: "recording.one" };
const wait = (fake: ReturnType<typeof core>) => ({ now: fake.now, sleep: fake.sleep, intervalMs: 100, timeoutMs: 10_000 });

test("the wait returns only once Core has finished the recording, with every entry it appended", async () => {
  const fake = core({ appendsAt: [0, 300, 600, 900], finalizedAt: 1_500 });
  const finalized = await awaitFinalizedRecording(fake.control, input, {}, wait(fake));
  assert.equal(finalized.entryCount, 4);
  assert.equal(finalized.endedAt, 1_500);
  // One entry was visible at the first read; three more arrived while waiting.
  assert.equal(finalized.entriesAppendedWhileWaiting, 3);
  assert.ok(finalized.waitedMs >= 1_500, `waited ${finalized.waitedMs} ms`);
  assert.ok(fake.reads.length > 1, "the wait polled Core more than once");
});

test("an entry that lands after Core's completion signal is still picked up, because the count must repeat", async () => {
  // Core reports finished at 500 with two entries visible and a third lands at
  // 600. Core's immutability rule says this cannot happen; if it does, the
  // repeat check is what stops the lane proposing from the two.
  const fake = core({ appendsAt: [0, 300, 600], finalizedAt: 500 });
  const finalized = await awaitFinalizedRecording(fake.control, input, {}, wait(fake));
  assert.equal(finalized.entryCount, 3);
  assert.ok(finalized.waitedMs >= 600, `waited ${finalized.waitedMs} ms`);
});

test("an unfinished recording fails at the bound and is never handed on, carrying what was observed", async () => {
  const fake = core({ appendsAt: [0, 300] });
  await assert.rejects(
    () => awaitFinalizedRecording(fake.control, input, {}, { ...wait(fake), timeoutMs: 1_000 }),
    (error: unknown) => {
      assert.ok(error instanceof RunnerFailure);
      assert.equal(error.category, "recording.persistence");
      assert.match(error.message, /still writing/);
      assert.equal(error.details?.endedAt, null);
      assert.equal(error.details?.entryCount, 2);
      assert.equal(error.details?.timeoutMs, 1_000);
      return true;
    },
  );
});

test("a recording Core never reports fails as unseen rather than as empty", async () => {
  const fake = core({ appendsAt: [0], recordingId: "recording.other" });
  await assert.rejects(
    () => awaitFinalizedRecording(fake.control, input, {}, { ...wait(fake), timeoutMs: 500 }),
    (error: unknown) => error instanceof RunnerFailure && error.details?.recordingSeen === false && /did not report/.test(error.message),
  );
});

test("a recording already finished is confirmed in two reads, and the full session shape is read as well as the summary", async () => {
  const control = {
    automationStudioCall: async () => ({ payload: { recordings: [{ recordingId: "recording.one", endedAt: 42, timeline: [{ type: "action" }, { type: "action" }] }] } }),
  };
  const finalized = await awaitFinalizedRecording(control, input, {}, { intervalMs: 1, timeoutMs: 1_000 });
  assert.equal(finalized.entryCount, 2);
  assert.equal(finalized.endedAt, 42);
  assert.equal(finalized.polls, 2);
});
