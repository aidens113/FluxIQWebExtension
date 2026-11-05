// One row per attempt at a task, and a series over a task's rows: whether the loop
// pays off. Calls and tokens sit beside dollars, because models and prices change.

import type { AnswerVerdict, AttemptStandIn, FlowScore, RepeatedActReport } from "./answer-score.js";

export const ATTEMPT_REPORT_SCHEMA_VERSION = "0.1" as const;

/**
 * The paths and simulation words of Core's attempt record
 * (`AUTOMATION_STUDIO_TASK_ATTEMPT_PATHS`, `..._SIMULATION_VERDICTS`), restated because
 * this package has no dependency on Core. The runner's test holds the two together.
 */
export const attemptPaths = ["explore", "run_flow", "run_flow_then_repair", "run_flow_then_explore"] as const;
export type AttemptPath = (typeof attemptPaths)[number];
export const attemptSimulationResults = ["passed", "failed", "inconclusive", "not_run"] as const;
export type AttemptSimulationResult = (typeof attemptSimulationResults)[number];

/** Loops caught by pattern, summed over the ladder. Core's patterns; a name it adds is kept. */
export type AttemptLoopsCaught = Record<string, number>;

export type AttemptReportRow = {
  schemaVersion: typeof ATTEMPT_REPORT_SCHEMA_VERSION;
  taskId: string;
  scenarioId: string;
  /** Which attempt at the task, from 1. */
  attempt: number;
  path: AttemptPath;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  usd: number;
  ms: number;
  /** Live steps it took on the real site. */
  liveSteps: number;
  simulation: AttemptSimulationResult;
  answerVerdict: AnswerVerdict;
  /** `oracleVerdict`: the Flow's own playback, `null` when none ran. */
  oracleVerdict: "passed" | "failed" | null;
  flow: FlowScore;
  repeatedActs: RepeatedActReport[];
  loopsCaught: AttemptLoopsCaught;
  /** Lasting acts Core could not tie to a row, so that row may be pressed again (a measured known limit). Absent reads as zero. */
  actsWithNoRow?: number;
  /** The share of this attempt's input tokens read from the model service's cache, whole percent. Absent when no step said. */
  cacheHitPercent?: number;
  /** Empty when every input was read from Core and the real chat. */
  standIns: AttemptStandIn[];
  /** True only with no stand-in at all (`attemptCountsAsLive`), held by validation: a scripted model's row can never be counted as live. */
  live: boolean;
};

/** How a task's attempts went, in order. It says nothing a row does not. */
export type AttemptSeries = {
  schemaVersion: typeof ATTEMPT_REPORT_SCHEMA_VERSION;
  taskId: string;
  scenarioId: string;
  rows: AttemptReportRow[];
  /** The first attempt whose answer was right; `null` when none was. */
  firstRightAttempt: number | null;
  /** The first attempt whose Flow held a zero-call replay; `null` when none did. */
  attemptsUntilDeterministic: number | null;
  /** Each later attempt beside the one before it: negative is less. */
  spendDeltas: { attempt: number; calls: number; tokens: number; usd: number; ms: number; liveSteps: number }[];
  /** Whether attempt 2 was proven to have started from what attempt 1 saved (`AttemptContinuation`); `null` with one attempt. */
  secondStartedFromFirst: boolean | null;
};

/** Why the Lab holds that a later attempt began from an earlier one's saved work, each named so a false claim has nowhere to hide. */
export type AttemptContinuation = {
  fromAttempt: number;
  toAttempt: number;
  held: boolean;
  /** Empty when `held`. */
  refused: string[];
};
