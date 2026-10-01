// Whether words say anything: a letter, a digit, a symbol such as a star or a
// check mark, or a currency sign. Punctuation and spacing alone do not.

const MEANINGFUL = /[\p{L}\p{N}\p{So}\p{Sc}]/u;

/** The words hold a letter, digit, other symbol or currency symbol (`\p{L}\p{N}\p{So}\p{Sc}`). */
export function meaningfulWords(words: string | undefined): words is string {
  return words !== undefined && MEANINGFUL.test(words);
}
