// Every bound the sanitized evidence packet is held to, in one place, and the
// resolver that turns a caller's requested byte budget into an enforced one.
//
// Two budgets, not one, because the two consumers are gated differently. The
// exploration path (the LLM evidence tools) is bounded only by what the
// harness will carry, so it defaults to 6,000 bytes. The failure path is
// bounded by Core: `sanitizeAutomationStudioLlmFailureEvidence` throws on a
// packet over `AUTOMATION_STUDIO_LLM_MAX_FAILURE_EVIDENCE_BYTES`, and
// `AutomationStudioService` treats that throw as "failure evidence
// unavailable" and abandons the whole diagnosis. Overshooting the gate
// therefore costs the intervention, not just the surplus bytes, so the failure
// path both defaults to and is clamped at Core's own number -- imported, never
// restated, so the two cannot drift.

import { AUTOMATION_STUDIO_LLM_MAX_FAILURE_EVIDENCE_BYTES } from "fluxiq/automation-studio";

/**
 * `ceiling` is the absolute cap no caller can raise. `exploration` and
 * `failure` are the defaults applied when a caller names no budget, and
 * `failure` is also the ceiling on the failure path.
 */
export const WEB_LLM_EVIDENCE_BYTE_BUDGETS = Object.freeze({
  ceiling: 12_000,
  exploration: 6_000,
  failure: AUTOMATION_STUDIO_LLM_MAX_FAILURE_EVIDENCE_BYTES
});

/** Per-field bounds. Every string the packet carries is cut to one of these. */
export const WEB_LLM_EVIDENCE_BOUNDS = Object.freeze({
  elements: 40,
  url: 2_000,
  text: 300,
  selector: 500,
  tag: 40,
  role: 80,
  attribute: 200,
  options: 20,
  placement: 80,
  dialogs: 3
});

/** The packet's serialized size, measured the way Core's gate measures it. */
export function serializedBytes(input: unknown): number {
  return new TextEncoder().encode(JSON.stringify(input)).byteLength;
}

/**
 * The budget actually applied: the caller's request when it names one, the
 * path's default when it does not, never above `ceiling`. A request that is
 * not a positive bounded integer is a caller defect and throws rather than
 * silently falling back, because a silent fallback would let a mis-wired host
 * ship a packet larger than its consumer's gate.
 */
export function evidenceByteLimit(input: unknown, fallback: number, ceiling: number = WEB_LLM_EVIDENCE_BYTE_BUDGETS.ceiling): number {
  const cap = Math.min(ceiling, WEB_LLM_EVIDENCE_BYTE_BUDGETS.ceiling);
  if (input === undefined) return Math.min(fallback, cap);
  if (!Number.isSafeInteger(input) || Number(input) < 1 || Number(input) > 100_000) throw new Error("maxEvidenceBytes must be a positive bounded integer");
  return Math.min(Number(input), cap);
}
