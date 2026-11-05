import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { resolveScenarioWorkflow, attemptPaths, attemptSimulationResults, type RunAnswerScore } from "@fluxiq-web-extension/test-contracts";
import { resolveCreatedFlowRequest } from "../../flow-lane/index.js";
import { catalogScenario, datasetTask } from "../../flow-lane/creation/tests/scenario-fixture.js";
import type { AttemptDriver, AttemptOutcome, AttemptTask } from "../driver.js";
import { proveContinuation } from "../continuation.js";
import { attemptReportRow, attemptSeries, renderAttemptSeries } from "../report.js";
import { runAttemptSeries } from "../run-attempt-series.js";
import { scriptedSpend } from "../scripted/index.js";

const request = resolveCreatedFlowRequest(catalogScenario, datasetTask());
const task: AttemptTask = { scenario: catalogScenario, request, workflow: resolveScenarioWorkflow(catalogScenario, { ...(request.workflowId === undefined ? {} : { workflowId: request.workflowId }) }) };
const RIGHT: RunAnswerScore = { verdict: "right", ending: "result", wrongBecause: [], records: "held", finalState: "not_declared", change: "held", shown: "held", repeatedActs: [], missingActs: [], unaskedChanges: [], storedRows: 2, shownRows: 2, flow: "unproven", standIns: ["spend"] };
const NO_LOOPS = { exact_repeat: { steered: 0, refused: 0, changeApproach: 0, askPerson: 0 }, near_repeat: { steered: 1, refused: 1, changeApproach: 0, askPerson: 0 }, cycle: { steered: 0, refused: 0, changeApproach: 0, askPerson: 0 }, no_progress: { steered: 0, refused: 0, changeApproach: 0, askPerson: 0 }, same_fix: { steered: 0, refused: 0, changeApproach: 0, askPerson: 0 } };

function outcome(ordinal: number, overrides: { path?: AttemptOutcome["record"]["path"]; flowId?: string; calls?: number; saved?: AttemptOutcome["saved"]; startedFrom?: AttemptOutcome["startedFrom"]; projectId?: string; taskId?: string; answer?: Partial<RunAnswerScore>; oracleVerdict?: AttemptOutcome["oracleVerdict"] } = {}): AttemptOutcome {
  return {
    record: {
      taskId: overrides.taskId ?? request.task.id, attemptId: `a${ordinal}`, ordinal, projectId: overrides.projectId ?? "p", path: overrides.path ?? "explore",
      ...(overrides.flowId ? { flowId: overrides.flowId } : {}),
      status: "achieved", spend: { ...scriptedSpend(overrides.calls ?? 10), ms: 1000 }, liveSteps: 5, loopsCaught: NO_LOOPS,
    },
    saved: overrides.saved === undefined ? { state: "partly_works", flowId: "f", draftDigest: "abc" } : overrides.saved,
    startedFrom: overrides.startedFrom ?? null,
    answer: { ...RIGHT, ...overrides.answer },
    oracleVerdict: overrides.oracleVerdict ?? null,
    standIns: ["spend"],
  };
}
const SECOND = { path: "run_flow" as const, flowId: "f", calls: 1, startedFrom: { state: "partly_works" as const, flowId: "f", draftDigest: "abc" } };

test("a second attempt that found the first's saved draft and ran its Flow started from it", () => {
  assert.deepEqual(proveContinuation(outcome(1), outcome(2, SECOND)), { fromAttempt: 1, toAttempt: 2, held: true, refused: [] });
});

test("a repeat that merely spent less is refused, each reason named", () => {
  const refused = (later: AttemptOutcome, earlier = outcome(1)) => proveContinuation(earlier, later).refused;
  assert.deepEqual(refused(outcome(2, { calls: 1 })), ["second_found_nothing_saved", "second_explored_from_blank"], "a blank start that happened to be cheap");
  assert.deepEqual(refused(outcome(2, { ...SECOND, projectId: "other" })), ["other_workspace"]);
  assert.deepEqual(refused(outcome(2, { ...SECOND, taskId: "other" })), ["other_task"]);
  assert.deepEqual(refused(outcome(3, SECOND)), ["not_consecutive"]);
  assert.deepEqual(refused(outcome(2, { ...SECOND, startedFrom: { state: "partly_works", flowId: "f", draftDigest: "else" } })), ["second_found_something_else"]);
  assert.deepEqual(refused(outcome(2, { ...SECOND, flowId: "other" })), ["second_ran_another_flow"]);
  assert.ok(refused(outcome(2, SECOND), outcome(1, { saved: null })).includes("first_saved_nothing"));
});

test("the series reseeds the site before each attempt, on one workspace, and reports the proof", async () => {
  const calls: string[] = [];
  const driver: AttemptDriver = {
    seedSite: async () => {
      calls.push("seed");
    },
    run: async (_task, ordinal) => {
      calls.push(`attempt-${ordinal}`);
      return ordinal === 1 ? outcome(1) : outcome(2, SECOND);
    },
  };
  const { series, continuations } = await runAttemptSeries({ task: { ...task, scenario: { ...catalogScenario, id: "everything-store" } }, driver, attempts: 2 });
  assert.deepEqual(calls, ["seed", "attempt-1", "seed", "attempt-2"]);
  assert.equal(series.secondStartedFromFirst, true);
  assert.equal(continuations[0]?.held, true);
  assert.deepEqual(series.spendDeltas.map(({ attempt, calls: delta }) => [attempt, delta]), [[2, -9]]);
  assert.equal(series.firstRightAttempt, 1);
});

test("the lane refuses a scenario that is not one of the ten realistic ones", async () => {
  await assert.rejects(runAttemptSeries({ task, driver: { seedSite: async () => undefined, run: async () => outcome(1) }, attempts: 1 }), /ten realistic/u);
});

test("a row carries the count of acts with no row only when the attempt had one, and the series validates both", () => {
  const plain = outcome(1);
  assert.equal("actsWithNoRow" in attemptReportRow(task, plain), false);
  const counted = attemptReportRow(task, { ...plain, record: { ...plain.record, actsWithNoRow: 2 } });
  assert.equal(counted.actsWithNoRow, 2);
  assert.doesNotThrow(() => attemptSeries(task, [counted], null));
  assert.throws(() => attemptSeries(task, [{ ...counted, actsWithNoRow: -1 }], null));
});

test("a row carries every column the plan names, and the series follows from its rows", () => {
  const row = attemptReportRow(task, outcome(1));
  assert.deepEqual(Object.keys(row).sort(), ["answerVerdict", "attempt", "calls", "flow", "inputTokens", "live", "liveSteps", "loopsCaught", "ms", "oracleVerdict", "outputTokens", "path", "repeatedActs", "scenarioId", "schemaVersion", "simulation", "standIns", "taskId", "usd"]);
  assert.equal(row.simulation, "not_run", "an attempt with no simulation says so");
  assert.equal(row.live, false, "a row with a stand-in is not live");
  assert.equal(row.loopsCaught.near_repeat, 2, "each pattern's ladder counts, summed");
  const series = attemptSeries(task, [attemptReportRow(task, outcome(1, { answer: { verdict: "wrong", wrongBecause: ["records"], records: "failed" } })), attemptReportRow(task, outcome(2, { ...SECOND, answer: { flow: "replay_held" } }))], null);
  assert.equal(series.firstRightAttempt, 2);
  assert.equal(series.attemptsUntilDeterministic, 2);
  assert.equal(series.secondStartedFromFirst, null);
});

test("what is printed names each stand-in beside the numbers it produced", () => {
  const text = renderAttemptSeries(attemptSeries(task, [attemptReportRow(task, outcome(1, { answer: { verdict: "wrong", wrongBecause: ["repeated_act"], repeatedActs: [{ name: "Two kettles", asked: 2, landed: 4 }] } }))], null));
  assert.match(text, /Two kettles \(asked 2, landed 4\)/u);
  assert.match(text, /\| spend$/mu);
});

test("the report prints how much of the input came from the cache, and says when no step said", () => {
  const row = attemptReportRow(task, outcome(1));
  const series = attemptSeries(task, [row], null);
  assert.match(renderAttemptSeries(series), /tokens \| from cache \| usd/u);
  assert.match(renderAttemptSeries(series), /\| unknown \|/u);
  assert.match(renderAttemptSeries({ ...series, rows: [{ ...row, cacheHitPercent: 83 }] }), /\| 83% \|/u);
});

test("the report's paths and simulation words are still Core's", async () => {
  const contracts = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..", "..", "!FluxIQ", "packages", "contracts", "src", "task-attempts", "task-attempt.ts");
  const source = await readFile(contracts, "utf8");
  const list = (name: string) => JSON.parse(`[${new RegExp(`${name} = Object\\.freeze\\(\\[([^\\]]*)\\]`, "u").exec(source)?.[1] ?? ""}]`) as string[];
  assert.deepEqual(list("AUTOMATION_STUDIO_TASK_ATTEMPT_PATHS"), [...attemptPaths]);
  assert.deepEqual(list("AUTOMATION_STUDIO_TASK_ATTEMPT_SIMULATION_VERDICTS"), [...attemptSimulationResults]);
});
