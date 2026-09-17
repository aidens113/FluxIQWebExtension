// What an evidence-guided exploration that ended without a proposal leaves in
// the run's evidence: one diagnostic per evidence step and per plan issue code
// the sanitizer kept, one for the codes it withheld, and the rejection itself.
// Only a sanitized failure reaches here, so nothing recorded can carry page
// data.
//
// The recorder refuses a fact above 1,000,000 by throwing, which would replace
// the failure being reported with its own. Core bounds an exploration's
// evidence at 1,048,576 bytes, so a count past the recorder's bound is left out
// and said to be past it.

import type { BrowserEvidenceRecorder } from "../browser-evidence.js";
import type { SanitizedGenerationFailure } from "./generation-failure.js";

const RECORDER_FACT_MAXIMUM = 1_000_000;

export async function recordExplorationGenerationFailure(evidence: Pick<BrowserEvidenceRecorder, "diagnostic">, failure: SanitizedGenerationFailure): Promise<void> {
  for (const [index, step] of (failure.evidenceSteps ?? []).entries()) {
    await evidence.diagnostic("panel", "exploration-tool-result", `${step.toolId}.${step.resultCode ?? "outcome_unknown"}`, {
      sequence: index + 1,
      effectAppliedKnown: step.effectApplied !== undefined,
      effectApplied: step.effectApplied === true,
    });
  }
  for (const [index, code] of (failure.issueCodes ?? []).entries()) {
    await evidence.diagnostic("panel", "exploration-plan-issue", code, { sequence: index + 1 });
  }
  if (failure.issueCodesWithheld) {
    await evidence.diagnostic("panel", "exploration-plan-issue", "plan-issue.withheld", { withheldCount: failure.issueCodesWithheld });
  }
  const loop = failure.evidenceLoop;
  await evidence.diagnostic("panel", "exploration-generation-rejected", failure.reasonCode ?? failure.code, {
    httpStatus: failure.status,
    providerCallCount: failure.providerCallCount,
    responseParsed: failure.parsed,
    ...(loop ? {
      evidenceIterationCount: loop.iterationCount,
      evidenceDecisionCount: loop.decisionCount,
      evidenceToolCallCount: loop.toolCallCount,
      ...(loop.evidenceBytes <= RECORDER_FACT_MAXIMUM ? { evidenceBytes: loop.evidenceBytes } : { evidenceBytesOverMillion: true }),
    } : {}),
    ...(failure.evidenceSteps ? {
      evidenceTraceStepCount: failure.evidenceSteps.length,
      evidenceEffectAppliedCount: failure.evidenceSteps.filter(step => step.effectApplied === true).length,
      evidenceEffectNotAppliedCount: failure.evidenceSteps.filter(step => step.effectApplied === false).length,
      evidenceResultCodeCount: failure.evidenceSteps.filter(step => step.resultCode !== undefined).length,
    } : {}),
  });
}
