// One saved build measured whole, over made-up traces: which Flow judges it, every live
// trial and pair of live runs, the control, and the Lab's oracle as a pair's truth.

import assert from "node:assert/strict";
import test from "node:test";
import { webTraceStateDomain as domain } from "@fluxiq-web-extension/domain/node";
import { readClientGatewayTraceOperation, type ClientGatewayTraceManifest, type ClientGatewayTraceStateRecordedCall } from "fluxiq/client-gateway";
import { configKey, measureBuild, STATE_RULE_CONFIGS } from "../build-measure.js";
import { summariseCorpus } from "../corpus-summary.js";
import type { LabRunRecord, StoreTrace } from "../types.js";

const SITE = "https://parts.example";
let sequence = 0;

function call(actionType: string, parameters: Record<string, unknown>, answer: Record<string, unknown>, callId: string | null = null): ClientGatewayTraceStateRecordedCall {
  sequence += 2;
  return { ordinal: sequence / 2, sequence, operation: readClientGatewayTraceOperation({ actionType, parameters }), callId, answer, latencyMs: 5, redacted: false };
}

const look = (at: string) => call("web.dom.capture_snapshot", {}, { status: "succeeded", payload: { url: `${SITE}${at}`, snapshot: { url: `${SITE}${at}`, interactiveElements: [{ selector: "#a" }] } } });
const goTo = (at: string, callId: string | null = null) => call("web.browser.navigate", { url: `${SITE}${at}` }, { status: "succeeded", payload: { url: `${SITE}${at}`, validation: { status: "passed" } } }, callId);
const readRows = (at: string, rows: readonly string[]) => call("web.dom.extract_list", { extractList: { item: ".row" } }, { status: "succeeded", payload: { url: `${SITE}${at}`, extracted: rows.map((row) => ({ row })) } });

function trace(id: string, activity: string, startedAt: string, calls: readonly ClientGatewayTraceStateRecordedCall[], episodeId = id): StoreTrace {
  const manifest = { traceId: `trace.${id}`, episodeId, activity, origin: { kind: "live" }, startedAt, completeness: { status: "complete" }, context: { value: { authoringMode: "project" } } } as unknown as ClientGatewayTraceManifest;
  return { manifest, calls, firstChild: null, refusal: null };
}

const run: LabRunRecord = {
  runId: "run-1", directory: "", task: "task", scenario: "scenario", instance: "i", repositoryRoot: "", startedAt: "2026-01-01T00:00:00.000Z", finishedAt: "2026-01-01T01:00:00.000Z",
  verdict: "failed", oracleVerdict: "failed", reportedVerdict: null, flowCreated: true, facilityFailure: false, provider: "p", model: "m",
};

const path = () => [look("/start"), goTo("/list"), look("/list"), readRows("/list", ["one", "two"])];

test("a build is judged by its last live test, its trials by their own judges, and each live run by the one before it", () => {
  const build = measureBuild({
    run, domain,
    exploration: trace("explore", "exploration", "2026-01-01T00:00:01.000Z", [...path(), goTo("/reset", "site-reset.arrival")]),
    traces: [
      trace("t1", "test", "2026-01-01T00:01:00.000Z", path(), "trial-1"),
      trace("t2", "test", "2026-01-01T00:02:00.000Z", path(), "trial-2"),
      trace("x1", "execution", "2026-01-01T00:03:00.000Z", path()),
    ],
    trialVerdicts: new Map([["trial-1", "yes"], ["trial-2", "no"]]),
  });
  assert.equal(build.flow, "last_live_test");
  assert.ok(build.flowTrace?.endsWith("t2"));
  assert.deepEqual(Object.keys(build.measures), STATE_RULE_CONFIGS.map(configKey));
  for (const measure of Object.values(build.measures)) assert.equal(measure.verdict.verdict, "pass");
  assert.deepEqual(build.trials.map((trial) => [trial.liveVerdict, trial.verdict]), [["yes", "pass"], ["no", "pass"]]);
  assert.deepEqual(build.pairs.map((pair) => [pair.liveFrom, pair.liveTo, pair.sameCommands, pair.verdict.verdict]), [["yes", "no", true, "pass"], ["no", "no", true, "pass"]], "the Lab's oracle judged the last execution");
  assert.equal(build.control?.positions, 4);
  assert.equal(build.self?.verdict.verdict, "pass");
  assert.equal(build.authoringMode, "project");
  const summary = summariseCorpus([build]);
  assert.equal(summary.pairs.passAfterYesThenNo, 1, "a recording judged yes passed a run judged no: a false pass");
  assert.equal(summary.pairs.passAfterNoThenNo, 1);
  assert.equal(summary.trials.passOnNo, 1);
});

test("a legacy build with no test falls back to its longest execution, then its last dry run, and one with neither has no Flow", () => {
  const dryRun = [call("web.browser.navigate", { url: `${SITE}/list` }, { status: "succeeded", payload: { url: `${SITE}/list` } }, "dryrun.1.1")];
  const exploration = trace("explore", "exploration", "2026-01-01T00:00:01.000Z", [goTo("/list"), look("/list"), ...dryRun]);
  const measure = (traces: readonly StoreTrace[], explored = exploration) => measureBuild({ run, domain, exploration: explored, traces, trialVerdicts: new Map() });
  const short = trace("short", "execution", "2026-01-01T00:01:00.000Z", [look("/list")]);
  const long = trace("long", "execution", "2026-01-01T00:02:00.000Z", [goTo("/list"), look("/list")]);
  assert.ok(measure([short, long]).flowTrace?.endsWith("long"));
  assert.equal(measure([]).flow, "dry_run");
  const bare = trace("bare", "exploration", "2026-01-01T00:00:01.000Z", [look("/list")]);
  const none = measure([], bare);
  assert.equal(none.flow, "none");
  assert.deepEqual(none.measures, {});
});
