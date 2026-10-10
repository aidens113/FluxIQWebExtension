// The gateway result the extension sends for a command it found still in
// flight when its background worker started again (plan B3): the outcome
// `./outcome.ts` decides, with the browser's own account in the payload.
//
// The payload names the command and nothing about the page: no tab, no frame,
// no document, no address. Those stay in the extension's session storage,
// where the record that found the interruption lives.

import type { ClientGatewayActionResult } from "@fluxiq/client-gateway-websocket";
import { webAutomationInterruptedOutcome } from "./outcome";

/** The browser's word for a command its background worker lost, carried in the result's payload. */
export const WEB_AUTOMATION_INTERRUPTED_STATUS = "interrupted";

/** What the extension kept about a command while it was in flight, as far as the result needs it. */
export type WebAutomationInFlightCommand = {
  commandId: string;
  actionType: string;
  committing: boolean;
  startedAt: number;
};

export function webAutomationInterruptedActionResult(command: WebAutomationInFlightCommand, completedAt: number): ClientGatewayActionResult {
  const outcome = webAutomationInterruptedOutcome(command.committing);
  return {
    commandId: command.commandId,
    status: outcome.status,
    startedAt: command.startedAt,
    completedAt,
    message: outcome.message,
    error: outcome.message,
    failure: outcome.failure,
    payload: {
      commandId: command.commandId,
      actionType: command.actionType,
      status: WEB_AUTOMATION_INTERRUPTED_STATUS,
      effect: "unknown",
      startedAt: command.startedAt
    }
  };
}
