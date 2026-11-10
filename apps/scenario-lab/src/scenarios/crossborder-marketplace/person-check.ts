import type { ScenarioPersonChecks } from "@fluxiq-web-extension/test-contracts";

/** Why every path of the `timed-check` variant meets a check, in the one sentence the row and the task share. */
export const TIMED_CHECK_MET = "A check only a person may pass covers the first page a moment after it loads, with nothing done there, and stays until a person passes it.";

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
 * loads never meets it, and that is not a fault. The same holds for
 * `free-hubs-under-ten`, whose honest path meets it at the price ceiling.
 *
 * The timed check (`state/timed-check.ts`), armed by `free-hubs-under-ten`'s
 * `timed-check` variant, is passed by pressing "Verify you are human". It runs
 * a two-second check and then leaves in place, with no reload, so it is
 * cleared once its question no longer shows; the question stays on screen
 * through the check. Every path meets it, since it comes up on the first page
 * with nothing done there, so its hand-off is `required`.
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
    Object.freeze({
      id: "timed-check",
      description: "A \"Please confirm you are human\" box that covers the page a second and a half after it loads, with nothing done there; pressing Verify you are human runs a two-second check and takes it away in place.",
      shows: "Please confirm you are human",
      steps: Object.freeze([Object.freeze({ action: "click" as const, text: "Verify you are human" })]),
      clears: "in-place" as const,
      clearsWithinMs: 10_000,
    }),
  ]),
  handOffs: Object.freeze([
    Object.freeze({ workflowId: "spain-hubs", person: "completes" as const, required: false, because: "The filters the honest path narrows by are the third results load, which the traffic screen replaces." }),
    Object.freeze({ workflowId: "spain-hubs", variantId: "list-layout", person: "completes" as const, required: false, because: "The filters the honest path narrows by are the third results load, which the traffic screen replaces." }),
    Object.freeze({ workflowId: "free-hubs-under-ten", person: "completes" as const, required: false, because: "Narrowing the search by free shipping and then a price ceiling makes the ceiling the third results load, which the traffic screen replaces." }),
    Object.freeze({ workflowId: "free-hubs-under-ten", variantId: "timed-check", person: "completes" as const, required: true, because: TIMED_CHECK_MET }),
  ]),
});
