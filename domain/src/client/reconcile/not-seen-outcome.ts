// What a command the browser never received is, in this domain's words (plan
// B3, Core C8). Core asked the browser what became of a command whose answer
// never came, and the browser had no record of it: the act never reached the
// page, whatever kind of act it was, so it is a failure that did nothing and
// Core's ordinary retry makes it. Core marks such a result with
// `payload.status: "not_seen"` and its own record; the output dispatcher
// restates it here (`../interrupted-action/dispatch-reading.ts`), and the
// browser answers a late copy of that command with the same outcome rather
// than running it.

import { WEB_AUTOMATION_FAILURE_CODES, webAutomationFailureRecord } from "../../runtime/failure";
import type { WebAutomationInterruptedOutcome } from "../interrupted-action";

export function webAutomationNotSeenOutcome(): WebAutomationInterruptedOutcome {
  const expected = "an answer from the browser for this action";
  const actual = "the browser had no record of the action, so it never reached the page";
  return {
    status: "failed",
    failure: { ...webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.TRANSPORT_TRANSIENT, { expected, actual }), effect: "unacted" },
    message: "The browser never received this action, so it did not act; it may be made again."
  };
}
