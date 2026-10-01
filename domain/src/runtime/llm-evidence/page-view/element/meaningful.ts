// Whether words say anything: a letter, a digit, a symbol such as a star or a
// check mark, a currency sign, or a math symbol. Punctuation and spacing alone
// do not.
//
// Math symbols (`\p{Sm}`) count because a lone `+`, `−` or `×` drawn on a page
// is nearly always a control: a quantity stepper's plus and minus, a close
// glyph. Until 2026-10-01 they did not, so bigbox's quantity stepper -- three
// plain spans, `−`, `1`, `+` -- showed the model only its `1`, and a build told
// to add two packs had no way to set the count (lane A, run 39,
// `run-muq4jztv-ea489aa9`).

const MEANINGFUL = /[\p{L}\p{N}\p{So}\p{Sc}\p{Sm}]/u;

/** The words hold a letter, digit, other symbol, currency symbol or math symbol (`\p{L}\p{N}\p{So}\p{Sc}\p{Sm}`). */
export function meaningfulWords(words: string | undefined): words is string {
  return words !== undefined && MEANINGFUL.test(words);
}
