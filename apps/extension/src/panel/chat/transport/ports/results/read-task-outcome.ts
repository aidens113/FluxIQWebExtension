import { checkAutomationStudioTaskAttemptResult, parseAutomationStudioSavedState, parseAutomationStudioTaskAttempt, parseAutomationStudioTaskResult } from "@fluxiq/contracts/automation";
import type { ChatTaskOutcome } from "@fluxiq/ui-components";
import type { AutomationStudioTaskOutcome, AutomationStudioTaskReplayDeviation } from "fluxiq/automation";
import { asRecord } from "../../reply";
import { readProvenance } from "./read-provenance";

/**
 * Every field Core's outcome can carry, typed against the contract both ways: a field the contract gains and this does not
 * name fails to compile here. Until t897 this was a hand list, and when the outcome gained `replay` every attempt that
 * carried one was refused whole, so its answer turn never drew (`run-mwbadi79-d928f922`, `run-mwbexkqx-cf7dd640`).
 */
const OUTCOME_FIELDS: Readonly<Record<keyof AutomationStudioTaskOutcome, true>> = { attempt: true, result: true, saved: true, comparedTo: true, provenance: true, replay: true };
const FIELDS: ReadonlySet<string> = new Set(Object.keys(OUTCOME_FIELDS));

/** Core's closed words for why a replay was judged, typed against the contract both ways, so a word it adds fails to compile here. */
const DEVIATIONS: Readonly<Record<AutomationStudioTaskReplayDeviation, true>> = {
  judge_always: true, asked_again: true, flow_not_proven: true, flow_not_confirmed: true, run_not_whole: true, repaired: true, step_failed: true,
  step_routed: true, act_not_done: true, check_cleared: true, step_retried: true, shape_unknown: true, shape_differs: true
};

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
  // How a replay was checked (task speed S9): read as strictly as the rest, and not shown, so it goes no further.
  if (fields.replay !== undefined && !replayReads(fields.replay)) {
    return undefined;
  }
  return outcome;
}

/** Exactly `{ stood: true }` or `{ stood: false, deviation }` with one of Core's closed words. */
function replayReads(value: unknown): boolean {
  const replay = asRecord(value);
  if (replay === undefined) {
    return false;
  }
  const keys = Object.keys(replay);
  if (replay.stood === true) {
    return keys.length === 1;
  }
  return replay.stood === false && keys.length === 2 && typeof replay.deviation === "string" && Object.hasOwn(DEVIATIONS, replay.deviation);
}
