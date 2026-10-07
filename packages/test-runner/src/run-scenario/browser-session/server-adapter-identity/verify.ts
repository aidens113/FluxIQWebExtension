import { RunnerFailure } from "../../../failure.js";
import { assertServerAdapterIdentityMatch } from "./assert-match.js";
import { expectedServerAdapterIdentity } from "./expected.js";
/** Required before every authenticated live/Flow Lab chat or provider dispatch. */
export async function verifyRunningServerAdapterIdentity(control: { readRuntimeBuildIdentity(reachedInputs: string[]): Promise<unknown> } | undefined, root: string, write: (identity: unknown) => Promise<void>, modulePath?: string): Promise<void> {
  if (!control) throw new RunnerFailure("environment.missing", "Authenticated server adapter identity control unavailable; provider dispatch refused");
  const expected = await expectedServerAdapterIdentity(root, modulePath);
  const response = await control.readRuntimeBuildIdentity(["packages/fluxiq/dist/index.js"]);
  await write({ expected, verified: false });
  const actual = assertServerAdapterIdentityMatch(expected, response);
  await write({ expected, actual, verified: true });
}
