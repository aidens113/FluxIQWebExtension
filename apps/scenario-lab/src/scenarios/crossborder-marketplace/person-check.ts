import type { ScenarioPersonChecks } from "@fluxiq-web-extension/test-contracts";

/**
 * The traffic screen, as a person passes it: press "I'm not a robot". The
 * page runs a two-second check, says it is taking you back, and reloads the
 * address that was asked for (`client/verify-script.ts`), which is the
 * results.
 *
 * The screen replaces every search load once two have been made since it was
 * last passed. The honest `spain-hubs` path narrows the search with the
 * site's own filters and meets it on the third results load
 * (`manifest/steps.ts`, `SPAIN_HUBS_SCRIPT`), so a hand-off there is expected.
 * It is not `required`: a Flow that reaches the filtered results in fewer
 * loads never meets it, and that is not a fault.
 */
export const PERSON_CHECKS: ScenarioPersonChecks = Object.freeze({
  scenarioId: "crossborder-marketplace",
  checks: Object.freeze([
    Object.freeze({
      id: "traffic-screen",
      description: "Sorry, we have detected unusual traffic from your network: an \"I'm not a robot\" box, which runs a two-second check and reloads.",
      shows: "I'm not a robot",
      steps: Object.freeze([Object.freeze({ action: "click" as const, text: "I'm not a robot" })]),
      clears: "navigation" as const,
      clearsWithinMs: 10_000,
    }),
  ]),
  handOffs: Object.freeze([
    Object.freeze({ workflowId: "spain-hubs", person: "completes" as const, required: false, because: "The filters the honest path narrows by are the third results load, which the traffic screen replaces." }),
    Object.freeze({ workflowId: "spain-hubs", variantId: "list-layout", person: "completes" as const, required: false, because: "The filters the honest path narrows by are the third results load, which the traffic screen replaces." }),
  ]),
});
