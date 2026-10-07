import { RunnerFailure } from "../../../failure.js";
import { screenHostIdentity } from "./screen.js";
import type { HostBuildIdentity } from "./types.js";
export function assertHostIdentityMatch(expected: HostBuildIdentity, response: unknown): HostBuildIdentity {
  const reply = response as { ok?: unknown; payload?: { loadedModules?: unknown } } | null;
  const modules = reply?.payload?.loadedModules;
  const actual = Array.isArray(modules) && modules.length === 1 ? screenHostIdentity(modules[0]) : null;
  if (reply?.ok !== true || !actual || JSON.stringify(expected) !== JSON.stringify(actual)) throw new RunnerFailure("environment.missing", "Executing domain host identity is missing or differs from intended host; provider dispatch refused", { details: { operationStage: "host-build-identity", expected, actual } });
  return actual;
}
