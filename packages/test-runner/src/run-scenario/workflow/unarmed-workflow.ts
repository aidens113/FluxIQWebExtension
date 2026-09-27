import { resolveScenarioWorkflow, type ResolvedScenarioWorkflow, type WebScenario } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../failure.js";

/**
 * The same workflow with no variant applied: what the Flow lane records.
 *
 * A variant never changes the recording. On the Flow lane the script runs
 * unarmed, so the recording lane must be judged by the workflow's own
 * expectations while the variant's govern the Flow run alone -- judging the
 * unarmed recording by the armed expectation fails every negative variant
 * before its Flow exists.
 *
 * A resolution failure here is the fixture's, not the run's, so it is raised as
 * `fixture.invalid` rather than escaping as a bare `Error` the bench would have
 * to classify itself.
 */
export function unarmedWorkflow(scenario: WebScenario, options: { workflowId?: string }): ResolvedScenarioWorkflow {
  try { return resolveScenarioWorkflow(scenario, { ...(options.workflowId === undefined ? {} : { workflowId: options.workflowId }) }); }
  catch (cause) { throw new RunnerFailure("fixture.invalid", cause instanceof Error ? cause.message : String(cause), { cause }); }
}
