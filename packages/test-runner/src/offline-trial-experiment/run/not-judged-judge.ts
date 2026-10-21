// The build-test judge port of a provider-free offline trial: it calls no
// model and answers every trial `not_judged`, at no spend. The runner then
// reports the trial inconclusive (`judgement_unavailable`) where the matcher
// found no gap, and the task's own oracle judges the stored rows instead.
// What it was asked about is counted, never kept: the summary holds page
// content.

import type { AutomationStudioOfflineCandidateTrialInput } from "fluxiq/automation-studio";

export const NOT_JUDGED_WHY = "offline-trial experiment: no model is called, so the trial is not judged";

export type NotJudgedJudge = Readonly<{
  judge: AutomationStudioOfflineCandidateTrialInput["ports"]["judge"];
  /** How many times the trial asked for a verdict. */
  asked(): number;
}>;

export function notJudgedJudge(): NotJudgedJudge {
  let asked = 0;
  return Object.freeze({
    judge: async () => {
      asked += 1;
      return { verdict: "not_judged" as const, why: NOT_JUDGED_WHY, spent: { calls: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0 } };
    },
    asked: () => asked,
  });
}
