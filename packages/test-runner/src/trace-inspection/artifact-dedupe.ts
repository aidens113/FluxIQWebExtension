// Artifact bytes over several traces: what every trace references, and what
// the content store needs once each digest is kept a single time (the content
// store is content addressed; a resource several traces claim is held once).

import type { ClientGatewayTraceArtifactPresence } from "fluxiq/client-gateway";
import type { TraceArtifactDedupe } from "./types.js";

export function traceArtifactDedupe(perTrace: readonly (readonly ClientGatewayTraceArtifactPresence[])[]): TraceArtifactDedupe {
  let references = 0;
  let referencedBytes = 0;
  const distinct = new Map<string, number>();
  for (const artifacts of perTrace) {
    for (const artifact of artifacts) {
      references += 1;
      referencedBytes += artifact.byteLength;
      distinct.set(artifact.sha256, artifact.byteLength);
    }
  }
  const distinctBytes = [...distinct.values()].reduce((sum, bytes) => sum + bytes, 0);
  return Object.freeze({ references, referencedBytes, distinct: distinct.size, distinctBytes });
}
