// The one browser session a web build drives (Core's `pickClientGatewaySession`
// under the web criteria): the requested session only when it is eligible,
// otherwise the only eligible session, otherwise none. The runtime adapter's
// snapshot, the output dispatcher and the host-resource lease all pick by it,
// so a session Core would refuse a command to (`requireReady`) is never chosen
// and an unpaired or recording second session never blocks the choice.

import { pickClientGatewaySession, type ClientGatewaySession } from "@fluxiq/client-gateway-websocket";
import { WEB_AUTOMATION_SESSION_CRITERIA } from "./criteria";

export function pickWebAutomationSession(sessions: readonly ClientGatewaySession[], requestedSessionId?: string): ClientGatewaySession | undefined {
  return pickClientGatewaySession(sessions, requestedSessionId === undefined ? WEB_AUTOMATION_SESSION_CRITERIA : { ...WEB_AUTOMATION_SESSION_CRITERIA, requestedSessionId });
}
