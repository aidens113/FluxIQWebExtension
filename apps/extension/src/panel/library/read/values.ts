// Defensive readers for what Core answers. Nothing here trusts a type: a field that is missing or the wrong
// shape is left out rather than made up, so the library never says something Core did not.

/** A plain object, or nothing. */
export function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

/** A string with words in it, or nothing. */
export function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

/** A whole number from zero up, or nothing. */
export function count(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;
}

/** The items of a list, or an empty list. */
export function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
