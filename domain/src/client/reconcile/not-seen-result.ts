// The result a late copy of a command answered `not_seen` is refused with
// (plan B3, Core C8). The extension told Core it never received the command,
// so Core may make the act again; a copy still on its way must never act after
// that, and is answered with this instead: this domain's not-seen outcome
// (`./not-seen-outcome.ts`) at one instant, naming the command and nothing
// about the page. Core's reconciliation calls it (`notSeenResult`).

import type { ClientGatewayActionResult } from "@fluxiq/client-gateway-websocket";
import { webAutomationNotSeenOutcome } from "./not-seen-outcome";

export function webAutomationNotSeenActionResult(commandId: string, at: number): ClientGatewayActionResult {
  const outcome = webAutomationNotSeenOutcome();
  return {
    commandId,
    status: outcome.status,
    startedAt: at,
    completedAt: at,
    message: outcome.message,
    error: outcome.message,
    failure: outcome.failure,
    payload: { commandId, status: "not_seen" }
  };
}
