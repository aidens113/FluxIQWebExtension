// Whether each credential-bearing protocol message a trace holds carries the
// credential redaction the gateway tap applies (D7): the field replaced and a
// declared `credential` redaction naming it. The message types and fields are
// the tap's own list (`client-gateway/service/trace-tap/credential-fields.ts`
// in Core), restated here because the tap does not export it.

import type { ClientGatewayTraceEvent } from "fluxiq/client-gateway";
import type { TraceCredentialRedactions } from "./types.js";

const CREDENTIAL_POINTERS: Readonly<Record<string, string>> = Object.freeze({
  "client.hello": "/payload/token",
  "client.pairing_submit": "/payload/pairingCode",
  "server.session_ready": "/payload/token"
});

/** Per credential-bearing message type: how many events the trace holds, and how many carry the credential redaction. */
export function traceCredentialRedactions(events: readonly ClientGatewayTraceEvent[]): TraceCredentialRedactions {
  const counts: Record<string, { events: number; redacted: number }> = {};
  for (const type of Object.keys(CREDENTIAL_POINTERS)) counts[type] = { events: 0, redacted: 0 };
  for (const event of events) {
    const pointer = event.messageType === null ? undefined : CREDENTIAL_POINTERS[event.messageType];
    const count = event.messageType === null ? undefined : counts[event.messageType];
    if (pointer === undefined || count === undefined) continue;
    count.events += 1;
    const declared = event.redactions.some(redaction => redaction.reason === "credential" && redaction.path === pointer);
    if (declared && event.payload.encoding !== "text") count.redacted += 1;
  }
  return Object.freeze(Object.fromEntries(Object.entries(counts).map(([type, count]) => [type, Object.freeze(count)])));
}
