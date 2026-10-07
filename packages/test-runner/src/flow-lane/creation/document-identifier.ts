// The one shape an identifier copied out of a Flow document must have before a
// run artifact may carry it: what Core writes for a node, definition, edge or
// port id. No space, so it can carry no label and no sentence.

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u;
const MAX_IDENTIFIER_LENGTH = 256;

/** `value` when it is shaped like a Core identifier, otherwise `undefined`, so a caller decides what stands in its place. */
export function flowIdentifier(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_IDENTIFIER_LENGTH && IDENTIFIER.test(value) ? value : undefined;
}
