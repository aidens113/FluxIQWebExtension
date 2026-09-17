import { distinct } from "../distinct.mjs";

/** The campaign summary as Markdown: totals, then a table of creation tasks and a table of repair tasks. */
export function renderSummaryMarkdown(summary) {
  const t = summary.totals;
  const { profiles, provider, model, maxAttempts } = summary.options;
  const cell = (value) => (value === null || value === undefined || value === "" ? "—" : String(value).replace(/\|/gu, "\\|").replace(/\s+/gu, " "));
  const yesNo = (value) => (value === null || value === undefined ? "—" : value ? "yes" : "no");
  const tableRow = (values) => `| ${values.map(cell).join(" | ")} |`;
  // The category, then what the runner said stopped the run, then how the
  // automation failed -- marked "as declared" when that is the failure the
  // scenario or variant said the run must report, which is a pass and not a
  // fault.
  const reportedOf = (row) => (row.declaredFailure && row.declaredFailure === row.automationFailure ? `as declared: ${row.automationFailure}` : row.automationFailure);
  const failureOf = (row) => [row.failureCategory, row.runnerMessage, reportedOf(row)].filter(Boolean).join("; ");
  const attemptsOf = (row) => (row.ramFaults.length > 0 ? `${row.attempts} (${row.ramFaults.join(", ")})` : row.attempts);
  const spent = (value, row) => value ?? (row.spendSource === "not recorded" ? "not recorded" : null);
  const nodesOf = ({ createdFlowShape: shape }) => (shape ? `${shape.nodeCount ?? "?"} nodes${Object.keys(shape.nodeTypes).length > 0 ? `: ${Object.entries(shape.nodeTypes).map(([name, n]) => `${name} ×${n}`).join(", ")}` : ""}` : null);
  const creations = summary.tasks.filter((row) => row.kind !== "repair");
  const repairs = summary.tasks.filter((row) => row.kind === "repair");
  const lines = [
    `# Live campaign ${summary.campaignId}`, "",
    `Started ${summary.startedAt}, finished ${summary.finishedAt ?? "(in progress)"}. Lab: creation tasks \`pnpm lab run ... --llm-task create-flow\` (profile \`${profiles.create}\`), repair tasks \`pnpm lab run ... --flow --llm-task adapt\` (profile \`${profiles.repair}\`); ${provider}/${model}, up to ${maxAttempts} attempt(s) per task.`, "",
    `**${t.passed} of ${t.tasks} runs passed** (${t.failed} failed, ${t.noResult} produced no result); ${t.judgementsPassed} judgement(s) passed; **${t.succeeded} of ${t.tasks} tasks succeeded** (a creation task on its run's verdict, a repair task on its judgement; a run whose scenario declares the failure it must report passes by reporting exactly that failure). Provider calls ${t.providerCalls}; reported tokens ${t.reportedTokens}; reported cost $${t.reportedCostUsd.toFixed(6)} (reservations excluded).`,
  ];
  if (creations.length > 0 || repairs.length === 0) {
    lines.push("", "| Task | Scenario / variant | Kind | Run | Verdict | Flow created | Created Flow nodes | Executed actions | Judged by | Judgement | Calls | Tokens (reported) | Cost USD (reported) | Failure | Issue codes | Attempts |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
    for (const row of creations) {
      const judgedBy = row.judgeBy === "expected-dataset" ? `dataset ${row.expectedDatasetId}` : "playback goal";
      lines.push(tableRow([row.taskId, row.variantId ? `${row.scenarioId} / ${row.variantId}` : row.scenarioId, row.kind, row.runId, row.verdict, yesNo(row.flowCreated), nodesOf(row), row.actionTypes.join(", "), judgedBy, yesNo(row.judgement.passed), row.providerCalls, spent(row.reportedTokens, row), spent(row.reportedCostUsd, row), failureOf(row), row.issueCodes.join(", "), attemptsOf(row)]));
    }
  }
  if (repairs.length > 0) {
    lines.push("", "Repair tasks. A run's verdict judges the variant's own expectations, which a repair that is only proposed never meets; the judgement is what counts.", "",
      "| Task | Scenario / workflow / variant | Expect | Run | Verdict | Final state | Diagnosis validated | Patch kinds (accepted) | Refused | Refusal codes | Proposal | Adaptation | Right control | Replay calls | Calls | Tokens (reported) | Cost USD (reported) | Judgement | Why | Failure | Attempts |",
      "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
    for (const row of repairs) {
      const r = row.repair;
      const accepted = distinct(r.accepted.map((patch) => patch.kind));
      const kinds = r.patchKinds.length === 0 ? "none" : `${r.patchKinds.join(", ")} (${accepted.length === 0 ? "none" : accepted.join(", ")})`;
      const refused = r.refused === true ? `yes, at ${r.refusedAt}` : yesNo(r.refused);
      const verified = row.judgement.targetVerified;
      const target = row.judgeBy !== "repair" ? null : `${verified === null ? "not checked" : yesNo(verified)}${r.targetJudgement ? ` (${r.targetJudgement.verdict})` : ""}`;
      lines.push(tableRow([row.taskId, [row.scenarioId, row.workflowId, row.variantId].filter(Boolean).join(" / "), row.judgeBy, row.runId, row.verdict, row.judgement.oracleVerdict, yesNo(r.diagnosisValidated), r.measured ? kinds : null, refused, r.refusalCodes.join(", "), yesNo(r.changeProposalCreated), yesNo(r.adaptationCreated), target, r.replayProviderCalls ?? "not replayed", row.providerCalls, spent(row.reportedTokens, row), spent(row.reportedCostUsd, row), yesNo(row.judgement.passed), row.judgement.reason, failureOf(row), attemptsOf(row)]));
    }
  }
  return `${lines.join("\n")}\n`;
}
