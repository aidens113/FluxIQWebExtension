// Which paired browser a host lease is granted on: the one session a build may
// drive, picked by the rule every web path uses (`../web-sessions/pick-web-session.ts`).
//
// Exactly one: with none there is no browser to lend, and with two the build
// path refuses to choose, so a lease on either would name a browser the build
// cannot act through.

import type { ClientGatewaySession } from "@fluxiq/client-gateway-websocket";
import { pickWebAutomationSession } from "../web-sessions";

export function webAutomationLeasableSession(sessions: readonly ClientGatewaySession[]): ClientGatewaySession | undefined {
  return pickWebAutomationSession(sessions);
}
