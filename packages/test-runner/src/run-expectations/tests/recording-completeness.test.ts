import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../failure.js";
import { readRecordingCompleteness } from "../recording-completeness.js";

/** Core's `get-recording`, answering with the full session of each recording in `timelines`, and failing for any other. */
function core(timelines: Record<string, readonly unknown[]>) {
  const reads: string[] = [];
  return {
    reads,
    automationStudioCall: async (endpoint: string, payload: Record<string, unknown>) => {
      assert.equal(endpoint, "get-recording");
      assert.equal(payload.projectId, "project.web");
      const recordingId = String(payload.recordingId);
      reads.push(recordingId);
      const timeline = timelines[recordingId];
      if (!timeline) throw new RunnerFailure("environment.missing", "Automation Studio call failed: get-recording");
      return { recording: { recordingId, startedAt: 0, endedAt: 1, timeline, metadata: { projectId: "project.web" } } };
    },
  };
}

// Timeline entries as Core holds them. The labels stand in for page data, which
// must not reach a failure.
const action = (label: string) => ({ type: "action", actionType: "web.dom.type", label });
const evidence = (label: string) => ({ type: "observation", observationType: "client.state_snapshot", label });
const input = (extensionActionCount: unknown, recordingIds = ["recording.run"]) => ({ projectId: "project.web", recordingIds, extensionActionCount });

test("equal counts pass, and Core's count is its action entries by Core's own test, not its evidence", async () => {
  const timeline = [
    action("Email"), evidence("Sign in"), { type: "interaction" }, { type: "client_action" }, { type: "recorded_action" },
    { type: "note", action: { kind: "click" } }, { type: "input", actionType: " " }, evidence("Account"),
  ];
  assert.deepEqual(await readRecordingCompleteness(core({ "recording.run": timeline }), input(5)), { extensionActions: 5, coreActions: 5, failure: undefined });
  // An action the page emitted after the read before Stop reaches Core but not the count.
  assert.equal((await readRecordingCompleteness(core({ "recording.run": timeline }), input(4))).failure, undefined);
});

test("a short count fails as recording.persistence, naming the two counts and nothing recorded", async () => {
  const completeness = await readRecordingCompleteness(core({ "recording.run": [action("private-email-label"), evidence("Account page"), action("Submit order")] }), input(3));
  assert.ok(completeness.failure instanceof RunnerFailure);
  assert.equal(completeness.failure.category, "recording.persistence");
  assert.equal(completeness.failure.message, "Core's recording holds 2 of the 3 actions the extension recorded");
  assert.deepEqual(completeness.failure.details, { extensionActions: 3, coreActions: 2 });
  assert.deepEqual([completeness.extensionActions, completeness.coreActions], [3, 2]);
  const published = JSON.stringify({ message: completeness.failure.message, details: completeness.failure.details });
  for (const recorded of ["private-email-label", "Account page", "Submit order", "web.dom.type"]) assert.equal(published.includes(recorded), false, recorded);
});

test("an empty recording fails against any action the extension recorded, and passes only when it recorded none", async () => {
  const empty = await readRecordingCompleteness(core({ "recording.run": [evidence("Home")] }), input(4));
  assert.equal(empty.failure?.category, "recording.persistence");
  assert.equal(empty.failure?.message, "Core's recording holds 0 of the 4 actions the extension recorded");
  assert.deepEqual(await readRecordingCompleteness(core({ "recording.run": [] }), input(0)), { extensionActions: 0, coreActions: 0, failure: undefined });
  assert.equal((await readRecordingCompleteness(core({ "recording.run": [evidence("Home")] }), input(0))).failure, undefined);
});

test("every recording the run produced is read once and counted", async () => {
  const fake = core({ "recording.a": [action("one"), action("two")], "recording.b": [action("three")] });
  assert.deepEqual(await readRecordingCompleteness(fake, input(3, ["recording.a", "recording.b"])), { extensionActions: 3, coreActions: 3, failure: undefined });
  assert.deepEqual(fake.reads, ["recording.a", "recording.b"]);
  assert.equal((await readRecordingCompleteness(fake, input(4, ["recording.a", "recording.b"]))).failure?.message, "Core's recording holds 3 of the 4 actions the extension recorded");
});

test("a count that cannot be read fails closed: the extension's as extension.worker, Core's as recording.persistence", async () => {
  for (const unreported of [undefined, null, "3", -1, 1.5]) {
    const completeness = await readRecordingCompleteness(core({ "recording.run": [action("one")] }), input(unreported));
    assert.equal(completeness.failure?.category, "extension.worker", String(unreported));
    assert.equal(completeness.extensionActions, null);
    assert.equal(completeness.coreActions, 1);
  }
  const missing = await readRecordingCompleteness(core({}), input(1));
  assert.equal(missing.failure?.category, "recording.persistence");
  assert.match(missing.failure?.message ?? "", /Core's recording recording\.run could not be read in full/u);
  assert.ok(missing.failure?.cause instanceof RunnerFailure);
  assert.equal(missing.coreActions, null);
  for (const answer of [{ recording: { recordingId: "recording.run" } }, { recording: { recordingId: "recording.other", timeline: [] } }, undefined]) {
    const unreadable = await readRecordingCompleteness({ automationStudioCall: async () => answer }, input(0));
    assert.equal(unreadable.failure?.category, "recording.persistence", JSON.stringify(answer));
  }
});
