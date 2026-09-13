// Coverage of handshake.ts: what happens after FluxIQ refuses a start. A
// transient refusal must be retried and a persistent one must be surfaced, and
// neither may loop -- the whole point of bounding the retry is that a recorder
// which retries forever and tells nobody is worse than one that latches idle.

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import type { JsonObject } from "../../../../shared/protocol";
import { RecordingStartHandshake, type RecordingStartAttempt } from "../handshake";
import type { RecordingStartRefusal } from "../refusal";

// A hand-driven stand-in for the handshake's timers, on the pattern
// pointer-click-filter.test.ts uses: node:test's MockTimers would do, but on
// Node 22 it prints an ExperimentalWarning into every run. The handshake arms
// at most one timer at a time -- a refusal cancels the acceptance window
// before arming a retry, and a retry re-arms the window -- so "fire the one
// that is pending" is unambiguous.
function fakeTimers(t: TestContext) {
  const pending = new Map<number, { callback: () => void; delay: number }>();
  let nextId = 1;
  t.mock.method(globalThis, "setTimeout", (callback: () => void, delay = 0) => {
    const id = nextId;
    nextId += 1;
    pending.set(id, { callback, delay });
    return id;
  });
  t.mock.method(globalThis, "clearTimeout", (id: number) => {
    pending.delete(id);
  });
  return {
    delays: () => [...pending.values()].map((timer) => timer.delay),
    count: () => pending.size,
    fireAll: () => {
      const due = [...pending.values()];
      pending.clear();
      for (const timer of due) timer.callback();
    }
  };
}

const STALE: RecordingStartRefusal = {
  code: "recording.project_required",
  kind: "transient",
  reason: "context_stale",
  title: "FluxIQ Is Catching Up",
  message: "stale",
  lastError: "stale",
  detail: "stale"
};

const NO_PROJECT: RecordingStartRefusal = {
  code: "recording.project_required",
  kind: "persistent",
  reason: "project_not_selected",
  title: "Project Required",
  message: "no project",
  lastError: "no project",
  detail: "no project"
};

const RETRY_DELAYS = [400, 1_200] as const;
const INITIAL_STATE: JsonObject = { kind: "initial" };

function harness(t: TestContext) {
  const timers = fakeTimers(t);
  const sent: RecordingStartAttempt[] = [];
  const surfaced: { refusal: RecordingStartRefusal; attempts: number }[] = [];
  const retries: { attempt: number; of: number; delayMs: number }[] = [];
  const local: string[] = [];
  const handshake = new RecordingStartHandshake({
    send: async (attempt) => { sent.push(attempt); },
    beginLocally: async (recordingId) => { local.push(recordingId); },
    surfaceRefusal: (refusal, attempts) => { surfaced.push({ refusal, attempts }); },
    noteRetry: (_refusal, attempt, of, delayMs) => { retries.push({ attempt, of, delayMs }); },
    acceptTimeoutMs: 750,
    retryDelaysMs: RETRY_DELAYS
  });
  return { timers, sent, surfaced, retries, local, handshake };
}

async function begin(handshake: RecordingStartHandshake) {
  await handshake.begin({ recordingId: "client.alpha.1", startedAt: 10, initialState: INITIAL_STATE });
}

test("a transient refusal is retried, and the retry re-sends the same recording", async (t) => {
  const { timers, sent, retries, handshake } = harness(t);
  await begin(handshake);
  assert.deepEqual(sent.map((attempt) => attempt.attempt), [0]);

  handshake.noteRefusal(STALE);
  // The acceptance window is over -- the refusal answered it -- and the only
  // timer left is the retry delay.
  assert.deepEqual(timers.delays(), [400]);
  assert.deepEqual(retries, [{ attempt: 1, of: 2, delayMs: 400 }]);

  timers.fireAll();
  assert.deepEqual(sent.map((attempt) => attempt.attempt), [0, 1]);
  assert.equal(sent[1]?.recordingId, "client.alpha.1");
  // Same recording, same start instant, same captured state: one logical
  // recording, not a second one.
  assert.equal(sent[1]?.startedAt, 10);
  assert.equal(sent[1]?.initialState, INITIAL_STATE);
  // And the retry gets an acceptance window of its own.
  assert.deepEqual(timers.delays(), [750]);
});

test("a transient refusal that never resolves is surfaced after the bound, and stops", async (t) => {
  const { timers, sent, surfaced, retries, handshake } = harness(t);
  await begin(handshake);

  handshake.noteRefusal(STALE);
  timers.fireAll();
  handshake.noteRefusal(STALE);
  timers.fireAll();
  assert.deepEqual(sent.map((attempt) => attempt.attempt), [0, 1, 2]);
  assert.deepEqual(retries.map((retry) => retry.delayMs), [400, 1_200]);
  assert.equal(surfaced.length, 0);

  // Third refusal: the delays are spent.
  handshake.noteRefusal(STALE);
  assert.equal(surfaced.length, 1);
  assert.equal(surfaced[0]?.refusal.reason, "context_stale");
  assert.equal(surfaced[0]?.attempts, 3, "the surfaced refusal counts every send, so the panel can say it retried");
  // Nothing is left running and nothing is left pending: no silent loop.
  assert.equal(timers.count(), 0);
  assert.equal(handshake.isPending(), false);

  // A refusal arriving after the handshake is over surfaces once more and
  // starts nothing.
  handshake.noteRefusal(STALE);
  assert.equal(surfaced.length, 2);
  assert.equal(surfaced[1]?.attempts, 0);
  assert.equal(sent.length, 3);
  assert.equal(timers.count(), 0);
});

test("a persistent refusal is surfaced on the first answer and is never retried", async (t) => {
  const { timers, sent, surfaced, retries, handshake } = harness(t);
  await begin(handshake);

  handshake.noteRefusal(NO_PROJECT);
  assert.deepEqual(surfaced.map((entry) => entry.attempts), [1]);
  assert.equal(surfaced[0]?.refusal.reason, "project_not_selected");
  assert.equal(retries.length, 0, "retrying a project nobody has chosen would only hide the message that asks for one");
  assert.equal(sent.length, 1);
  assert.equal(timers.count(), 0, "the acceptance window is cancelled too: a refusal is an answer");
  assert.equal(handshake.isPending(), false);
});

test("a persistent refusal mid-retry ends the retries immediately", async (t) => {
  const { timers, sent, surfaced, handshake } = harness(t);
  await begin(handshake);
  handshake.noteRefusal(STALE);
  timers.fireAll();
  assert.equal(sent.length, 2);

  handshake.noteRefusal(NO_PROJECT);
  assert.deepEqual(surfaced.map((entry) => entry.attempts), [2]);
  assert.equal(timers.count(), 0);
  assert.equal(sent.length, 2);
});

test("silence still starts the recording locally, once, and only for the pending start", async (t) => {
  const { timers, local, surfaced, handshake } = harness(t);
  await begin(handshake);
  assert.deepEqual(timers.delays(), [750]);

  timers.fireAll();
  assert.deepEqual(local, ["client.alpha.1"]);
  assert.equal(handshake.isPending(), false);
  assert.equal(surfaced.length, 0, "no answer is not a refusal");

  // A refusal that arrives after the local start has nothing to retry.
  handshake.noteRefusal(STALE);
  assert.deepEqual(surfaced.map((entry) => entry.attempts), [0]);
  assert.equal(timers.count(), 0);
});

test("an accepted start cancels the pending retry", async (t) => {
  const { timers, sent, handshake } = harness(t);
  await begin(handshake);
  handshake.noteRefusal(STALE);
  assert.equal(timers.count(), 1);

  handshake.noteAccepted();
  assert.equal(handshake.isPending(), false);
  timers.fireAll();
  assert.equal(sent.length, 1, "a cancelled retry must not resend after FluxIQ has already accepted");
});

test("disconnecting cancels the handshake, and a new start replaces the old one", async (t) => {
  const { timers, sent, handshake } = harness(t);
  await begin(handshake);
  handshake.cancel();
  assert.equal(timers.count(), 0);

  await handshake.begin({ recordingId: "client.alpha.2", startedAt: 20, initialState: INITIAL_STATE });
  assert.equal(handshake.pendingRecordingId(), "client.alpha.2");
  handshake.noteRefusal(STALE);
  timers.fireAll();
  assert.deepEqual(sent.map((attempt) => attempt.recordingId), ["client.alpha.1", "client.alpha.2", "client.alpha.2"]);
});
