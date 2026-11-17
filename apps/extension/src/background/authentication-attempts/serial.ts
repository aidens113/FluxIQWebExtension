import type { AuthenticationTabSessionArea } from "../authentication-tabs";

const tails = new WeakMap<AuthenticationTabSessionArea, Promise<void>>();

/** Serializes one background runtime's adapters, not other processes or arbitrary storage writers. */
export function serializePkceAttemptStorage<T>(area: AuthenticationTabSessionArea, operation: () => Promise<T>): Promise<T> {
  const result = (tails.get(area) ?? Promise.resolve()).then(operation);
  tails.set(area, result.then(() => undefined, () => undefined));
  return result;
}
