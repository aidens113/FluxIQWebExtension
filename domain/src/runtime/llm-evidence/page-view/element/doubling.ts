// Rule W1 of the page view (t223): words a page wrote twice print once.
//
// A price is often written for the screen and again for a screen reader, and
// both land in one element's text: `$39.99$39.99`. Words that are exactly
// `X X` or `XX` therefore print as `X`.
//
// Not every doubled-looking string is doubled text, and dropping half of a
// real word or number would be the one thing the view must never do. So `X`
// must be at least two characters, must not be digits alone (`2020` is a year,
// `11` a day), and must hold a space or a character that is not a letter
// (`$39.99`, `Add to cart`): letters alone are a word (`Bora Bora`,
// `couscous`), and the view prints a word as the page wrote it.

/** The words, or their half where they are exactly `X X` or `XX` and `X` is plainly a repeat. */
export function undoubledWords(words: string): string {
  const text = words.replace(/\s+/gu, " ").trim();
  const half = repeatedHalf(text);
  return half !== undefined && plainlyRepeated(half) ? half : text;
}

function repeatedHalf(text: string): string | undefined {
  const length = text.length;
  if (length < 2) return undefined;
  if (length % 2 === 0) {
    const half = text.slice(0, length / 2);
    return half === text.slice(length / 2) ? half : undefined;
  }
  const middle = (length - 1) / 2;
  const half = text.slice(0, middle);
  return text[middle] === " " && half === text.slice(middle + 1) ? half : undefined;
}

function plainlyRepeated(half: string): boolean {
  if (half.length < 2 || /^\p{N}+$/u.test(half)) return false;
  return /\s/u.test(half) || /[^\p{L}]/u.test(half);
}
