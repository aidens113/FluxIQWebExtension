// How a refusal is printed: a sentence per rule a person can act on, then one
// JSON line in the shape the live campaign already reads as a run that never
// started (`live-campaign/lab-run/output.mjs` `parseRunnerRefusal`), so two
// identical refusals are recognised as deterministic and not retried.

/**
 * @param {import("./rules/guard-state.mjs").Refusal[]} refusals at least one
 * @returns {{ text: string, line: string }}
 */
export function formatRefusals(refusals) {
  const rules = refusals.map((refusal) => refusal.rule);
  const text = [
    ...refusals.map((refusal) => `[lab] live run refused by rule "${refusal.rule}": ${refusal.why}.\n[lab]   To satisfy it: ${refusal.remedy}`),
    "[lab] No provider call was made; this refusal cost nothing. Overrides are files only the user creates; there is no flag.",
    "",
  ].join("\n");
  const line = JSON.stringify({
    status: "failed", category: "lab.live-guard", rules,
    message: `live run refused (${rules.join(", ")}): ${refusals[0].why}`,
    spentUsd: 0,
  });
  return { text, line: `${line}\n` };
}
