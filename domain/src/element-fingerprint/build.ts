// The one builder of a saved step's control identity (user, 2026-10-10: every
// element carries the full multi-signal fingerprint, so a step is never found by
// one attribute alone, and the model never has to think about any of it).
//
// The output is the recorded node's own `parameters.element` shape,
// `WebAutomationElementFingerprint`, because that is the shape every reader
// already takes: Core's matcher scores its text, label, id, test id, role, tag,
// selector and class names together (`fingerprinting/element-fingerprint.ts`),
// the page's resolver looks it up by id, test id, name, class set and words
// (`apps/extension/src/content/element-finder.ts`) before it scores
// (`content/identity/score.ts`), and its record and shadow hosts are the gates
// the page applies. So a signal written here is one some reader uses, and a
// signal left out is one no reader can use.
//
// **What it carries:** the tag, the role and the implied role, the input type,
// the visible text, the label, the accessible name, the authored id, the `name`
// attribute, each class token as its own entry, a test id, a link's
// destination, and where the control sat. The selector and xpath ride as
// locators, never as the identity. Of the attributes the page wrote, only the
// ones that say which control this is are kept (`IDENTITY_ATTRIBUTES`, the one
// list every path uses): never the whole map, which holds a control's state
// and a framework's data as well as its identity. The id and the class are
// read out of it into fields of their own, and so is a test id.
//
// **What it never carries is what the control holds.** A text field's,
// textarea's or select's text and value are its contents, not its name, so they
// are left out; a button input's value is the words on it and stays. A
// control's state -- checked, selected, pressed, a slider's reading -- is left
// out of the attributes as well: it is what a step changes, so a fingerprint
// holding it would describe the control as it was before the step, and the same
// control after it as another one. A control that holds a secret carries no word
// that could be its contents (`WebElementFingerprintSource.secret`).

import type { WebAutomationElementFingerprint } from "../actions/types";
import type { WebElementFingerprintSource } from "./source";

/**
 * Every key of a contract type, written out, so a field cannot leave this
 * builder in silence: `output-nodes/targets/targets.ts` has the same three lines
 * for the same reason.
 */
type ContractFields<T> = { [K in keyof Required<T>]: T[K] };

/** Input types pressed rather than filled: their value is the author's word for them, not something a person entered. */
const AUTHORED_VALUE_INPUT_TYPES: ReadonlySet<string> = new Set(["button", "submit", "reset", "image", "checkbox", "radio"]);

/**
 * The attributes a saved identity keeps, by the name the page wrote: the ones
 * that say which control this is. `type` says what a button does (a reset
 * discards), which the repair check reads (`runtime/llm-evidence/target/
 * equivalence.ts`); an input's type is its `inputType` and is not repeated
 * here. A `placeholder`, an `aria-label` and a `title` are the author's words
 * for it; the rest are test ids. Never a value, a checked or selected state, a
 * pressed or expanded state, a style or a data blob.
 */
const IDENTITY_ATTRIBUTES: readonly string[] = ["name", "type", "placeholder", "aria-label", "title", "data-testid", "data-test", "data-cy", "data-qa"];

/** Attributes an author writes as a test id, in the order the recorder prefers them. */
const TEST_ID_ATTRIBUTES = ["data-testid", "data-test", "data-cy", "data-qa"] as const;

/** The saved identity of one control, from whatever the path that met it knew. */
export function webElementFingerprint(source: WebElementFingerprintSource): WebAutomationElementFingerprint {
  const attributes = source.attributes;
  const tagName = source.tagName;
  // Only as the path reported it: a text field's default type is no signal, and the packet leaves it out (`runtime/llm-evidence/elements.ts`).
  const inputType = filled(source.inputType);
  const holdsContents = holdsWhatWasEntered(tagName, inputType);
  const words = !source.secret && !holdsContents;
  // In the order the wire reader writes them (`output-nodes/targets/targets.ts`
  // `elementFingerprint`), so a recorded node's parameters keep the bytes they
  // had wherever no rule here changed a field.
  return compact({
    selector: filled(source.selector),
    xpath: filled(source.xpath),
    id: filled(source.id) ?? filled(attributes?.id),
    classNames: classTokens(source.classNames ?? attributes?.class?.split(/\s+/u)),
    visibleText: words ? filled(source.visibleText) : undefined,
    tagName,
    text: words ? filled(source.text) : undefined,
    value: words ? filled(source.value) : undefined,
    role: filled(source.role),
    implicitRole: filled(source.implicitRole),
    name: filled(source.name) ?? filled(attributes?.name),
    href: filled(source.href),
    inputType,
    // A control's state is what a step changes, never who the control is (header).
    checked: undefined,
    testId: filled(source.testId) ?? TEST_ID_ATTRIBUTES.map((key) => filled(attributes?.[key])).find((value) => value !== undefined),
    accessibleName: source.secret ? undefined : filled(source.accessibleName) ?? filled(attributes?.["aria-label"]),
    label: filled(source.label),
    attributes: identityAttributes(attributes, tagName),
    context: source.context,
    // Core's remaining signals. A web page has no source for the first four,
    // `url` names the page rather than the control, and `bounds` are the
    // capture's viewport rather than the run's, which is why the page refuses
    // to compare them (`content/identity/score.ts`).
    automationId: undefined,
    entityId: undefined,
    entityKind: undefined,
    statePath: undefined,
    queryPath: undefined,
    url: undefined,
    bounds: undefined,
    metadata: undefined
  } satisfies ContractFields<WebAutomationElementFingerprint>) as WebAutomationElementFingerprint;
}

/** A text field, a textarea or a select: a control whose text and value are what was put in it. */
function holdsWhatWasEntered(tagName: string, inputType: string | undefined): boolean {
  const tag = tagName.toLowerCase();
  if (tag === "textarea" || tag === "select") return true;
  return tag === "input" && !AUTHORED_VALUE_INPUT_TYPES.has(inputType ?? "text");
}

/** The identifying attributes the page gave a value, in `IDENTITY_ATTRIBUTES`' order; nothing when it gave none. */
function identityAttributes(attributes: Readonly<Record<string, string>> | undefined, tagName: string): Record<string, string> | undefined {
  const kept: Record<string, string> = {};
  for (const key of IDENTITY_ATTRIBUTES) {
    if (key === "type" && tagName.toLowerCase() === "input") continue;
    const value = filled(attributes?.[key]);
    if (value !== undefined) kept[key] = value;
  }
  return Object.keys(kept).length > 0 ? kept : undefined;
}

/** Each class token once, blanks dropped; nothing when no token is left. */
function classTokens(tokens: readonly string[] | undefined): string[] | undefined {
  const kept = [...new Set((tokens ?? []).map((token) => token.trim()).filter((token) => token !== ""))];
  return kept.length > 0 ? kept : undefined;
}

/** A string that says something, or nothing. */
function filled(value: string | undefined): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

/** The fields that are present, so an absent signal is absent rather than written as `undefined`. */
function compact(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}
