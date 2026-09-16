// A record field's key, derived from the label a field is picked under (D16).
//
// The picker shows a label ("Product name", a column's header, a test id) and
// keeps it beside the key. The key is what names the column everywhere a record
// goes: the extraction node's output, Core's dataset schema, the saved table and
// its exports. This is the one function that turns a label into a key.
//
// It does not decide what a well-formed key is. That is
// `isWebAutomationExtractFieldKey` (`actions/extraction/field-key.ts`), the
// predicate the parameter lift refuses a request by, so the pattern and the
// prototype names are written once. Every key returned here passes it, and a
// label that would give a prototype name is caught by asking it.

import { isWebAutomationExtractFieldKey } from "../actions/extraction";

/** Core's bound on a dataset field id, which the key predicate enforces; a derived key is cut to fit it. */
const MAX_KEY_LENGTH = 100;

const FALLBACK_KEY = "field";

const RESERVED_KEY_SUFFIX = "_field";

/** A run of characters a key cannot hold, once the label is lower-cased. */
const OUTSIDE_KEY_CHARACTERS = /[^a-z0-9_-]+/u;

const COMBINING_MARKS = /\p{M}+/gu;

/**
 * The key for a field picked under `label`, distinct from every key in `taken`.
 *
 * The label is lower-cased and its accents dropped. Each run of characters a
 * key cannot hold becomes one `_`, with none left at either end, and the result
 * is cut to 100 characters, or is `field` when nothing is left. A prototype name
 * gets `_field` appended. A key already in `taken` gets the first free suffix:
 * `price`, then `price_2`, then `price_3`.
 */
export function webAutomationExtractionFieldKey(label: string, taken: ReadonlySet<string>): string {
  const words = label
    .toLowerCase()
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .split(OUTSIDE_KEY_CHARACTERS)
    .filter((word) => word.length > 0);
  let key = words.join("_").slice(0, MAX_KEY_LENGTH) || FALLBACK_KEY;
  if (!isWebAutomationExtractFieldKey(key)) key = `${key}${RESERVED_KEY_SUFFIX}`;
  if (!taken.has(key)) return key;
  for (let ordinal = 2; ; ordinal += 1) {
    const suffix = `_${ordinal}`;
    const candidate = `${key.slice(0, MAX_KEY_LENGTH - suffix.length)}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}
