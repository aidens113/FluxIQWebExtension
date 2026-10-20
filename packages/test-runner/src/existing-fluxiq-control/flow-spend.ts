// A Flow's spend as Core's Flow purse recorded it (`get-flow-spend`, Core
// t728).
//
// Core adds every settled provider call to the Flow's one purse as it settles,
// attributed to a phase from the step-log scope the Lab sets on every run:
// the build, its reading of the instructions, a judge, the Flow run's own
// recovery, a re-author, and the extension chat's interpreter. The Lab used to
// rebuild those figures from the step log and four other records; it reads
// them here instead. `calls` and `byPhase` are `null` on a record Core never
// itemised, and the whole answer is `null` when Core holds no record, so an
// unknown figure stays unknown rather than becoming a zero.

import { finite, integer, invalid, record, text } from "./api-readings.js";

/** Core's spend phases (`AUTOMATION_STUDIO_FLOW_SPEND_PHASES`), in Core's order. */
export const EXISTING_FLOW_SPEND_PHASES = ["build", "read", "judge", "runtime", "reauthor", "chat"] as const;
export type ExistingFlowSpendPhase = (typeof EXISTING_FLOW_SPEND_PHASES)[number];

/** One phase's settled calls (priced chat attempts for `chat`) and their charge in US dollars. */
export type ExistingFlowSpendItem = Readonly<{ calls: number; usd: number }>;

export type ExistingFlowSpend = Readonly<{
  projectId: string;
  flowId: string;
  spentUsd: number;
  builds: number;
  calls: number | null;
  byPhase: Readonly<Record<ExistingFlowSpendPhase, ExistingFlowSpendItem>> | null;
  updatedAt: number;
}>;

/** The `spend` member of a `get-flow-spend` answer, or `null` when Core holds no record. Anything malformed is refused, never coerced. */
export function flowSpendReading(value: unknown, at = "flow spend payload.spend"): ExistingFlowSpend | null {
  if (value === null || value === undefined) return null;
  const spend = record(value, at);
  const calls = spend.calls === null || spend.calls === undefined ? null : integer(spend.calls, `${at}.calls`);
  const byPhase = spend.byPhase === null || spend.byPhase === undefined ? null : phasesOf(record(spend.byPhase, `${at}.byPhase`), `${at}.byPhase`);
  // Core writes the two together (`creation-spend/parse.ts`); one without the other is not a record it wrote.
  if ((calls === null) !== (byPhase === null)) invalid(`${at}.calls and ${at}.byPhase must be present together`);
  return Object.freeze({
    projectId: text(spend.projectId, `${at}.projectId`),
    flowId: text(spend.flowId, `${at}.flowId`),
    spentUsd: usd(spend.spentUsd, `${at}.spentUsd`),
    builds: integer(spend.builds, `${at}.builds`),
    calls,
    byPhase,
    updatedAt: finite(spend.updatedAt, `${at}.updatedAt`),
  });
}

function phasesOf(value: Record<string, unknown>, at: string): Readonly<Record<ExistingFlowSpendPhase, ExistingFlowSpendItem>> {
  const entries = EXISTING_FLOW_SPEND_PHASES.map((phase) => {
    const item = record(value[phase], `${at}.${phase}`);
    return [phase, Object.freeze({ calls: integer(item.calls, `${at}.${phase}.calls`), usd: usd(item.usd, `${at}.${phase}.usd`) })] as const;
  });
  return Object.freeze(Object.fromEntries(entries) as Record<ExistingFlowSpendPhase, ExistingFlowSpendItem>);
}

function usd(value: unknown, at: string): number {
  const amount = finite(value, at);
  if (amount < 0) invalid(`${at} must not be negative`);
  return amount;
}
