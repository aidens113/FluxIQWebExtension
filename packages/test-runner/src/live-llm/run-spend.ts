// Every provider call a live run made, added up once, with where each came from.
//
// A live run pays for up to four kinds of call, and Core keeps each in a
// different record: the build's on its proposal, the Flow run's own recovery
// on the run's accounting, the result check's on the run's interventions, and
// a re-author's on `metadata.resultReauthor` and its adaptation. Settlements
// used to publish one of them as the run's `observed` total, so the machine's
// spend ledger, which reads exactly that total, under-reported every run that
// judged or re-authored (`run-munw7ffn-fe1cecd2`: $0.0418 recorded of about
// $0.0861 spent). This is the sum, and the phases stay beside it so each can
// still be read, and budgeted, on its own.
//
// **No call is counted twice.** The result check's calls are made outside the
// run's budget, so Core's accounting and per-call lines leave them out -- but
// a run detail with neither is read from its interventions, which do include
// them (`observed-usage.ts`). A check call the run phase already itemized, by
// its request id, is taken out of that phase and counted under `judge` only.
//
// **The step log closes what Core's records leave out.** Core writes every
// provider call into the run's step log (`step-log-spend.ts`), and two kinds
// reach no record above: the chat's own interpreter call, and the calls of a
// re-author whose attempt Core recorded a cost for and no count
// (`run-muqk713g-d08ad3dc`: 17 counted of 35 calls, $0.12085128 of $0.121157).
// The chat's calls are a phase of their own; a re-author left uncounted takes
// the calls the log saw beyond every counted phase; and anything still beyond
// them is added as `unattributed`, never subtracted when the log saw fewer.
//
// **The build's judge and its reading of the instructions are phases of their
// own.** Core books the build judge's spend into the build's accounting with
// no call (`phases.ts` `judgeAccounting`), and the reading of the person's
// instructions likewise, so the build phase carried their cost and the log's
// calls for them landed in `unattributed` at $0 (`run-murzln6g-11debe1d`:
// build 30 calls for $0.08857, judge null, 3 unattributed calls at $0). The
// step log names each call's build and phase (`byPart`), so the creation
// build's `judge` calls join the judge phase and its `read` calls are `read`;
// their cost comes out of the build's only when Core's figure is the one that
// held it (`creationBuildSplit`).
//
// **One purse per Flow (t438).** The user's words (2026-10-01): "bring the
// ceiling down to $0.1 per flow max" -- the build, its re-authors, its repairs
// and the judge all count against one ceiling, in billed dollars. A Lab run is
// one Flow, so `perBuild` judges the run's whole spend, every phase and every
// call the step log saw, as that one Flow against the ceiling, and lists each
// part beside it. It used to judge the build, the run's recovery and each
// re-author as builds of their own, each allowed the whole ceiling, which read
// `run-mv4912r9-53b05a51` ($0.1203 against $0.10) as inside it.

import type { LiveLlmObservedUsage } from "./observed-usage.js";
import type { LiveLlmReauthorRecord } from "./reauthor-record.js";
import type { LiveLlmStepLogSpend } from "./step-log-spend.js";

/** One phase's share: Core's call count where it gave one, and its cost. */
export type LiveLlmSpendPhase = { calls: number | null; estimatedCostUsd: number };

export type LiveLlmRunSpend = {
  /** Every call the phases counted. A phase that could not count its calls adds none, and `uncountedPhases` names it. */
  calls: number;
  totalEstimatedCostUsd: number;
  phases: {
    build: LiveLlmSpendPhase | null;
    /** The Flow run's own calls: diagnosis, exploration and runtime repair. */
    runtime: LiveLlmSpendPhase | null;
    /** Core's result check, on the run's interventions, and the creation build's own judge, from the step log. */
    judge: LiveLlmSpendPhase | null;
    /** Every re-author attempt, its retries included. */
    reauthor: LiveLlmSpendPhase | null;
    /** The extension chat's own calls (its interpreter), read from the step log: Core records them nowhere else. */
    chat: LiveLlmSpendPhase | null;
    /** The creation build's reading of the person's instructions (the consequences they ask for), from the step log. */
    read: LiveLlmSpendPhase | null;
  };
  uncountedPhases: Array<"judge" | "reauthor">;
  /** What the run's step log held and what it added to the phases; `null` when there was no step log to read. */
  stepLog: LiveLlmStepLogReconciliation | null;
  /**
   * The spend judged against the ceiling as one Flow: the run's whole spend,
   * build, recovery, re-authors, judge, chat and anything the step log alone
   * saw, with each part listed beside it.
   */
  perBuild: LiveLlmPerBuildSpend;
};

export type LiveLlmStepLogReconciliation = {
  calls: number;
  estimatedCostUsd: number;
  /** Calls given to a re-author Core left uncounted: what the log saw beyond every counted phase. */
  filledReauthorCalls: number;
  /** Calls and cost the log saw that no phase accounts for, added to the run's totals. */
  unattributed: LiveLlmSpendPhase & { calls: number };
  /**
   * The creation build's judge and read calls the log gave phases of their
   * own, and how much of Core's build figure was theirs: `calls` and
   * `estimatedCostUsd` are what came out of `phases.build`, 0 where Core's
   * build figure did not hold them.
   */
  fromBuild: LiveLlmCreationBuildSplit;
};

type LiveLlmStepLogShare = LiveLlmSpendPhase & { calls: number };
type LiveLlmCreationBuildSplit = { judge: LiveLlmStepLogShare; read: LiveLlmStepLogShare; calls: number; estimatedCostUsd: number };

/** The Flow's spend against the ceiling: everything the run spent on it. */
export type LiveLlmBuildSpend = { phase: "flow"; attempt: null; estimatedCostUsd: number; overCeiling: boolean };

/** One part of the Flow's spend, as it drew on the Flow's one purse; a re-author's attempts are each a part. */
export type LiveLlmFlowSpendPart = { phase: "build" | "read" | "judge" | "chat" | "runtime" | "reauthor" | "unattributed"; attempt: number | null; estimatedCostUsd: number };

export type LiveLlmPerBuildSpend = {
  /** The ceiling the Flow was held to: the plan's, which is Core's run cost ceiling or lower. */
  ceilingUsd: number;
  /** The Flow, one entry; none for a run that spent nothing anywhere. */
  builds: LiveLlmBuildSpend[];
  /** What each part of the Flow spent, which together make its figure. */
  parts: LiveLlmFlowSpendPart[];
  /** What the Flow spent, so a reader sees at once how near the ceiling the run came. */
  maxBuildCostUsd: number;
  /** 1 when the Flow spent more than the ceiling, else 0. */
  overCeiling: number;
};

/** The result check's calls, as the settlement's verification record lists them. */
export type LiveLlmJudgeCalls = { interventions: ReadonlyArray<{ requestId: string | null; estimatedCostUsd: number | null }> };

export function liveLlmRunSpend(input: {
  build?: LiveLlmObservedUsage | null | undefined;
  runtime?: LiveLlmObservedUsage | null | undefined;
  judge?: LiveLlmJudgeCalls | null | undefined;
  reauthor?: LiveLlmReauthorRecord | null | undefined;
  /** The run's step log, as `readLiveLlmStepLogSpend` read it; absent or `null` where there is none. */
  stepLog?: LiveLlmStepLogSpend | null | undefined;
  /** The run plan's `maxTotalEstimatedCostUsd`: the per-build ceiling the run was held to. */
  ceilingUsd: number;
}): LiveLlmRunSpend {
  const coreBuild = input.build ? { calls: input.build.calls, estimatedCostUsd: input.build.totalEstimatedCostUsd } : null;
  const split = creationBuildSplit(coreBuild, input.stepLog);
  const build = coreBuild && split ? { calls: Math.max(0, coreBuild.calls - split.calls), estimatedCostUsd: Math.max(0, sum([coreBuild.estimatedCostUsd, -split.estimatedCostUsd])) } : coreBuild;
  const judgeCalls = input.judge?.interventions ?? [];
  const checkJudge = judgeCalls.length > 0 ? { calls: judgeCalls.length, estimatedCostUsd: sum(judgeCalls.map((call) => call.estimatedCostUsd ?? 0)) } : null;
  const judge = split && split.judge.calls > 0 ? { calls: (checkJudge?.calls ?? 0) + split.judge.calls, estimatedCostUsd: sum([checkJudge?.estimatedCostUsd ?? 0, split.judge.estimatedCostUsd]) } : checkJudge;
  const read = split && split.read.calls > 0 ? { calls: split.read.calls, estimatedCostUsd: split.read.estimatedCostUsd } : null;
  const runtime = input.runtime ? runtimeWithoutJudge(input.runtime, judgeCalls) : null;
  let reauthor: LiveLlmSpendPhase | null = input.reauthor && input.reauthor.attempts.length > 0
    ? { calls: input.reauthor.uncountedAttempts > 0 && input.reauthor.calls === 0 ? null : input.reauthor.calls, estimatedCostUsd: input.reauthor.totalEstimatedCostUsd }
    : null;
  let reauthorUncounted = reauthor !== null && (input.reauthor?.uncountedAttempts ?? 0) > 0;
  const chatSeen = input.stepLog?.byKind.chat;
  const chat = chatSeen ? { calls: chatSeen.calls, estimatedCostUsd: chatSeen.estimatedCostUsd } : null;
  const counted = (phases: ReadonlyArray<LiveLlmSpendPhase | null>) => phases.reduce((total, phase) => total + (phase?.calls ?? 0), 0);
  let stepLog: LiveLlmStepLogReconciliation | null = null;
  if (input.stepLog) {
    let beyond = input.stepLog.calls - counted([build, runtime, judge, reauthor, chat, read]);
    let filledReauthorCalls = 0;
    if (reauthor && reauthorUncounted && beyond > 0) {
      filledReauthorCalls = beyond;
      reauthor = { calls: (reauthor.calls ?? 0) + beyond, estimatedCostUsd: reauthor.estimatedCostUsd };
      reauthorUncounted = false;
      beyond = 0;
    }
    const costBeyond = sum([input.stepLog.estimatedCostUsd, ...[build, runtime, judge, reauthor, chat, read].map((phase) => -(phase?.estimatedCostUsd ?? 0))]);
    stepLog = {
      calls: input.stepLog.calls,
      estimatedCostUsd: input.stepLog.estimatedCostUsd,
      filledReauthorCalls,
      // A cost beyond the phases below a hundredth of a micro-dollar is rounding between two records, not a call.
      unattributed: { calls: Math.max(0, beyond), estimatedCostUsd: costBeyond > 1e-8 ? costBeyond : 0 },
      fromBuild: split ?? { judge: { calls: 0, estimatedCostUsd: 0 }, read: { calls: 0, estimatedCostUsd: 0 }, calls: 0, estimatedCostUsd: 0 },
    };
  }
  const phases = [build, runtime, judge, reauthor, chat, read];
  const totalEstimatedCostUsd = sum([...phases.map((phase) => phase?.estimatedCostUsd ?? 0), stepLog?.unattributed.estimatedCostUsd ?? 0]);
  return {
    calls: counted(phases) + (stepLog?.unattributed.calls ?? 0),
    totalEstimatedCostUsd,
    phases: { build, runtime, judge, reauthor, chat, read },
    uncountedPhases: reauthorUncounted ? ["reauthor"] : [],
    stepLog,
    perBuild: flowSpend(input.ceilingUsd, totalEstimatedCostUsd, { build, read, judge, chat, runtime }, input.reauthor, stepLog?.unattributed ?? null),
  };
}

/**
 * The creation build's judge and read calls, from the step log, and how much
 * of Core's build figure was theirs; `undefined` with no build, or a log that
 * names no creation judge or read.
 *
 * Core's build figure counts its decisions; whether it also holds the judge's
 * and the read's spend is read off the figures rather than assumed: their cost
 * comes out of the build when Core's build cost is nearer the log's whole
 * creation build than the log's creation build without them, and their calls
 * when Core's count is exactly the log's creation calls with them. Where
 * neither held, nothing comes out, and they are still phases of their own.
 */
function creationBuildSplit(build: { calls: number; estimatedCostUsd: number } | null, stepLog: LiveLlmStepLogSpend | null | undefined): LiveLlmCreationBuildSplit | undefined {
  const creation = stepLog?.byPart?.creation;
  if (!build || !creation) return undefined;
  const share = (phase: string): LiveLlmStepLogShare => ({ calls: creation[phase]?.calls ?? 0, estimatedCostUsd: creation[phase]?.estimatedCostUsd ?? 0 });
  const judge = share("judge");
  const read = share("read");
  if (judge.calls + read.calls === 0) return undefined;
  const all = Object.values(creation);
  const allCalls = all.reduce((total, phase) => total + phase.calls, 0);
  const allCost = sum(all.map((phase) => phase.estimatedCostUsd));
  const ownCost = sum([allCost, -judge.estimatedCostUsd, -read.estimatedCostUsd]);
  const heldCost = Math.abs(build.estimatedCostUsd - allCost) < Math.abs(build.estimatedCostUsd - ownCost);
  return {
    judge,
    read,
    calls: build.calls === allCalls ? judge.calls + read.calls : 0,
    estimatedCostUsd: heldCost ? sum([judge.estimatedCostUsd, read.estimatedCostUsd]) : 0,
  };
}

/**
 * The Flow's spend against the ceiling: the run's whole total, judged once,
 * with its parts listed. A re-author's attempts are each a part; one whose
 * cost Core did not record is listed at what was recorded, which is nothing.
 */
function flowSpend(
  ceilingUsd: number,
  totalEstimatedCostUsd: number,
  phases: Record<"build" | "read" | "judge" | "chat" | "runtime", LiveLlmSpendPhase | null>,
  reauthor: LiveLlmReauthorRecord | null | undefined,
  unattributed: LiveLlmSpendPhase | null,
): LiveLlmPerBuildSpend {
  const part = (phase: LiveLlmFlowSpendPart["phase"], attempt: number | null, estimatedCostUsd: number): LiveLlmFlowSpendPart => ({ phase, attempt, estimatedCostUsd });
  const parts = [
    ...(["build", "read", "judge", "chat", "runtime"] as const).flatMap((phase) => (phases[phase] ? [part(phase, null, phases[phase].estimatedCostUsd)] : [])),
    ...(reauthor?.attempts ?? []).map((attempt, index) => part("reauthor", attempt.attempt ?? index + 1, sum([attempt.estimatedCostUsd ?? 0]))),
    ...(unattributed && (unattributed.calls ?? 0) + unattributed.estimatedCostUsd > 0 ? [part("unattributed", null, unattributed.estimatedCostUsd)] : []),
  ];
  const overCeiling = totalEstimatedCostUsd > ceilingUsd;
  return {
    ceilingUsd,
    builds: parts.length > 0 ? [{ phase: "flow", attempt: null, estimatedCostUsd: totalEstimatedCostUsd, overCeiling }] : [],
    parts,
    maxBuildCostUsd: parts.length > 0 ? totalEstimatedCostUsd : 0,
    overCeiling: parts.length > 0 && overCeiling ? 1 : 0,
  };
}

/**
 * The run phase with any result-check call it itemized taken out.
 *
 * Only a run read from its interventions -- no accounting, no per-call lines
 * -- can hold one, and there its figures are the interventions' own, so the
 * matched calls come out of both its count and its cost.
 */
function runtimeWithoutJudge(runtime: LiveLlmObservedUsage, judgeCalls: LiveLlmJudgeCalls["interventions"]): LiveLlmSpendPhase {
  const fromInterventions = runtime.accounting === null && runtime.perCallRecords === "not recorded";
  const judgeIds = new Set(judgeCalls.flatMap((call) => call.requestId ?? []));
  const matched = fromInterventions ? runtime.observedCalls.filter((call) => call.requestId !== null && judgeIds.has(call.requestId)) : [];
  return {
    calls: Math.max(0, runtime.calls - matched.filter((call) => call.totalTokens !== null || call.estimatedCostUsd !== null).length),
    estimatedCostUsd: Math.max(0, sum([runtime.totalEstimatedCostUsd, ...matched.map((call) => -(call.estimatedCostUsd ?? 0))])),
  };
}

/** Rounded to the nano-dollar, so a sum of provider figures does not carry float dust into a ledger. */
function sum(values: readonly number[]): number {
  return Number(values.reduce((total, value) => total + value, 0).toFixed(9));
}
