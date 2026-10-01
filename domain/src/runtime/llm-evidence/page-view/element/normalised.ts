// Words as the page view compares them: whitespace collapsed, trimmed, and
// lower-cased, so two lines that differ only in spacing or case read as one.

/** Whitespace collapsed, trimmed and lower-cased: the form two lines' words are compared in. */
export function normalisedWords(words: string): string {
  return words.replace(/\s+/gu, " ").trim().toLowerCase();
}
