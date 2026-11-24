import { resolveScenarioWorkflow, type ScenarioPersonChecks, type ScenarioVariant, type WebScenario } from "@fluxiq-web-extension/test-contracts";

/**
 * How a site's own declared check is brought up before the run, as the site's campaign task brings it up.
 * - `variant`: the site arms it as a variant of a workflow, and the hand-off row that requires a person names which.
 * - `lab_raise`: the site raises it from what a page does (a number of results loads, a form sent), so the Lab's person
 *   does that on the page before the run, as a visitor would, and the run then opens on the check.
 * - `none`: the module declares nothing the Lab can bring up. That is a gap, never a pass.
 */
export type SiteChallengePlan =
  | Readonly<{ how: "variant"; workflowId: string | undefined; variant: ScenarioVariant }>
  | Readonly<{ how: "lab_raise"; scenarioId: string }>
  | Readonly<{ how: "none" }>;

/** The sites whose check the Lab brings up by driving the page: no row names a variant for them. */
const LAB_RAISED: readonly string[] = Object.freeze(["bigbox-retail", "company-website"]);

/** The hand-off row that needs a person, with the variant that arms it, wins; a site with none is raised by the page. */
export function planSiteChallenge(module: ScenarioPersonChecks, scenario: WebScenario): SiteChallengePlan {
  const row = module.handOffs.find((entry) => entry.required && entry.variantId !== undefined);
  if (row?.variantId !== undefined) {
    const resolved = resolveScenarioWorkflow(scenario, { ...(row.workflowId === undefined ? {} : { workflowId: row.workflowId }), variantId: row.variantId });
    if (resolved.variant) return { how: "variant", workflowId: row.workflowId, variant: resolved.variant };
  }
  return LAB_RAISED.includes(scenario.id) ? { how: "lab_raise", scenarioId: scenario.id } : { how: "none" };
}
