// The one browser session a web build drives (Core's `pickClientGatewaySession`
// under the web criteria): the requested session only when it is eligible,
// otherwise the only eligible session, otherwise none. The runtime adapter's
// snapshot, the output dispatcher and the host-resource lease all pick by it,
// so a session Core would refuse a command to (`requireReady`) is never chosen
// and an unpaired or recording second session never blocks the choice.

import { pickClientGatewaySession, type ClientGatewaySession } from "@fluxiq/client-gateway-websocket";
import { WEB_AUTOMATION_SESSION_CRITERIA } from "./criteria";
import { isEligibleWebSession } from "./eligible-web-session";
import { leasedWebSessionId } from "./leased-web-session";

export function pickWebAutomationSession(sessions: readonly ClientGatewaySession[], requestedSessionId?: string): ClientGatewaySession | undefined {
  const leased = leasedWebSessionId();
  if (leased !== undefined) {
    if (requestedSessionId !== undefined && requestedSessionId !== leased) return undefined;
    return sessions.find((session) => session.sessionId === leased && isEligibleWebSession(session));
  }
  // Engine-managed browsers belong to their run leases. A person's independent
  // builder must not acquire the same browser under another resource key.
  return pickClientGatewaySession(sessions.filter((session) => session.managedHostId === undefined), requestedSessionId === undefined ? WEB_AUTOMATION_SESSION_CRITERIA : { ...WEB_AUTOMATION_SESSION_CRITERIA, requestedSessionId });
}
