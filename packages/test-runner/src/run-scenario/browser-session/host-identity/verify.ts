import { RunnerFailure } from "../../../failure.js";
import { assertHostIdentityMatch } from "./assert-match.js";
import { expectedHostIdentity } from "./expected.js";
/** Required before every authenticated live/Flow Lab chat or provider dispatch. */
export async function verifyRunningHostIdentity(control: { readRuntimeBuildIdentity(reachedInputs: string[]): Promise<unknown> } | undefined, root: string, hostPath: string, write: (identity: unknown) => Promise<void>): Promise<void> {
  if (!control) throw new RunnerFailure("environment.missing", "Authenticated host identity control unavailable; provider dispatch refused");
  const expected = await expectedHostIdentity(root, hostPath);
  const response = await control.readRuntimeBuildIdentity(["packages/fluxiq/dist/index.js"]);
  await write({ expected, verified: false });
  const actual = assertHostIdentityMatch(expected, response);
  await write({ expected, actual, verified: true });
}
