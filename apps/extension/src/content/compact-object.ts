/** Drops `undefined` entries so an optional field never reaches the wire as `null`. */
export function compactObject<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}
