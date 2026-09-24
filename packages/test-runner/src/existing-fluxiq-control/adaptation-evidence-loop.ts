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
import { publishableStepFields, type PublishableStepValue } from "./publishable-step-value.js";

/** Core's own ceiling on a build's decisions: its evidence-loop iterations, plus the deterministic iteration 0. */
const MAX_EVIDENCE_LOOP_STEPS = 65;
/**
 * Core's ceiling on the *rows* of a published trace, which is a different
 * number from the decisions above. One decision writes one row, except the kind
 * that edits the draft and re-runs a step: that writes its own row and then the
 * row for the call the rerun makes, both under the single iteration that paid
 * for them. A build may therefore publish up to two rows per decision, and
 * `traceStepCount` and `steps` are held to that rather than to the decision
 * count.
 */
const MAX_EVIDENCE_LOOP_TRACE_ROWS = 129;
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
  /**
   * The rows of Core's published trace, which is not a call count and must not
   * be read as one. A decision that edits the draft and re-runs a step writes
   * two rows under one iteration, so this sits above `iterationCount` by
   * however many decisions did that.
   */
  traceStepCount?: number;
  /** The loop's decisions, plus the deterministic observation it may make before the first. */
  iterationCount: number;
  toolCallCount: number;
  evidenceBytes: number;
  toolIds: string[];
  /**
   * Every decision of the build, in order, where Core published them. A
   * refused build carries them on its failure diagnostic; a proposed one
   * carries them here.
   */
  steps?: ExistingAdaptationEvidenceLoopStep[];
};

/**
 * One decision the build made: the tool it called, or Core's name for a
 * decision that called none, and whatever else Core published on the row.
 *
 * **Every member of the row that may travel is carried, not a chosen three.**
 * The fields named below are the ones Core writes today and are here for a
 * reader; they are not the limit of what is kept, and a member Core adds later
 * arrives without a change on this side. What bounds the record is the shape of
 * each value (`publishable-step-value.ts`), which is what keeps the guarantee
 * that nothing the tool returned and nothing the model wrote is admitted.
 */
export type ExistingAdaptationEvidenceLoopStep = {
  toolId: string;
  effectApplied?: boolean;
  resultCode?: string;
  /** The loop iteration this row belongs to, which is what a provider call is counted by; two rows may share one. */
  iteration?: number;
  /** The evidence call the row records, where it made one. */
  callId?: string;
  /** Bytes of evidence this one call admitted. A size, never a value. */
  evidenceBytes?: number;
  /** The refusal's own reason, where the row was one and Core named it. */
  reason?: string;
  /** What this one call spent, as Core reported it. */
  usage?: Readonly<Record<string, string | number | boolean>>;
  [field: string]: PublishableStepValue | undefined;
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
    // The rows are at least the decisions they record and at most two per
    // decision. This read `traceStepCount === iterationCount`, which was true
    // only while Core counted rows as decisions: a build that corrected a step
    // and re-ran it published more rows than iterations and was rejected here
    // as malformed, although it was the first record of the two that was right.
    || (loop.traceStepCount !== undefined && (loop.traceStepCount < loop.iterationCount || loop.traceStepCount > MAX_EVIDENCE_LOOP_TRACE_ROWS))
    || (loop.providerCallCount !== undefined && (loop.iterationCount < loop.providerCallCount || loop.iterationCount > loop.providerCallCount + 1))
    // Core's own ceiling, not a number of our own. A build now explores by
    // running the node library's nodes, so it makes one tool call per step it
    // tries rather than a handful before writing a script: 16 was measured
    // cutting off a live build that had already produced a Flow, and
    // `toolCallCount > iterationCount` already refuses a record that claims
    // more calls than decisions.
    || loop.toolCallCount > MAX_EVIDENCE_LOOP_STEPS || loop.toolCallCount > loop.iterationCount
    || loop.evidenceBytes > MAX_EVIDENCE_BYTES || loop.toolIds.length > MAX_EVIDENCE_LOOP_STEPS
    // One published step per trace row, so bounded by the rows and not by the
    // decisions.
    || (loop.steps !== undefined && loop.steps.length > MAX_EVIDENCE_LOOP_TRACE_ROWS);
}

/**
 * A build's published decisions, in order.
 *
 * **Nothing the tool returned and nothing the model wrote is admitted.** That
 * policy is unchanged; what changed is how it is enforced. This kept the tool
 * id, whether the effect was applied, and the result code, and dropped every
 * other member of the row -- so a real failed build read as 32 rows of two
 * fields each, twenty of them the identical `web.action.rejected.target_unobserved`
 * inside one undivided 99-second gap, and three defects with three different
 * fixes were indistinguishable (`run-muf8dstp-0135804a`). The iteration, the
 * call id, the bytes the call admitted, what it spent and the refusal's own
 * reason were all on the row and all thrown away here.
 *
 * Each member is now judged by the shape of its value
 * (`publishable-step-value.ts`): an identifier, a closed code, a count, a byte
 * size, a flag and a timestamp travel; a prompt, a reply, free text, a
 * selector, an address and a label cannot. A member Core adds later is carried
 * through with no change here, and the guarantee still holds because it never
 * depended on the list of names -- it depends on what a value is allowed to
 * look like.
 *
 * A refused build's decisions are built by the same rule in
 * `flow-lane/creation/build-proposal.ts`, so a proposed build and a refused one
 * still read alike.
 */
function evidenceLoopSteps(value: unknown, at: string): ExistingAdaptationEvidenceLoopStep[] {
  return array(value, at).map((entry, index) => {
    const step = record(entry, `${at}[${index}]`);
    // Every member was admitted by the shape rule on the way in, and `toolId`
    // by this module's own: refuse a malformed record rather than coerce it.
    // The assertion states that shape rather than assuming it.
    const row: Record<string, PublishableStepValue> = {
      toolId: text(step.toolId, `${at}[${index}].toolId`),
      ...publishableStepFields(step),
    };
    return row as ExistingAdaptationEvidenceLoopStep;
  });
}
