// Whether a build may drive a paired browser session: Core's one session rule
// (`clientGatewaySessionEligible`: ready, still connected, not recording) under
// the web criteria (`./criteria.ts`). The evidence tools
// (`../llm-evidence/tools.ts`) list sessions by it; the pick a build, a
// snapshot, an output and a host lease use is `./pick-web-session.ts`.

import { clientGatewaySessionEligible, type ClientGatewaySession } from "@fluxiq/client-gateway-websocket";
import { WEB_AUTOMATION_SESSION_CRITERIA } from "./criteria";

/** Whether a build may drive `session`; with `alsoDeclaring` named, the session must also declare that capability id. */
export function isEligibleWebSession(session: ClientGatewaySession, alsoDeclaring?: string): boolean {
  return clientGatewaySessionEligible(session, alsoDeclaring === undefined ? WEB_AUTOMATION_SESSION_CRITERIA : { ...WEB_AUTOMATION_SESSION_CRITERIA, alsoDeclaring });
}
