// Whether a lasting act whose acknowledgement was lost took effect, read off the
// page when the step declared nothing to judge it by (t1096, diagnosis of the
// manual run of 2026-11-27, Question 1).
//
// **Why.** The declared check (`./effect-check.ts`) judges only a step's own
// `expectedState`, and a step that wrote none got `unknown`. A press on a list's
// Next whose document reloaded under it lost both its answer and the look after
// it, so Core held a page turn that had landed as `uncertain`, and the model was
// handed a question the page could answer: the address had gained `page=2`, the
// pager marked page 2 current, and the rows were the next page's.
//
// **What is compared.** The page the call found (the call's own record,
// `found`, read before its command went out) with the page the act left, read
// the way the run reads it after any act: waiting out a page between two
// documents (`../../capture.ts`, `captureAfterAction`), with its window, no
// other. The address, the controls marked current and the first row
// (`./page-move.ts`).
//
// **The verdicts.**
//
//  - `landed` when any of the three moved. For every act, not only a page
//    turn: a change can prove an act landed.
//  - `not_landed` only for a page turn, and only when the page answered and
//    nothing moved: the same address, the same marks, and the same rows in the
//    same order, at least one of them. An unchanged list is the Next page verb's
//    own definition of failure (`list_unchanged`), so pressing it again is not a
//    second act. A page turn is `web.dom.next_page`, or a plain press on the
//    control a detected list names as its Next (`pager`, which the caller learns
//    from the detection's bindings: `../list-pages/turned-lists.ts`). Any other
//    act that changed nothing stays `unknown`: no change does not prove a press
//    did not land.
//  - `unknown` when the call found no page, when no page could be read after
//    it, or when what changed proves neither.
//
// Never shown to the model: nothing here leaves the domain but the verdict, and
// the page the act left is read again by the run itself when it counts as done.

import type { AutomationStudioLastingActCheck } from "fluxiq/automation";
import { captureAfterAction, type WebLlmAfterActionTiming } from "../../capture";
import type { WebLlmSnapshotBinding } from "../../sanitize";
import type { WebNodeRun } from "../context";
import type { WebNodeDispatchResult } from "./dispatch";
import { webNodePageMove } from "./page-move";

/** The verb whose unchanged page proves it did not happen (header). */
const PAGE_TURN_ACTION = "web.dom.next_page";

/**
 * The check Core asks of an uncertain act: the step's declared check first,
 * and where that cannot say, the page (header). `act` is the command's verb and
 * whether it presses a detected list's Next (`pager`). `found` is read when Core
 * asks, from the call's own record, so a page read just before the command went
 * out is the one compared. `timing` is the after-action wait's own, for tests.
 */
export function webNodePageEffectCheck(
  run: Pick<WebNodeRun, "gateway" | "sessionId" | "request">,
  act: { actionType: string; pager?: boolean | undefined },
  found: () => WebLlmSnapshotBinding | undefined,
  declared?: AutomationStudioLastingActCheck<WebNodeDispatchResult>,
  timing?: WebLlmAfterActionTiming
): AutomationStudioLastingActCheck<WebNodeDispatchResult> {
  const pageTurn = act.actionType === PAGE_TURN_ACTION || act.pager === true;
  return async (result, attempt) => {
    const said = declared === undefined ? "unknown" : await askedOrUnknown(run, () => declared(result, attempt));
    if (said !== "unknown") return said;
    const before = found();
    if (before === undefined) return "unknown";
    const after = await askedOrUnknown(run, () => captureAfterAction(run.gateway, run.sessionId, run.request, run.request.signal, undefined, timing));
    if (after === undefined || after === "unknown") return "unknown";
    return webNodePageMove(before, after, pageTurn);
  };
}

/** What `ask` answered, or `unknown` when it threw: a check that broke says nothing about the page. Cancellation still ends the call. */
async function askedOrUnknown<T>(run: Pick<WebNodeRun, "request">, ask: () => Promise<T>): Promise<T | "unknown"> {
  try {
    return await ask();
  } catch (error) {
    if (run.request.signal?.aborted) throw error;
    return "unknown";
  }
}
