// Every provider call a live run made, as Core's Flow purse recorded it.
//
// **One purse per Flow (t438).** The user's words (2026-10-01): "bring the
// ceiling down to $0.1 per flow max" -- the build, its re-authors, its repairs
// and the judge all count against one ceiling, in billed dollars. A Lab run is
// one Flow, and Core adds every settled call to that Flow's purse as it
// settles, by phase (Core `runtime/service/creation-spend.ts`, read through
// `get-flow-spend`): the build, its reading of the instructions, every judge,
// the Flow run's own recovery, the re-authors and the extension chat's
// interpreter. This is that record in the shape the snapshot and the ledger
// already read (`observed.calls`, `observed.totalEstimatedCostUsd`,
// `observed.phases`, `observed.perBuild`, `runSpend`).
//
// It replaces a reconstruction (`run-spend.ts`, `step-log-spend.ts`, removed
// in t728) that summed four Core records and filled their gaps from the run's
// step log. Core now keeps the sum, so nothing here adds a figure Core did not
// publish. Where Core holds no record, or one it never itemised, the figure it
// does not have is reported as unknown (`null`) and `source` says why; it is
// never rebuilt from another record.

import type { ExistingFlowSpend, ExistingFlowSpendPhase } from "../existing-fluxiq-control/index.js";

/** What reads the Flow's spend from Core: the control's `get-flow-spend` read. */
export type LiveLlmFlowSpendControl = { getFlowSpend(projectId: string, flowId: string): Promise<ExistingFlowSpend | null> };

/**
 * Where the figures came from: `flow_purse` is Core's itemised record;
 * `flow_purse_unitemised` a record with a total and no calls or phases;
 * `no_record` a Flow Core holds no record for; `flow_unknown` a run whose Flow
 * the Lab could not name; `unreadable` a read that failed; `not_settled` before
 * any settlement read one.
 */
export type LiveLlmSpendSource = "flow_purse" | "flow_purse_unitemised" | "no_record" | "flow_unknown" | "unreadable" | "not_settled";

/** One phase's calls and cost, as Core's purse attributed them. */
export type LiveLlmSpendPhase = { calls: number; estimatedCostUsd: number };

export type LiveLlmRunSpendPhases = {
  build: LiveLlmSpendPhase | null;
  /** The creation build's reading of the person's instructions. */
  read: LiveLlmSpendPhase | null;
  /** Every judge: the build's trial judges and Core's result check after the run. */
  judge: LiveLlmSpendPhase | null;
  /** The Flow run's own calls: diagnosis, exploration and runtime repair. */
  runtime: LiveLlmSpendPhase | null;
  /** Every re-author attempt, its retries included. */
  reauthor: LiveLlmSpendPhase | null;
  /** The extension chat's own calls (its interpreter). */
  chat: LiveLlmSpendPhase | null;
};

export type LiveLlmRunSpend = {
  source: LiveLlmSpendSource;
  /** Every call Core's purse counted; `null` where Core kept no itemised record. */
  calls: number | null;
  /** What the Flow spent in billed dollars; `null` where Core holds no record. */
  totalEstimatedCostUsd: number | null;
  /** How many builds Core charged to the Flow; `null` where Core holds no record. */
  builds: number | null;
  /** Each phase's share; a phase that spent nothing, or one Core did not itemise, is `null` (`source` tells the two apart). */
  phases: LiveLlmRunSpendPhases;
  /** The spend judged against the ceiling as one Flow, with each phase listed beside it. */
  perBuild: LiveLlmPerBuildSpend;
};

/** The Flow's spend against the ceiling; `estimatedCostUsd` is `null` when Core holds no figure for it. */
export type LiveLlmBuildSpend = { phase: "flow"; attempt: null; estimatedCostUsd: number | null; overCeiling: boolean };

/** One part of the Flow's spend: a phase of Core's purse, or `unattributed` for spend the record held before Core itemised it. */
export type LiveLlmFlowSpendPart = { phase: ExistingFlowSpendPhase | "unattributed"; attempt: null; estimatedCostUsd: number };

export type LiveLlmPerBuildSpend = {
  /** The ceiling the Flow was held to: the plan's, which is Core's run cost ceiling or lower. */
  ceilingUsd: number;
  /** The Flow, one entry; none for a run Core says spent nothing. */
  builds: LiveLlmBuildSpend[];
  /** What each part of the Flow spent, which together make its figure. */
  parts: LiveLlmFlowSpendPart[];
  /** What the Flow spent; `null` when Core holds no figure. */
  maxBuildCostUsd: number | null;
  /** 1 when the Flow spent more than the ceiling, else 0. */
  overCeiling: number;
};

const PHASES = ["build", "read", "judge", "runtime", "reauthor", "chat"] as const satisfies readonly ExistingFlowSpendPhase[];
const NO_PHASES: LiveLlmRunSpendPhases = { build: null, read: null, judge: null, runtime: null, reauthor: null, chat: null };

/**
 * The run's spend from Core's record of its Flow. `spend` is `null` when there
 * is no record to read, and `unknownBecause` then says why.
 */
export function liveLlmRunSpend(spend: ExistingFlowSpend | null, ceilingUsd: number, unknownBecause: Exclude<LiveLlmSpendSource, "flow_purse" | "flow_purse_unitemised"> = "no_record"): LiveLlmRunSpend {
  if (!spend) {
    return {
      source: unknownBecause,
      calls: null,
      totalEstimatedCostUsd: null,
      builds: null,
      phases: { ...NO_PHASES },
      perBuild: { ceilingUsd, builds: unknownBecause === "not_settled" ? [] : [{ phase: "flow", attempt: null, estimatedCostUsd: null, overCeiling: false }], parts: [], maxBuildCostUsd: null, overCeiling: 0 },
    };
  }
  const total = nano(spend.spentUsd);
  const byPhase = spend.byPhase;
  const phases: LiveLlmRunSpendPhases = { ...NO_PHASES };
  const parts: LiveLlmFlowSpendPart[] = [];
  if (byPhase) {
    for (const phase of PHASES) {
      const item = byPhase[phase];
      if (item.calls === 0 && item.usd === 0) continue;
      phases[phase] = { calls: item.calls, estimatedCostUsd: nano(item.usd) };
      parts.push({ phase, attempt: null, estimatedCostUsd: nano(item.usd) });
    }
    // Core's phases sum to its total unless the record already held spend when itemising began (Core `api/contracts/run.ts`).
    const beyond = nano(total - parts.reduce((sum, part) => sum + part.estimatedCostUsd, 0));
    if (beyond > 1e-8) parts.push({ phase: "unattributed", attempt: null, estimatedCostUsd: beyond });
  }
  const overCeiling = total > ceilingUsd;
  const spent = total > 0 || (spend.calls ?? 0) > 0;
  return {
    source: byPhase ? "flow_purse" : "flow_purse_unitemised",
    calls: spend.calls,
    totalEstimatedCostUsd: total,
    builds: spend.builds,
    phases,
    perBuild: {
      ceilingUsd,
      builds: spent ? [{ phase: "flow", attempt: null, estimatedCostUsd: total, overCeiling }] : [],
      parts,
      maxBuildCostUsd: spent ? total : 0,
      overCeiling: spent && overCeiling ? 1 : 0,
    },
  };
}

/** Rounded to the nano-dollar, so a provider figure does not carry float dust into a ledger. */
function nano(value: number): number {
  return Number(value.toFixed(9));
}
