// A JSON value read as an object, or `undefined` for anything else: how every
// file of this experiment reads a record it did not write (a Lab step file, a
// stored build record, a trace manifest's context).

export function jsonRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
