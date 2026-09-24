// Whether an identifier was produced by a build or a component library rather
// than written by an author, and so says nothing about *which* control this is.
//
// An author writes `id="search"` to name a thing. A framework writes
// `id=":r13b8o:"` to make a `<label for>` point somewhere without colliding
// with anything, and draws a fresh one on the next render, the next build or
// the next deploy. Both arrive here as a string on an element, and until
// 2026-09-23 `element-anchors.ts` could not tell them apart, so a Flow was
// written against the second kind and could never replay:
//
//     #\:r13b8o\: > div > div:nth-of-type(2) > button:nth-of-type(1)
//
// That is a real selector from a built Flow (`test-runs/run-muesyox4-930bef98`,
// everything store). `:r13b8o:` is the store's notifications modal, and the
// store draws that token from its build seed -- exactly as React's `useId`
// draws one from a render counter. The Flow was unreplayable the moment it was
// written, because nothing on any later rendering of that page carries that
// token.
//
// The judgement is made on the identifier's **shape**, not on a list of library
// names, because the libraries are not the population -- the generators are,
// and a new one ships every year. Three shapes, each with what it deliberately
// does not catch:
//
//  1. **A colon-delimited token.** React's `useId` emits `:r<base36>:`, and
//     Radix, Headless UI, React Aria, MUI and Ariakit all wrap it, so
//     `radix-:r1:` and `headlessui-dialog-:r7:` are the same shape with a stem
//     bolted on. React chose the colons precisely because no author writes one:
//     an id holding a colon must be escaped in every CSS selector. It does not
//     catch a bare colon with words either side (`form:email`, which some
//     server frameworks author), because there the words are the author's.
//
//  2. **An opaque token**: a UUID, a hex hash, or a run with the digit density
//     and the missing syllables of something counted out by a machine. It does
//     not catch a word with a number on it -- `section2`, `checkout2024`,
//     `col-md-6`, `h2` -- because a run of four or more letters holding a vowel
//     is a word, and a token holding one is not opaque.
//
//  3. **A named generator with a counter.** Angular Material's `mat-input-3`,
//     the CDK's `cdk-overlay-0` and Ember's `ember1234` have no shape at all: a
//     stem and a number is what an author writes too. Only the stem separates
//     them, so only here is a list the right instrument, and it stays short and
//     is named as a list rather than dressed up as a rule.
//
// Used in three places, for the same reason in all of them. `element-anchors.ts`
// will not quote one in a selector and `element-finder.ts` will not anchor an
// xpath on one, so a Flow is never written against it; and `identity/score.ts`
// will not hand one to Core's matcher as an identity signal, so a Flow that
// already carries one -- every Flow built before this rule existed -- is not
// scored as *contradicted* by a page that merely regenerated the token. Core
// charges a contradicted identifier -0.8 of weight 26, which buries the right
// candidate under every wrong one.
//
// It reads a string. It never reads the page, so it cannot leak one.

/**
 * A `:`-delimited run holding a counter: React's `useId` is `:r<base32>:`, so
 * every token past the ninth holds a digit. `:r13b8o:` is one.
 */
const COUNTED_COLON_TOKEN = /:[0-9a-z]*\d[0-9a-z]*:/iu;

/**
 * A `:`-delimited run too short to be a word: React's first nine ids
 * (`:r0:`) and, once the counter turns over into letters, `:ra:` and `:rab:`.
 * Kept separate from the rule above so neither has to be widened into
 * `form:email`, where the colon separates two words an author chose.
 */
const SHORT_COLON_TOKEN = /:[0-9a-z]{0,3}:/iu;

/** Where one identifier ends and the next begins, for a value built from several. */
const SEGMENT_SEPARATORS = /[-_.:\s/\\]+/u;

/** A UUID, dashed or not, whichever segment of the value holds it. */
const UUID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/iu;

/** A content hash: eight or more hex characters holding at least one digit and at least one letter. */
const HEX_HASH = /^(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{8,}$/iu;

/** Characters an opaque token is made of: nothing but letters and digits. */
const ALPHANUMERIC = /^[0-9a-z]+$/iu;

/** A run of letters long enough to be a word, if it holds a vowel. */
const LETTER_RUN = /[a-z]{4,}/giu;

/** The shortest token this module is willing to call opaque; below it, too many authored names look alike. */
const MIN_OPAQUE_LENGTH = 6;

/** How much of an opaque token is digits, at least: a quarter. */
const MIN_DIGIT_SHARE = 0.25;

/**
 * Generators whose tokens are a stem and a counter, which no shape rule can
 * see. Short on purpose: a stem here is one an author would not choose, and
 * anything needing a longer list wants rule 1 or rule 2 instead.
 */
const GENERATOR_STEMS = [
  "mat", "cdk", "ember", "radix", "headlessui", "downshift", "reach",
  "chakra", "mantine", "mui", "rc", "uid", "uniqid", "ngb", "react-aria"
] as const;

/** Words, then a number: the shape `mat-input-3`, `cdk-overlay-0` and `ember1234` all take. */
const STEM_AND_COUNTER = /^([a-z]+(?:[-_][a-z]+)*)[-_]?(\d+)$/iu;

/**
 * Whether `value` is an identifier a rendering generated, and so one nothing
 * should be addressed by.
 *
 * Answers `false` for anything it is unsure of. A stable id wrongly called
 * volatile costs a Flow its strongest anchor and leaves it a structural path;
 * a volatile id wrongly called stable costs the Flow every future replay. The
 * second is the worse mistake, but the first is not free, so each rule below
 * is written to the shape it is sure of rather than to the widest shape it
 * could defend.
 */
export function isVolatileIdentifier(value: string): boolean {
  const identifier = value.trim();
  if (!identifier) return false;
  if (COUNTED_COLON_TOKEN.test(identifier) || SHORT_COLON_TOKEN.test(identifier)) return true;
  if (UUID.test(identifier) || isGeneratorCounter(identifier)) return true;
  return identifier.split(SEGMENT_SEPARATORS).some(isOpaqueToken);
}

/**
 * A counter one of the named generators wrote, rather than one an author did.
 *
 * `step-1` and `mat-input-3` are the same string to every shape rule above, so
 * the stem is the only thing that can separate them and the list is read
 * directly. A stem qualifies when it is a generator's name or begins with it,
 * which is what makes one entry cover `mat-input-3` and `mat-form-field-7`
 * alike.
 */
function isGeneratorCounter(identifier: string): boolean {
  const stem = STEM_AND_COUNTER.exec(identifier)?.[1]?.toLowerCase();
  if (stem === undefined) return false;
  return GENERATOR_STEMS.some((generator) => stem === generator || stem.startsWith(`${generator}-`) || stem.startsWith(`${generator}_`));
}

/** A token counted out by a machine: a hash, or digits dense enough and no word to hold them together. */
function isOpaqueToken(token: string): boolean {
  if (token.length < MIN_OPAQUE_LENGTH || !ALPHANUMERIC.test(token)) return false;
  if (HEX_HASH.test(token)) return true;
  const digits = (token.match(/\d/gu) ?? []).length;
  if (digits < token.length * MIN_DIGIT_SHARE) return false;
  return !(token.match(LETTER_RUN) ?? []).some((run) => /[aeiou]/iu.test(run));
}

/**
 * Whether a recorded selector is addressed through a generated identifier, and
 * so names nothing on a later rendering.
 *
 * Asked of a selector that has already been written down -- a Flow built before
 * `elementAnchors` refused to quote one. The string is all there is by then: the
 * element it was built for is gone, and the descriptor beside it says only what
 * the element was, not which ancestor the address was hung on. So the selector
 * is read back as the tokens it quotes and each is put to the same rule.
 *
 * CSS escapes are undone first, because that is how the volatile part reaches
 * the string: `:r13b8o:` has to be written `#\:r13b8o\:` to be a selector at
 * all, and the backslashes are the escape, not the id.
 */
export function selectorQuotesVolatileIdentifier(selector: string): boolean {
  const unescaped = selector.replace(/\\(.)/gu, "$1");
  return (unescaped.match(/[A-Za-z0-9_:.-]+/gu) ?? []).some(isVolatileIdentifier);
}
