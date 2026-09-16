// The one rule for a record field's key (D16).
//
// A field key names a column in every place a record goes: the extraction
// node's output, Core's dataset schema, the saved table and its exports. Core
// validates a dataset's field ids against exactly this pattern and refuses the
// three prototype names (`record-sets/schema.ts` in Core's contracts), and it
// refuses the whole candidate over one bad key. So the lift refuses such a key
// at dispatch rather than letting a Flow run and fail at the store.
//
// A human label such as "Product name" is not a key. The picker keeps the label
// beside the key and derives the key with the domain's key function, which must
// only ever produce keys this predicate accepts.

const FIELD_KEY_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

const RESERVED_FIELD_KEYS: ReadonlySet<string> = new Set(["__proto__", "constructor", "prototype"]);

/** Whether a value is a well-formed record field key: 1 to 100 of `A-Z a-z 0-9 _ -`, and no prototype name. */
export function isWebAutomationExtractFieldKey(key: unknown): key is string {
  return typeof key === "string" && FIELD_KEY_PATTERN.test(key) && !RESERVED_FIELD_KEYS.has(key);
}
