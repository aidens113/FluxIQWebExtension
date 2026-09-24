// What one `where` condition says about its value, read off an untrusted
// object (contract C5): the vocabulary, and the one reader of it.
//
// Two callers read conditions and they must not read them differently. The
// dispatch reader takes a literal request and names a value by a field key or a
// field of its own (`./read-request.ts`); the plan resolver takes a condition a
// model wrote over a *detected* list and names its value by a column the
// detection showed (`runtime/llm-evidence/plan-resolution/extraction/`). The
// half that differs is which key names the value. The half that does not -- what
// may be said about it, and what each phrase means -- is here, so a condition
// the resolver accepts is a condition the dispatch runs, to the character.
//
// ## Easy to write, or it will not be written
//
// The everything-store run of 2026-09-24 carried five conditions in its
// instruction and none of them into the Flow (`run-mug1z9k9-ef625d8b`). A
// vocabulary a model half-remembers is a vocabulary it writes wrong once and
// then stops reaching for, so this reader is deliberately forgiving in three
// ways that cost nothing:
//
// - **A name it can guess at.** `min`, `gte`, `lt`, `regex`, `includes`,
//   `exclude` and their neighbours are read as the canonical key they plainly
//   mean, and a key is matched with its case and punctuation ignored, so
//   `greater_than` is `greaterThan`. The wire carries the canonical key, so the
//   page and every reader downstream see one vocabulary rather than fifteen.
// - **One value or several.** Every comparison over text, and equality, takes a
//   lone value or a list of them, and a list means "any of these". "No ear tips
//   and no charging cases" is one condition, which is how it was said.
// - **A number where a number belongs.** A bound is a number, and a text
//   comparison written with one reads it as its digits rather than refusing.
//
// What it is not forgiving about is a key it cannot place, or a value it cannot
// act on: those refuse the condition and name the key, because a dropped
// condition returns the whole unnarrowed list and reports success having done
// it.

import {
  WEB_AUTOMATION_EXTRACT_CONDITION_BOUNDS,
  WEB_AUTOMATION_EXTRACT_CONDITION_TEXTS,
  webAutomationExtractConditionPattern
} from "./condition-match";
import {
  WEB_AUTOMATION_EXTRACT_CONDITION_PRESENCE,
  type WebAutomationExtractConditionValue,
  type WebAutomationExtractItemCondition
} from "./request";

/** Everything a condition says about its value, which is every part of one but the key that names it. */
export type WebAutomationExtractConditionSaying = Omit<WebAutomationExtractItemCondition, "field" | "read">;

/**
 * What a condition says, or the written key that could not be placed or acted
 * on. A refusal with no `key` is the condition contradicting itself, which no
 * one key explains.
 */
export type WebAutomationExtractConditionSayingRead =
  | { ok: true; says: WebAutomationExtractConditionSaying }
  | { ok: false; key?: string | undefined };

/** Every phrase a condition may use, in the order a canonical condition writes them. */
const SAYING_KEYS = [
  "is",
  ...WEB_AUTOMATION_EXTRACT_CONDITION_BOUNDS,
  "equals",
  ...WEB_AUTOMATION_EXTRACT_CONDITION_TEXTS,
  "not"
] as const satisfies readonly (keyof WebAutomationExtractConditionSaying)[];

type SayingKey = (typeof SAYING_KEYS)[number];

/**
 * The phrases a model reaches for that are not the canonical spelling, each
 * mapped to the one it means. Keys are compared with case and punctuation
 * removed, so this lists meanings rather than spellings.
 */
const OTHER_NAMES: readonly (readonly [string, SayingKey])[] = [
  ["min", "atLeast"],
  ["minimum", "atLeast"],
  ["gte", "atLeast"],
  ["greaterthanorequal", "atLeast"],
  ["greaterorequal", "atLeast"],
  ["max", "atMost"],
  ["maximum", "atMost"],
  ["lte", "atMost"],
  ["lessthanorequal", "atMost"],
  ["lessorequal", "atMost"],
  ["lt", "lessThan"],
  ["under", "lessThan"],
  ["below", "lessThan"],
  ["gt", "greaterThan"],
  ["over", "greaterThan"],
  ["above", "greaterThan"],
  ["equal", "equals"],
  ["equalto", "equals"],
  ["eq", "equals"],
  ["exact", "equals"],
  ["exactly", "equals"],
  ["match", "matches"],
  ["regex", "matches"],
  ["regexp", "matches"],
  ["pattern", "matches"],
  ["contain", "contains"],
  ["include", "contains"],
  ["includes", "contains"],
  ["containing", "contains"],
  ["has", "contains"],
  ["startwith", "startsWith"],
  ["beginswith", "startsWith"],
  ["beginwith", "startsWith"],
  ["prefix", "startsWith"],
  ["endwith", "endsWith"],
  ["endingwith", "endsWith"],
  ["suffix", "endsWith"],
  ["negate", "not"],
  ["negated", "not"],
  ["invert", "not"],
  ["exclude", "not"],
  ["excluded", "not"]
];

const SAYINGS: ReadonlyMap<string, SayingKey> = new Map<string, SayingKey>([
  ...SAYING_KEYS.map((key) => [plainKey(key), key] as const),
  ...OTHER_NAMES
]);

/**
 * Every spelling a condition may use for a phrase about its value: the
 * canonical keys and the other names read as them.
 *
 * It is exported for the refusal position (`plan-resolution/issue-position.ts`),
 * which spells a key only when the grammar itself names it and gives any other
 * key as its index. A refusal that says `where.0.1` tells a model nothing it can
 * act on, and every key here is the grammar's own word rather than anything the
 * page supplied.
 */
export const WEB_AUTOMATION_EXTRACT_CONDITION_KEYS: readonly string[] = [
  ...SAYING_KEYS,
  ...OTHER_NAMES.map(([name]) => name)
];

/** The phrases that compare something, which "the value is not there" cannot be said beside. */
const COMPARISONS: readonly SayingKey[] = [...WEB_AUTOMATION_EXTRACT_CONDITION_BOUNDS, "equals", ...WEB_AUTOMATION_EXTRACT_CONDITION_TEXTS];

/**
 * What `written` says about its value, with `naming` the keys this caller uses
 * to name the value and reads for itself.
 *
 * A key neither this vocabulary nor the caller's knows refuses the condition
 * and is named, as does a value the page could not act on -- a bound that is
 * not a number, a regular expression that does not compile. Two spellings of
 * one phrase are read as one when they agree and refused when they do not,
 * since two readings of the same condition would disagree about the rows.
 */
export function webAutomationExtractConditionSayingValue(written: Record<string, unknown>, naming: readonly string[]): WebAutomationExtractConditionSayingRead {
  const said = new Map<SayingKey, unknown>();
  for (const [key, value] of Object.entries(written)) {
    if (value === undefined || naming.includes(key)) continue;
    const saying = SAYINGS.get(plainKey(key));
    if (saying === undefined) return { ok: false, key };
    const read = sayingValue(saying, value);
    if (read === undefined) return { ok: false, key };
    // `has` rather than a lookup, because `not: false` is a value a second
    // spelling could contradict and `undefined` would hide.
    if (said.has(saying) && JSON.stringify(said.get(saying)) !== JSON.stringify(read)) return { ok: false, key };
    said.set(saying, read);
  }
  // `not: false` is what a condition means with no `not` at all, and carrying
  // it would put a phrase on the wire that says nothing.
  if (said.get("not") === false) said.delete("not");
  // "The value is not there" and "the number in it is under fifty" cannot both
  // have been meant, so the pair is refused rather than read one way.
  if (said.get("is") === "absent" && COMPARISONS.some((key) => said.has(key))) return { ok: false };
  const says: Record<string, unknown> = {};
  for (const key of SAYING_KEYS) {
    const value = said.get(key);
    if (value !== undefined) says[key] = value;
  }
  return { ok: true, says: says as WebAutomationExtractConditionSaying };
}

/** One phrase's value, canonical, or `undefined` for one the page could not act on. */
function sayingValue(saying: SayingKey, value: unknown): unknown {
  if (saying === "is") return (WEB_AUTOMATION_EXTRACT_CONDITION_PRESENCE as readonly string[]).includes(value as string) ? value : undefined;
  if (saying === "not") return booleanValue(value);
  if ((WEB_AUTOMATION_EXTRACT_CONDITION_BOUNDS as readonly string[]).includes(saying)) {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
  }
  if (saying === "equals") return comparedValues(value);
  return comparedTexts(saying, value);
}

/**
 * The values an equality names: a number is compared against the number in the
 * value and a string against its text, so both are kept as written.
 */
function comparedValues(value: unknown): WebAutomationExtractConditionValue[] | undefined {
  const written = Array.isArray(value) ? value : [value];
  if (written.length === 0) return undefined;
  const values: WebAutomationExtractConditionValue[] = [];
  for (const entry of written) {
    if (typeof entry === "number" && Number.isFinite(entry)) values.push(entry);
    else if (typeof entry === "string" && entry.trim() !== "") values.push(entry);
    else return undefined;
  }
  return values;
}

/**
 * The texts a comparison names. A number is read as its digits rather than
 * refused, and an empty text is refused: `contains: ""` holds of every item,
 * which is a filter that quietly does nothing.
 */
function comparedTexts(saying: SayingKey, value: unknown): string[] | undefined {
  const written = Array.isArray(value) ? value : [value];
  if (written.length === 0) return undefined;
  const texts: string[] = [];
  for (const entry of written) {
    const text = typeof entry === "number" && Number.isFinite(entry) ? String(entry) : entry;
    if (typeof text !== "string" || text.trim() === "") return undefined;
    // A pattern the page could not compile is refused here rather than run
    // there, where it would fail every row of a list and look like an empty page.
    if (saying === "matches" && webAutomationExtractConditionPattern(text) === undefined) return undefined;
    texts.push(text);
  }
  return texts;
}

/** `true` and `false`, and the two words a model writes for them. */
function booleanValue(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  return value === "false" ? false : undefined;
}

/** A written key with its case and punctuation removed, so one meaning is not five keys. */
function plainKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]+/gu, "");
}
