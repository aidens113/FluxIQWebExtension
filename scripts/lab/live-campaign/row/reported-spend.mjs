/**
 * What the provider reported spending, and where the figure came from
 * (`source`). A created-Flow build keeps Core's provider-reported totals in
 * `snapshots/live-llm.json` `build.accounting` and itemizes no call
 * (`observedCalls: []`); a Flow run keeps one record per call. Never Core's
 * `observed.accounting`, which includes reservations for a run.
 *
 * A created Flow whose playback ran under a repair grant also keeps that run's
 * per-call record beside the build, as `repair.observed`, never folded into
 * it. The two are summed here, where a row reports its spend, and the source
 * reads `build+repair` only when the repair called a provider: a repair Core
 * refused before diagnosis spent nothing, adds nothing, and leaves the row
 * reading exactly as a row without one.
 *
 * `source` is `build`, `build+repair`, `per-call`, `no calls` (a record of zero
 * calls, so zero is the true spend), `not recorded` (a record exists and holds
 * no figure: the tokens and cost are `null`, never 0), or `null` when the run
 * left no live-llm record at all.
 */
export function reportedSpend(liveLlm, flowLane) {
  const build = liveLlm?.build ?? (flowLane?.lane === "created-flow" ? flowLane.build : null);
  if (build) return withRepair(buildSpend(build), liveLlm?.repair?.observed);
  if (!liveLlm) return { source: null, tokens: null, costUsd: null, callsWithoutReportedTokens: 0 };
  return perCallSpend(liveLlm.observed);
}

function buildSpend(build) {
  const totals = build.accounting ?? null;
  const input = number(totals?.inputTokens);
  const output = number(totals?.outputTokens);
  const tokens = number(totals?.totalTokens) ?? (input !== null && output !== null ? input + output : null);
  return { source: totals && (tokens !== null || number(totals.estimatedCostUsd) !== null) ? "build" : "not recorded", tokens, costUsd: number(totals?.estimatedCostUsd), callsWithoutReportedTokens: null };
}

/**
 * The build's spend plus a repair's, when the repair called a provider. A
 * figure either side could not report makes that sum `null`, never a partial
 * total that reads as the whole.
 */
function withRepair(spend, repairObserved) {
  if (!repairObserved || !(number(repairObserved.calls) > 0)) return spend;
  const repair = perCallSpend(repairObserved);
  const add = (left, right) => (left === null || right === null ? null : Number((left + right).toFixed(8)));
  return {
    source: "build+repair",
    tokens: add(spend.tokens, repair.tokens),
    costUsd: add(spend.costUsd, repair.costUsd),
    callsWithoutReportedTokens: repair.callsWithoutReportedTokens,
  };
}

function perCallSpend(observed) {
  const calls = observed?.observedCalls ?? [];
  if (calls.length === 0) {
    const none = observed?.calls === 0;
    return { source: none ? "no calls" : "not recorded", tokens: none ? 0 : null, costUsd: none ? 0 : null, callsWithoutReportedTokens: 0 };
  }
  const tokens = calls.map((call) => number(call.totalTokens) ?? (number(call.inputTokens) !== null && number(call.outputTokens) !== null ? call.inputTokens + call.outputTokens : null)).filter((n) => n !== null);
  const costs = calls.map((call) => number(call.estimatedCostUsd)).filter((n) => n !== null);
  return {
    source: "per-call",
    tokens: tokens.length === 0 ? null : tokens.reduce((sum, n) => sum + n, 0),
    costUsd: costs.length === 0 ? null : Number(costs.reduce((sum, n) => sum + n, 0).toFixed(8)),
    callsWithoutReportedTokens: calls.length - tokens.length,
  };
}

function number(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
