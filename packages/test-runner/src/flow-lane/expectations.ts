import type { AutomationStudioFailureRecord, ExpectedAction, ExpectedExtraction, ExpectedFailure } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../failure.js";
import { assertExtraction } from "../run-expectations/index.js";
import type { PersistedFlowAction } from "./persisted-flow-run.js";

/**
 * Every `expected.actions` entry must match an attempt of that type. An entry
 * that declares an `outcome` must match an attempt with that status; an entry
 * with no `outcome` is judged on the attempt's presence alone, never as
 * `succeeded`. Reading a missing outcome as `succeeded` failed Lab Stage 2's
 * W15 `popup-blocked` and W26 `no-context`: each negative variant pins a click
 * with no outcome and names its failure in `expected.failure`, and Core failed
 * the click with exactly that failure.
 */
export function assertFlowActions(expected: readonly ExpectedAction[] | undefined, actions: readonly PersistedFlowAction[]): void {
  for (const entry of expected ?? []) {
    const { outcome } = entry;
    const matched = actions.some((action) => action.actionType === entry.action && (outcome === undefined || action.status === outcome));
    if (!matched) {
      // Action types and statuses are Core's own vocabulary, never page data,
      // so naming what did run is safe and is what makes this diagnosable.
      const observed = actions.map((action) => `${action.actionType}:${action.status}`);
      const wanted = outcome === undefined ? `a ${entry.action} action` : `a ${entry.action} action with outcome ${outcome}`;
      throw new RunnerFailure("action.dispatch", `The Flow did not produce ${wanted}; it produced ${observed.join(", ") || "no attempts"}`, {
        details: { expected: entry.action, ...(outcome === undefined ? {} : { expectedOutcome: outcome }), observed },
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

/** The domain outputs whose attempts yield extracted records (`domain/src/actions/types.ts`). */
const EXTRACT_OUTPUT_IDS: ReadonlySet<string> = new Set(["web.dom.extract", "web.dom.extract_list"]);

/**
 * Whether the Flow lane judges a workflow's `expected.extracted`, published in
 * the lane's evidence so a run shows which it was:
 * - `judged`: extraction is expected, and the generated Flow has an extract node;
 * - `not_applicable`: extraction is expected, and the Flow has no extract node
 *   that could yield any. A recording's `extract` step is the runner's own
 *   check, not a user action, so nothing is recorded for it and Core proposes
 *   no extract node; Lab Stage 2's W18 and W09 Flow-lane runs could only fail
 *   with `0 extraction result(s)`. The recording lane still judges it;
 * - `not_expected`: the workflow declares no extraction.
 */
export type FlowExtractionExpectation = "judged" | "not_applicable" | "not_expected";

/** Which `FlowExtractionExpectation` a workflow's `expected.extracted` is, against the approved Flow's node output ids (`flowActionTypes`). */
export function flowExtractionExpectation(expected: readonly ExpectedExtraction[] | undefined, actionTypes: ReadonlyMap<string, string>): FlowExtractionExpectation {
  if (!expected?.length) return "not_expected";
  return [...actionTypes.values()].some((outputId) => EXTRACT_OUTPUT_IDS.has(outputId)) ? "judged" : "not_applicable";
}

/**
 * `expected.extracted` against what the Flow's extract attempts yielded, in
 * attempt order, judged only when `flowExtractionExpectation` is `judged`. The
 * recording lane asserts only unpaginated extraction because it reads the
 * current page and never follows `next`; a Flow does follow it, so paginated
 * extraction is proven here and nowhere else, and only by a Flow with an
 * extract node.
 */
export function assertFlowExtraction(expected: readonly ExpectedExtraction[] | undefined, extracted: readonly Array<Record<string, string>>[], actionTypes: ReadonlyMap<string, string>): void {
  if (flowExtractionExpectation(expected, actionTypes) !== "judged") return;
  const entries = expected ?? [];
  if (!entries.length) return;
  if (entries.length !== extracted.length) {
    throw new RunnerFailure("runtime.behavior", `The Flow produced ${extracted.length} extraction result(s), expected ${entries.length}`, { details: { expectedCount: entries.length, actualCount: extracted.length } });
  }
  entries.forEach((entry, index) => { assertExtraction([entry], entry.step, extracted[index]!); });
}
