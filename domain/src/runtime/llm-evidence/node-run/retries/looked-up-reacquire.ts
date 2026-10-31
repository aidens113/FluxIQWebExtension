// An exploration step on a control it named by a handle finds that control
// again (t786, D7).
//
// The handle was bound to a control of the look the call took before acting;
// the resolver wrote that control's identity and selector into the step. When
// the page re-renders before the command lands -- a list redrawn, a card
// re-keyed -- the selector names nothing or another node and every retry
// fails, although the control is still there under a new handle. So, once Core
// asks: the page is looked at again (`./look.ts`, under the same default
// retries, until a look shows a control that could be it), the control is
// matched among the fresh look's controls by its identity signals
// (`runtime/target-reacquire/element-match.ts`, never by handle, selector or
// position), and the remaining attempts are dispatched on the fresh control's
// identity and selector. Only controls in the step's own frame are candidates.
// The fresh look is remembered as a look taken, as every look before acting is.
//
// The caller takes the look (`../run.ts`, its own page read), so this file
// imports no capture and closes no module cycle through the run. A look that
// throws is not read as "nothing there": it propagates, and Core's callback
// answers `unavailable` (`./reacquire.ts`).

import type { JsonObject } from "fluxiq/core";
import { webAutomationOutputNodeDefinitions } from "../../../../output-nodes";
import { webRefreshTargetIdentity, type WebTargetObservation, type WebTargetScope } from "../../../target-reacquire/identity";
import type { WebLlmSnapshotBinding } from "../../sanitize";
import { isJsonRecord } from "../../untrusted-json";
import type { WebNodeRun } from "../context";
import { webNodeLookUntilPresent } from "./look";
import type { WebNodeReacquire } from "./reacquire";

/**
 * How a step run with the resolved `parameters`, whose control was named by
 * `handle` or its saved identity, finds that control again on the page `look`
 * reads. Missing identity or a state-bound target retains its existing path.
 */
export function webNodeLookedUpReacquire(
  run: Pick<WebNodeRun, "request" | "looked">,
  input: {
    definitionId: string;
    handle: string | undefined;
    parameters: JsonObject;
    before?: WebLlmSnapshotBinding | undefined;
    look: (options?: { includeHidden: true; scope: WebTargetScope }) => Promise<WebLlmSnapshotBinding | undefined>;
  }
): WebNodeReacquire | undefined {
  const { parameters } = input;
  const stale = isJsonRecord(parameters.element) ? parameters.element : undefined;
  const context = isJsonRecord(stale?.context) ? stale.context : undefined;
  const record = isJsonRecord(context?.record) ? context.record : undefined;
  const tab = parameters.browserTabId ?? parameters.tabId;
  const frame = parameters.browserFrameId ?? parameters.frameId;
  if (stale === undefined || Object.keys(stale).length === 0 || isJsonRecord(parameters.target) || record?.values !== undefined || !SINGLE_CONTROL_NODES.has(input.definitionId)) return undefined;
  const prior = input.before?.captureProvenance;
  return async () => {
    if (run.request.signal?.aborted || prior?.scope.sessionId === undefined || prior.scope.browserTabId === undefined || prior.scope.browserFrameId === undefined || prior.scope.resetResource === undefined || prior.scope.location === undefined || prior.scope.timeOrigin === undefined) return { outcome: "unavailable" };
    if ((prior.scope.browserFrameId !== 0 || parameters.browserFrameUrlPath !== undefined) && (prior.scope.kind !== "single-frame" || prior.coverage !== "complete" || !prior.includesHidden)) return { outcome: "unavailable" };
    if ((tab !== undefined && tab !== prior.scope.browserTabId) || (frame !== undefined && frame !== prior.scope.browserFrameId) || (parameters.browserFrameUrlPath !== undefined && parameters.browserFrameUrlPath !== prior.scope.browserFrameUrlPath)) return { outcome: "unavailable" };
    const scope: WebTargetScope = { ...prior.scope, kind: "single-frame" };
    const match = (page: WebLlmSnapshotBinding) => webRefreshTargetIdentity({ parameters, observation: observed(page, prior.scope) });
    const looked = await webNodeLookUntilPresent(run, input.definitionId, () => input.look({ includeHidden: true, scope }), (page) => page === undefined || match(page).outcome === "gone");
    const page = looked.seen;
    if (run.request.signal?.aborted || page === undefined) return { outcome: "unavailable" };
    run.looked(page);
    const answer = match(page);
    if (run.request.signal?.aborted) return { outcome: "unavailable" };
    if (answer.outcome === "found") return { outcome: "found", parameters: { ...parameters, selector: answer.target.selector, element: answer.target.element as unknown as JsonObject } };
    if (answer.outcome === "gone") return { outcome: "gone" };
    return { outcome: answer.outcome };
  };
}

const SINGLE_CONTROL_NODES = new Set(webAutomationOutputNodeDefinitions.filter((definition) => ["selector", "element"].every((id) => definition.parameters.some((parameter) => parameter.id === id && parameter.targetRefresh === true))).map((definition) => definition.id));

/** Use the capture's private coverage claims and compare its actual document with the prior capture. */
function observed(page: WebLlmSnapshotBinding, before: WebTargetScope): WebTargetObservation {
  const provenance = page.captureProvenance;
  const now = provenance?.scope;
  const observation: WebTargetObservation = { page, scope: now ?? { kind: "single-frame" }, coverage: provenance?.coverage ?? "unknown", includesHidden: provenance?.includesHidden === true, samePlace: "unknown" };
  if (now?.sessionId === undefined || now.resetResource === undefined || now.browserTabId === undefined || now.browserFrameId === undefined || now.location === undefined || now.timeOrigin === undefined) return observation;
  observation.samePlace = before.sessionId === now.sessionId && before.resetResource === now.resetResource && before.browserTabId === now.browserTabId && before.browserFrameId === now.browserFrameId && before.location === now.location && before.timeOrigin === now.timeOrigin ? "yes" : "no";
  return observation;
}
