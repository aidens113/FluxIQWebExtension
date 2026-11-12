import { assertAttemptSeries, ATTEMPT_REPORT_SCHEMA_VERSION, attemptCountsAsLive, type AttemptCallKinds, type AttemptContinuation, type AttemptDeterministicSummary, type AttemptLoopsCaught, type AttemptReportRow, type AttemptSeries } from "@fluxiq-web-extension/test-contracts";
import type { AttemptOutcome, AttemptTask } from "./driver.js";
import { attemptOverheadLine, type AttemptOverhead } from "./overhead/index.js";

/** Core's ladder counts per pattern, summed: how many times each kind of loop was caught, however it was answered. */
function loopsCaughtOf(outcome: AttemptOutcome): AttemptLoopsCaught {
  return Object.fromEntries(Object.entries(outcome.record.loopsCaught).map(([pattern, count]) => [pattern, count.steered + count.refused + count.changeApproach + count.askPerson]));
}

/**
 * What an attempt's model calls were, by kind. Core's attempt record counts the decisions and the judge but not the chat's
 * reading of the typed instruction, so that is added once, and the judge is taken out of the record's count to give the
 * decisions: the three add up to `calls` and none is counted twice. `undefined` when the run's step log could not say.
 */
export function callKindsOf(outcome: AttemptOutcome): AttemptCallKinds | undefined {
  if (outcome.modelCalls === undefined) return undefined;
  const { interpretation, judge } = outcome.modelCalls;
  return { interpretation, judge, decisions: Math.max(0, outcome.record.spend.calls - judge) };
}

/** `2 (interpretation 1, judge 1, decisions 0)`, or the bare count when the split could not be attributed. */
export function callWords(calls: number, kinds: AttemptCallKinds | null | undefined): string {
  return kinds ? `${calls} (interpretation ${kinds.interpretation}, judge ${kinds.judge}, decisions ${kinds.decisions})` : `${calls} (not split by kind)`;
}

/** One attempt's row. Calls and tokens sit beside dollars, because models and prices change. */
export function attemptReportRow(task: AttemptTask, outcome: AttemptOutcome): AttemptReportRow {
  const { record, answer } = outcome;
  const callKinds = callKindsOf(outcome);
  return {
    schemaVersion: ATTEMPT_REPORT_SCHEMA_VERSION,
    taskId: task.request.task.id,
    scenarioId: task.scenario.id,
    attempt: record.ordinal,
    path: record.path,
    calls: callKinds ? callKinds.interpretation + callKinds.judge + callKinds.decisions : record.spend.calls,
    ...(callKinds ? { callKinds } : {}),
    inputTokens: record.spend.inputTokens,
    outputTokens: record.spend.outputTokens,
    usd: record.spend.usd,
    ms: record.spend.ms,
    liveSteps: record.liveSteps,
    simulation: record.simulation?.verdict ?? "not_run",
    answerVerdict: answer.verdict,
    oracleVerdict: outcome.oracleVerdict,
    flow: answer.flow,
    repeatedActs: answer.repeatedActs.map((act) => ({ ...act })),
    loopsCaught: loopsCaughtOf(outcome),
    ...(record.actsWithNoRow !== undefined ? { actsWithNoRow: record.actsWithNoRow } : {}),
    ...(outcome.against ? { against: { reseeded: outcome.against.reseeded, foundDone: [...outcome.against.foundDone], changed: [...outcome.against.changed] } } : {}),
    standIns: [...outcome.standIns],
    live: attemptCountsAsLive(outcome.standIns),
  };
}

/** What attempts 2..N say, in the order they ran. `null` when no later attempt was asked for. */
export function deterministicSummary(rows: readonly AttemptReportRow[], continuations: readonly AttemptContinuation[], flowIds: ReadonlyMap<number, string | null>, asked: number): AttemptDeterministicSummary | null {
  if (asked < 1) return null;
  const attempts = rows.slice(1).map((row, index) => ({ attempt: row.attempt, path: row.path, flowId: flowIds.get(row.attempt) ?? null, continuationHeld: continuations[index]?.held === true, calls: row.calls, callKinds: row.callKinds ? { ...row.callKinds } : null, ms: row.ms }));
  return { asked, ran: attempts.length, attempts, zeroCallAttempts: attempts.filter((entry) => entry.calls === 0).length, allHeld: attempts.length === asked && attempts.every((entry) => entry.continuationHeld) };
}

/**
 * A task's rows in attempt order, with what follows from them and nothing else. `asked` is the number of attempts the
 * run asked for in all; `flowIds` is the Flow each attempt ran, by attempt number.
 */
export function attemptSeries(task: AttemptTask, rows: readonly AttemptReportRow[], continuations: readonly AttemptContinuation[], asked: number, flowIds: ReadonlyMap<number, string | null>): AttemptSeries {
  const ordered = [...rows].sort((left, right) => left.attempt - right.attempt);
  const series: AttemptSeries = {
    schemaVersion: ATTEMPT_REPORT_SCHEMA_VERSION,
    taskId: task.request.task.id,
    scenarioId: task.scenario.id,
    rows: ordered,
    firstRightAttempt: ordered.find((row) => row.answerVerdict === "right")?.attempt ?? null,
    attemptsUntilDeterministic: ordered.find((row) => row.flow === "replay_held")?.attempt ?? null,
    spendDeltas: ordered.slice(1).map((row, index) => {
      const before = ordered[index]!;
      return {
        attempt: row.attempt,
        calls: row.calls - before.calls,
        tokens: row.inputTokens + row.outputTokens - before.inputTokens - before.outputTokens,
        usd: row.usd - before.usd,
        ms: row.ms - before.ms,
        liveSteps: row.liveSteps - before.liveSteps,
      };
    }),
    continuations: continuations.map((proof) => ({ ...proof, refused: [...proof.refused] })),
    deterministic: deterministicSummary(ordered, continuations, flowIds, asked - 1),
  };
  assertAttemptSeries(series);
  return series;
}

const LESS_OR_MORE = (delta: number, what: string, words: (value: number) => string = String): string => `${delta === 0 ? "the same" : `${words(Math.abs(delta))} ${delta < 0 ? "less" : "more"}`} ${what}`;

/** Each later attempt beside the one before it, in words. */
function comparedWords(series: AttemptSeries): string[] {
  return series.spendDeltas.map((delta) => `attempt ${delta.attempt} beside attempt ${delta.attempt - 1}: ${[
    LESS_OR_MORE(delta.calls, "calls"), LESS_OR_MORE(delta.tokens, "tokens"), LESS_OR_MORE(delta.usd, "dollars", (usd) => `$${usd.toFixed(4)}`),
    LESS_OR_MORE(delta.ms, "time", (ms) => `${Math.round(ms / 1000)} s`), LESS_OR_MORE(delta.liveSteps, "live steps"),
  ].join(", ")}`);
}

/** Each later attempt, one line, with its path, Flow, continuation (held, or refused with its reasons), model calls and time. */
function deterministicLines(series: AttemptSeries): string[] {
  const { deterministic } = series;
  if (deterministic === null) return ["deterministic attempts: none asked for (a diagnosis-only run, which is never a pass)"];
  const each = deterministic.attempts.map((entry, index) => {
    const proof = series.continuations[index];
    const continuation = proof === undefined ? "not proven" : proof.held ? "held" : `refused (${proof.refused.join(", ")})`;
    return `deterministic attempt ${entry.attempt}: path ${entry.path}, flow ${entry.flowId ?? "none"}, continuation ${continuation}, model calls ${callWords(entry.calls, entry.callKinds)}, ${(entry.ms / 1000).toFixed(1)} s`;
  });
  const summary = `deterministic attempts: ${deterministic.ran} of ${deterministic.asked} ran, ${deterministic.zeroCallAttempts} with no model call, continuations ${deterministic.allHeld ? "all held" : deterministic.ran < deterministic.asked && series.continuations.every((proof) => proof.held) ? "all held for the ones that ran" : "not all held"}`;
  return [...each, summary];
}

/**
 * One plain line naming each later attempt that spent model calls or strayed from the saved Flow. Never averaged away;
 * empty when none did. It reads `NOT DETERMINISTIC` when an attempt made decisions, took another path, was not proven to
 * start from the one before or did not run; when later attempts made only the chat's reading and the judge, it says
 * exactly that, so the calls are shown and not mistaken for exploring.
 */
export function laterAttemptNotes(series: AttemptSeries): string[] {
  const { deterministic } = series;
  if (deterministic === null) return [];
  let strayed = false;
  const notes = deterministic.attempts.flatMap((entry, index) => {
    const decided = (entry.callKinds?.decisions ?? 0) > 0;
    const reasons = [
      ...(entry.calls > 0 ? [`it made model calls ${callWords(entry.calls, entry.callKinds)}`] : []),
      ...(entry.path !== "run_flow" ? [`it did not just run the saved Flow (path ${entry.path})`] : []),
      ...(series.continuations[index]?.held === false ? [`it was not proven to start from the attempt before (${series.continuations[index]!.refused.join(", ")})`] : []),
    ];
    if (decided || entry.path !== "run_flow" || series.continuations[index]?.held === false || entry.callKinds === null) strayed = true;
    return reasons.length === 0 ? [] : [`attempt ${entry.attempt}: ${reasons.join("; ")}`];
  });
  const stoppedShort = deterministic.ran < deterministic.asked ? [`${deterministic.asked - deterministic.ran} of the ${deterministic.asked} later attempts asked for did not run`] : [];
  if (stoppedShort.length > 0) strayed = true;
  const all = [...notes, ...stoppedShort];
  if (all.length === 0) return [];
  return [`${strayed ? "NOT DETERMINISTIC" : "Later attempts made model calls (the chat's reading and the judge only, no decisions)"}: ${all.join(". ")}.`];
}

/** The series as a person reads it. Stand-ins are named beside the numbers they produced. */
export function renderAttemptSeries(series: AttemptSeries): string {
  const header = "attempt | path | calls | tokens | from cache | usd | ms | live steps | simulation | answer | oracle | flow | repeated acts | loops caught | counted as | stand-ins";
  const lines = series.rows.map((row) => [
    row.attempt, row.path, callWords(row.calls, row.callKinds), row.inputTokens + row.outputTokens, row.cacheHitPercent === undefined ? "unknown" : `${row.cacheHitPercent}%`, row.usd.toFixed(4), row.ms, row.liveSteps, row.simulation, row.answerVerdict, row.oracleVerdict ?? "none", row.flow,
    row.repeatedActs.map((act) => `${act.name} (asked ${act.asked}, landed ${act.landed})`).join("; ") || "none",
    Object.values(row.loopsCaught).reduce((sum, count) => sum + count, 0),
    row.live ? "live" : "not live",
    row.standIns.join(",") || "none",
  ].join(" | "));
  return [`task ${series.taskId} on ${series.scenarioId}`, header, ...lines, ...comparedWords(series), ...deterministicLines(series), ...laterAttemptNotes(series)].join("\n");
}

/** The series as `attempt-report.txt` shows it: each attempt's browser calls beside the saved Flow's (read from the run's step folders) follow the series. */
export function renderAttemptReport(series: AttemptSeries, overheads: readonly AttemptOverhead[]): string {
  return [renderAttemptSeries(series), ...overheads.map(attemptOverheadLine)].join("\n");
}
