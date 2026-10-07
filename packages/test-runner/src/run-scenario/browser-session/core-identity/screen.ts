import type { RuntimeIdentity } from "./types.js";
/** Closed projection: arbitrary fields never enter evidence. */
export function screenRuntimeIdentity(value: unknown): RuntimeIdentity | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.schema !== 1 || record.protocol !== "fluxiq.core-runtime-identity.v1" || record.normalization !== "reader-payload-v1"
    || typeof record.version !== "string" || !/^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][a-zA-Z0-9.-]+)?$/.test(record.version)
    || typeof record.artifactDigest !== "string" || !/^[a-f0-9]{64}$/.test(record.artifactDigest)) return null;
  return { schema: 1, protocol: record.protocol, version: record.version, normalization: record.normalization, artifactDigest: record.artifactDigest };
}
