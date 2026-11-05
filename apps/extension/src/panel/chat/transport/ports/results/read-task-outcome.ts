import { checkAutomationStudioTaskAttemptResult, parseAutomationStudioSavedState, parseAutomationStudioTaskAttempt, parseAutomationStudioTaskResult } from "@fluxiq/contracts/automation";
import type { ChatTaskOutcome } from "@fluxiq/ui-components";
import { asRecord } from "../../reply";
import { readProvenance } from "./read-provenance";

const FIELDS: ReadonlySet<string> = new Set(["attempt", "result", "saved", "comparedTo", "provenance"]);

/**
 * Core's account of one attempt, through the contract's own parsers, or undefined for anything they
 * refuse. The chat has no reader of its own for these, so a record that fails here is a failed read,
 * never a guess.
 */
export function readTaskOutcome(value: unknown): ChatTaskOutcome | undefined {
  const fields = asRecord(value);
  if (fields === undefined || !Object.keys(fields).every((key) => FIELDS.has(key))) {
    return undefined;
  }
  const attempt = parseAutomationStudioTaskAttempt(fields.attempt);
  if (!attempt.ok) {
    return undefined;
  }
  const result = fields.result === undefined ? undefined : parseAutomationStudioTaskResult(fields.result);
  if (result !== undefined && !result.ok) {
    return undefined;
  }
  if (!checkAutomationStudioTaskAttemptResult(attempt.attempt, result?.result).ok) {
    return undefined;
  }
  const outcome: ChatTaskOutcome = { attempt: attempt.attempt };
  if (result !== undefined) {
    outcome.result = result.result;
  }
  if (fields.saved !== undefined) {
    const saved = parseAutomationStudioSavedState(fields.saved);
    if (!saved.ok) {
      return undefined;
    }
    outcome.saved = saved.saved;
  }
  if (fields.comparedTo !== undefined) {
    const earlier = parseAutomationStudioTaskAttempt(fields.comparedTo);
    if (!earlier.ok) {
      return undefined;
    }
    outcome.comparedTo = earlier.attempt;
  }
  if (fields.provenance !== undefined) {
    const provenance = readProvenance(fields.provenance);
    if (provenance === undefined) {
      return undefined;
    }
    outcome.provenance = provenance;
  }
  return outcome;
}
