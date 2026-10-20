// The browser's host-lease ledger (automation-project-agents plan, `Extension
// And Domain Wiring` 1): Core's `ClientGatewayHostLeaseLedger` -- the highest
// lease seen per resource, against which every leased command is judged -- kept
// in the browser's session storage beside the in-flight records
// (`../in-flight/record-area.ts`), under Core's default `fluxiq.hostLease.`
// keys, the ones earlier builds wrote. A restarted service worker therefore
// still knows which epoch is current: without it, a stale builder's late
// command reaching a fresh worker would be adopted as a new grant.

import { ClientGatewayHostLeaseLedger, type ClientGatewayStorageArea } from "@fluxiq/client-gateway-websocket";
import { inFlightRecordArea } from "../in-flight/index";

export function sessionHostLeaseLedger(area: ClientGatewayStorageArea = inFlightRecordArea()): ClientGatewayHostLeaseLedger {
  return new ClientGatewayHostLeaseLedger(area);
}
