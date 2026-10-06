/**
 * What the provider reported spending, and where the figure came from
 * (`source`). A created-Flow build keeps Core's provider-reported totals in
 * `snapshots/live-llm.json` `build.accounting` and itemizes no call
 * (`observedCalls: []`); a Flow run keeps one record per call. Never Core's
 * `observed.accounting`, which includes reservations for a run.
 *
 * A created Flow whose playback ran with the model taking part also keeps that run's
 * per-call record beside the build, as `repair.observed`, never folded into
 * it. The two are summed here, where a row reports its spend, and the source
 * reads `build+repair` only when the repair called a provider: a repair Core
 * refused before diagnosis spent nothing, adds nothing, and leaves the row
 * reading exactly as a row without one.
 *
 * `source` is `run` (the run's whole spend, below), `build`, `build+repair`, `per-call`, `no calls` (a record of zero
 * calls, so zero is the true spend), `not recorded` (a record exists and holds
 * no figure: the tokens and cost are `null`, never 0), or `null` when the run
 * left no live-llm record at all.
 */
export function reportedSpend(liveLlm, flowLane) {
  const build = liveLlm?.build ?? (flowLane?.lane === "created-flow" ? flowLane.build : null);
  if (build) return withRunSpend(withRepair(buildSpend(build), liveLlm?.repair?.observed), liveLlm?.runSpend);
  if (!liveLlm) return { source: null, tokens: null, costUsd: null, callsWithoutReportedTokens: 0 };
  return withRunSpend(perCallSpend(liveLlm.observed), liveLlm.runSpend);
}

/**
 * The run's whole spend in place of the phases' sum, when the run recorded it
 * (`live-llm.json` `runSpend.totalEstimatedCostUsd`, `run-spend.ts`): every
 * call the run paid for, the chat's own interpreter call and the build's judge
 * and reading among them, which no build or repair record holds. The row
 * reported only the build's $0.211519044 of a run that spent $0.212718924
 * (`run-musq0b1m-0472cfa0`). `source` reads `run` then; the tokens stay the
 * phases', since the run's spend counts money and calls, not tokens.
 */
function withRunSpend(spend, runSpend) {
  const total = number(runSpend?.totalEstimatedCostUsd);
  return total === null ? spend : { ...spend, source: "run", costUsd: total };
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
