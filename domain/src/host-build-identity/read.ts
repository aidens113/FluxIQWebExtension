import type { TrustedModuleBuildIdentity } from "fluxiq/runtime";
// The owning generator replaces this single payload literal after bundling.
const embedded = "__FLUXIQ_HOST_IDENTITY_BEGIN__eyJmbHV4aXFIb3N0SWRlbnRpdHlQbGFjZWhvbGRlciI6MzA1fQ==__FLUXIQ_HOST_IDENTITY_END__";
/** Identity belongs to this executing host bundle, never a disk reread. */
export function readHostBuildIdentity(): TrustedModuleBuildIdentity | null {
  const match = /^__FLUXIQ_HOST_IDENTITY_BEGIN__([A-Za-z0-9+/=]+)__FLUXIQ_HOST_IDENTITY_END__$/.exec(embedded);
  if (!match) throw new Error("Malformed embedded host identity slot.");
  const decoded = Buffer.from(match[1]!, "base64");
  if (decoded.toString("base64") !== match[1]) throw new Error("Malformed embedded host identity encoding.");
  const identity = JSON.parse(decoded.toString("utf8"));
  if (identity.fluxiqHostIdentityPlaceholder === 305 && Object.keys(identity).length === 1) return null;
  if (identity.schema !== 1 || identity.protocol !== "fluxiq.module-build-identity.v1" || identity.normalization !== "module-payload-v1"
    || identity.moduleId !== "@fluxiq-web-extension/domain-host" || typeof identity.version !== "string"
    || !/^[a-f0-9]{64}$/.test(identity.artifactDigest) || !/^[a-f0-9]{64}$/.test(identity.sourceInputsDigest)
    || Object.keys(identity).length !== 7) throw new Error("Malformed embedded host build identity.");
  return Object.freeze(identity);
}
