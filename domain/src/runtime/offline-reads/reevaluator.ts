// The web domain's offline reevaluator (traces and offline trials, P5, tier 2;
// D31-D34, D37): answers a changed read from the page snapshot recorded with
// the replaced read's own result, run in a sandboxed page a host with a
// browser provides. It is the port Core's trace matcher asks
// (`ClientGatewayTraceReevaluator`), and it reads every payload Core hands it
// as untyped data.
//
// The rule (D37, differential dynamic content). A static snapshot cannot say
// by itself whether the live page would have shown more, so the recorded
// command is replayed over the same snapshot as a control, beside the changed
// read. The changed read is answered only when
//   (a) the control reproduces the recorded result -- status, failure code,
//       the value or records read, and the extraction summary's counts, never
//       timings, addresses or ids (`./control-reproduced.ts`) -- so the
//       snapshot is the page the recorded read saw, as far as it looked; and
//   (b) the changed read asked the page for no more than the control did (held
//       navigations and scrolls past the end not above the control's), or the
//       recorded read proves its list ended (`./recorded-list-ended.ts`).
// Otherwise the answer is a `dynamic_content` gap, as it is for a sandbox
// breach in either run (a page script ran, a request leaked) and for a changed
// read whose target was not found or not shown, whose wait ran out, or whose
// list never appeared (`./dynamic-content.ts`). A recorded read that failed is
// no obstacle by itself: a read that ended `failed` with its rows is answered
// when its control fails the same way with the same rows.
//
// In order: a command the domain does not evaluate offline is `declined` (not
// a readable command, rejected by the domain, an act, a difference outside
// parameters and target); a recorded command that cannot be read back as the
// same action is an `incomplete_capture` gap (without it there is no control);
// a snapshot that cannot be had is a `snapshot_unavailable` gap; a page that
// cannot run either read gives its own reason; then the rule above; anything
// else is answered with the builder's result (`./answered-result.ts`). A page
// or a store that throws is left to throw: the matcher reads a reevaluator
// failure as a gap, never a pass (D33), and keeps its message.

import type { ClientGatewayTraceMatcherGapReason, ClientGatewayTraceReevaluation, ClientGatewayTraceReevaluationRequest, ClientGatewayTraceReevaluator } from "fluxiq/client-gateway";
import type { WebAutomationActionCommand } from "../../actions/types";
import { webAutomationActionFromGatewayCommand } from "../../client";
import { webOfflineReadAnsweredResult } from "./answered-result";
import { webOfflineReadDynamicContent } from "./dynamic-content";
import { webOfflineReadEligible } from "./read-eligibility";
import { webOfflineReadGatewayCommand } from "./command-payload";
import { webOfflineReadRecordedSnapshot } from "./recorded-snapshot";
import type { WebSnapshotPage } from "./snapshot-page";

export function createWebOfflineReadReevaluator(page: WebSnapshotPage): ClientGatewayTraceReevaluator {
  return {
    reevaluate: async (request: ClientGatewayTraceReevaluationRequest): Promise<ClientGatewayTraceReevaluation> => {
      const action = actionOf(request.command);
      if (action === undefined || !webOfflineReadEligible(action.actionType, request.fields)) return { status: "declined" };
      const gap = (reason: ClientGatewayTraceMatcherGapReason): ClientGatewayTraceReevaluation => ({ status: "gap", reason, fields: [...request.fields] });
      const recordedAction = actionOf(request.recordedCommand);
      if (recordedAction === undefined || recordedAction.actionType !== action.actionType) return gap("incomplete_capture");
      const snapshot = await webOfflineReadRecordedSnapshot(request);
      if (snapshot === undefined) return gap("snapshot_unavailable");
      const control = await page.evaluate(snapshot, recordedAction);
      if (control.status === "unavailable") return gap(control.reason);
      const changed = await page.evaluate(snapshot, action);
      if (changed.status === "unavailable") return gap(changed.reason);
      if (webOfflineReadDynamicContent({ changed, control, changedAction: action, controlAction: recordedAction, recordedResult: request.recordedResult })) return gap("dynamic_content");
      return { status: "answered", result: webOfflineReadAnsweredResult(changed.result, request.recordedResult) };
    }
  };
}

/** The action a command payload maps to; `undefined` for one that is not a readable command or that the domain rejects. */
function actionOf(payload: ClientGatewayTraceReevaluationRequest["recordedCommand"]): WebAutomationActionCommand | undefined {
  const command = webOfflineReadGatewayCommand(payload);
  if (command === undefined) return undefined;
  const action = webAutomationActionFromGatewayCommand(command);
  return "status" in action ? undefined : action;
}
