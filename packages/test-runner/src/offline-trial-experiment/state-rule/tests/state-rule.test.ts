// The go/no-go harness over small made-up traces: the walk against live answers, the
// exploration as its own Flow, every mutation refused, the control, receipts, the
// corpus summary and the command's arguments. The rule itself is tested in Core.

import assert from "node:assert/strict";
import test from "node:test";
import { webTraceStateDomain as domain } from "@fluxiq-web-extension/domain/node";
import { readClientGatewayTraceOperation, type ClientGatewayTraceStateRecordedCall } from "fluxiq/client-gateway";
import { buildRecording, explorationCalls, flowCalls, lastDryRun } from "../build-measure.js";
import { flowControl } from "../control.js";
import { summariseCorpus, totalsTable, verdictsTable } from "../corpus-summary.js";
import { walkFlow } from "../flow-walk.js";
import { traceInRunWindow } from "../lab-corpus.js";
import { traceStateMutations } from "../mutations.js";
import { traceStateReceipts } from "../receipts.js";
import { parseStateRuleArguments } from "../state-rule-arguments.js";
import type { BuildReport, StoreTrace } from "../types.js";

const SITE = "https://parts.example";
let sequence = 0;

function call(actionType: string, parameters: Record<string, unknown>, answer: Record<string, unknown> | null, callId: string | null = null): ClientGatewayTraceStateRecordedCall {
  sequence += 2;
  return { ordinal: sequence / 2, sequence, operation: readClientGatewayTraceOperation({ actionType, parameters }), callId, answer, latencyMs: 5, redacted: false };
}

const look = (at: string, selectors: readonly string[] = ["#a"], parameters: Record<string, unknown> = {}) => call("web.dom.capture_snapshot", parameters, { status: "succeeded", payload: { url: `${SITE}${at}`, snapshot: { url: `${SITE}${at}`, interactiveElements: selectors.map((selector) => ({ selector })) } } });
const goTo = (at: string) => call("web.browser.navigate", { url: `${SITE}${at}` }, { status: "succeeded", payload: { url: `${SITE}${at}`, validation: { status: "passed" } } });
const press = (selector: string, at: string, status = "succeeded", record?: string) => call("web.dom.click", { selector, element: { selector, ...(record ? { context: { record } } : {}) } }, { status, payload: { url: `${SITE}${at}` }, ...(status === "failed" ? { failure: { code: "web.target.not_found" } } : {}) });
const readRows = (at: string, rows: readonly string[], where?: string) => call("web.dom.extract_list", { extractList: { item: ".row", ...(where ? { where } : {}) } }, { status: "succeeded", payload: { url: `${SITE}${at}`, extracted: rows.map((row) => ({ row })) } });

const exploration = (): readonly ClientGatewayTraceStateRecordedCall[] => [
  look("/start"),
  goTo("/list"),
  look("/list", ["#a", "#save"]),
  press("#save", "/list", "succeeded", "row one"),
  look("/list", ["#a", "#save", "#saved"]),
  readRows("/list", ["one", "two"]),
];

function walk(flow: readonly ClientGatewayTraceStateRecordedCall[], recordingCalls = exploration()) {
  return walkFlow({ flow, recording: buildRecording(recordingCalls, domain), domain, options: { skippedActs: "gap" } });
}

test("a Flow that repeats the exploration is answered in full and passes", () => {
  const calls = exploration();
  const { tally, verdict } = walk(calls, calls);
  assert.equal(verdict.verdict, "pass");
  assert.deepEqual(tally.gaps, {});
  assert.equal(tally.answered, calls.length);
  assert.equal(tally.urlSame, tally.readsAnswered - 1, "every read after the opening one");
  assert.equal(tally.statusSameActs, 1);
  assert.equal(tally.rowsSame, 1);
  assert.equal(tally.actsSameInput, 1);
});

test("compares answers with what the site told the Flow live, and sets aside a retry only the failure caused", () => {
  const recorded = exploration();
  const live = [
    look("/elsewhere"),
    goTo("/list"),
    look("/list"),
    press("#save", "/list", "failed", "row one"),
    press("#save", "/list", "succeeded", "row one"),
    look("/other"),
    readRows("/list", ["one", "three"]),
  ];
  const { tally } = walk(live, recorded);
  assert.equal(tally.openingUrlDiffer, 1, "the opening read stands wherever the live run stood");
  assert.equal(tally.notSent, 1, "the second press is sent only because the site failed the first");
  assert.equal(tally.statusDifferActs, 1);
  assert.deepEqual(tally.disagreements, { "act|recorded_succeeded|live_failed|web.target.not_found|not_layer": 1 });
  assert.equal(tally.urlDiffer, 1);
  assert.equal(tally.rowsDiffer, 1);
});

test("says what a refused read would have said, and what first took the run off the recording", () => {
  const { tally, verdict } = walk([look("/start"), goTo("/never"), look("/never")]);
  assert.equal(verdict.verdict, "inconclusive");
  assert.deepEqual(verdict.firstGap && { code: verdict.firstGap.code, actionType: verdict.firstGap.actionType }, { code: "missing_transition", actionType: "web.browser.navigate" });
  assert.deepEqual(tally.firstLeave, { "missing_transition|web.browser.navigate": 1 });
  assert.equal(tally.refusedUrlDiffer.after_unrecorded_move, 1);
  assert.equal(tally.commandsOnRecording, 2);
  assert.equal(tally.answeredOnRecording, 1);
});

test("names where a gap's read differs, on the canonical form", () => {
  const { tally } = walk([look("/start"), goTo("/list"), readRows("/list", [], "a changed filter")]);
  assert.equal(tally.gaps.argument_mismatch, 1);
  assert.equal(tally.gapFields["parameters.extractList.where"], 1);
});

test("no mutation of the exploration's own commands passes", () => {
  const calls = exploration().concat([press("#row", "/list", "succeeded", "row two"), look("/list"), goTo("/end"), look("/end")]);
  const recording = buildRecording(calls, domain);
  const moved = new Set(recording.entries.flatMap((entry) => (entry.kind === "page_move" && entry.nodeAfter !== entry.node && entry.index < recording.resultEntry! ? [entry.index] : [])));
  const mutations = traceStateMutations(calls, domain, new Set(), moved);
  assert.deepEqual(mutations.map((mutation) => mutation.mutation).sort(), ["changed_read", "drop_last_act", "drop_last_move", "other_row", "repeat_act", "swap_acts"]);
  for (const { mutation, flow } of mutations) {
    const { verdict } = walkFlow({ flow, recording, domain, options: { skippedActs: "gap" } });
    assert.notEqual(verdict.verdict, "pass", mutation);
  }
  assert.equal(walkFlow({ flow: calls, recording, domain, options: { skippedActs: "gap" } }).verdict.verdict, "pass");
});

test("the control counts one Flow's two live runs by position", () => {
  const left = [look("/a", ["#a", "#b"]), press("#x", "/a"), readRows("/a", ["one"])];
  const right = [look("/b", ["#a", "#b"]), press("#x", "/a", "failed"), readRows("/a", ["two"])];
  const tally = flowControl(left, right, domain);
  assert.equal(tally.positions, 3);
  assert.equal(tally.snapshotUrlDiffer, 1);
  assert.equal(tally.selectorsEqual, 1);
  assert.equal(tally.statusDifferActs, 1);
  assert.equal(tally.rowsDiffer, 1);
  assert.equal(tally.statusSame, 2);
});

test("gives a receipt only for an act whose looks before and after are equal, or one the next act undid", () => {
  const nothing = [look("/a", ["#a"]), press("#x", "/a"), look("/a", ["#a"])];
  assert.equal(traceStateReceipts(nothing, domain).get(1), "changed_nothing");
  const changed = [look("/a", ["#a"]), press("#x", "/a"), look("/a", ["#a", "#b"])];
  assert.equal(traceStateReceipts(changed, domain).size, 0);
  const undone = [look("/a", ["#a"]), press("#open", "/a"), look("/a", ["#a", "#panel"]), press("#close", "/a"), look("/a", ["#a"])];
  assert.deepEqual([...traceStateReceipts(undone, domain)], [[1, "undone"], [3, "undone"]]);
  const movedBack = [look("/a", ["#a"]), press("#add", "/a"), look("/b", ["#b"]), goTo("/a"), look("/a", ["#a"])];
  assert.equal(traceStateReceipts(movedBack, domain).size, 0, "a page navigated back to still holds what was done to it");
});

test("reads an exploration without Core's bookkeeping, up to the first trial or whole", () => {
  const calls = [look("/a"), call("web.dom.capture_snapshot", { includeHidden: true }, null, "site-reset.read.1"), press("#x", "/a"), look("/a")];
  const trace = { calls, firstChild: calls[2]!.sequence + 1 } as unknown as StoreTrace;
  assert.equal(explorationCalls(trace, "first").length, 2);
  assert.equal(explorationCalls(trace, "whole").length, 3);
  assert.equal(flowCalls(calls).length, 3);
});

test("takes a legacy build's last dry run from inside its exploration, without its reset", () => {
  const calls = [call("web.dom.click", {}, null, "dryrun.1.1"), call("web.dom.click", {}, null, "dryrun.2.1"), call("web.dom.click", {}, null, "dryrun.2.1.pass.2"), call("web.dom.click", {}, null, "dryrun.2.reset"), look("/a")];
  assert.deepEqual(lastDryRun({ calls } as unknown as StoreTrace).map((item) => item.callId), ["dryrun.2.1", "dryrun.2.1.pass.2"]);
});

test("matches a trace to a run by the run's window", () => {
  const run = { startedAt: "2026-10-01T10:00:00.000Z", finishedAt: "2026-10-01T11:00:00.000Z" };
  assert.equal(traceInRunWindow("2026-10-01T10:30:00.000Z", run), true);
  assert.equal(traceInRunWindow("2026-10-01T11:30:00.000Z", run), false);
});

test("the summary counts false passes only on saved failed runs", () => {
  const { tally, verdict } = walk(exploration(), exploration());
  const build = (runId: string, labVerdict: string, oracleVerdict: string | null): BuildReport => ({
    runId, task: "task", scenario: "scenario", provider: "p", model: "m", authoringMode: "project", labVerdict, oracleVerdict, reportedVerdict: null, flowCreated: true, facilityFailure: false,
    explorationTrace: "e", explorationRefusal: null, flow: "last_live_test", flowTrace: "f", flowRefusal: null,
    measures: { "first/gap": { flow: "last_live_test", recordedCalls: 1, tally, verdict } }, control: null, self: null, trials: [], pairs: [],
  });
  const summary = summariseCorpus([build("a", "passed", "passed"), build("b", "failed", "failed"), build("c", "failed", null)]);
  assert.deepEqual(summary.verdicts["first/gap"], { builds: 3, pass: 3, fail: 0, inconclusive: 0, falsePasses: 2, falsePassesOnOracleFailed: 1, falseFailures: 0, passOnPassed: 1, failOnFailed: 0 });
  assert.match(verdictsTable(summary), /first\/gap \| 3 \| 3 \| 0 \| 0 \| 2 \| 1 \| 1 \| 0 \| 0/u);
  assert.match(totalsTable(summary), /Control/u);
  assert.doesNotMatch(JSON.stringify(summary), /parts\.example/u, "no address reaches a report");
});

test("the command refuses to open a store anywhere but a copy under test-runs", () => {
  assert.deepEqual(parseStateRuleArguments(["--lab-runs", "x"]), { error: "--work is required: only a copy of a store is ever opened" });
  assert.match((parseStateRuleArguments(["--lab-runs", "x", "--work", "somewhere"]) as { error: string }).error, /test-runs/u);
  assert.match((parseStateRuleArguments(["--work", "a/test-runs/b"]) as { error: string }).error, /exactly one/u);
  assert.match((parseStateRuleArguments(["--store", "s", "--work", "a/test-runs/b"]) as { error: string }).error, /--run/u);
  assert.match((parseStateRuleArguments(["--lab-runs", "x", "--work", "a/test-runs/b", "--extra-store", "no-run"]) as { error: string }).error, /@<run id>/u);
  const parsed = parseStateRuleArguments(["--lab-runs", "x", "--work", "a/test-runs/b", "--extra-store", "s.sqlite@run-1"]);
  assert.ok(!("error" in parsed));
  assert.deepEqual(parsed.extraStores, [{ store: "s.sqlite", runId: "run-1" }]);
});
