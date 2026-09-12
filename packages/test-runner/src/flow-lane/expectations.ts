import type { AutomationStudioFailureRecord, ExpectedAction, ExpectedExtraction, ExpectedFailure } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../failure.js";
import { assertExtraction } from "../run-expectations/index.js";
import type { PersistedFlowAction } from "./persisted-flow-run.js";

/** Every `expected.actions` entry must match an attempt of that type with that outcome. */
export function assertFlowActions(expected: readonly ExpectedAction[] | undefined, actions: readonly PersistedFlowAction[]): void {
  for (const entry of expected ?? []) {
    const outcome = entry.outcome ?? "succeeded";
    const matched = actions.some((action) => action.actionType === entry.action && action.status === outcome);
    if (!matched) {
      // Action types and statuses are Core's own vocabulary, never page data,
      // so naming what did run is safe and is what makes this diagnosable.
      const observed = actions.map((action) => `${action.actionType}:${action.status}`).join(", ") || "no attempts";
      throw new RunnerFailure("action.dispatch", `The Flow did not produce a ${entry.action} action with outcome ${outcome}; it produced ${observed}`, {
        details: { expected: entry.action, expectedOutcome: outcome, observed: actions.map((action) => `${action.actionType}:${action.status}`) },
      });
    }
  }
}

/**
 * The run's structured failure against the workflow's `expected.failure`.
 * Both sides are Core's taxonomy and the observed side is Core's own
 * `failure` record, so nothing is inferred from a message. A workflow that
 * expects a failure and gets none fails; so does an unexpected failure, which
 * would otherwise let a broken run pass as long as it broke differently.
 */
export function assertFlowFailure(expected: ExpectedFailure | undefined, failure: AutomationStudioFailureRecord | null): void {
  if (!expected) {
    if (failure) throw new RunnerFailure("runtime.behavior", `The Flow reported an unexpected ${failure.category} failure`, { details: { category: failure.category, ...(failure.code ? { code: failure.code } : {}) } });
    return;
  }
  if (!failure) {
    throw new RunnerFailure("runtime.behavior", `The Flow reported no structured failure, expected ${expected.category}`, { details: { expectedCategory: expected.category } });
  }
  if (failure.category !== expected.category) {
    throw new RunnerFailure("runtime.behavior", `The Flow reported failure category ${failure.category}, expected ${expected.category}`, { details: { expectedCategory: expected.category, actualCategory: failure.category } });
  }
  if (expected.code !== undefined && failure.code !== expected.code) {
    throw new RunnerFailure("runtime.behavior", `The Flow reported failure code ${String(failure.code)}, expected ${expected.code}`, { details: { expectedCode: expected.code, actualCode: failure.code ?? null } });
  }
}

/**
 * `expected.extracted` against what the Flow's extract attempts yielded, in
 * attempt order. The recording lane asserts only unpaginated extraction
 * because it reads the current page and never follows `next`; a Flow does
 * follow it, so paginated extraction is proven here and nowhere else.
 */
export function assertFlowExtraction(expected: readonly ExpectedExtraction[] | undefined, extracted: readonly Array<Record<string, string>>[]): void {
  const entries = expected ?? [];
  if (!entries.length) return;
  if (entries.length !== extracted.length) {
    throw new RunnerFailure("runtime.behavior", `The Flow produced ${extracted.length} extraction result(s), expected ${entries.length}`, { details: { expectedCount: entries.length, actualCount: extracted.length } });
  }
  entries.forEach((entry, index) => { assertExtraction([entry], entry.step, extracted[index]!); });
}
