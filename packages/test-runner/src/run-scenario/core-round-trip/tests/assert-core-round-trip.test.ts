import assert from "node:assert/strict";
import test from "node:test";
import type { RunningTopology } from "../../../coordinator.js";
import { RunnerFailure } from "../../../failure.js";
import { assertCoreRoundTrip } from "../assert-core-round-trip.js";

type ControlFake = {
  sessions: unknown[];
  recordings: { recordingId: string; endedAt?: number; metadata?: { eventCount: number } }[];
  calls: string[];
};

function topologyWith(fake: ControlFake): RunningTopology {
  const control = {
    gatewaySnapshot: async () => { fake.calls.push("gatewaySnapshot"); return { payload: { sessions: fake.sessions } }; },
    listRecordings: async () => { fake.calls.push("listRecordings"); return { payload: { recordings: fake.recordings } }; },
    // What `awaitFinalizedRecording` reads to decide a recording is finished.
    automationStudioCall: async () => { fake.calls.push("automationStudioCall"); return { recordings: fake.recordings }; },
  };
  return { control, projectId: "project.web" } as unknown as RunningTopology;
}

const isFailure = (category: string, message: RegExp) => (error: unknown) => error instanceof RunnerFailure && error.category === category && message.test(error.message);

test("a gateway snapshot holding no matching paired session fails as gateway.connection before any recording is read", async () => {
  const noSession = { sessions: [], recordings: [], calls: [] };
  await assert.rejects(() => assertCoreRoundTrip(topologyWith(noSession), "session.one"), isFailure("gateway.connection", /no matching paired extension session/u));
  assert.deepEqual(noSession.calls, ["gatewaySnapshot"], "the recording wait is never entered for a session that is gone");

  const otherSession = { sessions: [{ status: "ready", sessionId: "session.other" }], recordings: [], calls: [] };
  await assert.rejects(() => assertCoreRoundTrip(topologyWith(otherSession), "session.one"), isFailure("gateway.connection", /no matching paired extension session/u));
});

test("a ready or connected session this run paired is accepted, and the recording it produced is returned finished", async () => {
  for (const status of ["ready", "connected"]) {
    const fake: ControlFake = {
      sessions: [{ status, sessionId: "session.one" }],
      recordings: [{ recordingId: "recording.before" }, { recordingId: "recording.run", endedAt: 1_700_000_000_000, metadata: { eventCount: 4 } }],
      calls: [],
    };
    const outcome = await assertCoreRoundTrip(topologyWith(fake), "session.one", new Set(["recording.before"]));
    assert.deepEqual(outcome.newRecordingIds, ["recording.run"], "only the recording this run produced is reported as new");
    assert.equal(outcome.newRecordingCount, 1);
    assert.equal(outcome.recordingCount, 2, "the project's whole count is still reported");
    assert.equal(outcome.sessionCount, 1);
    assert.deepEqual(outcome.finalized.map(item => [item.recordingId, item.endedAt, item.entryCount]), [["recording.run", 1_700_000_000_000, 4]], "a baselined call waits for Core's own endedAt before reporting the recording");
  }
});

/**
 * Without a baseline every recording in the project is "new", so an unrelated
 * open one would be waited on and would fail the run. The Flow lane holds the
 * same finalization wait on the exact recording it builds from, so nothing is
 * lost by skipping it here.
 */
test("an unbaselined call reports every recording and waits on none of them", async () => {
  const fake: ControlFake = { sessions: [{ status: "ready", sessionId: "session.one" }], recordings: [{ recordingId: "recording.open" }], calls: [] };
  const outcome = await assertCoreRoundTrip(topologyWith(fake), "session.one");
  assert.deepEqual(outcome.newRecordingIds, ["recording.open"]);
  assert.deepEqual(outcome.finalized, []);
  assert.equal(fake.calls.includes("automationStudioCall"), false, "no finalization wait is entered, so an unrelated open recording cannot fail the run");
});
