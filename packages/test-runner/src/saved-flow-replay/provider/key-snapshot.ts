import { RunnerFailure } from "../../index.js";

/** Private identities of every stored key; this port never reveals or mutates a key. */
export async function replayKeyIdentities(control: {
  secretKeysCall(endpoint: string, payload: Record<string, unknown>): Promise<unknown>;
}): Promise<readonly string[]> {
  const snapshot = await control.secretKeysCall("snapshot", {});
  const invalid = () => new RunnerFailure("environment.missing", "Core returned an unreadable Secret Keys identity snapshot");
  if (!snapshot || typeof snapshot !== "object" || !Array.isArray((snapshot as { keys?: unknown }).keys)) throw invalid();
  const keys = (snapshot as { keys: unknown[] }).keys;
  const ids = new Set<string>();
  const identities: string[] = [];
  for (const key of keys) {
    if (!key || typeof key !== "object" || Array.isArray(key)) throw invalid();
    const { id, kind } = key as { id?: unknown; kind?: unknown };
    if (typeof id !== "string" || !id.trim() || typeof kind !== "string" || !kind.trim() || ids.has(id)) throw invalid();
    ids.add(id);
    identities.push(JSON.stringify([id, kind]));
  }
  return Object.freeze(identities.sort());
}
