// A dataset's id, derived from the name it is saved under and a nonce (D16).
//
// Core keys a dataset by an id matching `^[A-Za-z0-9._:-]{1,200}$`
// (`datasetIdPattern`, `record-sets/output.ts` in Core's contracts). The name makes the id readable
// wherever a run's datasets are listed; the nonce makes it unique, because a
// re-recorded extraction is a new dataset with a new id, never a second writer
// into the rows an earlier recording saved.
//
// So the nonce is kept whole. A nonce that cannot be kept as it is gets refused
// rather than cut or rewritten, since two nonces cut or rewritten to the same
// text would give two recordings one id. The name is only for reading, so it is
// reduced to what an id can hold and cut to make room.
//
// The label is the dataset's name, never a value read from the page (D3).

const MAX_ID_LENGTH = 200;

/** What a nonce must already be. It excludes `:`, which separates it from the name. */
const NONCE_PATTERN = /^[A-Za-z0-9._-]{1,64}$/u;

const SEPARATOR = ":";

const FALLBACK_NAME = "dataset";

/** A run of characters the name part cannot hold, once the label is lower-cased. */
const OUTSIDE_NAME_CHARACTERS = /[^a-z0-9._-]+/u;

const COMBINING_MARKS = /\p{M}+/gu;

/**
 * The id of a dataset named `label`, made unique by `nonce`: `products:<nonce>`.
 *
 * The label is lower-cased and its accents dropped. Each run of characters the
 * name cannot hold becomes one `-`, with none left at either end, and the name
 * is cut so the whole id fits 200 characters, or is `dataset` when nothing is
 * left.
 *
 * @throws RangeError when `nonce` is not 1 to 64 of `A-Z a-z 0-9 . _ -`. A
 * random UUID is one.
 */
export function webAutomationDatasetId(label: string, nonce: string): string {
  if (!NONCE_PATTERN.test(nonce)) {
    throw new RangeError("A dataset id nonce must be 1 to 64 characters of A-Z, a-z, 0-9, '.', '_' or '-'.");
  }
  const words = label
    .toLowerCase()
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .split(OUTSIDE_NAME_CHARACTERS)
    .filter((word) => word.length > 0);
  const name = words.join("-").slice(0, MAX_ID_LENGTH - SEPARATOR.length - nonce.length) || FALLBACK_NAME;
  return `${name}${SEPARATOR}${nonce}`;
}
