import { assertAttemptSeries, ATTEMPT_REPORT_SCHEMA_VERSION, attemptCountsAsLive, type AttemptContinuation, type AttemptLoopsCaught, type AttemptReportRow, type AttemptSeries } from "@fluxiq-web-extension/test-contracts";
import type { AttemptOutcome, AttemptTask } from "./driver.js";

/** Core's ladder counts per pattern, summed: how many times each kind of loop was caught, however it was answered. */
function loopsCaughtOf(outcome: AttemptOutcome): AttemptLoopsCaught {
  return Object.fromEntries(Object.entries(outcome.record.loopsCaught).map(([pattern, count]) => [pattern, count.steered + count.refused + count.changeApproach + count.askPerson]));
}

/** One attempt's row. Calls and tokens sit beside dollars, because models and prices change. */
export function attemptReportRow(task: AttemptTask, outcome: AttemptOutcome): AttemptReportRow {
  const { record, answer } = outcome;
  return {
    schemaVersion: ATTEMPT_REPORT_SCHEMA_VERSION,
    taskId: task.request.task.id,
    scenarioId: task.scenario.id,
    attempt: record.ordinal,
    path: record.path,
    calls: record.spend.calls,
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
    standIns: [...outcome.standIns],
    live: attemptCountsAsLive(outcome.standIns),
  };
}

/** A task's rows in attempt order, with what follows from them and nothing else. */
export function attemptSeries(task: AttemptTask, rows: readonly AttemptReportRow[], continuation: AttemptContinuation | null): AttemptSeries {
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
    secondStartedFromFirst: continuation === null ? null : continuation.held,
  };
  assertAttemptSeries(series);
  return series;
}

/** The series as a person reads it. Stand-ins are named beside the numbers they produced. */
export function renderAttemptSeries(series: AttemptSeries): string {
  const header = "attempt | path | calls | tokens | from cache | usd | ms | live steps | simulation | answer | oracle | flow | repeated acts | loops caught | counted as | stand-ins";
  const lines = series.rows.map((row) => [
    row.attempt, row.path, row.calls, row.inputTokens + row.outputTokens, row.cacheHitPercent === undefined ? "unknown" : `${row.cacheHitPercent}%`, row.usd.toFixed(4), row.ms, row.liveSteps, row.simulation, row.answerVerdict, row.oracleVerdict ?? "none", row.flow,
    row.repeatedActs.map((act) => `${act.name} (asked ${act.asked}, landed ${act.landed})`).join("; ") || "none",
    Object.values(row.loopsCaught).reduce((sum, count) => sum + count, 0),
    row.live ? "live" : "not live",
    row.standIns.join(",") || "none",
  ].join(" | "));
  const started = series.secondStartedFromFirst === null ? "" : `second attempt started from the first's draft: ${series.secondStartedFromFirst ? "proven" : "refused"}`;
  return [`task ${series.taskId} on ${series.scenarioId}`, header, ...lines, ...(started ? [started] : [])].join("\n");
}
