import { createCorrelationId } from "@fluxiq-web-extension/test-evidence";

/** The triggers a scenario run publishes an evidence event under. */
export type EvidenceEventTrigger = "step.start" | "step.complete" | "gateway.action" | "runtime.dispatch" | "runtime.settle" | "checkpoint" | "error" | "final";

/**
 * One evidence event, correlated back to the run, the scenario and -- where the
 * event belongs to a recording script step -- the step.
 *
 * Every event a run publishes is built here, which is what makes the correlation
 * uniform: a reader of `events.ndjson` can group by run, filter by scenario and
 * follow one step's `step.start` through to its `step.complete` without knowing
 * which lane wrote them. `correlationId` is fresh per event, so the same summary
 * published twice is still two distinguishable events.
 *
 * `stepId` is spread conditionally, so an event that belongs to no step carries
 * no `stepId` key at all rather than one holding `undefined` -- the difference
 * between the two survives into the persisted JSON.
 */
export function evidenceEvent(runId: string, scenarioId: string, stepId: string | undefined, trigger: EvidenceEventTrigger, summary: string) {
  return { trigger, summary, correlation: { runId, scenarioId, ...(stepId ? { stepId } : {}), correlationId: createCorrelationId() } };
}
