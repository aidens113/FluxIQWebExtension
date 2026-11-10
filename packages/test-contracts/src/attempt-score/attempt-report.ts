// One row per attempt at a task, and a series over a task's rows: whether the loop
// pays off. Calls and tokens sit beside dollars, because models and prices change.

import type { AnswerVerdict, AttemptStandIn, FlowScore, RepeatedActReport } from "./answer-score.js";

export const ATTEMPT_REPORT_SCHEMA_VERSION = "0.3" as const;

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

/**
 * An attempt that began on what an earlier one left. `reseeded` is always false here: it is
 * said so that nothing can read the row as a fresh start. Each list is words the Lab wrote
 * from its own table and the site's own record, never page text.
 */
export type AttemptAgainstEarlier = {
  reseeded: false;
  /** The asked acts the site already held when it began, by name. */
  foundDone: string[];
  /** What the site's own record says landed during it. Empty is a change of nothing. */
  changed: string[];
};

/**
 * The model calls of one attempt by kind. `interpretation` is the chat's reading of the typed instruction,
 * `judge` the check that the answer holds, and `decisions` every other call Core's attempt record counts.
 * Their sum is the row's `calls`, so no call is counted twice.
 */
export type AttemptCallKinds = { interpretation: number; judge: number; decisions: number };

export type AttemptReportRow = {
  schemaVersion: typeof ATTEMPT_REPORT_SCHEMA_VERSION;
  taskId: string;
  scenarioId: string;
  /** Which attempt at the task, from 1. */
  attempt: number;
  path: AttemptPath;
  /** Every model call the attempt made: with `callKinds`, interpretation + judge + decisions. */
  calls: number;
  /** Absent when the call source could not attribute the interpretation and judge calls to this attempt; `calls` is then Core's own count, unsplit. */
  callKinds?: AttemptCallKinds;
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
  /** Said only of an attempt that began on what an earlier one left. */
  against?: AttemptAgainstEarlier;
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
  /** One proof per later attempt, each against the attempt before it (`AttemptContinuation`); empty with one attempt. */
  continuations: AttemptContinuation[];
  /** What attempts 2..N say about determinism; `null` when no later attempt was asked for (a diagnosis-only run). */
  deterministic: AttemptDeterministicSummary | null;
};

/** Why the Lab holds that a later attempt began from an earlier one's saved work, each named so a false claim has nowhere to hide. */
export type AttemptContinuation = {
  fromAttempt: number;
  toAttempt: number;
  held: boolean;
  /** Empty when `held`. */
  refused: string[];
};

/** One later attempt, by what it ran and whether it was proven to start from the one before. */
export type AttemptDeterministicEntry = {
  attempt: number;
  path: AttemptPath;
  /** The Flow it ran; `null` when it ran none (it explored). */
  flowId: string | null;
  /** Whether `continuations` held for this attempt. */
  continuationHeld: boolean;
  calls: number;
  /** The attempt's split of `calls`; `null` when it could not be attributed. */
  callKinds: AttemptCallKinds | null;
  ms: number;
};

/**
 * Attempts 2..N, which the standing rule asks for after every exploration: that they use the saved Flow, and how
 * many model calls they make. Nothing here is averaged: each attempt is listed.
 */
export type AttemptDeterministicSummary = {
  /** The later attempts asked for (attempts - 1). */
  asked: number;
  /** The later attempts that ran; less than `asked` when the series stopped short. */
  ran: number;
  attempts: AttemptDeterministicEntry[];
  /** How many of the later attempts made no model call. */
  zeroCallAttempts: number;
  /** True only when every later attempt asked for ran and every continuation held. */
  allHeld: boolean;
};
