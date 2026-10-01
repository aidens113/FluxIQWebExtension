// One text rule for every identity signal: collapse whitespace, trim, and treat
// empty text as no signal at all. Core's fingerprint normalizes text the same
// way before comparing it, so a signal that differs only in whitespace must not
// read as a different element.
//
// Nothing is cut (t200). A name, a label, a heading or a record's words used to
// be sliced to 80, 120, 160 or 200 characters on the way out, so the model was
// shown the head of a sentence and the rest of it was gone without a mark. What
// may not leave the page is decided before the text reaches this rule, by
// `../sensitive-text.ts`, never by its length. `bounded-text.ts` remains for
// the one reader that must keep a quote short: a failure message naming the
// candidates it weighed.

/** Normalized, trimmed text, whole, or `undefined` when nothing is left. */
export function normalizedText(value: string | null | undefined): string | undefined {
  const text = (value ?? "").replace(/\s+/gu, " ").trim();
  return text || undefined;
}
