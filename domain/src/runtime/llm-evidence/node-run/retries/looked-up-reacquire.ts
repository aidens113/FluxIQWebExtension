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
import type { AutomationStudioTargetReacquireAnswer } from "fluxiq/automation-studio";
import { webReacquireElement } from "../../../target-reacquire";
import { webPacketElementFingerprint } from "../../packet-fingerprint";
import type { WebLlmSnapshotBinding } from "../../sanitize";
import { isJsonRecord } from "../../untrusted-json";
import type { WebNodeRun } from "../context";
import { webNodeLookUntilPresent } from "./look";
import type { WebNodeReacquire } from "./reacquire";

/**
 * How a step run with the resolved `parameters`, whose control was named by
 * `handle`, finds that control again on the page `look` reads (restamped, as
 * every look is); nothing for a step that named no handle,
 * carries no identity, or is bound to run state rather than to a control.
 */
export function webNodeLookedUpReacquire(
  run: Pick<WebNodeRun, "request" | "looked">,
  input: { definitionId: string; handle: string | undefined; parameters: JsonObject; look: () => Promise<WebLlmSnapshotBinding | undefined> }
): WebNodeReacquire | undefined {
  const { parameters } = input;
  const stale = isJsonRecord(parameters.element) ? parameters.element : undefined;
  if (input.handle === undefined || stale === undefined || isJsonRecord(parameters.target)) return undefined;
  const frame = typeof parameters.browserFrameId === "number" ? parameters.browserFrameId : 0;
  const match = (page: WebLlmSnapshotBinding) => matched(page, stale, frame);
  return async () => {
    const looked = await webNodeLookUntilPresent(run, input.definitionId, input.look, (page) => page === undefined || match(page).answer.outcome === "gone");
    const page = looked.seen;
    if (page === undefined) return { outcome: "unavailable" };
    run.looked(page);
    const { answer, fresh } = match(page);
    // The fresh control's identity whole -- none of the stale one's address or place survives -- in the step's own
    // frame, so its frame keys stand; a step that reads its control's words as its value still says so (`readsWords`).
    const reads = stale.readsWords === true ? { readsWords: true } : {};
    if (fresh !== undefined) return { outcome: "found", parameters: { ...parameters, selector: fresh.selector, element: { ...fresh.element, ...reads } } };
    return answer.outcome === "gone" ? { outcome: "gone" } : { outcome: "unmatched" };
  };
}

type Fresh = { selector: string; element: JsonObject };

/** The fresh look's controls in the step's frame, as identities, and which of them is the stale control. */
function matched(page: WebLlmSnapshotBinding, stale: JsonObject, frame: number): { answer: AutomationStudioTargetReacquireAnswer; fresh: Fresh | undefined } {
  const candidates: Fresh[] = [];
  for (const element of page.evidence.elements) {
    const selector = page.selectors.get(element.target);
    if (selector === undefined || (element.frameId ?? 0) !== frame) continue;
    const identity = webPacketElementFingerprint(element, {
      selector,
      shadowHosts: page.shadowHosts?.get(element.target),
      dialog: page.dialogNames?.get(element.target),
      drawing: page.drawings?.get(element.target)
    });
    candidates.push({ selector, element: identity as unknown as JsonObject });
  }
  const answer = webReacquireElement({ stale, candidates: candidates.map((candidate) => candidate.element) });
  const fresh = answer.outcome === "found" ? candidates.find((candidate) => candidate.element === answer.value) : undefined;
  return { answer, fresh };
}
