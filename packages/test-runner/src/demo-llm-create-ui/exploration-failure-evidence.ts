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
const DIAGNOSTIC_IDENTITY = /^[a-z0-9][a-z0-9._-]{0,63}$/u;

function diagnosticIdentity(value: string, fallback: string): string {
  return DIAGNOSTIC_IDENTITY.test(value) ? value : fallback;
}

export async function recordExplorationGenerationFailure(evidence: Pick<BrowserEvidenceRecorder, "diagnostic">, failure: SanitizedGenerationFailure): Promise<void> {
  for (const [index, step] of (failure.evidenceSteps ?? []).entries()) {
    // Tool and result ids are each bounded vocabularies, but concatenating them
    // can exceed the recorder's 64-character identity limit. The result is the
    // useful category; fall back to the tool id when Core reported no result.
    await evidence.diagnostic("panel", "exploration-tool-result", diagnosticIdentity(step.resultCode ?? step.toolId, "exploration.tool-result"), {
      sequence: index + 1,
      effectAppliedKnown: step.effectApplied !== undefined,
      effectApplied: step.effectApplied === true,
    });
  }
  for (const [index, code] of (failure.issueCodes ?? []).entries()) {
    await evidence.diagnostic("panel", "exploration-plan-issue", diagnosticIdentity(code, "exploration.plan-issue"), { sequence: index + 1 });
  }
  if (failure.issueCodesWithheld) {
    await evidence.diagnostic("panel", "exploration-plan-issue", "plan-issue.withheld", { withheldCount: failure.issueCodesWithheld });
  }
  const loop = failure.evidenceLoop;
  await evidence.diagnostic("panel", "exploration-generation-rejected", diagnosticIdentity(failure.reasonCode ?? failure.code, "exploration.generation-rejected"), {
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
