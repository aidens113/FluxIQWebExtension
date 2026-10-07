import type { ScreenedBuildIdentity } from "./types.js";
/** Closed projection: diagnostics can never smuggle settings, tokens or page data into the report. */
export function screenIdentity(value: unknown): ScreenedBuildIdentity | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (v.schema !== 1 || v.protocol !== "fluxiq.build-identity.v1" || !["chrome", "firefox", "e2e-chromium"].includes(String(v.target)) || typeof v.version !== "string" || !/^\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/.test(v.version)) return null;
  if (![v.inputsDigest, v.coreInputsDigest, v.domainInputsDigest].every(x => typeof x === "string" && /^[a-f0-9]{64}$/.test(x))) return null;
  return { schema: 1, target: v.target as string, version: v.version, protocol: "fluxiq.build-identity.v1", inputsDigest: v.inputsDigest as string, coreInputsDigest: v.coreInputsDigest as string, domainInputsDigest: v.domainInputsDigest as string };
}
