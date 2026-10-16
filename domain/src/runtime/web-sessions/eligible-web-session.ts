// The one rule for which paired browser session a build may drive: ready, an
// extension, not recording, and offering this domain's web actions (or the DOM
// snapshot action). The host-resource lease (`../host-resources/leasable-session.ts`)
// and the evidence tools (`../llm-evidence/tools.ts`) both pick sessions by it.

import type { ClientGatewaySession } from "@fluxiq/client-gateway-websocket";
import { WEB_AUTOMATION_DOMAIN_ID } from "../../constants";

/** Whether a build may drive `session`; with `alsoDeclaring` named, the session must also declare that capability id. */
export function isEligibleWebSession(session: ClientGatewaySession, alsoDeclaring?: string): boolean {
  return session.status === "ready" &&
    session.clientType === "extension" &&
    !session.activeRecordingId &&
    session.capabilities.some((capability) =>
      capability.id === "web.actions" &&
      (capability.metadata?.domainId === WEB_AUTOMATION_DOMAIN_ID || capability.actionTypes?.includes("web.dom.capture_snapshot"))
    ) &&
    (alsoDeclaring === undefined || session.capabilities.some((capability) => capability.id === alsoDeclaring));
}
