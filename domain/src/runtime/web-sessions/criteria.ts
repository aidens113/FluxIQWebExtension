// What a web build needs of a client session, in the terms of Core's one
// session rule (`clientGatewaySessionEligible`, which adds ready, still
// connected and not recording): the extension, offering this domain's web
// actions or the DOM snapshot action.

import type { ClientGatewaySessionCriteria } from "@fluxiq/client-gateway-websocket";
import { WEB_AUTOMATION_DOMAIN_ID } from "../../constants";

export const WEB_AUTOMATION_SESSION_CRITERIA: Readonly<ClientGatewaySessionCriteria> = Object.freeze({
  clientType: "extension",
  serves: (capability) =>
    capability.id === "web.actions" &&
    (capability.metadata?.domainId === WEB_AUTOMATION_DOMAIN_ID || capability.actionTypes?.includes("web.dom.capture_snapshot") === true)
});
