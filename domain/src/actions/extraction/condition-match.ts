// Whether one condition of an extraction's `where` holds of one value
// (contract C5): the half of a condition that is neither DOM nor wire.
//
// It lives here, beside the request contract, because three callers have to
// agree about it exactly. The content script asks it of a value it read off a
// card (`content/extraction/item-filter.ts`); the request reader asks it of a
// pattern at authoring time, to refuse a condition the page could never run
// (`./read-request.ts`); and a test asks it of the strings the real fixtures
// really produce. A second implementation of "under $50" would be a row set
// that differs between the page and everything that reasons about the page.
//
// ## What a value is
//
// A page states one fact in as many ways as its designers had readers. The
// four formats below are all one number, and every one of them comes off the
// fixtures this repository measures against:
//
//     "16.00 USD"   "$49.00"   "3.7 out of 5 stars"   "4.0"
//
// So a numeric comparison reads the **first** number written in the value,
// group separators removed: a price written twice -- once for a screen reader
// and once for the eye -- says one number and repeats it, and a rating written
// beside its count of ratings says one number and qualifies it. A value with no
// number in it fails every numeric comparison, because a row with no price is
// not a row under $50.
//
// A textual comparison reads the value with runs of whitespace collapsed to one
// space -- a card's title is laid out for a screen, not for a comparison -- and
// ignores case unless the author asked for case to matter.
//
// ## Why there is text matching here at all, when there was deliberately none
//
// Until 2026-09-24 this contract could say only two things about a value: the
// page has it, or the number in it is above or below a bound. That was a
// decision rather than an omission, and its reason was good: a word-list
// heuristic that guessed "sponsored" from an item's prose was deleted on
// 2026-09-18 for being a guess, and a substring test looked like the same guess
// under another name.
//
// What changed is who writes the test. On the everything store, an instruction
// carrying three qualifying conditions and two exclusions -- Plus eligible,
// rated 4.0 or higher, under $50, not sponsored, and no ear tips or charging
// cases -- produced a Flow carrying none of them, and returned 55 rows of which
// 13 were wanted and 0 matched (`run-mug1z9k9-ef625d8b`). The model had nowhere
// to put them. A person asking for "no charging cases" is not guessing at what
// the page means: they are naming words they do not want, in a column they
// named, and the condition either finds those words or it does not. What stays
// forbidden is the product **inferring** a word list nobody asked for.

import type { WebAutomationExtractConditionValue, WebAutomationExtractItemCondition } from "./request";

/** The comparisons a condition may put on the number in its value. */
export const WEB_AUTOMATION_EXTRACT_CONDITION_BOUNDS = ["atLeast", "atMost", "lessThan", "greaterThan"] as const satisfies readonly (keyof WebAutomationExtractItemCondition)[];

/** The comparisons a condition may put on the text of its value. */
export const WEB_AUTOMATION_EXTRACT_CONDITION_TEXTS = ["matches", "contains", "startsWith", "endsWith"] as const satisfies readonly (keyof WebAutomationExtractItemCondition)[];

type ConditionBound = (typeof WEB_AUTOMATION_EXTRACT_CONDITION_BOUNDS)[number];
type ConditionText = (typeof WEB_AUTOMATION_EXTRACT_CONDITION_TEXTS)[number];

/**
 * How far apart two numbers may be and still be equal. The price parsed out of
 * `$49.00` and the 49 an instruction asked for are the same number, and binary
 * floating point does not always agree.
 */
const EQUAL_WITHIN = 1e-9;

/**
 * The longest regular expression a condition may carry, and the most of a
 * value's text one is run against.
 *
 * Both bound what a bad pattern can cost rather than what a good one can say: a
 * model-written expression runs inside the page, where one that backtracks
 * catastrophically would hang the tab rather than fail a row. The text bound is
 * generous against what a column actually holds -- a product title, a price, a
 * badge -- and applies to regular expressions alone, because the other textual
 * comparisons are linear and a truncated value would make `endsWith` mean
 * something else.
 */
const PATTERN_CHARACTERS = 200;
const MATCHED_CHARACTERS = 2_000;

/** The flags a `/pattern/flags` form may name. `g` and `y` are dropped, since a stateful expression would answer differently per row. */
const PATTERN_FLAGS = "dimsuvy";

/** A regular expression written in the `/pattern/flags` form, rather than as a bare source. */
const DELIMITED_PATTERN = /^\/(.+)\/([a-z]*)$/su;

/** The first number written in a value: an optional sign, digits with group separators, and an optional fraction. */
const NUMBER = /-?\d[\d,]*(?:\.\d+)?/u;

const BOUND_HOLDS: Record<ConditionBound, (value: number, bound: number) => boolean> = {
  atLeast: (value, bound) => value >= bound,
  atMost: (value, bound) => value <= bound,
  lessThan: (value, bound) => value < bound,
  greaterThan: (value, bound) => value > bound
};

const TEXT_HOLDS: Record<ConditionText, (text: string, written: string) => boolean> = {
  matches: (text, written) => {
    const pattern = webAutomationExtractConditionPattern(written);
    return pattern !== undefined && pattern.test(text.slice(0, MATCHED_CHARACTERS));
  },
  contains: (text, written) => folded(text).includes(folded(written)),
  startsWith: (text, written) => folded(text).startsWith(folded(written)),
  endsWith: (text, written) => folded(text).endsWith(folded(written))
};

/**
 * Whether the item carrying `value` for the condition's column is one the read
 * keeps. `undefined` is a value the page did not have at all, which is what an
 * optional field the page could not read and a field the record does not carry
 * both mean.
 *
 * Every comparison the condition names must hold, and `not: true` inverts the
 * verdict whole -- the verdict on a value the page did not have included, so
 * "no charging case in the title" keeps an item with no title rather than
 * dropping it for a reason nobody asked about. Several values under one
 * comparison are read as "any of these", which is how a person names the
 * accessories they do not want.
 */
export function webAutomationExtractConditionHolds(condition: WebAutomationExtractItemCondition, value: string | undefined): boolean {
  const held = valueHolds(condition, value);
  return condition.not === true ? !held : held;
}

function valueHolds(condition: WebAutomationExtractItemCondition, value: string | undefined): boolean {
  const bounds = WEB_AUTOMATION_EXTRACT_CONDITION_BOUNDS.filter((key) => condition[key] !== undefined);
  const texts = WEB_AUTOMATION_EXTRACT_CONDITION_TEXTS.filter((key) => condition[key] !== undefined);
  // A condition that compares nothing asks whether the page has the value at
  // all, which is the whole of what a mark -- an ad label, a badge -- says.
  if (bounds.length === 0 && texts.length === 0 && condition.equals === undefined) {
    return (value !== undefined) === (condition.is !== "absent");
  }
  if (value === undefined) return false;
  if (bounds.length > 0) {
    const number = webAutomationExtractConditionNumber(value);
    if (number === undefined) return false;
    if (!bounds.every((key) => BOUND_HOLDS[key](number, condition[key] as number))) return false;
  }
  const text = collapsed(value);
  for (const key of texts) {
    const written = condition[key] as string | readonly string[];
    if (!anyOf(written).some((entry) => TEXT_HOLDS[key](text, entry))) return false;
  }
  if (condition.equals !== undefined && !equalsHolds(anyOf(condition.equals), value)) return false;
  return true;
}

/**
 * A written value read as an equality: a number against the number in the
 * value, and a string against its text. One condition may name several, and any
 * one of them satisfies it.
 */
function equalsHolds(written: readonly WebAutomationExtractConditionValue[], value: string): boolean {
  const text = folded(value);
  const number = webAutomationExtractConditionNumber(value);
  return written.some((entry) => typeof entry === "number"
    ? number !== undefined && Math.abs(number - entry) <= EQUAL_WITHIN
    : folded(entry) === text);
}

/**
 * The regular expression a `matches` names, or `undefined` for one the page
 * could not run. A bare source is read case-insensitively, since a person
 * naming words rarely means their capitalisation; the `/pattern/flags` form
 * says otherwise when it matters, and `/Sponsored/` is how case is asked for.
 */
export function webAutomationExtractConditionPattern(written: string): RegExp | undefined {
  if (written.length === 0 || written.length > PATTERN_CHARACTERS) return undefined;
  const delimited = DELIMITED_PATTERN.exec(written);
  const source = delimited?.[1] ?? written;
  const asked = delimited?.[2] ?? "";
  if ([...asked].some((flag) => !PATTERN_FLAGS.includes(flag) && !STATEFUL_FLAGS.includes(flag))) return undefined;
  const flags = delimited === null ? "i" : [...asked].filter((flag) => !STATEFUL_FLAGS.includes(flag)).join("");
  try {
    return new RegExp(source, flags);
  } catch (error) {
    // An unparsable pattern is reported as a `SyntaxError`, and "this is not an
    // expression" is exactly what this function answers `undefined` to. Any
    // other failure is not the pattern's and is not this function's to swallow.
    if (error instanceof SyntaxError) return undefined;
    throw error;
  }
}

/** The number a value states, or `undefined` for a value that states none. */
export function webAutomationExtractConditionNumber(value: string): number | undefined {
  const found = NUMBER.exec(value);
  if (found === null) return undefined;
  const number = Number(found[0].replaceAll(",", ""));
  return Number.isFinite(number) ? number : undefined;
}

/** Accepted where a pattern is written with flags, and dropped: each carries state across calls, so a row's verdict would depend on the rows before it. */
const STATEFUL_FLAGS = "gy";

/** One written value or several, always as several. */
function anyOf<T>(written: T | readonly T[]): readonly T[] {
  return Array.isArray(written) ? written as readonly T[] : [written as T];
}

/** The value's text with its layout removed: a card writes its title for a screen, not for a comparison. */
function collapsed(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function folded(value: string): string {
  return collapsed(value).toLowerCase();
}
