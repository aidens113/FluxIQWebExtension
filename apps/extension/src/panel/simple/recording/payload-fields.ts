/**
 * `value` as a record of fields, or undefined when it is not a plain object.
 * Every reply this lane reads comes from a relay it does not own, so each
 * level is checked before a field is read.
 */
export function payloadFields(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}
