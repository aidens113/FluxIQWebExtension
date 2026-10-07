import { RunnerFailure } from "../../../failure.js";
import { screenRuntimeIdentity } from "./screen.js";
import type { ExpectedRuntimeIdentity } from "./types.js";
export function assertRuntimeIdentityMatch(expected: ExpectedRuntimeIdentity, response: unknown): void {
  const reply = response as { ok?: unknown; payload?: { identity?: unknown; reachedInputsDigest?: unknown } } | null;
  const actual = screenRuntimeIdentity(reply?.payload?.identity);
  if (reply?.ok !== true || !actual || JSON.stringify(expected.identity) !== JSON.stringify(actual) || reply.payload?.reachedInputsDigest !== expected.reachedInputsDigest) {
    throw new RunnerFailure("environment.missing", "Executing Core runtime identity is missing or differs from intended build/contracts; provider dispatch refused", { details: { operationStage: "core-build-identity", expected: expected.identity, actual } });
  }
}
