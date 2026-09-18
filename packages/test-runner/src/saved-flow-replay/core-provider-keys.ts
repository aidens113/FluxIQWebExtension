// The second half of "no model could have been reached": Core holds no model
// provider key. A live build installs the Lab's DeepSeek key into Core's
// Secret Keys (`live-llm/secret-key.ts`), and a persistent workspace keeps it,
// so a Flow built there is replayed beside the key that built it unless the
// key is taken away. The replay takes it away first, then counts again.

import { RunnerFailure } from "../failure.js";

/** The Secret Keys calls this needs; `ExistingFluxIQControlClient` satisfies it. */
export type CoreProviderKeyControl = {
  secretKeysCall(endpoint: string, payload: Record<string, unknown>): Promise<unknown>;
};

/** Model provider keys Core held before, how many this removed, and how many it holds after. Counts only. */
export type CoreProviderKeyRemoval = Readonly<{ before: number; removed: number; after: number }>;

/**
 * Deletes every `llm` Secret Key Core holds, authorized as a person deleting
 * one is, with the account's password and PIN, and reads the store back. Throws
 * when a key survives, because a replay beside a usable key proves less than
 * it claims. Only ids and kinds are read; Core never returns a key's value to
 * these calls.
 */
export async function removeCoreProviderKeys(control: CoreProviderKeyControl, authorization: { password: string; pin?: string }): Promise<CoreProviderKeyRemoval> {
  const held = await providerKeyIds(control);
  let removed = 0;
  for (const id of held) {
    const result = await control.secretKeysCall("delete-key", { id, authorizationPassword: authorization.password, ...(authorization.pin ? { authorizationPin: authorization.pin } : {}) });
    if (isRecord(result) && result.deleted === true) removed += 1;
  }
  const after = (await providerKeyIds(control)).length;
  if (after !== 0) throw new RunnerFailure("environment.missing", `Core still holds ${after} model provider key(s) after the replay removed them`, { details: { before: held.length, removed, after } });
  return Object.freeze({ before: held.length, removed, after });
}

async function providerKeyIds(control: CoreProviderKeyControl): Promise<string[]> {
  const snapshot = await control.secretKeysCall("snapshot", {});
  if (!isRecord(snapshot) || !Array.isArray(snapshot.keys)) throw new RunnerFailure("environment.missing", "Core returned an unreadable Secret Keys snapshot");
  return snapshot.keys.flatMap((key) => isRecord(key) && key.kind === "llm" && typeof key.id === "string" && key.id ? [key.id] : []);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
