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
// destination, the author's other descriptive attributes (a placeholder, an
// `aria-label`, a title), and where the control sat. The selector and xpath ride
// as locators, never as the identity.
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

/** Attributes that state what a control holds or how it is set, never what it is. */
const STATE_ATTRIBUTES: ReadonlySet<string> = new Set(["checked", "selected", "aria-checked", "aria-selected", "aria-pressed", "aria-valuenow", "aria-valuetext"]);

/** Attributes an author writes as a test id, in the order the recorder prefers them. */
const TEST_ID_ATTRIBUTES = ["data-testid", "data-test", "data-cy", "data-qa"] as const;

/** The saved identity of one control, from whatever the path that met it knew. */
export function webElementFingerprint(source: WebElementFingerprintSource): WebAutomationElementFingerprint {
  const attributes = source.attributes;
  const tagName = source.tagName;
  const inputType = filled(source.inputType) ?? (tagName.toLowerCase() === "input" ? filled(attributes?.type)?.toLowerCase() : undefined);
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
    attributes: describingAttributes(attributes, holdsContents || source.secret),
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

/** The attributes the page wrote, less a control's state and, on a control that holds what was entered, its value. */
function describingAttributes(attributes: Readonly<Record<string, string>> | undefined, withholdValue: boolean): Record<string, string> | undefined {
  if (attributes === undefined) return undefined;
  const kept = Object.entries(attributes).filter(([name, value]) => typeof value === "string" && !STATE_ATTRIBUTES.has(name) && !(withholdValue && name === "value"));
  return kept.length > 0 ? Object.fromEntries(kept) : undefined;
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
