import { expectedRuntimeIdentity } from "./expected.js";
import { assertRuntimeIdentityMatch } from "./assert-match.js";
import { screenRuntimeIdentity } from "./screen.js";
import { RunnerFailure } from "../../../failure.js";
/** Must precede every Lab provider/chat dispatch. */
export async function verifyRunningCoreIdentity(control: { readRuntimeBuildIdentity(reachedInputs: string[]): Promise<unknown> } | undefined, coreRoot: string, extensionPath: string, write: (identity: unknown) => Promise<void>): Promise<void> {
  if (!control) throw new RunnerFailure("environment.missing", "Authenticated Core identity control is unavailable; provider dispatch refused");
  const expected = await expectedRuntimeIdentity(coreRoot, extensionPath);
  const response = await control.readRuntimeBuildIdentity(expected.reachedInputs);
  const actual = screenRuntimeIdentity((response as { payload?: { identity?: unknown } } | null)?.payload?.identity);
  await write({ expected: expected.identity, actual, verified: false, reachedInputsDigest: expected.reachedInputsDigest });
  assertRuntimeIdentityMatch(expected, response);
  await write({ expected: expected.identity, actual, verified: true, reachedInputsDigest: expected.reachedInputsDigest });
}
