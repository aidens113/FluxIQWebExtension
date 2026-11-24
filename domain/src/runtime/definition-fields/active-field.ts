/**
 * Whether `value`, one field or condition read of an `extractList`, reads a
 * semantic definition: a text read carrying a `definition` member, malformed or
 * not, that is not excluded. Only a client that declares the definition-field
 * capability reads one; an older reader ignores the member and reads something
 * else under its key.
 */
export function webActiveDefinitionField(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const field = value as Record<string, unknown>;
  return field.kind === "text" && field.handling !== "exclude" && Object.hasOwn(field, "definition") && field.definition !== undefined;
}
