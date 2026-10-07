// Whether a line's words differ from what they were only in one number, and
// that number went up: "Cart (2)" to "Cart (3)", "1 item" to "2 items". The
// draft statement says such a line `rose` (`./statement.ts`), which is
// how a count an act raises -- a cart, a basket, a quantity -- reads to Core.

/** A number as a page prints it, thousands separators and a fraction included. */
const NUMBER = /\d+(?:[.,]\d+)*/gu;
/** A word's plural ending, so "1 item" and "2 items" are the same words around their number. */
const PLURAL = /(\p{L})e?s\b/gu;

/** Whether `now` is `was` with one number risen, and nothing else changed but a plural ending. */
export function webWordsRose(was: string, now: string): boolean {
  const wasNumbers = was.match(NUMBER) ?? [];
  const nowNumbers = now.match(NUMBER) ?? [];
  if (wasNumbers.length !== nowNumbers.length || skeleton(was) !== skeleton(now)) return false;
  const differ = wasNumbers.flatMap((number, index) => number === nowNumbers[index] ? [] : [index]);
  if (differ.length !== 1) return false;
  return value(nowNumbers[differ[0]!]!) > value(wasNumbers[differ[0]!]!);
}

/** The words with every number held out and plural endings dropped. */
function skeleton(words: string): string {
  return words.replace(NUMBER, "#").replace(PLURAL, "$1");
}

function value(number: string): number {
  return Number.parseFloat(number.replace(/,/gu, ""));
}
