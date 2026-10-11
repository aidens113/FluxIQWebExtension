// What a run's Flow spent, against the ceiling.
//
// **One purse per Flow (t438).** The user's words (2026-10-01): "bring the
// ceiling down to $0.1 per flow max" -- the build, its re-authors, its repairs
// and the judge all count against one ceiling, in billed dollars. A Lab run is
// one Flow, so its whole spend is judged once against the ceiling. This read
// each build, the run's recovery and each re-author as a build of its own,
// each allowed the whole ceiling, and so read `run-mv4912r9-53b05a51` ($0.1203
// against $0.10) as inside it.
//
// The Flow's figure is the runner's, where it recorded one
// (`observed.perBuild.builds`, one `flow` entry,
// `packages/test-runner/src/live-llm/run-spend.ts`). A snapshot from before
// that listed parts instead; its Flow is the larger of the run's recorded total
// (`observed.totalEstimatedCostUsd`) and the sum of those parts, and so is an
// older snapshot's build accounting and repair. A part whose cost was not
// recorded leaves the Flow unrecorded unless the run's total says what it was.
//
// The ceiling is never written here. It is the run's own, read from its
// live-LLM snapshot: `observed.perBuild.ceilingUsd` where the runner recorded
// it, or else the plan's `authorized.maxTotalEstimatedCostUsd`, which the
// runner takes from Core's run cost ceiling. A run that recorded neither has no
// ceiling to report against, and reads `null`.

/**
 * @typedef {{ phase: string, attempt: number | null, costUsd: number | null }} FlowPart
 * @typedef {{ phase: "flow", attempt: null, costUsd: number | null, overCeiling: boolean }} BuildSpend
 * @typedef {{ ceilingUsd: number, builds: BuildSpend[], parts: FlowPart[], maxBuildCostUsd: number | null, overCeiling: number, unrecorded: number }} PerBuildSpend
 */

/** @returns {PerBuildSpend | null} */
export function perBuildSpend(liveLlm, flowLane) {
  if (!liveLlm) return null;
  const recorded = liveLlm.observed?.perBuild;
  const ceilingUsd = number(recorded?.ceilingUsd) ?? number(liveLlm.authorized?.maxTotalEstimatedCostUsd);
  if (ceilingUsd === null) return null;
  const recordedFlow = Array.isArray(recorded?.builds) ? recorded.builds.find((item) => item?.phase === "flow") : undefined;
  const parts = recordedFlow
    ? (Array.isArray(recorded.parts) ? recorded.parts : []).map((item) => part(item?.phase, number(item?.attempt), number(item?.estimatedCostUsd)))
    : Array.isArray(recorded?.builds)
      ? recorded.builds.map((item) => part(item?.phase, number(item?.attempt), number(item?.estimatedCostUsd)))
      : derivedParts(liveLlm, flowLane);
  const costUsd = recordedFlow ? number(recordedFlow.estimatedCostUsd) : flowCost(parts, number(liveLlm.observed?.totalEstimatedCostUsd));
  const builds = recordedFlow || parts.length > 0 ? [{ phase: "flow", attempt: null, costUsd, overCeiling: costUsd !== null && costUsd > ceilingUsd }] : [];
  return {
    ceilingUsd,
    builds,
    parts,
    maxBuildCostUsd: builds.length === 0 ? null : costUsd,
    overCeiling: builds.filter((item) => item.overCeiling).length,
    unrecorded: builds.filter((item) => item.costUsd === null).length,
  };
}

/**
 * A snapshot from before the runner recorded per-build spend: the build's own
 * accounting, the repair run's calls, or a Flow run's own calls, each a part
 * of the one Flow.
 */
function derivedParts(liveLlm, flowLane) {
  const build = liveLlm.build ?? (flowLane?.lane === "created-flow" ? flowLane.build : null);
  if (!build) return liveLlm.observed ? [part("runtime", null, observedCost(liveLlm.observed))] : [];
  const parts = [part("build", null, number(build.accounting?.estimatedCostUsd))];
  const repair = liveLlm.repair?.observed;
  if (repair && number(repair.calls) > 0) parts.push(part("runtime", null, observedCost(repair)));
  return parts;
}

/** The Flow's cost from its parts and the run's recorded total: the larger, or `null` when neither is known whole. */
function flowCost(parts, totalUsd) {
  const whole = parts.length > 0 && parts.every((item) => item.costUsd !== null);
  const known = whole ? Number(parts.reduce((sum, item) => sum + item.costUsd, 0).toFixed(9)) : null;
  if (known === null) return totalUsd;
  return totalUsd === null ? known : Math.max(known, totalUsd);
}

function part(phase, attempt, costUsd) {
  return { phase: typeof phase === "string" ? phase : "unknown", attempt, costUsd };
}

function observedCost(observed) {
  const total = number(observed.totalEstimatedCostUsd);
  if (total !== null) return total;
  const costs = (observed.observedCalls ?? []).map((call) => number(call.estimatedCostUsd)).filter((cost) => cost !== null);
  return observed.calls === 0 ? 0 : costs.length === 0 ? null : Number(costs.reduce((sum, cost) => sum + cost, 0).toFixed(8));
}

function number(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
