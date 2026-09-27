// Which column of a request a written name means (contract C5): the half of
// reading a `where` condition that is about the *name* rather than the value.
//
// It is its own module because it is its own question, and because the resolver
// asks the same question on the other side of the seam: for a list a detection
// found, a condition names a column the detection showed and
// `runtime/llm-evidence/plan-resolution/extraction/columns.ts` decides which one.
// This is that decision for a literal request, over the keys the request itself
// declares.
//
// ## A name written nearly right is the name
//
// A condition naming a key the request does not have used to refuse the whole
// request, which cost every row of the read. The standing rule is the opposite:
// an unknown name is resolved by search, not refused, using every signal
// available -- and the evidence for it is that a refusal does not work. A run
// refused the same way fourteen times never corrected itself; it simply spent
// the budget being told.
//
// So resolution is **Core's**, not a second implementation of it
// (`automationStudioMatchName` in `fluxiq/automation-studio/nodes`): exact, then
// equal after folding case and separators, then the nearest name above Core's
// measured score floor of 0.25. `productName` finds `name`, `Price` finds
// `price`, `ratng` finds `rating`, and `sponsored` finds nothing when the request
// reads name, price, rating and url -- which is the honest answer, and drops one
// condition rather than the read.
//
// ## The one shape a request declares
//
// The rule says name *and* shape, and a request's fields say what to read, never
// what type the value holds -- so the shape is mostly unknowable here. The one
// exception is a field that reads an **address**: a `link`, or an `attribute`
// naming `href` or `src`. A comparison on the *number* in a value was not written
// for one of those. So where the name alone leaves a guess, the address columns
// are stood aside and the guess is made among the rest; standing aside is not
// excluding, and with nothing else to pick an address column is still the answer,
// because a guess beats a dropped clause.
//
// A field written in the string grammar makes no claim either way. The page owns
// that grammar (`content/extraction/field-spec.ts`) and a second parser of it
// here would disagree with the first about which selectors carry an attribute.

import { automationStudioMatchName } from "fluxiq/automation-studio/nodes";
import type { WebAutomationExtractConditionSaying } from "./condition-grammar";
import { WEB_AUTOMATION_EXTRACT_CONDITION_BOUNDS } from "./condition-match";
import type { WebAutomationExtractField } from "./request";

/**
 * The column a condition's `field` was read as, and how much of that was a
 * guess. `exact` is the key verbatim; `normalized` is the same key in another
 * casing or with other separators, which is a spelling variant; `nearest` is a
 * scored guess. `score` is name similarity in 0..1 before any shape tie-break,
 * as Core's matcher reports it.
 */
export type WebAutomationExtractFieldMatch = {
  field: string;
  how: "exact" | "normalized" | "nearest";
  score: number;
};

/**
 * The field of `fields` that `written` names, or `undefined` when nothing
 * plausible answers to it.
 *
 * `undefined` drops the one condition that named it and keeps every row. It is
 * never a refusal of the read: a filter nobody can apply must leave the answer
 * too wide, which the loop's judgement can see, rather than absent, which it
 * cannot.
 */
export function webAutomationExtractFieldMatch(
  written: string,
  fields: Record<string, WebAutomationExtractField>,
  says: WebAutomationExtractConditionSaying
): WebAutomationExtractFieldMatch | undefined {
  const readable = Object.keys(fields).filter((key) => isWebAutomationExtractFieldRead(fields[key]));
  if (readable.length === 0) return undefined;
  const named = automationStudioMatchName(written, readable.map((id) => ({ id })));
  if (named === undefined || named.how !== "nearest") {
    return named === undefined ? undefined : { field: named.id, how: named.how, score: named.score };
  }
  const apart = comparesNumbers(says) ? readable.filter((key) => !readsAnAddress(fields[key]!)) : readable;
  const best = apart.length === 0 || apart.length === readable.length
    ? named
    : automationStudioMatchName(written, apart.map((id) => ({ id }))) ?? named;
  return { field: best.id, how: best.how, score: best.score };
}

/**
 * Whether a request reads the field at all, which is what makes it a candidate:
 * an excluded column is never read from the page (D12), so a condition over it
 * could only ever be false.
 */
export function isWebAutomationExtractFieldRead(field: WebAutomationExtractField | undefined): boolean {
  return field !== undefined && (typeof field === "string" || field.handling === undefined || field.handling === "include");
}

/** Whether the condition puts a comparison on the number in its value, which no address column was written to answer. */
function comparesNumbers(says: WebAutomationExtractConditionSaying): boolean {
  if (WEB_AUTOMATION_EXTRACT_CONDITION_BOUNDS.some((key) => says[key] !== undefined)) return true;
  const equals = says.equals;
  return Array.isArray(equals) && equals.some((entry) => typeof entry === "number");
}

/** The attributes a page writes an address into, which is what makes a field's value a URL rather than a quantity. */
const ADDRESS_ATTRIBUTES: ReadonlySet<string> = new Set(["href", "src", "action", "poster"]);

/** Whether a declared field reads an address. A string-grammar field says nothing, because the page owns that grammar. */
function readsAnAddress(field: WebAutomationExtractField): boolean {
  if (typeof field === "string") return false;
  if (field.kind === "link") return true;
  return field.kind === "attribute" && field.attribute !== undefined && ADDRESS_ATTRIBUTES.has(field.attribute.toLowerCase());
}
