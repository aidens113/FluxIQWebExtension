// Which paired browser a host lease is granted on: the one session a build may
// drive, by the same rule the build's evidence tools use
// (`../llm-evidence/tools.ts`, `eligibleWebSessionIds`) -- ready, an extension,
// not recording, and offering this domain's web actions. That function is
// private to the evidence tools, so the rule is restated here; a change to one
// must be made to the other.
//
// Exactly one: with none there is no browser to lend, and with two the build
// path refuses to choose, so a lease on either would name a browser the build
// cannot act through.

import type { ClientGatewaySession } from "@fluxiq/client-gateway-websocket";
import { WEB_AUTOMATION_DOMAIN_ID } from "../../constants";

export function webAutomationLeasableSession(sessions: readonly ClientGatewaySession[]): ClientGatewaySession | undefined {
  const eligible = sessions.filter((session) =>
    session.status === "ready" &&
    session.clientType === "extension" &&
    !session.activeRecordingId &&
    session.capabilities.some((capability) =>
      capability.id === "web.actions" &&
      (capability.metadata?.domainId === WEB_AUTOMATION_DOMAIN_ID || capability.actionTypes?.includes("web.dom.capture_snapshot"))
    )
  );
  return eligible.length === 1 ? eligible[0] : undefined;
}
