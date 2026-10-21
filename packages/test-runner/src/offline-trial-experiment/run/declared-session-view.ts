// The browser extension's session view as the product declares it: the view
// the experiment supplies to Core's offline runner (`sessionView`) for a
// source trace that recorded none.
//
// A trace records the view of the session it stands for when the session is
// first claimed (`session.claimed`, D23). Traces captured before that record
// existed -- every round-4 trace -- hold no such event, so Core's runner uses
// the view its caller supplies, says so in its outcome (`sessionView:
// "supplied"`, with a declared normalization), and refuses the trial when it
// is given none. A recorded view always wins over a supplied one.
//
// In a build, the supplied view is the live session's public view for the same
// client. Offline there is no live session, so the experiment supplies what
// the extension itself says in its hello
// (`apps/extension/src/background/connection/gateway-session.ts`,
// `extensionHello`): client type `extension`, the domain's client capabilities
// and its domain id; the browser descriptor and capture settings are left out
// because nothing recorded them.

import { WEB_AUTOMATION_DOMAIN_ID, webAutomationClientCapabilities } from "@fluxiq-web-extension/domain/node";
import type { ClientGatewayClientHello } from "fluxiq/client-gateway";

export const DECLARED_EXTENSION_SESSION_VIEW: ClientGatewayClientHello = Object.freeze({
  clientType: "extension",
  name: "FluxIQ Browser Extension",
  capabilities: structuredClone(webAutomationClientCapabilities),
  metadata: { domainId: WEB_AUTOMATION_DOMAIN_ID },
});
