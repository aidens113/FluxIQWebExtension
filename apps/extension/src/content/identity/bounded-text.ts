// One text rule for every identity signal: collapse whitespace, trim, cap the
// length, and treat empty text as no signal at all. Core's fingerprint
// normalizes text the same way before comparing it, so a signal that differs
// only in whitespace must not read as a different element.

/** Normalized, trimmed and capped text, or `undefined` when nothing is left. */
export function boundedText(value: string | null | undefined, maxLength: number): string | undefined {
  const text = (value ?? "").replace(/\s+/gu, " ").trim();
  return text ? text.slice(0, maxLength) : undefined;
}
