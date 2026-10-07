import type { BuildIdentity } from "./types";
declare const __FLUXIQ_BUILD_IDENTITY_JSON__: string;
/** Immutable at bundle time; reading build-info.json at runtime would certify stale workers. */
export function currentBuildIdentity(): BuildIdentity | null {
  if (typeof __FLUXIQ_BUILD_IDENTITY_JSON__ === "undefined") return null;
  const identity = JSON.parse(__FLUXIQ_BUILD_IDENTITY_JSON__) as BuildIdentity | null;
  return identity?.schema === 1 ? identity : null;
}
