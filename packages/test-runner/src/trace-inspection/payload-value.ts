// A trace event's payload as a value: a structured copy as it is, raw text
// parsed as the JSON message it was received as. Raw text that is not JSON is
// reported as unparsable, by name, so a caller counts it rather than reading
// it as a message that carried nothing. Core stores an unparsable inbound
// message as structured JSON with a secret redaction (D18), so a text payload
// that does not parse is itself worth counting.

import type { ClientGatewayTracePayload } from "fluxiq/client-gateway";

export type TracePayloadValue = { readonly kind: "value"; readonly value: unknown } | { readonly kind: "none" } | { readonly kind: "unparsable" };

const NONE: TracePayloadValue = Object.freeze({ kind: "none" });
const UNPARSABLE: TracePayloadValue = Object.freeze({ kind: "unparsable" });

export function tracePayloadValue(payload: ClientGatewayTracePayload): TracePayloadValue {
  if (payload.encoding === "json") return { kind: "value", value: payload.value };
  if (payload.encoding !== "text") return NONE;
  try {
    return { kind: "value", value: JSON.parse(payload.text) as unknown };
  } catch (error) {
    if (error instanceof SyntaxError) return UNPARSABLE;
    throw error;
  }
}
