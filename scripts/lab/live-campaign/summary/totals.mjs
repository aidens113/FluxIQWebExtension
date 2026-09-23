/** The campaign's totals over its rows so far; a figure a row does not hold counts as nothing. */
export function totalsOf(rows) {
  const sum = (pick) => rows.reduce((total, row) => total + (pick(row) ?? 0), 0);
  return {
    tasks: rows.length,
    passed: rows.filter((row) => row.verdict === "passed").length,
    succeeded: rows.filter((row) => row.succeeded).length,
    failed: rows.filter((row) => row.verdict === "failed" || row.verdict === "inconclusive").length,
    noResult: rows.filter((row) => row.verdict === "no-result").length,
    judgementsPassed: rows.filter((row) => row.judgement.passed === true).length,
    /** Builds that produced a proposal nothing was waiting on. */
    built: rows.filter((row) => row.buildOutcome === "proposed").length,
    /**
     * Builds that asked a person for a lasting act and were not answered. A
     * result about the product -- what it would have done, and that nothing
     * allowed it -- and never a fault of the facility.
     */
    permissionRequired: rows.filter((row) => row.buildOutcome === "permission_required").length,
    providerCalls: sum((row) => row.providerCalls),
    reportedTokens: sum((row) => row.reportedTokens),
    reportedCostUsd: Number(sum((row) => row.reportedCostUsd).toFixed(8)),
  };
}
