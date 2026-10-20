import type { ExistingFlowSpend, ExistingFlowSpendPhase } from "../../existing-fluxiq-control/index.js";

/**
 * A Flow's spend as Core's purse records it (`get-flow-spend`), itemised by
 * phase as `[calls, usd]`; a phase left out spent nothing. `spentUsd` and
 * `calls` are the phases' sums unless given; the largest input and the role
 * tallies are `null` unless given.
 */
export function flowPurse(
  phases: Partial<Record<ExistingFlowSpendPhase, readonly [number, number]>>,
  totals: { spentUsd?: number; calls?: number; flowId?: string; largestInputTokens?: number | null; byRole?: ExistingFlowSpend["byRole"] } = {},
): ExistingFlowSpend {
  const byPhase = Object.fromEntries((["build", "read", "judge", "runtime", "reauthor", "chat"] as const).map((phase) => [phase, { calls: phases[phase]?.[0] ?? 0, usd: phases[phase]?.[1] ?? 0 }])) as Record<ExistingFlowSpendPhase, { calls: number; usd: number }>;
  const items = Object.values(byPhase);
  return {
    projectId: "project-1",
    flowId: totals.flowId ?? "flow-1",
    spentUsd: totals.spentUsd ?? Number(items.reduce((sum, item) => sum + item.usd, 0).toFixed(9)),
    builds: 1,
    calls: totals.calls ?? items.reduce((sum, item) => sum + item.calls, 0),
    byPhase,
    largestInputTokens: totals.largestInputTokens ?? null,
    byRole: totals.byRole ?? null,
    updatedAt: 1,
  };
}
