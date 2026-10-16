// Which paired browser a host lease is granted on: the one session a build may
// drive, by the rule the build's evidence tools also use
// (`../web-sessions/eligible-web-session.ts`).
//
// Exactly one: with none there is no browser to lend, and with two the build
// path refuses to choose, so a lease on either would name a browser the build
// cannot act through.

import type { ClientGatewaySession } from "@fluxiq/client-gateway-websocket";
import { isEligibleWebSession } from "../web-sessions";

export function webAutomationLeasableSession(sessions: readonly ClientGatewaySession[]): ClientGatewaySession | undefined {
  const eligible = sessions.filter((session) => isEligibleWebSession(session));
  return eligible.length === 1 ? eligible[0] : undefined;
}
