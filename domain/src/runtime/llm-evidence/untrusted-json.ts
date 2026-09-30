// Readers for the untrusted JSON a page snapshot arrives as. Every value the
// packet carries passes through one of these, so a hostile or merely broken
// page cannot put a non-string where a string belongs, a non-JSON value, or a
// negative count into something an LLM will read. A value that fails a reader
// is dropped, not repaired.
//
// None of them cuts anything (t200). Until 2026-09-30 every string was sliced
// to a per-field bound and every count checked against a ceiling, which is how
// a page's words and its long lists reached the model shortened. What a reader
// still refuses is a value of the wrong kind, never a value that is too large.

export function isJsonRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === "object" && !Array.isArray(input);
}

/** A required object. The name goes into the error so a bad hop is identifiable. */
export function jsonRecord(input: unknown, name: string): Record<string, unknown> {
  if (!isJsonRecord(input)) throw new Error(`${name} must be an object`);
  return input;
}

/** A string collapsed to one line and trimmed, whole; `undefined` when nothing is left. */
export function pageText(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined;
  const value = input.replace(/\s+/gu, " ").trim();
  return value || undefined;
}

/** A bounded identifier. Unlike the readers above this throws: an identifier is never optional. */
export function boundedIdentifier(input: unknown, name: string): string {
  if (typeof input !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/u.test(input)) throw new Error(`${name} must be a bounded identifier`);
  return input;
}

/**
 * A boolean read as a present-or-absent marker. Only `true` survives, so a
 * false flag costs no bytes in the packet at all.
 */
export function trueFlag(input: unknown): true | undefined {
  return input === true ? true : undefined;
}

/** A non-negative safe integer, or `undefined`. */
export function countValue(input: unknown): number | undefined {
  if (typeof input !== "number" || !Number.isSafeInteger(input) || input < 0) return undefined;
  return input;
}
