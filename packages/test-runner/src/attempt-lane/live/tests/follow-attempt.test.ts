import assert from "node:assert/strict";
import test from "node:test";
import { AttemptProofStuck, AttemptScriptRefused, followAttempt, type AttemptOutcomeRead, type AttemptOutcomeRecord } from "../index.js";

function outcome(status: AttemptOutcomeRecord["status"], extra: Partial<AttemptOutcomeRecord> = {}): AttemptOutcomeRead {
  return { attempt: { taskId: "t", attemptId: "attempt.one", ordinal: 1, projectId: "p", path: "explore", status, spend: { calls: 3, inputTokens: 1, outputTokens: 1, usd: 0.1, ms: 1 }, budget: { usd: 5 }, liveSteps: 2, loopsCaught: {}, startedAtMs: 1, ...extra } };
}

/** A control answering each read with the next list, and a clock that moves by what is slept. */
function scripted(reads: readonly (readonly AttemptOutcomeRead[] | Error)[]) {
  let at = 0;
  let read = 0;
  return {
    control: {
      automationStudioCall: async () => {
        const next = reads[Math.min(read++, reads.length - 1)]!;
        if (next instanceof Error) throw next;
        return { outcomes: next };
      },
    },
    now: () => at,
    sleep: async (ms: number) => { at += ms; },
    reads: () => read,
  };
}

const scope = { projectId: "p", conversationId: "c", known: new Set<string>() };

for (const status of ["achieved", "budget_out", "stopped_by_person"] as const) {
  test(`it stops on ${status}`, async () => {
    const world = scripted([[], [outcome("working")], [outcome(status)]]);
    const ended = await followAttempt({ ...scope, ...world });
    assert.equal(ended.attempt.status, status);
  });
}

test("a running attempt is never called a failure, however long it runs, while it moves", async () => {
  const steps = Array.from({ length: 200 }, (_, index) => [outcome("working", { liveSteps: index })]);
  const world = scripted([...steps, [outcome("achieved")]]);
  const ended = await followAttempt({ ...scope, ...world, stallMs: 5_000, pollMs: 1_000 });
  assert.equal(ended.attempt.status, "achieved");
  assert.ok(world.now() > 100_000, "it ran past many stall windows, each of which it moved in");
});

test("a thread with no attempt yet is not stuck while Core's step log moves", async () => {
  const world = scripted([...Array.from({ length: 12 }, () => []), [outcome("achieved")]]);
  let steps = 0;
  const ended = await followAttempt({ ...scope, ...world, stallMs: 3_000, pollMs: 1_000, progress: async () => ({ marker: `${(steps += 1)} steps` }) });
  assert.equal(ended.attempt.status, "achieved");
});

test("nothing moving stops the watch, saying where it stood and judging nothing", async () => {
  const world = scripted([[outcome("working")]]);
  await assert.rejects(() => followAttempt({ ...scope, ...world, stallMs: 3_000, pollMs: 1_000, describeChat: async () => "Working on your task" }), (error: unknown) => {
    assert.ok(error instanceof AttemptProofStuck);
    assert.match(error.stood, /the attempt stood at working, 2 live steps, 3 calls/u);
    assert.match(error.stood, /Working on your task/u);
    return true;
  });
});

test("no attempt at all says so, and a failed read is waited through", async () => {
  const world = scripted([new Error("Core blinked"), [], [outcome("achieved")]]);
  assert.equal((await followAttempt({ ...scope, ...world })).attempt.status, "achieved");
  const none = scripted([[]]);
  await assert.rejects(() => followAttempt({ ...scope, ...none, stallMs: 2_000, pollMs: 1_000 }), /started no attempt the thread can read/u);
});

test("a request the script refused ends the watch at once, by name", async () => {
  const world = scripted([[outcome("working")]]);
  await assert.rejects(() => followAttempt({ ...scope, ...world, progress: async () => ({ marker: "{}", refused: "expects no request 9 of kind evidence_tool_decision" }) }), (error: unknown) => error instanceof AttemptScriptRefused && /kind evidence_tool_decision/u.test(error.message));
});

test("an attempt the thread held before this message is not this one", async () => {
  const world = scripted([[outcome("achieved")], [outcome("achieved"), outcome("achieved", { attemptId: "attempt.two", ordinal: 2 })]]);
  const ended = await followAttempt({ ...scope, known: new Set(["attempt.one"]), ...world });
  assert.equal(ended.attempt.attemptId, "attempt.two");
});

test("with no person playing it stops on a wait for a person, saying so", async () => {
  const world = scripted([[], [outcome("working")], [outcome("waiting_for_person", { waitingFor: "a person" })]]);
  const ended = await followAttempt({ ...scope, ...world });
  assert.equal(ended.attempt.status, "waiting_for_person");
});

test("with a person playing it follows a wait for a person on to the attempt's own ending", async () => {
  const world = scripted([[outcome("working")], [outcome("waiting_for_person")], [outcome("waiting_for_person")], [outcome("waiting_for_person")], [outcome("achieved")]]);
  const ended = await followAttempt({ ...scope, ...world, personPlaying: true });
  assert.equal(ended.attempt.status, "achieved");
  assert.ok(world.reads() >= 5, "it read past every wait");
});

test("a person that never answers still ends the watch by the stall, never by calling the wait an ending", async () => {
  const world = scripted([[outcome("waiting_for_person")]]);
  await assert.rejects(() => followAttempt({ ...scope, ...world, personPlaying: true, stallMs: 3_000, pollMs: 1_000 }), AttemptProofStuck);
});

// Run `run-mwb5cnxg-003415b4` (t897): a saved Flow's run asks permission once before it starts, and the Lab answered
// in the chat within 1.3 s. A poll in that window stopped the watch, so attempts 2 and 4 read as ended with no answer.
test("a wait for a permission answer the Lab's person gives is followed on to the attempt's own ending", async () => {
  const world = scripted([[outcome("working")], [outcome("waiting_for_person", { waitingFor: "permission" })], [outcome("working", { liveSteps: 7 })], [outcome("achieved", { liveSteps: 7 })]]);
  const ended = await followAttempt({ ...scope, ...world, permissionsAnswered: true });
  assert.equal(ended.attempt.status, "achieved");
  assert.equal(ended.attempt.liveSteps, 7);
});

test("answering permission questions plays no other wait: one for a check with nobody playing still stops the proof", async () => {
  const world = scripted([[outcome("working")], [outcome("waiting_for_person", { waitingFor: "person_only_check" })]]);
  const ended = await followAttempt({ ...scope, ...world, permissionsAnswered: true });
  assert.deepEqual([ended.attempt.status, ended.attempt.waitingFor], ["waiting_for_person", "person_only_check"]);
});

test("a run whose person leaves permission questions stops on one, saying so", async () => {
  const world = scripted([[outcome("working")], [outcome("waiting_for_person", { waitingFor: "permission" })]]);
  const ended = await followAttempt({ ...scope, ...world });
  assert.deepEqual([ended.attempt.status, ended.attempt.waitingFor], ["waiting_for_person", "permission"]);
});
