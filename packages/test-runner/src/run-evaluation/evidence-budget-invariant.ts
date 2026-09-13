import { WEB_LLM_EVIDENCE_BYTE_BUDGETS } from "@fluxiq-web-extension/domain/node";
import type { InvariantResult } from "@fluxiq-web-extension/test-contracts";
import type { MeasuredEvidencePacket } from "./flow-lane-evidence-sizes.js";

/** The invariant's id in `RunEvaluation.invariants`. */
const EVIDENCE_PACKET_BUDGET = "evidence-packet-budget";

/**
 * Week 1's second exit criterion asks for a sanitized packet within its budget.
 * This is the check that makes that a judgement rather than a reading of the
 * figures: one invariant over every packet a Flow-lane run measured.
 *
 * The budget is the one the domain's host runtime applies. It calls
 * `sanitizeWebLlmSnapshot` with no options, so the exploration budget holds, and
 * it is imported here, never restated, so the two cannot drift
 * (`domain/src/runtime/llm-evidence/limits.ts`). A packet at the budget passes;
 * one byte over fails. `bytes` is measured the way the domain's budget counts
 * (`PersistedEvidencePacket`), so the comparison is like for like.
 *
 * A run with no packets gets no invariant: whether packets were measured at all
 * is a separate criterion row, and a vacuous pass here would hide that gap.
 *
 * The failure names each packet over the budget by its action's position, its
 * capture point and its bytes. `MeasuredEvidencePacket` carries nothing a
 * packet contained, so no page content can reach the message.
 */
export function evidenceBudgetInvariant(packets: readonly MeasuredEvidencePacket[]): InvariantResult | undefined {
  if (packets.length === 0) return undefined;
  const budget = WEB_LLM_EVIDENCE_BYTE_BUDGETS.exploration;
  const expected = `every sanitized evidence packet at most ${budget} bytes`;
  const over = packets.filter((packet) => packet.bytes > budget);
  if (over.length === 0) {
    const largest = packets.reduce((most, packet) => Math.max(most, packet.bytes), 0);
    return { id: EVIDENCE_PACKET_BUDGET, passed: true, expected, actual: `${packets.length} packets, the largest ${largest} bytes`, evidenceSequences: [] };
  }
  return { id: EVIDENCE_PACKET_BUDGET, passed: false, expected, actual: `${over.length} of ${packets.length} packets over budget: ${over.map(located).join("; ")}`, evidenceSequences: [] };
}

const located = (packet: MeasuredEvidencePacket): string => `action ${packet.actionPosition} ${packet.point ?? "at an unnamed point"}: ${packet.bytes} bytes`;
