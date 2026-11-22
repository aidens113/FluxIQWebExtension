import { assertAttemptSeries, type AttemptSeries } from "@fluxiq-web-extension/test-contracts";
import { classifyPreflight, type PreflightEvidence } from "../preflight/index.js";
import { OFFLINE_SCOREBOARD_TASKS } from "./fixed-tasks.js";

export type OfflineScoreboardEvidence = Readonly<{
  series: AttemptSeries;
  source: Readonly<{ core: string; extension: string }>;
  proof: "full_attempt_series" | "prefix" | "candidate_trial" | "isolated_saved_replay";
  oracleDigest: string;
  preflight: PreflightEvidence;
  configuredModel?: string | null;
  /** Read from actual per-attempt bundles, alongside the series' continuation verdict. */
  attempts: readonly Readonly<{ ordinal: number; artifact: string; savedFlow: string | null; savedDigest: string | null; startedFlow: string | null; startedDigest: string | null; logicalCalls: number | null; externalCalls: number | null; externalUsd: number | null; historicalUsd: number | null; modeledUsd: number | null }>[];
}>;

/** Fixed rows, current source, four honest outcomes and three independently named predecessor digests. */
export function evaluateOfflineScoreboard(input: { source: OfflineScoreboardEvidence["source"]; oracleDigests: Readonly<Record<string, string>>; taskDigests?: Readonly<Record<string, string>>; evidence: readonly OfflineScoreboardEvidence[] }) {
  return OFFLINE_SCOREBOARD_TASKS.map((task) => {
    const matches = input.evidence.filter((entry) => entry.series.taskId === task.taskId);
    const reasons: string[] = [];
    const entry = matches[0];
    if (matches.length !== 1 || !entry) return { ...task, verdict: "FAILURE" as const, reasons: [matches.length ? "duplicate_evidence" : "missing_evidence"] };
    try { assertAttemptSeries(entry.series); } catch { reasons.push("invalid_series"); }
    if (!input.source.core || !input.source.extension || entry.source.core !== input.source.core || entry.source.extension !== input.source.extension) reasons.push("stale_source");
    if (entry.proof !== "full_attempt_series") reasons.push(`insufficient_proof:${entry.proof}`);
    if (!/^[a-f0-9]{64}$/u.test(entry.oracleDigest) || entry.oracleDigest !== input.oracleDigests[task.taskId]) reasons.push("unproved_oracle_identity");
    if (entry.series.scenarioId !== task.scenarioId) reasons.push("other_scenario");
    const preflight = classifyPreflight(entry.preflight);
    if (entry.preflight.scenarioId !== task.scenarioId || !preflight.protocolPassed || entry.preflight.source.core !== input.source.core || entry.preflight.source.extension !== input.source.extension) reasons.push("unproved_current_preflight");
    if (entry.preflight.siteChallenge === "failed") reasons.push("site_challenge_failed");
    if (entry.preflight.permission?.applicability === "not_applicable" && (entry.preflight.permission.taskId !== task.taskId || entry.preflight.permission.taskDigest !== input.taskDigests?.[task.taskId])) reasons.push("unproved_task_permission_applicability");
    if (entry.series.rows.length !== 4 || entry.attempts.length !== 4) reasons.push("not_four_attempts");
    for (let ordinal = 1; ordinal <= 4; ordinal++) {
      const rows = entry.series.rows.filter((row) => row.attempt === ordinal);
      const receipts = entry.attempts.filter((attempt) => attempt.ordinal === ordinal);
      const row = rows[0];
      const receipt = receipts[0];
      if (rows.length !== 1 || !row || row.answerVerdict !== "right" || row.oracleVerdict === "failed") reasons.push(`not_right:${ordinal}`);
      if (receipts.length !== 1 || !receipt?.artifact) reasons.push(`missing_attempt_receipt:${ordinal}`);
      if (!receipt || receipt.externalUsd !== 0 || receipt.externalCalls !== 0) reasons.push(`unproved_zero_external_spend:${ordinal}`);
      if (ordinal === 1) continue;
      if (!row || row.path !== "run_flow" || row.calls !== 0 || !row.callKinds || Object.values(row.callKinds).some((count) => count !== 0) || receipt?.logicalCalls !== 0) reasons.push(`later_model_calls_or_unknown:${ordinal}`);
      const before = entry.attempts.find((attempt) => attempt.ordinal === ordinal - 1);
      const proof = entry.series.continuations.filter((each) => each.fromAttempt === ordinal - 1 && each.toAttempt === ordinal);
      if (proof.length !== 1 || proof[0]?.held !== true || proof[0].refused.length !== 0 || !before?.savedFlow || !before.savedDigest || receipt?.startedFlow !== before.savedFlow || receipt.startedDigest !== before.savedDigest) reasons.push(`unproved_predecessor:${ordinal}`);
    }
    if (entry.series.continuations.length !== 3) reasons.push("not_three_continuations");
    return { ...task, verdict: reasons.length === 0 ? "SUCCESS" as const : entry.series.rows.some((row) => row.answerVerdict === "right") ? "PARTIAL" as const : "FAILURE" as const, reasons, configuredModel: entry.configuredModel ?? null, calls: entry.attempts.map((attempt) => attempt.logicalCalls), ms: entry.series.rows.map((row) => row.ms), accounting: entry.attempts.map(({ ordinal, externalCalls, externalUsd, historicalUsd, modeledUsd }) => ({ ordinal, externalCalls, externalUsd, historicalUsd, modeledUsd })), siteChallenge: preflight.siteChallenge };
  });
}
