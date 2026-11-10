import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { resolveScenarioWorkflow, attemptPaths, attemptSimulationResults, type AttemptReportRow, type RunAnswerScore } from "@fluxiq-web-extension/test-contracts";
import { resolveCreatedFlowRequest } from "../../flow-lane/index.js";
import { catalogScenario, datasetTask } from "../../flow-lane/creation/tests/scenario-fixture.js";
import type { AttemptDriver, AttemptOutcome, AttemptTask } from "../driver.js";
import { proveContinuation } from "../continuation.js";
import { attemptReportRow, attemptSeries, laterAttemptNotes, renderAttemptSeries } from "../report.js";
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
  const { series, continuations } = await runAttemptSeries({ task: { ...task, scenario: { ...catalogScenario, id: "everything-store" } }, driver, attempts: 2, between: "reseed" });
  assert.deepEqual(calls, ["seed", "attempt-1", "seed", "attempt-2"]);
  assert.deepEqual(series.continuations.map((proof) => proof.held), [true]);
  assert.equal(series.deterministic?.allHeld, true);
  assert.equal(continuations[0]?.held, true);
  assert.deepEqual(series.spendDeltas.map(({ attempt, calls: delta }) => [attempt, delta]), [[2, -9]]);
  assert.equal(series.firstRightAttempt, 1);
});

test("left as it was, the site is seeded once, before the first attempt and never between them", async () => {
  const calls: string[] = [];
  const driver: AttemptDriver = {
    seedSite: async () => { calls.push("seed"); },
    run: async (_task, ordinal) => {
      calls.push(`attempt-${ordinal}`);
      return ordinal === 1 ? outcome(1) : outcome(2, SECOND);
    },
  };
  const { series, stoppedShort } = await runAttemptSeries({ task: { ...task, scenario: { ...catalogScenario, id: "everything-store" } }, driver, attempts: 2, between: "as_left" });
  assert.deepEqual(calls, ["seed", "attempt-1", "attempt-2"]);
  assert.equal(series.deterministic?.allHeld, true);
  assert.equal(stoppedShort, undefined);
});

test("what runs before a later attempt runs once, after the first ended and before the second began, and not when the series stops short", async () => {
  const order: string[] = [];
  const driver: AttemptDriver = {
    seedSite: async () => { order.push("seed"); },
    run: async (_task, ordinal) => {
      order.push(`attempt ${ordinal}`);
      return outcome(ordinal);
    },
  };
  const scenario = { ...task, scenario: { ...catalogScenario, id: "everything-store" } };
  await runAttemptSeries({ task: scenario, driver, attempts: 2, between: "as_left", beforeLater: async (ordinal) => { order.push(`restart before ${ordinal}`); } });
  assert.deepEqual(order, ["seed", "attempt 1", "restart before 2", "attempt 2"]);
  order.length = 0;
  await runAttemptSeries({ task: scenario, driver, attempts: 2, between: "as_left", mayGoOn: async () => "the first was wrong", beforeLater: async () => { order.push("restart"); } });
  assert.deepEqual(order, ["seed", "attempt 1"]);
});

test("a series can stop short with its reason, and what ran is still reported", async () => {
  const driver: AttemptDriver = { seedSite: async () => undefined, run: async (_task, ordinal) => outcome(ordinal) };
  const { series, outcomes, stoppedShort } = await runAttemptSeries({ task: { ...task, scenario: { ...catalogScenario, id: "everything-store" } }, driver, attempts: 2, between: "as_left", mayGoOn: async () => "the first was wrong" });
  assert.equal(outcomes.length, 1);
  assert.equal(stoppedShort, "the first was wrong");
  assert.deepEqual(series.continuations, []);
  assert.deepEqual(series.deterministic, { asked: 1, ran: 0, attempts: [], zeroCallAttempts: 0, allHeld: false }, "one later attempt asked for and none ran: not held");
  assert.match(laterAttemptNotes(series).join(" "), /1 of the 1 later attempts asked for did not run/u);
});

const LATER_ZERO = (flowId = "f") => ({ path: "run_flow" as const, flowId, calls: 0, startedFrom: { state: "partly_works" as const, flowId: "f", draftDigest: "abc" } });

test("four attempts prove each later one against the one before, and list every one of them", async () => {
  const driver: AttemptDriver = { seedSite: async () => undefined, run: async (_task, ordinal) => (ordinal === 1 ? outcome(1) : outcome(ordinal, LATER_ZERO())) };
  const { series, continuations } = await runAttemptSeries({ task: { ...task, scenario: { ...catalogScenario, id: "everything-store" } }, driver, attempts: 4, between: "as_left" });
  assert.equal(continuations.length, 3);
  assert.deepEqual(series.continuations.map(({ fromAttempt, toAttempt, held }) => [fromAttempt, toAttempt, held]), [[1, 2, true], [2, 3, true], [3, 4, true]]);
  assert.deepEqual(series.deterministic, { asked: 3, ran: 3, attempts: [2, 3, 4].map((attempt) => ({ attempt, path: "run_flow", flowId: "f", continuationHeld: true, calls: 0, callKinds: null, ms: 1000 })), zeroCallAttempts: 3, allHeld: true });
  assert.deepEqual(laterAttemptNotes(series), [], "nothing to name when every later attempt only ran the saved Flow with no call");
  const text = renderAttemptSeries(series);
  for (const attempt of [2, 3, 4]) assert.match(text, new RegExp(`deterministic attempt ${attempt}: path run_flow, flow f, continuation held, model calls 0 \\(not split by kind\\)`, "u"));
  assert.match(text, /deterministic attempts: 3 of 3 ran, 3 with no model call, continuations all held/u);
});

test("a later attempt that spent calls or strayed is named, and one refused continuation means not all held", async () => {
  const driver: AttemptDriver = {
    seedSite: async () => undefined,
    run: async (_task, ordinal) => {
      if (ordinal === 1) return outcome(1);
      if (ordinal === 3) return outcome(3, { path: "run_flow_then_repair", flowId: "f", calls: 5, startedFrom: { state: "partly_works", flowId: "f", draftDigest: "abc" }, saved: { state: "partly_works", flowId: "f", draftDigest: "abc" } });
      if (ordinal === 4) return outcome(4, { path: "run_flow", flowId: "other", calls: 0, startedFrom: { state: "partly_works", flowId: "f", draftDigest: "abc" } });
      return outcome(2, LATER_ZERO());
    },
  };
  const { series } = await runAttemptSeries({ task: { ...task, scenario: { ...catalogScenario, id: "everything-store" } }, driver, attempts: 4, between: "as_left" });
  assert.equal(series.deterministic?.allHeld, false);
  assert.equal(series.deterministic?.zeroCallAttempts, 2);
  assert.deepEqual(series.continuations.map((proof) => proof.held), [true, true, false]);
  assert.deepEqual(series.continuations[2]?.refused, ["second_ran_another_flow"]);
  const [note, ...more] = laterAttemptNotes(series);
  assert.equal(more.length, 0, "one line");
  assert.match(note!, /^NOT DETERMINISTIC: attempt 3: it made model calls 5 \(not split by kind\); it did not just run the saved Flow \(path run_flow_then_repair\)\. attempt 4: it was not proven to start from the attempt before \(second_ran_another_flow\)\.$/u);
  assert.match(renderAttemptSeries(series), /deterministic attempt 4: path run_flow, flow other, continuation refused \(second_ran_another_flow\), model calls 0 \(not split by kind\)/u);
});

test("a series of one attempt has no deterministic summary, and says it is a diagnosis", () => {
  const one = attemptSeries(task, [attemptReportRow(task, outcome(1))], [], 1, new Map());
  assert.equal(one.deterministic, null);
  assert.match(renderAttemptSeries(one), /none asked for \(a diagnosis-only run, which is never a pass\)/u);
});

test("a second attempt's row says it began on what the first left, and that is validated", () => {
  const against = { reseeded: false as const, foundDone: ["Three saved"], changed: [] };
  const row = attemptReportRow(task, { ...outcome(2, SECOND), against });
  assert.deepEqual(row.against, against);
  assert.doesNotThrow(() => attemptSeries(task, [attemptReportRow(task, outcome(1)), row], [proveContinuation(outcome(1), outcome(2, SECOND))], 2, new Map([[2, "f"]])));
  const reseeded: unknown = { ...row, against: { ...against, reseeded: true } };
  assert.throws(() => attemptSeries(task, [attemptReportRow(task, outcome(1)), reseeded as AttemptReportRow], [proveContinuation(outcome(1), outcome(2, SECOND))], 2, new Map([[2, "f"]])), /reseeded/u);
});

test("what is printed sets the second beside the first", () => {
  const text = renderAttemptSeries(attemptSeries(task, [attemptReportRow(task, outcome(1)), attemptReportRow(task, outcome(2, SECOND))], [{ fromAttempt: 1, toAttempt: 2, held: true, refused: [] }], 2, new Map([[2, "f"]])));
  assert.match(text, /attempt 2 beside attempt 1: 9 less calls/u);
  assert.match(text, /deterministic attempt 2: path run_flow, flow f, continuation held, model calls 1 \(not split by kind\)/u);
  assert.match(text, /NOT DETERMINISTIC: attempt 2: it made model calls 1 \(not split by kind\)\./u, "a later attempt that made a call is named, not averaged away");
});

test("the lane refuses a scenario that is not one of the ten realistic ones", async () => {
  await assert.rejects(runAttemptSeries({ task, driver: { seedSite: async () => undefined, run: async () => outcome(1) }, attempts: 1, between: "reseed" }), /ten realistic/u);
});

test("a row carries the count of acts with no row only when the attempt had one, and the series validates both", () => {
  const plain = outcome(1);
  assert.equal("actsWithNoRow" in attemptReportRow(task, plain), false);
  const counted = attemptReportRow(task, { ...plain, record: { ...plain.record, actsWithNoRow: 2 } });
  assert.equal(counted.actsWithNoRow, 2);
  assert.doesNotThrow(() => attemptSeries(task, [counted], [], 1, new Map()));
  assert.throws(() => attemptSeries(task, [{ ...counted, actsWithNoRow: -1 }], [], 1, new Map()));
});

test("a row carries every column the plan names, and the series follows from its rows", () => {
  const row = attemptReportRow(task, outcome(1));
  assert.deepEqual(Object.keys(row).sort(), ["answerVerdict", "attempt", "calls", "flow", "inputTokens", "live", "liveSteps", "loopsCaught", "ms", "oracleVerdict", "outputTokens", "path", "repeatedActs", "scenarioId", "schemaVersion", "simulation", "standIns", "taskId", "usd"]);
  assert.equal(row.simulation, "not_run", "an attempt with no simulation says so");
  assert.equal(row.live, false, "a row with a stand-in is not live");
  assert.equal(row.loopsCaught.near_repeat, 2, "each pattern's ladder counts, summed");
  const series = attemptSeries(task, [attemptReportRow(task, outcome(1, { answer: { verdict: "wrong", wrongBecause: ["records"], records: "failed" } })), attemptReportRow(task, outcome(2, { ...SECOND, answer: { flow: "replay_held" } }))], [{ fromAttempt: 1, toAttempt: 2, held: true, refused: [] }], 2, new Map([[2, "f"]]));
  assert.equal(series.firstRightAttempt, 2);
  assert.equal(series.attemptsUntilDeterministic, 2);
  assert.equal(series.deterministic?.zeroCallAttempts, 0);
});

test("what is printed names each stand-in beside the numbers it produced", () => {
  const text = renderAttemptSeries(attemptSeries(task, [attemptReportRow(task, outcome(1, { answer: { verdict: "wrong", wrongBecause: ["repeated_act"], repeatedActs: [{ name: "Two kettles", asked: 2, landed: 4 }] } }))], [], 1, new Map()));
  assert.match(text, /Two kettles \(asked 2, landed 4\)/u);
  assert.match(text, /\| spend$/mu);
});

test("the report prints how much of the input came from the cache, and says when no step said", () => {
  const row = attemptReportRow(task, outcome(1));
  const series = attemptSeries(task, [row], [], 1, new Map());
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

test("a row's calls include the chat's reading of the instruction and add up by kind, so the judge is not counted twice", () => {
  const exploring = { ...outcome(1, { calls: 21 }), modelCalls: { interpretation: 1, judge: 1 } };
  const row = attemptReportRow(task, exploring);
  assert.deepEqual(row.callKinds, { interpretation: 1, judge: 1, decisions: 20 }, "Core's 21 already holds the judge");
  assert.equal(row.calls, 22);
  const replay = attemptReportRow(task, { ...outcome(2, { ...SECOND, calls: 1 }), modelCalls: { interpretation: 1, judge: 1 } });
  assert.deepEqual(replay.callKinds, { interpretation: 1, judge: 1, decisions: 0 });
  assert.equal(replay.calls, 2);
  const unsaid = attemptReportRow(task, outcome(2, { ...SECOND, calls: 1 }));
  assert.equal(unsaid.callKinds, undefined, "a call source that cannot attribute says nothing, and calls stays Core's count");
  assert.equal(unsaid.calls, 1);
});

test("later attempts that made only the interpretation and the judge are shown, and named without being called exploring", async () => {
  const withCalls = (ordinal: number, kinds: { interpretation: number; judge: number }, calls: number) => ({ ...outcome(ordinal, { ...LATER_ZERO(), calls }), modelCalls: kinds });
  const driver: AttemptDriver = { seedSite: async () => undefined, run: async (_task, ordinal) => (ordinal === 1 ? { ...outcome(1, { calls: 21 }), modelCalls: { interpretation: 1, judge: 1 } } : withCalls(ordinal, { interpretation: 1, judge: 1 }, 1)) };
  const { series } = await runAttemptSeries({ task: { ...task, scenario: { ...catalogScenario, id: "everything-store" } }, driver, attempts: 3, between: "as_left" });
  assert.deepEqual(series.rows.map((row) => row.calls), [22, 2, 2]);
  assert.equal(series.deterministic?.zeroCallAttempts, 0);
  assert.deepEqual(series.deterministic?.attempts.map((entry) => entry.callKinds), [{ interpretation: 1, judge: 1, decisions: 0 }, { interpretation: 1, judge: 1, decisions: 0 }]);
  const [note] = laterAttemptNotes(series);
  assert.match(note!, /^Later attempts made model calls \(the chat's reading and the judge only, no decisions\): attempt 2: it made model calls 2 \(interpretation 1, judge 1, decisions 0\)\. attempt 3: /u);
  assert.match(renderAttemptSeries(series), /deterministic attempt 3: path run_flow, flow f, continuation held, model calls 2 \(interpretation 1, judge 1, decisions 0\)/u);
  const spending: AttemptDriver = { seedSite: async () => undefined, run: async (_task, ordinal) => (ordinal === 1 ? outcome(1) : { ...outcome(ordinal, { ...LATER_ZERO(), calls: 4 }), modelCalls: { interpretation: 1, judge: 1 } }) };
  const decided = await runAttemptSeries({ task: { ...task, scenario: { ...catalogScenario, id: "everything-store" } }, driver: spending, attempts: 2, between: "as_left" });
  assert.match(laterAttemptNotes(decided.series)[0]!, /^NOT DETERMINISTIC: attempt 2: it made model calls 5 \(interpretation 1, judge 1, decisions 3\)\.$/u);
});
