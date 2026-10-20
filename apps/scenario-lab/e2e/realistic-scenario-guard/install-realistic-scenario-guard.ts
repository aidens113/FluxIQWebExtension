import type { BrowserContext, Route } from "@playwright/test";
import { unrealisticScenarioRefusal } from "../../../../packages/test-runner/src/realistic-scenarios/index.js";
import { scenarioIdInUrl } from "./scenario-id-in-url.js";

/** What the guard refused on one browser context. */
export type RealisticScenarioGuard = {
  /** The non-realistic scenarios a page in the context tried to reach, sorted. */
  readonly refusedScenarioIds: readonly string[];
  /** Throws the rule's refusal when anything was refused. */
  assertClean(): void;
};

/**
 * Refuses, on `context`, every request for a Scenario Lab scenario that is
 * not one of the ten realistic ones (user rule, 2026-09-29: every Lab or
 * browser test run, Playwright specs and the content harness included, opens
 * only those). The request is aborted before it reaches the lab, so the page
 * never loads, and `assertClean` names the rule. A browser spec cannot open a
 * synthetic scenario through `goto`, a link, a frame, a `fetch` or a popup.
 *
 * Allowed requests fall through with `route.fallback()`, so the guard composes
 * with other routes on the context (the deterministic network guard) in
 * either registration order.
 */
export async function installRealisticScenarioGuard(context: BrowserContext, entry: string): Promise<RealisticScenarioGuard> {
  const refused = new Set<string>();
  await context.route("**/*", async (route: Route) => {
    const scenarioId = scenarioIdInUrl(route.request().url());
    if (scenarioId !== null && unrealisticScenarioRefusal([scenarioId], entry) !== null) {
      refused.add(scenarioId);
      await route.abort("blockedbyclient");
      return;
    }
    await route.fallback();
  });
  return {
    get refusedScenarioIds() { return [...refused].sort(); },
    assertClean() {
      const refusal = unrealisticScenarioRefusal([...refused].sort(), entry);
      if (refusal !== null) throw new Error(refusal);
    },
  };
}
