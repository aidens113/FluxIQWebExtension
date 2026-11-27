// The web host's `reachRouteEffect` (t1083): Core passes over a step whose page
// never came, and that step's recorded effect moved the page to another route,
// which the steps after it were written on. Core asks the host to bring the page
// there and answers how (`fluxiq/runtime/automation-host`, `contracts/route-reach.ts`).
//
// Bigbox `run-mwz29d50-c3a32a9c`: the drawer an Add opens never came because the
// Add was already done, so the drawer's "View cart" was passed over and the cart
// read ran on the product page. The product page's header has the same cart link.
//
// In order, as the brief and the effect allow:
//
//   1. `stays` when the effect moved to no other route (`./owed-route.ts`): a
//      drawer's Close, a cover's dismiss. Nothing is looked at.
//   2. `already_there` when the page is on the route.
//   3. `pressed` when a link on the page goes to the route (`./route-link.ts`),
//      a press of it was answered, and the page is then on the route.
//   4. `went` when the effect kept its destination, the domain's navigate output
//      went there -- a move, never a lasting act, as a replay's reset is
//      (`../target-reacquire/return-to-source-place.ts`) -- and the page is then
//      on the route.
//   5. `unreached` otherwise, and when the page could not be read: Core then
//      leaves the step to its other cases rather than send the run on from a
//      page it is not on. A snapshot the packet refuses throws, which Core reads
//      the same way.
//
// Each command is bounded by the timeout that command already has on this host:
// a page read or a press as a policy action's, a navigation as a reset's. Nothing
// here waits, retries or counts.

import type { AutomationStudioRouteReachAnswer, AutomationStudioRouteReachRequest } from "fluxiq/runtime/automation-host";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_DOMAIN_ID } from "../../constants";
import { sanitizeWebLlmSnapshotWithBindings, type WebLlmSnapshotBinding } from "../llm-evidence";
import { webOwedRoute } from "./owed-route";
import { webRouteLinkSelector } from "./route-link";

const SNAPSHOT_OUTPUT_ID = "web.dom.capture_snapshot";
const CLICK_OUTPUT_ID = "web.dom.click";
const NAVIGATE_OUTPUT_ID = "web.browser.navigate";
const SOURCE = "web-automation-host-runtime";
/** A page read's and a press's bound on this host: Core's default policy action command timeout (`../host-runtime.ts`). */
const COMMAND_TIMEOUT_MS = 5_000;
/** A navigation's bound, the one a reset's move has (`../target-reacquire/return-to-source-place.ts`). */
const NAVIGATE_TIMEOUT_MS = 15_000;

/** How the host reaches the paired browser: an output dispatched by id. */
export type WebRouteReachDispatch = (request: { outputId: string; payload: JsonObject; metadata: JsonObject; timeoutMs?: number; signal?: AbortSignal }) => Promise<{ ok: boolean; status?: string | undefined; payload?: JsonObject | undefined }>;

/** Brings the page to the route `request.effect` went to, and says how (header). */
export async function webAutomationReachRouteEffect(request: AutomationStudioRouteReachRequest, dispatch: WebRouteReachDispatch): Promise<AutomationStudioRouteReachAnswer> {
  const route = webOwedRoute(request.effect);
  if (route === undefined) return "stays";
  const metadata: JsonObject = { source: SOURCE, domainId: WEB_AUTOMATION_DOMAIN_ID, nodeId: request.node.id, point: "reach_route" };
  const signal = request.signal ? { signal: request.signal } : {};
  const look = async (): Promise<WebLlmSnapshotBinding | undefined> => {
    const looked = await dispatch({ outputId: SNAPSHOT_OUTPUT_ID, payload: {}, timeoutMs: COMMAND_TIMEOUT_MS, metadata, ...signal });
    return answered(looked) ? bindingOf(looked.payload) : undefined;
  };
  const page = await look();
  if (page === undefined) return "unreached";
  if (route.holds(page.evidence.location)) return "already_there";
  const selector = webRouteLinkSelector(page, route);
  if (selector !== undefined) {
    const pressed = await dispatch({ outputId: CLICK_OUTPUT_ID, payload: { selector }, timeoutMs: COMMAND_TIMEOUT_MS, metadata, ...signal });
    const after = answered(pressed) ? await look() : undefined;
    if (after !== undefined && route.holds(after.evidence.location)) return "pressed";
  }
  const destination = route.resolved(page.evidence.location);
  if (destination === undefined) return "unreached";
  const went = await dispatch({ outputId: NAVIGATE_OUTPUT_ID, payload: { url: destination }, timeoutMs: NAVIGATE_TIMEOUT_MS, metadata, ...signal });
  const arrived = answered(went) ? await look() : undefined;
  return arrived !== undefined && route.holds(arrived.evidence.location) ? "went" : "unreached";
}

/** Whether a dispatched command was answered with success. */
function answered(result: { ok: boolean; status?: string | undefined }): boolean {
  return result.ok && (result.status === undefined || result.status === "succeeded");
}

/** The page a dispatched snapshot read, as the model would be shown it, or nothing when the answer carried no snapshot; one the packet refuses throws (header). */
function bindingOf(payload: JsonObject | undefined): WebLlmSnapshotBinding | undefined {
  const result = payload?.result;
  const snapshot = typeof result === "object" && result !== null && !Array.isArray(result) ? result.snapshot : undefined;
  return snapshot === undefined ? undefined : sanitizeWebLlmSnapshotWithBindings(snapshot);
}
