// A gateway action result with its trace references set on
// `metadata.trace` (`ClientGatewayTraceResultMetadata`): never a top-level
// key, which Core's durable path refuses, and never on the browser result or
// the recorded event, which travel raw into recordings. Metadata the result
// already has is kept, field by field; only `trace` is set.

import type { ClientGatewayTraceResultMetadata } from "fluxiq/client-gateway";
import type { ClientGatewayActionResult, JsonObject } from "../../shared/protocol";
import { TRACE_METADATA_KEY } from "./metadata-key";

export function withTraceMetadata(result: ClientGatewayActionResult, trace: ClientGatewayTraceResultMetadata): ClientGatewayActionResult {
  const metadata: JsonObject = {};
  for (const [key, value] of Object.entries(result.metadata ?? {})) metadata[key] = value;
  metadata[TRACE_METADATA_KEY] = {
    artifacts: trace.artifacts.map((artifact) => {
      const entry: JsonObject = { sha256: artifact.sha256, mediaType: artifact.mediaType, byteLength: artifact.byteLength, role: artifact.role };
      if (artifact.source !== undefined) entry.source = artifact.source;
      return entry;
    }),
    unavailable: trace.unavailable
  };
  return { ...result, metadata };
}
