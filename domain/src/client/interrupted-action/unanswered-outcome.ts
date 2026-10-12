// What a required (durable) command whose outcome stayed unknown is reported
// to Core as (plan C8, t427).
//
// The answer never came, the browser could not say what became of the command
// when asked by its id, and Core's command ledger holds its outcome `unknown`.
// Whether the act took effect is not known, whatever kind of act it was, so it
// is `unknown` with `web.action.unknown`, effect `ambiguous`: Core's required
// run stops there as Outcome uncertain, after its page check says what the page
// shows, and never makes the act again.

import { WEB_AUTOMATION_FAILURE_CODES, webAutomationFailureRecord } from "../../runtime/failure";
import type { WebAutomationInterruptedOutcome } from "./outcome";

export function webAutomationUnansweredOutcome(): WebAutomationInterruptedOutcome {
  const expected = "an answer from the browser for this action";
  const actual = "no answer came, and the browser could not say what became of the action";
  return {
    status: "unknown",
    failure: { ...webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.UNKNOWN, { expected, actual }), effect: "ambiguous" },
    message: "No answer came for this action and the browser could not say what became of it; whether it took effect is unknown, so it was not made again."
  };
}
