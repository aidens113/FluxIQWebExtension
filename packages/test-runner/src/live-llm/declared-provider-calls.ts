// A scenario's declaration that a live run must finish without the model, and
// the one judgement it replaces.
//
// `--live-llm` is a request for a real provider call, so a live run that
// reached no provider fails (`assertLiveLlmProviderWasReached`). That guard is
// right by default: it is what stops a deterministic pass being reported as a
// green live-LLM result. But a fixture that arms a fault the deterministic
// runtime is *supposed* to absorb -- a control renamed between authoring and
// replay, content that arrives after the action needing it -- ends with a
// grant that correctly went unspent, and under the guard every correct
// absorption reads as a defect.
//
// The answer is a declaration, not a weaker guard, and it follows
// `expected.failure` / `declaredFailureOutcome` exactly: an undeclared
// zero-call run fails as it always has, a declared one is held to spending
// nothing instead, and neither the oracle, the declared final state, the
// extraction judgement nor a facility failure is touched either way.
//
// It never applies to a Flow build. A build that reached no provider produced
// no proposal, so `settleBuild` passes no declaration and keeps the guard
// whatever the scenario says.

import type { ScenarioExpected } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../failure.js";
import { assertLiveLlmProviderWasReached } from "./budget.js";
import type { LiveLlmPlan } from "./live-llm-plan.js";
import type { LiveLlmObservedUsage } from "./observed-usage.js";

/**
 * The declaration as a run records it: the fixture's own words, and where they
 * were written. `declaredBy` is kept because a variant's `expected` replaces
 * the workflow's field of the same name, so the same scenario can declare a
 * spend on one variant and none on another, and the run file must say which
 * one this run was.
 */
export type DeclaredProviderCalls = Readonly<{
  count: 0;
  because: string;
  declaredBy: Readonly<{ scenarioId: string; workflowId: string | null; variantId: string | null }>;
}>;

/** The resolved workflow's `expected.providerCalls`, stamped with where it came from; `null` when nothing declared one. */
export function declaredProviderCalls(
  expected: ScenarioExpected,
  where: { scenarioId: string; workflowId?: string | undefined; variantId?: string | undefined },
): DeclaredProviderCalls | null {
  const declared = expected.providerCalls;
  if (declared === undefined) return null;
  return Object.freeze({
    count: 0 as const,
    because: declared.because,
    declaredBy: Object.freeze({ scenarioId: where.scenarioId, workflowId: where.workflowId ?? null, variantId: where.variantId ?? null }),
  });
}

/**
 * Holds a settled live run to what its scenario declared about provider calls.
 *
 * With no declaration this is `assertLiveLlmProviderWasReached` and nothing
 * else, so the default path is unchanged and an undeclared zero-call run fails
 * exactly as it did before.
 *
 * With one, the check inverts rather than disappearing: the run must have
 * spent nothing. A declaration is an expectation, not an exemption -- a
 * variant that says the runtime absorbs it and then consults the model has
 * told us something worth failing on, and reporting that as a pass would make
 * the declaration a hole in the one measurement it exists to take.
 *
 * `interventions` counts with `calls` because Core records a model
 * intervention on the run whether or not the call reached its per-call lines,
 * and a run that intervened is not one the deterministic runtime absorbed.
 */
export function assertProviderCallsAsDeclared(plan: LiveLlmPlan, usage: LiveLlmObservedUsage, declared: DeclaredProviderCalls | null): void {
  if (declared === null) return assertLiveLlmProviderWasReached(plan, usage);
  if (usage.calls === 0 && usage.interventions === 0) return;
  const where = describeDeclaration(declared);
  throw new RunnerFailure(
    "runtime.behavior",
    `Declared provider calls exceeded: ${where} declares that this run makes no provider call (${declared.because}), and Core made ${usage.calls} with ${usage.interventions} intervention(s).`,
    { details: { declared: 0, calls: usage.calls, interventions: usage.interventions, declaredBy: declared.declaredBy } },
  );
}

/** The declaration's home, as a message names it: the scenario, its workflow and the variant that armed the run. */
function describeDeclaration(declared: DeclaredProviderCalls): string {
  const { scenarioId, workflowId, variantId } = declared.declaredBy;
  return [scenarioId, workflowId ?? "primary", ...(variantId === null ? [] : [variantId])].join("/");
}
