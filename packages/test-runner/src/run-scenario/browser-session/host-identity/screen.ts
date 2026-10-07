import type { HostBuildIdentity } from "./types.js";
/** Closed public descriptor; no raw module inputs or page data enter evidence. */
export function screenHostIdentity(value: unknown): HostBuildIdentity | null {
  const identity = value as Partial<HostBuildIdentity> | null;
  if (!identity || identity.schema !== 1 || identity.protocol !== "fluxiq.module-build-identity.v1" || identity.moduleId !== "@fluxiq-web-extension/domain-host"
    || identity.normalization !== "module-payload-v1" || typeof identity.version !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9.+_-]{0,79}$/.test(identity.version)
    || typeof identity.artifactDigest !== "string" || !/^[a-f0-9]{64}$/.test(identity.artifactDigest)
    || typeof identity.sourceInputsDigest !== "string" || !/^[a-f0-9]{64}$/.test(identity.sourceInputsDigest) || Object.keys(identity).length !== 7) return null;
  return { schema: 1, protocol: identity.protocol, moduleId: identity.moduleId, version: identity.version, normalization: identity.normalization, artifactDigest: identity.artifactDigest, sourceInputsDigest: identity.sourceInputsDigest };
}
