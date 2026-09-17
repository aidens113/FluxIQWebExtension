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
    providerCalls: sum((row) => row.providerCalls),
    reportedTokens: sum((row) => row.reportedTokens),
    reportedCostUsd: Number(sum((row) => row.reportedCostUsd).toFixed(8)),
  };
}
