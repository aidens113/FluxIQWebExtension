// A lasting act whose outcome is uncertain, told to the model as that (t361).
//
// Core does not make a lasting act again when its failure leaves the effect
// unknown, and says so on the dispatch's outcome (`lastingAct: "uncertain"`,
// `./dispatch.ts`, t359). Until this file the build's exploration and its
// own test runs read only the failure under it, so the model was told the step
// failed in the words of that failure -- `channel_to_page_failed` even says
// "run it again" -- when what is true is that the step may already have
// happened and was deliberately not repeated. A press of Add to cart that the
// model then repeats is the second item in the cart the rule exists to stop.
//
// The code stays the failure's own, so nothing that reads codes changes; the
// reason becomes `outcome_uncertain`, whose `next` says in plain words what
// happened and what to do (`../../tool-rejection.ts`).

import { webActionFailureRefusal, type WebActionRefusal, type WebFailedActionResult } from "../../action-failure";
import { rejectionDetail } from "../../tool-rejection";
import type { WebNodeRetriedDispatch } from "./dispatch";

/**
 * The refusal a node's failed dispatch is reported as: the failure's own,
 * unless Core settled it as a lasting act whose outcome is uncertain, which
 * then says so instead of whatever the failure's reason implied.
 */
export function webNodeFailureRefusal(result: WebFailedActionResult, lastingAct: WebNodeRetriedDispatch["lastingAct"]): WebActionRefusal {
  const refused = webActionFailureRefusal(result);
  if (lastingAct !== "uncertain") return refused;
  return { ...refused, detail: rejectionDetail({ reason: "outcome_uncertain", target: undefined, instead: undefined, missing: undefined, requestId: undefined }) };
}
