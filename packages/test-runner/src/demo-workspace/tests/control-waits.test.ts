// The demo's wait for a new recording. Under load Core was still storing the
// recording's entries when a 10 s wait ran out, and the demo then stopped Core
// mid-write (`i-demo-recording-finalize`). The wait now hands on a recording
// only once Core has stamped its `endedAt`, inside one named bound.

import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../failure.js";
import { waitForNewRecording } from "../control-waits.js";

/** Stands in for page data a summary could carry; it must never reach a failure. */
const PAGE_TEXT = "Recorded by Ada";
const PROJECT_ID = "project.demo";

type FakeRecording = { recordingId: string; listedFrom?: number; appendsAt?: readonly number[]; finalizedAt?: number };

/** A Core listing recordings at virtual times: each appears at `listedFrom`, gains entries at `appendsAt`, and ends at `finalizedAt`. */
function core(recordings: readonly FakeRecording[]) {
  const clock = { value: 0 };
  const reads: number[] = [];
  return {
    clock,
    reads,
    wait: (timeoutMs: number) => ({ now: () => clock.value, sleep: async (ms: number) => { clock.value += ms; }, intervalMs: 100, timeoutMs }),
    control: {
      automationStudioCall: async (endpoint: string, payload: Record<string, unknown>) => {
        assert.equal(endpoint, "list-recordings");
        assert.deepEqual(payload, { projectId: PROJECT_ID, summaries: true });
        reads.push(clock.value);
        const listed = recordings.filter(item => (item.listedFrom ?? 0) <= clock.value);
        return {
          recordings: listed.map(item => {
            const eventCount = (item.appendsAt ?? []).filter(at => at <= clock.value).length;
            const ended = item.finalizedAt !== undefined && clock.value >= item.finalizedAt;
            return { recordingId: item.recordingId, startedAt: 0, title: PAGE_TEXT, ...(ended ? { endedAt: item.finalizedAt } : {}), metadata: { summaryOnly: true, eventCount } };
          }),
        };
      },
    },
  };
}

test("a new recording Core finalizes after several polls resolves, and only once Core has stamped endedAt", async () => {
  const fake = core([
    { recordingId: "recording.old", appendsAt: [0], finalizedAt: 0 },
    { recordingId: "recording.new", appendsAt: [0, 300, 600, 900], finalizedAt: 1_500 },
  ]);
  const recordingId = await waitForNewRecording(fake.control, PROJECT_ID, new Set(["recording.old"]), fake.wait(10_000));
  assert.equal(recordingId, "recording.new");
  assert.ok(fake.clock.value >= 1_500, `returned at ${fake.clock.value} ms, before Core finalized the recording at 1500 ms`);
  assert.ok(fake.reads.filter(at => at < 1_500).length >= 5, "the wait polled Core several times before it finalized");
});

test("a new recording Core never finalizes fails at the named bound, naming its id and last entry count and no page data", async () => {
  const fake = core([{ recordingId: "recording.new", appendsAt: [0, 300, 600] }]);
  await assert.rejects(
    () => waitForNewRecording(fake.control, PROJECT_ID, new Set(), fake.wait(1_000)),
    (error: unknown) => {
      assert.ok(error instanceof RunnerFailure);
      assert.equal(error.category, "recording.persistence");
      assert.match(error.message, /demo recording recording\.new but did not finalize it within 1000 ms \(DEMO_RECORDING_FINALIZE_TIMEOUT_MS\)/);
      assert.match(error.message, /Core was still writing it; last observed entry count 3$/);
      assert.equal(error.details?.recordingId, "recording.new");
      assert.equal(error.details?.entryCount, 3);
      assert.equal(error.details?.bound, "DEMO_RECORDING_FINALIZE_TIMEOUT_MS");
      assert.equal(error.details?.timeoutMs, 1_000);
      assert.ok(!error.message.includes(PAGE_TEXT), "the message quotes no page data");
      assert.ok(!JSON.stringify(error.details).includes(PAGE_TEXT), "the details quote no page data");
      return true;
    },
  );
  assert.ok(fake.clock.value >= 1_000, `gave up at ${fake.clock.value} ms, before its 1000 ms bound`);
});

test("the one bound runs from the start of the wait, not from the moment the recording is first listed", async () => {
  const fake = core([{ recordingId: "recording.new", listedFrom: 600, appendsAt: [600], finalizedAt: 1_500 }]);
  await assert.rejects(
    () => waitForNewRecording(fake.control, PROJECT_ID, new Set(), fake.wait(1_000)),
    (error: unknown) => error instanceof RunnerFailure && error.details?.waitedMs !== undefined && Number(error.details.waitedMs) >= 1_000,
  );
  assert.ok(fake.clock.value < 1_500, `waited until ${fake.clock.value} ms, past the bound`);
});

test("a recording first listed at the deadline still gets the confirming read that accepts it", async () => {
  const fake = core([{ recordingId: "recording.new", listedFrom: 1_000, appendsAt: [0, 200], finalizedAt: 400 }]);
  assert.equal(await waitForNewRecording(fake.control, PROJECT_ID, new Set(), fake.wait(1_000)), "recording.new");
});

test("no new recording within the bound fails as unpersisted, naming the bound", async () => {
  const fake = core([{ recordingId: "recording.old", appendsAt: [0], finalizedAt: 0 }]);
  await assert.rejects(
    () => waitForNewRecording(fake.control, PROJECT_ID, new Set(["recording.old"]), fake.wait(500)),
    (error: unknown) => error instanceof RunnerFailure && /did not persist a new demo recording within 500 ms \(DEMO_RECORDING_FINALIZE_TIMEOUT_MS\)/.test(error.message),
  );
});

test("two new recordings fail as soon as both are listed", async () => {
  const fake = core([
    { recordingId: "recording.one", listedFrom: 200, appendsAt: [200], finalizedAt: 200 },
    { recordingId: "recording.two", listedFrom: 200, appendsAt: [200] },
  ]);
  await assert.rejects(
    () => waitForNewRecording(fake.control, PROJECT_ID, new Set(), fake.wait(10_000)),
    (error: unknown) => error instanceof RunnerFailure && error.message === "Recording operation created more than one recording",
  );
  assert.equal(fake.clock.value, 200, "the wait failed at the first listing that showed both, without waiting for either to finalize");
});

test("a second new recording listed while the first finalizes fails once the first is finished", async () => {
  const fake = core([
    { recordingId: "recording.one", appendsAt: [0, 300], finalizedAt: 800 },
    { recordingId: "recording.two", listedFrom: 400, appendsAt: [400] },
  ]);
  await assert.rejects(
    () => waitForNewRecording(fake.control, PROJECT_ID, new Set(), fake.wait(10_000)),
    (error: unknown) => error instanceof RunnerFailure && /Demo recording recording\.one finalized, but Core then listed 2 new recordings instead of exactly that one/.test(error.message),
  );
});
