// Reading page evidence off the wire with the contract's own keys.
//
// The evidence is assembled by a content script that may be older than the
// domain reading it, in a page that may have interfered with it, so no value on
// it may be trusted: a reader that assumed a `number` was a number would take a
// whole recording down on a malformed field. The usual answer is to type the
// whole thing `Record<string, unknown>` and read it by string literal -- and
// that answer is what let the packet spend three months reading
// `snapshot.loading` against a producer writing `evidence.loading`, with a green
// suite on both sides.
//
// So the keys and the values are separated. `PageEvidenceWire<T>` keeps `T`'s
// **keys**, which the compiler checks against
// `apps/extension/src/content/evidence/`'s own declaration because that
// declaration is this one, and makes every **value** `unknown`, which forces it
// through one of the defensive readers before it can be used. A field the
// producer renames stops compiling here; a field the page corrupts still
// reports nothing rather than throwing.

/**
 * `T` as it arrives: `T`'s keys, all optional, every value untrusted.
 *
 * Optional because a producer older than the domain sends fewer fields, and a
 * reader must treat a missing field and a malformed one the same way.
 */
export type PageEvidenceWire<T> = { [K in keyof T]?: unknown };

/**
 * A wire object read as `T`'s key set, or `undefined` when the value is not an
 * object at all. Narrowing only: nothing is validated here, because validating
 * a field the caller will not read is a cost paid on every recorded event.
 */
export function pageEvidenceWire<T>(value: unknown): PageEvidenceWire<T> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as PageEvidenceWire<T>
    : undefined;
}
