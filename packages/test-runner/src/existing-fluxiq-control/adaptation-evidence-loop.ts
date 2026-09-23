// The evidence-loop accounting a build publishes on its proposal's created
// audit event, and the bounds a record must satisfy to be one Core wrote.
//
// The bounds are the point. A build that claims more tool calls than decisions,
// or a call count that does not add up, is not a record to measure a product
// by, and a reader that takes it anyway reports arithmetic nobody can defend.
// They are also where a ceiling of our own would do damage: evidence-guided
// creation iterates for as many calls as it needs, so the only call ceiling a
// record can honestly be held to is the one Core enforces on its own loop.

import { LLM_LAB_MAX_CALLS_PER_RUN } from "@fluxiq-web-extension/test-contracts";
import { array, integer, invalid, record, stringArray, text, type JsonRecord } from "./api-readings.js";

/** Core's own ceiling on a published trace: one entry per evidence-loop iteration, plus the deterministic iteration 0. */
const MAX_EVIDENCE_LOOP_STEPS = 65;
/** Core's ceiling on the evidence one build may accumulate, in bytes. */
const MAX_EVIDENCE_BYTES = 7_340_032;

export type ExistingAdaptationEvidenceLoop = {
  providerCallCount?: number;
  decisionCount?: number;
  /**
   * Provider calls the build made outside the loop -- today, reading the
   * person's instruction for what it already asks for -- and every call it
   * made. Core publishes them beside the two loop counts rather than inside
   * them, because folding the extra call into `providerCallCount` breaks the
   * bounds below and fails every evidence-guided build before its Flow is read
   * (Core's `evidence-trace.ts`, measured on `run-mudna2ng-ceadeb69`).
   * `totalProviderCallCount` is what a build really spent, and it is what this
   * facility reports.
   */
  additionalProviderCallCount?: number;
  totalProviderCallCount?: number;
  traceStepCount?: number;
  iterationCount: number;
  toolCallCount: number;
  evidenceBytes: number;
  toolIds: string[];
  /**
   * Every decision of the build, in order, where Core published them. A
   * refused build carries them on its failure diagnostic; a proposed one
   * carries them here.
   */
  steps?: Array<{ toolId: string; effectApplied?: boolean; resultCode?: string }>;
};

/** The created audit's accounting, or `undefined` when the build was not evidence-guided. */
export function adaptationEvidenceLoop(auditDetail: JsonRecord | undefined, at: string): ExistingAdaptationEvidenceLoop | undefined {
  if (auditDetail?.evidenceGuided !== true) return undefined;
  const loop: ExistingAdaptationEvidenceLoop = {
    ...(auditDetail.providerCallCount === undefined ? {} : { providerCallCount: integer(auditDetail.providerCallCount, `${at}.providerCallCount`) }),
    ...(auditDetail.decisionCount === undefined ? {} : { decisionCount: integer(auditDetail.decisionCount, `${at}.decisionCount`) }),
    ...(auditDetail.additionalProviderCallCount === undefined ? {} : { additionalProviderCallCount: integer(auditDetail.additionalProviderCallCount, `${at}.additionalProviderCallCount`) }),
    ...(auditDetail.totalProviderCallCount === undefined ? {} : { totalProviderCallCount: integer(auditDetail.totalProviderCallCount, `${at}.totalProviderCallCount`) }),
    ...(auditDetail.traceStepCount === undefined ? {} : { traceStepCount: integer(auditDetail.traceStepCount, `${at}.traceStepCount`) }),
    iterationCount: integer(auditDetail.iterationCount, `${at}.iterationCount`),
    toolCallCount: integer(auditDetail.toolCallCount, `${at}.toolCallCount`),
    evidenceBytes: integer(auditDetail.evidenceBytes, `${at}.evidenceBytes`),
    toolIds: stringArray(auditDetail.toolIds, `${at}.toolIds`),
    ...(auditDetail.steps === undefined ? {} : { steps: evidenceLoopSteps(auditDetail.steps, `${at}.steps`) }),
  };
  if (outsideItsContract(loop)) invalid(`${at} created evidence audit exceeded its bounded contract`);
  return loop;
}

function outsideItsContract(loop: ExistingAdaptationEvidenceLoop): boolean {
  return (loop.providerCallCount === undefined) !== (loop.decisionCount === undefined)
    || (loop.providerCallCount !== undefined && (loop.providerCallCount < 1 || loop.providerCallCount > LLM_LAB_MAX_CALLS_PER_RUN))
    || (loop.providerCallCount !== undefined && loop.decisionCount !== loop.providerCallCount)
    // The total is the loop's calls plus the ones outside it, and a record
    // that does not add up is not accounting. Both are bounded by the same
    // per-run ceiling as the loop count: they were paid for out of one grant.
    || (loop.totalProviderCallCount !== undefined && (loop.providerCallCount === undefined
      || loop.totalProviderCallCount !== loop.providerCallCount + (loop.additionalProviderCallCount ?? 0)
      || loop.totalProviderCallCount > LLM_LAB_MAX_CALLS_PER_RUN))
    || (loop.additionalProviderCallCount !== undefined && loop.totalProviderCallCount === undefined)
    || (loop.traceStepCount !== undefined && loop.traceStepCount !== loop.iterationCount)
    || (loop.providerCallCount !== undefined && (loop.iterationCount < loop.providerCallCount || loop.iterationCount > loop.providerCallCount + 1))
    // Core's own ceiling, not a number of our own. A build now explores by
    // running the node library's nodes, so it makes one tool call per step it
    // tries rather than a handful before writing a script: 16 was measured
    // cutting off a live build that had already produced a Flow, and
    // `toolCallCount > iterationCount` already refuses a record that claims
    // more calls than decisions.
    || loop.toolCallCount > MAX_EVIDENCE_LOOP_STEPS || loop.toolCallCount > loop.iterationCount
    || loop.evidenceBytes > MAX_EVIDENCE_BYTES || loop.toolIds.length > MAX_EVIDENCE_LOOP_STEPS
    || (loop.steps !== undefined && loop.steps.length > MAX_EVIDENCE_LOOP_STEPS);
}

/**
 * A build's published decisions, in order. Only the tool id, whether its
 * effect was applied, and the code it came to are kept -- the same three
 * fields a refused build's diagnostic carries, so a proposed build and a
 * refused one read alike. Nothing the tool returned and nothing the model
 * wrote is admitted.
 */
function evidenceLoopSteps(value: unknown, at: string): Array<{ toolId: string; effectApplied?: boolean; resultCode?: string }> {
  return array(value, at).map((entry, index) => {
    const step = record(entry, `${at}[${index}]`);
    return {
      toolId: text(step.toolId, `${at}[${index}].toolId`),
      ...(step.effectApplied === undefined ? {} : { effectApplied: Boolean(step.effectApplied) }),
      ...(step.resultCode === undefined ? {} : { resultCode: text(step.resultCode, `${at}[${index}].resultCode`) }),
    };
  });
}
