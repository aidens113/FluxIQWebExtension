import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../failure.js";
import { readRecordingDiscards, type RecordingDiscardAudit } from "../recording-discards.js";

/**
 * A `/api/client-gateway/snapshot` response shaped as Core serves it: the audit
 * entries `noteDiscardedClientMessage` writes, with the client and page fields
 * that must not travel, beside an unrelated pairing entry.
 */
function snapshot(auditLog: unknown[]) {
  return { ok: true, payload: { sessions: [{ sessionId: "session.one", status: "ready" }], auditLog } };
}
/** The discards and the failure, for a row that judges those and not the window the read publishes beside them. */
function judged({ discards, failure }: RecordingDiscardAudit) {
  return { discards, failure };
}
/**
 * The run's window on Core's clock, in epoch milliseconds, from Lab Stage 2's
 * instrumented run (`reports/l-stage2.md`, "Blocker diagnosis"): the runner
 * asked the extension to start recording at `from`, a recorded action landed at
 * `inside`, Core finalized the recording at `finalized`, and the Flow lane began
 * dispatching no later than `until`, its first action's start. Every entry below
 * is stamped `inside` unless a test says otherwise.
 */
const clock = { from: 1_789_292_715_339, inside: 1_789_292_717_045, finalized: 1_789_292_717_333, until: 1_789_292_729_664 };
/** `recordAuditEvent` puts the session in the metadata, and `ClientGatewayAuditLog.record` copies it onto the entry and stamps it with Core's `Date.now()`. */
function discard(type: string, metadata: Record<string, unknown>, id = `audit.${type}`, sessionId = "session.one", timestamp: unknown = clock.inside) {
  return { id, timestamp, sessionId, type, message: "A recording event arrived 12 ms after its recording was finalized", metadata: { sessionId, source: "automation-studio", clientId: "client.one", clientName: "Chromium", projectId: "project.web", eventType: "client.recording_event", inputId: "element-pressed", executable: type === "recording.action_discarded", ...metadata } };
}
/** The same entry with no `timestamp` key at all. */
function unstamped(entry: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(entry).filter(([key]) => key !== "timestamp"));
}
const pairing = { id: "audit.pairing", timestamp: 0, type: "pairing.approved", message: "Pairing approved", metadata: { clientId: "client.one" } };
/** This run: the recording it produced, the session it paired, and when it asked the extension to start recording. */
const run = { recordingIds: ["recording.run"], sessionId: "session.one", from: clock.from };
/** The start of every failure this check raises: what it judged is a lost action inside this run's recording window. */
const lostInWindow = "Core discarded recorded actions inside this run's recording window";

test("a discarded action on the run's own recording fails as recording.persistence, and only type, entry id, recording, counts and timing travel", () => {
  const audit = readRecordingDiscards(snapshot([
    pairing,
    discard("recording.event_discarded", { recordingId: "recording.run", discardedEvents: 1, discardedActions: 0, sinceFinalizedMs: 4 }),
    discard("recording.action_discarded", { recordingId: "recording.run", discardedEvents: 3, discardedActions: 1, sinceFinalizedMs: 12 }),
  ]), run);

  assert.deepEqual(audit.discards, [
    { type: "recording.event_discarded", entryId: "audit.recording.event_discarded", recordingId: "recording.run", discardedActions: 0, discardedEvents: 1, sinceFinalizedMs: 4 },
    { type: "recording.action_discarded", entryId: "audit.recording.action_discarded", recordingId: "recording.run", discardedActions: 1, discardedEvents: 3, sinceFinalizedMs: 12 },
  ]);
  assert.ok(audit.failure instanceof RunnerFailure);
  assert.equal(audit.failure.category, "recording.persistence");
  assert.match(audit.failure.message, /1 for recording\.run/u);
  const serialized = JSON.stringify(audit.discards);
  for (const withheld of ["client.one", "Chromium", "element-pressed", "arrived 12 ms", "session.one"]) assert.equal(serialized.includes(withheld), false, withheld);
});

test("a discard against another recording is not this run's loss, even from the run's own session", () => {
  const audit = readRecordingDiscards(snapshot([
    discard("recording.action_discarded", { recordingId: "recording.earlier", discardedEvents: 2, discardedActions: 2 }),
  ]), run);

  assert.deepEqual(audit.discards, []);
  assert.equal(audit.failure, undefined);
});

// -- T2: a discard that names no recording --------------------------------------
// Every audit entry keeps the session that sent the message, so one Core attached
// to no recording is still this run's when this run's paired session sent it.

test("a discard that names no recording is counted when the run's paired session sent it, and another session's is not", () => {
  const ours = discard("recording.action_discarded", { discardedEvents: 1, discardedActions: 1 }, "audit.ours");
  const theirs = discard("recording.action_discarded", { discardedEvents: 4, discardedActions: 3 }, "audit.theirs", "session.other");
  const audit = readRecordingDiscards(snapshot([pairing, theirs, ours]), run);

  assert.deepEqual(audit.discards, [{ type: "recording.action_discarded", entryId: "audit.ours", discardedActions: 1, discardedEvents: 1 }]);
  assert.equal(audit.failure?.category, "recording.persistence");
  assert.equal(audit.failure?.message, `${lostInWindow} (1 with no recording id)`);

  const otherSessionOnly = readRecordingDiscards(snapshot([pairing, theirs]), run);
  assert.deepEqual(judged(otherSessionOnly), { discards: [], failure: undefined });
  // With no paired session, no entry is counted by session.
  assert.deepEqual(judged(readRecordingDiscards(snapshot([ours]), { recordingIds: ["recording.run"], sessionId: undefined, from: clock.from })), { discards: [], failure: undefined });
});

test("a session-counted discard is unioned across reads like any other, and its evidence alone does not fail the run", () => {
  const evidenceOnly = discard("recording.event_discarded", { recordingId: "", discardedEvents: 2, discardedActions: 0 }, "audit.evidence");
  const first = readRecordingDiscards(snapshot([evidenceOnly]), run);
  assert.deepEqual(judged(first), { discards: [{ type: "recording.event_discarded", entryId: "audit.evidence", discardedActions: 0, discardedEvents: 2 }], failure: undefined });

  const lateAction = discard("recording.action_discarded", { recordingId: "recording.run", discardedEvents: 3, discardedActions: 1 }, "audit.late");
  const second = readRecordingDiscards(snapshot([evidenceOnly, lateAction]), run, first.discards);
  assert.deepEqual(second.discards.map(item => item.entryId), ["audit.evidence", "audit.late"]);
  assert.equal(second.failure?.category, "recording.persistence");
  assert.match(second.failure?.message ?? "", /\(1 for recording\.run\)$/u);
});

test("discarded evidence alone is recorded but does not fail the run", () => {
  const audit = readRecordingDiscards(snapshot([
    pairing,
    discard("recording.event_discarded", { recordingId: "recording.run", discardedEvents: 5, discardedActions: 0 }),
  ]), { recordingIds: new Set(["recording.run"]), sessionId: "session.one", from: clock.from });

  assert.deepEqual(audit.discards, [{ type: "recording.event_discarded", entryId: "audit.recording.event_discarded", recordingId: "recording.run", discardedActions: 0, discardedEvents: 5 }]);
  assert.equal(audit.failure, undefined);
});

test("an evidence entry whose running count shows a lost action still fails the run", () => {
  // The action's own entry can have left Core's 100-entry snapshot window.
  const audit = readRecordingDiscards(snapshot([
    discard("recording.event_discarded", { recordingId: "recording.run", discardedEvents: 4, discardedActions: 2 }),
  ]), run);

  assert.equal(audit.failure?.category, "recording.persistence");
  assert.match(audit.failure?.message ?? "", /2 for recording\.run/u);
});

test("a clean audit yields nothing, and a response with no audit log fails closed", () => {
  assert.deepEqual(judged(readRecordingDiscards(snapshot([pairing]), run)), { discards: [], failure: undefined });
  for (const response of [{ ok: true, payload: { sessions: [] } }, { ok: true }, undefined]) {
    const audit = readRecordingDiscards(response, run);
    assert.deepEqual(audit.discards, []);
    assert.equal(audit.failure?.category, "gateway.connection");
  }
});

// -- The recording's window -----------------------------------------------------
// After a Core-dispatched action succeeds, the extension confirms it on the
// recording channel whether or not it is recording, and Core audits a
// confirmation that reaches no open recording as a discarded action. The rows
// below are Lab Stage 2's instrumented run: the runner's Core action probe sent
// two before the recording was asked to start, naming no recording, and the Flow
// lane's four actions sent one each after it was finalized, naming it. Neither is
// a message this recording lost.

/** Discards 1 and 2: the probe's navigate and type, each audited 2 ms after it returned, with no recording open. */
const probeConfirmations = [
  discard("recording.action_discarded", { eventType: "web.page.navigated", inputId: "web.user.navigation_requested", domainId: "web-automation", discardedEvents: 1, discardedActions: 1 }, "audit.probe.navigate", "session.one", 1_789_292_713_188),
  discard("recording.action_discarded", { eventType: "web.element.input_changed", inputId: "web.user.text_entered", domainId: "web-automation", discardedEvents: 2, discardedActions: 2 }, "audit.probe.type", "session.one", 1_789_292_714_619),
];
/** Discards 3 to 6: the Flow lane's four actions, each audited as it finished, against the recording Core had finalized 11 to 15 s earlier. `firstCount` is Core's running count on the first. */
function flowConfirmations(firstCount = 1) {
  const actions: [eventType: string, inputId: string, timestamp: number, sinceFinalizedMs: number][] = [
    ["web.element.input_changed", "web.user.text_entered", 1_789_292_730_686, 11_165],
    ["web.element.changed", "web.user.option_selected", 1_789_292_731_704, 12_183],
    ["web.element.input_changed", "web.user.text_entered", 1_789_292_732_726, 13_205],
    ["web.element.clicked", "web.user.element_clicked", 1_789_292_734_054, 14_533],
  ];
  return actions.map(([eventType, inputId, timestamp, sinceFinalizedMs], index) => discard("recording.action_discarded", { recordingId: "recording.run", eventType, inputId, domainId: "web-automation", discardedEvents: firstCount + index, discardedActions: firstCount + index, sinceFinalizedMs }, `audit.flow.${index + 1}`, "session.one", timestamp));
}
/** Not in that run: a recorded click that reached Core 40 ms after it finalized the recording, before any Flow was dispatched. A real loss. */
const genuineLateAction = discard("recording.action_discarded", { recordingId: "recording.run", eventType: "web.element.clicked", inputId: "web.user.element_clicked", domainId: "web-automation", discardedEvents: 1, discardedActions: 1, sinceFinalizedMs: 40 }, "audit.late", "session.one", clock.finalized + 40);

test("a runtime confirmation Core audited before the extension was asked to start recording, naming no recording, is ignored", () => {
  // The first read after Stop, as the instrumented run saw it: the probe's two discards from the run's own session, and nothing else.
  assert.deepEqual(judged(readRecordingDiscards(snapshot([pairing, ...probeConfirmations]), run)), { discards: [], failure: undefined });
  // With no lower bound the same two entries fail the run, as they failed all 12 Stage 2 runs.
  assert.equal(readRecordingDiscards(snapshot([pairing, ...probeConfirmations]), { ...run, from: undefined }).failure?.message, `${lostInWindow} (2 with no recording id)`);
});

test("a discard Core audited inside the window counts, from the moment the extension was asked to start recording", () => {
  // At `from`, before Core has opened the recording, so it names none and carries Core's running count on from the probe's.
  const atStart = discard("recording.action_discarded", { discardedEvents: 3, discardedActions: 3 }, "audit.at-start", "session.one", clock.from);
  const whileRecording = discard("recording.action_discarded", { recordingId: "recording.run", discardedEvents: 1, discardedActions: 1 }, "audit.while-recording", "session.one", clock.inside);
  const audit = readRecordingDiscards(snapshot([pairing, ...probeConfirmations, atStart, whileRecording]), run);

  assert.deepEqual(audit.discards.map(item => item.entryId), ["audit.at-start", "audit.while-recording"]);
  assert.equal(audit.failure?.category, "recording.persistence");
  assert.equal(audit.failure?.message, `${lostInWindow} (3 with no recording id, 1 for recording.run)`);
});

test("once the Flow lane began dispatching, a discard naming the recording is ignored, and a late one Core audited before that counts", () => {
  const flowRun = { ...run, until: clock.until };
  // Both reads of the instrumented run, as the runner makes them: the first bounded below only, the second closed at the Flow's dispatch. All six discards, and no loss.
  const first = readRecordingDiscards(snapshot([pairing, ...probeConfirmations]), run);
  assert.deepEqual(judged(readRecordingDiscards(snapshot([pairing, ...probeConfirmations, ...flowConfirmations()]), flowRun, first.discards)), { discards: [], failure: undefined });
  // An entry naming only the session is judged against the same window.
  const sessionOnlyAfter = discard("recording.action_discarded", { discardedEvents: 5, discardedActions: 5 }, "audit.session-after", "session.one", clock.until + 5);
  assert.deepEqual(judged(readRecordingDiscards(snapshot([sessionOnlyAfter]), flowRun)), { discards: [], failure: undefined });

  // A real late loss before the dispatch still fails the run, and the Flow's confirmations then carry Core's running count on from it.
  const audit = readRecordingDiscards(snapshot([pairing, ...probeConfirmations, genuineLateAction, ...flowConfirmations(2)]), flowRun, first.discards);
  assert.deepEqual(audit.discards, [{ type: "recording.action_discarded", entryId: "audit.late", recordingId: "recording.run", discardedActions: 1, discardedEvents: 1, sinceFinalizedMs: 40 }]);
  assert.equal(audit.failure?.message, `${lostInWindow} (1 for recording.run after finalization)`);

  // With no `until`, as when no Flow was dispatched, the window is open-ended and the Flow's confirmations count.
  assert.equal(readRecordingDiscards(snapshot(flowConfirmations()), run).failure?.message, `${lostInWindow} (4 for recording.run after finalization)`);
});

test("an entry with no readable timestamp counts, so the window fails closed", () => {
  const flowRun = { ...run, until: clock.until };
  // Shaped like a Flow confirmation, but with no time to place it after the dispatch, so it is read as a loss.
  const confirmation = flowConfirmations()[0]!;
  for (const entry of [unstamped(confirmation), { ...confirmation, timestamp: null }, { ...confirmation, timestamp: String(clock.until + 1) }, { ...confirmation, timestamp: Number.NaN }]) {
    const audit = readRecordingDiscards(snapshot([entry]), flowRun);
    assert.deepEqual(audit.discards.map(item => item.entryId), ["audit.flow.1"], `timestamp ${String(entry.timestamp)}`);
    assert.equal(audit.failure?.category, "recording.persistence");
  }
  // And one shaped like a probe confirmation, naming no recording.
  assert.equal(readRecordingDiscards(snapshot([unstamped(probeConfirmations[0]!)]), flowRun).failure?.message, `${lostInWindow} (1 with no recording id)`);
});

// -- What each read publishes ---------------------------------------------------
// The runner publishes each read's window beside its discards, so a Lab run can
// show that the probe's and the Flow's confirmations were excluded, not merely
// absent. Only the bounds and counts travel.

/** What a window that excluded nothing of one audit type counts. */
const noneExcluded = { thisRunsRecording: 0, noRecording: 0, anotherRecording: 0 };

test("each read publishes its bounds, until only when set, and counts what the window excluded by audit type and by the recording each entry names", () => {
  // The instrumented run's first read: the probe's two confirmations, stamped before `from` and naming no recording.
  const first = readRecordingDiscards(snapshot([pairing, ...probeConfirmations]), run);
  assert.deepEqual(first.window, { from: clock.from, excluded: { "recording.action_discarded": { ...noneExcluded, noRecording: 2 }, "recording.event_discarded": noneExcluded } });
  assert.equal("until" in first.window, false, "a read with no upper bound publishes none");
  // Its second read, closed at the Flow's dispatch: the Flow's four confirmations after `until` as well.
  const second = readRecordingDiscards(snapshot([pairing, ...probeConfirmations, ...flowConfirmations()]), { ...run, until: clock.until }, first.discards);
  assert.deepEqual(second.window, { from: clock.from, until: clock.until, excluded: { "recording.action_discarded": { thisRunsRecording: 4, noRecording: 2, anotherRecording: 0 }, "recording.event_discarded": noneExcluded } });

  // Every group, each side of the window; entries inside it, unstamped, or of another audit type are not counted as excluded.
  const earlierEvidence = discard("recording.event_discarded", { recordingId: "recording.earlier", discardedEvents: 7, discardedActions: 0 }, "audit.earlier-evidence", "session.other", clock.from - 1);
  const earlierAction = discard("recording.action_discarded", { recordingId: "recording.earlier", discardedEvents: 8, discardedActions: 1 }, "audit.earlier-action", "session.one", clock.from - 10_000);
  const unloadEvidence = discard("recording.event_discarded", { recordingId: "recording.run", discardedEvents: 2, discardedActions: 0, sinceFinalizedMs: 20_000 }, "audit.unload", "session.one", clock.until + 1);
  // Named by no recording and sent by another session: the window judges it before the session does, so it is counted.
  const otherSessionAfter = discard("recording.action_discarded", { recordingId: "", discardedEvents: 1, discardedActions: 1 }, "audit.other-session", "session.other", clock.until + 2);
  const inside = discard("recording.event_discarded", { recordingId: "recording.run", discardedEvents: 1, discardedActions: 0 }, "audit.inside");
  const noTime = unstamped(discard("recording.event_discarded", { recordingId: "recording.run", discardedEvents: 9, discardedActions: 0 }, "audit.unstamped"));
  // Exactly at `until` is inside; it names another recording, so it is neither this run's discard nor excluded.
  const atUntil = discard("recording.event_discarded", { recordingId: "recording.earlier", discardedEvents: 10, discardedActions: 0 }, "audit.at-until", "session.one", clock.until);
  const mixed = readRecordingDiscards(snapshot([pairing, earlierEvidence, earlierAction, ...probeConfirmations, inside, noTime, atUntil, ...flowConfirmations(), unloadEvidence, otherSessionAfter]), { ...run, until: clock.until });
  assert.deepEqual(mixed.window.excluded, {
    "recording.action_discarded": { thisRunsRecording: 4, noRecording: 3, anotherRecording: 1 },
    "recording.event_discarded": { thisRunsRecording: 1, noRecording: 0, anotherRecording: 1 },
  });
  assert.deepEqual(judged(mixed), { discards: [
    { type: "recording.event_discarded", entryId: "audit.inside", recordingId: "recording.run", discardedActions: 0, discardedEvents: 1 },
    { type: "recording.event_discarded", entryId: "audit.unstamped", recordingId: "recording.run", discardedActions: 0, discardedEvents: 9 },
  ], failure: undefined });

  // Nothing an entry or a page supplied travels: no id, message, session, client, recording id, label or input id.
  const published = JSON.stringify([first.window, second.window, mixed.window]);
  for (const withheld of ["audit.", "session.", "client.one", "Chromium", "automation-studio", "project.web", "arrived 12 ms", "element-pressed", "web.user.", "web.element.", "web.page.", "web-automation", "recording.run", "recording.earlier"]) assert.equal(published.includes(withheld), false, withheld);
});

test("a read with no bound publishes from as null and no until, a bound that is not a finite number is no bound, and a response with no audit log publishes no exclusion count", () => {
  const unbounded = readRecordingDiscards(snapshot([pairing, ...probeConfirmations]), { ...run, from: undefined, until: undefined });
  assert.deepEqual(unbounded.window, { from: null, excluded: { "recording.action_discarded": noneExcluded, "recording.event_discarded": noneExcluded } });
  assert.equal("until" in unbounded.window, false);

  // Published as none, and applied as none: every entry is read.
  for (const bound of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    const audit = readRecordingDiscards(snapshot([...probeConfirmations, ...flowConfirmations(3)]), { ...run, from: bound, until: bound });
    assert.deepEqual(audit.window, { from: null, excluded: { "recording.action_discarded": noneExcluded, "recording.event_discarded": noneExcluded } }, String(bound));
    assert.equal(audit.discards.length, 6, String(bound));
  }

  // Nothing was read, so nothing is claimed excluded; the bounds are still the read's.
  for (const response of [{ ok: true, payload: { sessions: [] } }, { ok: true }, undefined]) {
    assert.deepEqual(readRecordingDiscards(response, { ...run, until: clock.until }).window, { from: clock.from, until: clock.until, excluded: null });
  }

  // What is published survives the bundle's JSON unchanged.
  const second = readRecordingDiscards(snapshot([...probeConfirmations, ...flowConfirmations()]), { ...run, until: clock.until });
  assert.deepEqual(JSON.parse(JSON.stringify(second.window)), second.window);
});

test("the failure names lost actions inside this run's recording window, says `with no recording id` when an entry names none, and says `after finalization` only when Core's sinceFinalizedMs says so", () => {
  const message = (...entries: unknown[]) => readRecordingDiscards(snapshot(entries), { ...run, until: clock.until }).failure?.message;
  const noRecording = discard("recording.action_discarded", { discardedEvents: 1, discardedActions: 1 }, "audit.none");
  const whileOpen = discard("recording.action_discarded", { recordingId: "recording.run", discardedEvents: 1, discardedActions: 1 }, "audit.open");
  const lateAgain = discard("recording.action_discarded", { recordingId: "recording.run", discardedEvents: 2, discardedActions: 2, sinceFinalizedMs: 60 }, "audit.late-again", "session.one", clock.finalized + 60);

  // No timing against finalization, so the text says nothing about it.
  assert.equal(message(noRecording), `${lostInWindow} (1 with no recording id)`);
  assert.equal(message(whileOpen), `${lostInWindow} (1 for recording.run)`);
  // Core timed it against finalization, so the text says so, for an entry naming no recording as well.
  assert.equal(message(genuineLateAction), `${lostInWindow} (1 for recording.run after finalization)`);
  assert.equal(message(discard("recording.action_discarded", { discardedEvents: 1, discardedActions: 1, sinceFinalizedMs: 5 }, "audit.none-timed")), `${lostInWindow} (1 with no recording id after finalization)`);
  // An evidence entry whose running count shows the loss, timed.
  assert.equal(message(discard("recording.event_discarded", { recordingId: "recording.run", discardedEvents: 3, discardedActions: 2, sinceFinalizedMs: 30 }, "audit.running")), `${lostInWindow} (2 for recording.run after finalization)`);
  // One entry showing the recording's loss has no timing, in either order, so the text does not claim it.
  assert.equal(message(whileOpen, lateAgain), `${lostInWindow} (2 for recording.run)`);
  assert.equal(message(lateAgain, whileOpen), `${lostInWindow} (2 for recording.run)`);
  // Untimed evidence that shows no loss does not decide it.
  const untimedEvidence = discard("recording.event_discarded", { recordingId: "recording.run", discardedEvents: 1, discardedActions: 0 }, "audit.evidence-untimed");
  assert.equal(message(untimedEvidence, lateAgain), `${lostInWindow} (2 for recording.run after finalization)`);
  // Each recording's text is its own.
  assert.equal(message(noRecording, genuineLateAction), `${lostInWindow} (1 with no recording id, 1 for recording.run after finalization)`);
});

// -- The second read, before the topology closes ------------------------------
// Core audits a discard only when the late message arrives, so the runner reads
// the log again and unions that read with the first.

test("a second read is unioned with the first by audit entry: an entry both reads return is counted once, and an action discarded after the first read fails the run", () => {
  const lateEvidence = discard("recording.event_discarded", { recordingId: "recording.run", discardedEvents: 1, discardedActions: 0, sinceFinalizedMs: 4 }, "audit.first");
  const first = readRecordingDiscards(snapshot([pairing, lateEvidence]), run);
  assert.equal(first.failure, undefined);

  const lateAction = discard("recording.action_discarded", { recordingId: "recording.run", discardedEvents: 2, discardedActions: 1, sinceFinalizedMs: 900 }, "audit.second");
  const second = readRecordingDiscards(snapshot([pairing, lateEvidence, lateAction]), run, first.discards);

  assert.deepEqual(second.discards, [
    { type: "recording.event_discarded", entryId: "audit.first", recordingId: "recording.run", discardedActions: 0, discardedEvents: 1, sinceFinalizedMs: 4 },
    { type: "recording.action_discarded", entryId: "audit.second", recordingId: "recording.run", discardedActions: 1, discardedEvents: 2, sinceFinalizedMs: 900 },
  ]);
  assert.equal(second.failure?.category, "recording.persistence");
  assert.match(second.failure?.message ?? "", /Core discarded recorded actions .*\(1 for recording\.run after finalization\)/u);
  // The first read's result is not changed by the second.
  assert.equal(first.discards.length, 1);
});

test("a loss only the first read saw still fails the second, and an unreadable second read keeps the first read's discards", () => {
  // The action's entry has left the 100-entry window by the second read.
  const lostEarly = discard("recording.action_discarded", { recordingId: "recording.run", discardedEvents: 1, discardedActions: 1 }, "audit.early");
  const first = readRecordingDiscards(snapshot([lostEarly]), run);
  const second = readRecordingDiscards(snapshot([pairing]), run, first.discards);
  assert.deepEqual(second.discards, first.discards);
  assert.equal(second.failure?.category, "recording.persistence");
  // A known loss outranks an audit the second read could not get.
  assert.equal(readRecordingDiscards({ ok: true }, run, first.discards).failure?.category, "recording.persistence");

  const evidenceOnly = readRecordingDiscards(snapshot([discard("recording.event_discarded", { recordingId: "recording.run", discardedEvents: 1, discardedActions: 0 }, "audit.evidence")]), run);
  const unreadable = readRecordingDiscards(undefined, run, evidenceOnly.discards);
  assert.deepEqual(unreadable.discards, evidenceOnly.discards);
  assert.equal(unreadable.failure?.category, "gateway.connection");
});

test("an audit entry without an id is matched by its type, recording and running counts", () => {
  const entry = { type: "recording.event_discarded", metadata: { recordingId: "recording.run", discardedEvents: 3, discardedActions: 0 } };
  const next = { type: "recording.event_discarded", metadata: { recordingId: "recording.run", discardedEvents: 4, discardedActions: 0 } };
  const first = readRecordingDiscards(snapshot([entry]), run);
  const second = readRecordingDiscards(snapshot([entry, next]), run, first.discards);

  assert.deepEqual(second.discards.map(item => item.discardedEvents), [3, 4]);
  assert.equal(second.discards.some(item => "entryId" in item), false);
  assert.equal(second.failure, undefined);
});
