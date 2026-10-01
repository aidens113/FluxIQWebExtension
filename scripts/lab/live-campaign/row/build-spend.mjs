// What each build in a run spent, against the per-build ceiling.
//
// The user's rule is $0.25 per build, enforced; Core holds a build, a run's
// recovery and each re-author build to it, each on its own. The row's
// `reportedCostUsd` is the run's sum (`reported-spend.mjs`), which can rightly
// exceed $0.25 when a build is followed by a repair, so it cannot say whether
// any build broke the ceiling. This does: one entry per build, never summed
// with another, each judged against the ceiling the run was planned under.
//
// The ceiling is never written here. It is the run's own, read from its
// live-LLM snapshot: `observed.perBuild.ceilingUsd` where the runner recorded
// per-build spend (`packages/test-runner/src/live-llm/run-spend.ts`), or else
// the plan's `authorized.maxTotalEstimatedCostUsd`, which the runner takes
// from Core's `AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_USD`. A run that recorded
// neither has no ceiling to report against, and reads `null`.

/**
 * @typedef {{ phase: "build" | "runtime" | "reauthor", attempt: number | null, costUsd: number | null, overCeiling: boolean }} BuildSpend
 * @typedef {{ ceilingUsd: number, builds: BuildSpend[], maxBuildCostUsd: number | null, overCeiling: number, unrecorded: number }} PerBuildSpend
 */

/** @returns {PerBuildSpend | null} */
export function perBuildSpend(liveLlm, flowLane) {
  if (!liveLlm) return null;
  const recorded = liveLlm.observed?.perBuild;
  const ceilingUsd = number(recorded?.ceilingUsd) ?? number(liveLlm.authorized?.maxTotalEstimatedCostUsd);
  if (ceilingUsd === null) return null;
  const builds = Array.isArray(recorded?.builds)
    ? recorded.builds.map((item) => judged(ceilingUsd, item?.phase, number(item?.attempt), number(item?.estimatedCostUsd)))
    : derivedBuilds(ceilingUsd, liveLlm, flowLane);
  const costs = builds.map((item) => item.costUsd).filter((cost) => cost !== null);
  return {
    ceilingUsd,
    builds,
    maxBuildCostUsd: costs.length === 0 ? null : Math.max(...costs),
    overCeiling: builds.filter((item) => item.overCeiling).length,
    unrecorded: builds.length - costs.length,
  };
}

/**
 * A snapshot from before the runner recorded per-build spend: the build's own
 * accounting, the repair run's calls, or a Flow run's own calls, each a build
 * of its own.
 */
function derivedBuilds(ceilingUsd, liveLlm, flowLane) {
  const build = liveLlm.build ?? (flowLane?.lane === "created-flow" ? flowLane.build : null);
  if (!build) return liveLlm.observed ? [judged(ceilingUsd, "runtime", null, observedCost(liveLlm.observed))] : [];
  const builds = [judged(ceilingUsd, "build", null, number(build.accounting?.estimatedCostUsd))];
  const repair = liveLlm.repair?.observed;
  if (repair && number(repair.calls) > 0) builds.push(judged(ceilingUsd, "runtime", null, observedCost(repair)));
  return builds;
}

function judged(ceilingUsd, phase, attempt, costUsd) {
  return { phase, attempt, costUsd, overCeiling: costUsd !== null && costUsd > ceilingUsd };
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
