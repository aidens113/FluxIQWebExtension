// Which words name a payment card's security code: the three or four digits
// printed on the card, which no form may let leave the page.
//
// `autocomplete="cc-csc"` names one outright, and the signature rule already
// treats every `cc-` token as a card field. But real card forms often write no
// `autocomplete` at all: bigbox-retail's card frame is `<input name="cvc">`
// under the label "Security code", and a headed probe (t730 c2) found what was
// typed into it in the snapshot, every recorded keydown and the recorded
// `dom.input`. So the rule also reads what the author called the field -- its
// `name` and `id` -- and the words that label it, through this one matcher.
//
// Identifiers and label text are read alike: split into words at every
// non-alphanumeric character and at each lower-to-upper case change, so
// `cardCvc`, `cc_cvv2`, `payment[cvc]` and "CVC / CVV" all yield the word they
// carry. A word must match whole, so `recvc` and `cvcx` do not; a phrase must
// be consecutive words, so "Security question" and "Gift card code" do not.
// "Verification code" alone is left out on purpose: that is a one-time code
// sent by mail or text, which pages mark with `one-time-code`, and matching it
// here would reach every sign-in step's code box by guesswork.

/** The short names of a card security code, as one word, with or without the trailing `2` of the second-generation code. */
const SHORT_NAMES: ReadonlySet<string> = new Set(["cvc", "cvv", "csc", "cvn", "cvc2", "cvv2", "securitycode"]);

/** The spelled-out names, as consecutive words. */
const PHRASES: ReadonlyArray<readonly string[]> = [
  ["security", "code"],
  ["card", "verification"],
  ["card", "validation"]
];

/**
 * Whether an identifier or a label names a card security code. The text is
 * only inspected, never carried; it is read whole, because cutting the input
 * to a security predicate is a way past it.
 */
export function namesCardSecurityCode(text: string): boolean {
  const words = text
    .replace(/([a-z0-9])([A-Z])/gu, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter(Boolean);
  if (words.some((word) => SHORT_NAMES.has(word))) return true;
  return PHRASES.some((phrase) => words.some((_, start) => phrase.every((word, offset) => words[start + offset] === word)));
}
