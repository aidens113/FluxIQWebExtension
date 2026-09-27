import type { Page } from "@playwright/test";
import type { WebScenario } from "@fluxiq-web-extension/test-contracts";

/**
 * The inputs a persisted Flow is run with: which scenario, which fixture origin,
 * which page the browser is on, the run's seed, and the facility run id that
 * ties Core's run back to this bundle.
 *
 * Both replay lanes -- a Flow in a remote FluxIQ and the same Flow cloned into
 * this run's isolated Core -- pass exactly this. They each built it themselves
 * until the two copies were one call, which is the kind of duplication that does
 * not fail: a field added to one lane simply never reaches the other, and the
 * cloned Flow runs with a context the remote one had. `scenarioUrl` is read at
 * the moment of the call rather than passed in, because it is the page the Flow
 * is actually about to run against.
 */
export function persistedFlowRunContext(run: { scenario: Pick<WebScenario, "id">; scenarioOrigin: string; page: Pick<Page, "url">; seed: number; facilityRunId: string }): Record<string, unknown> {
  return {
    scenarioId: run.scenario.id,
    scenarioOrigin: run.scenarioOrigin,
    scenarioUrl: run.page.url(),
    seed: run.seed,
    facilityRunId: run.facilityRunId,
  };
}
