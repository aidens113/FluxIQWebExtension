// What an interrupted command is reported to Core as (plan B3, Core C8).
//
// The browser's background worker stopped, or its channel to the page closed,
// while the command was in flight: the browser does not know whether the act
// happened, and a missing acknowledgement is `unknown`, never "did not happen".
// The wire's status vocabulary has no `interrupted` (Core
// `ClientGatewayActionResult`, whose durable ledger refuses any other word), so
// the browser's own account rides in the payload -- `status: "interrupted"`,
// `effect: "unknown"` -- and the wire status says what Core must do with it:
//
//  - **A committing act** answers `unknown` with `web.action.unknown`, effect
//    `ambiguous`: Core holds it as uncertain and runs the effect check before
//    any retry, route or alternative. It is never made again blindly.
//  - **Every other act** answers `failed` with `web.transport.transient`,
//    effect `unacted`: it sets a state rather than commits one, so making it
//    again under the first attempt and three retries cannot do anything twice.
//
// The same outcome is built in the extension, from the record it kept, and in
// the domain's output dispatcher, from the command it sent
// (`io/gateway-output-dispatcher.ts`), so the dispatcher's answer is the one
// Core acts on even if the two ever disagreed.

import type { AutomationStudioFailureRecord } from "fluxiq/automation-studio";
import { WEB_AUTOMATION_FAILURE_CODES, webAutomationFailureRecord } from "../../runtime/failure";

/** The wire status, record and words for an interrupted command. */
export type WebAutomationInterruptedOutcome = {
  status: "unknown" | "failed";
  failure: AutomationStudioFailureRecord;
  message: string;
};

export function webAutomationInterruptedOutcome(committing: boolean): WebAutomationInterruptedOutcome {
  const expected = "an answer from the browser for this action";
  if (committing) {
    const actual = "the browser was interrupted while the action was in flight, so whether it took effect is unknown";
    return {
      status: "unknown",
      failure: { ...webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.UNKNOWN, { expected, actual }), effect: "ambiguous" },
      message: "The browser was interrupted while this action was in flight; whether it took effect is unknown, so it was not made again."
    };
  }
  const actual = "the browser was interrupted while the action was in flight";
  return {
    status: "failed",
    failure: { ...webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.TRANSPORT_TRANSIENT, { expected, actual }), effect: "unacted" },
    message: "The browser was interrupted while this action was in flight; it changes nothing that lasts, so it may be made again."
  };
}
