import { isRealisticScenario } from "../../realistic-scenarios/index.js";

/** These receipts must come from the real composition; this classifier launches nothing. */
export type PreflightEvidence = Readonly<{
  scenarioId: string;
  source: Readonly<{ core: string; extension: string }>;
  stages: readonly Readonly<{ stage: "pairing" | "chat_start" | "person_answer" | "permission_answer" | "read"; passed: boolean; artifact: string }> [];
  siteChallenge: "passed" | "failed" | "not_declared" | "not_run";
  externalCalls: number | null;
  externalUsd: number | null;
  /** A read-only task does not prove the consequential-action permission protocol. */
  permission?: Readonly<{ applicability: "not_applicable" | "required"; taskId: string; taskDigest: string; declaredConsequences: readonly string[]; pointDeclared: boolean }>;
}>;

export function classifyPreflight(evidence: PreflightEvidence): Readonly<{ protocolPassed: boolean; siteChallenge: PreflightEvidence["siteChallenge"]; gaps: readonly string[] }> {
  const gaps: string[] = [];
  if (!isRealisticScenario(evidence.scenarioId)) gaps.push("unsupported_scenario");
  if (!evidence.source.core || !evidence.source.extension) gaps.push("missing_source");
  for (const stage of ["pairing", "chat_start", "person_answer", "permission_answer", "read"] as const) {
    if (stage === "permission_answer" && evidence.permission?.applicability === "not_applicable") {
      if (!evidence.permission.taskId || !/^[a-f0-9]{64}$/u.test(evidence.permission.taskDigest) || evidence.permission.declaredConsequences.length || evidence.permission.pointDeclared) gaps.push("unproved_permission_not_applicable");
      continue;
    }
    const receipts = evidence.stages.filter((receipt) => receipt.stage === stage);
    if (receipts.length !== 1 || receipts[0]?.passed !== true || !receipts[0].artifact) gaps.push(`unproved_${stage}`);
  }
  if (evidence.externalCalls !== 0 || evidence.externalUsd !== 0) gaps.push("unproved_zero_external_spend");
  return { protocolPassed: gaps.length === 0, siteChallenge: evidence.siteChallenge, gaps };
}
