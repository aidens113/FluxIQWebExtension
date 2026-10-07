import { RunnerFailure } from "../../../failure.js";
import { screenServerAdapterIdentity } from "./screen.js";
import type { ServerAdapterBuildIdentity } from "./types.js";
export function assertServerAdapterIdentityMatch(expected: ServerAdapterBuildIdentity, response: unknown): ServerAdapterBuildIdentity {
  const reply = response as { ok?: unknown; payload?: { serverTransportIdentity?: unknown } } | null;
  const actual = screenServerAdapterIdentity(reply?.payload?.serverTransportIdentity);
  if (reply?.ok !== true || !actual || JSON.stringify(expected) !== JSON.stringify(actual)) throw new RunnerFailure("environment.missing", "Executing server adapter identity is missing or differs from intended adapter; provider dispatch refused", { details: { operationStage: "server-adapter-identity", expected, actual } });
  return actual;
}
