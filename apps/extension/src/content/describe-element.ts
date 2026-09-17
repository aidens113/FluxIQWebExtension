// Turns one element into the descriptor that travels on the wire, plus the
// field accessors that build it. The accessors are exported because the
// snapshot path judges elements by the same fields before deciding to describe
// them.
//
// The identity signals Core's fingerprint normalizer scores -- `testId`,
// `accessibleName`, `label`, `implicitRole` and `context` -- are derived in
// `identity/`, one rule per module, and only assembled here (Phase 1.3). The
// selector is built in `selector/`, which names this element and no other.
//
// Sensitivity is handled at the source (Phase 1.4): `readElementValue` is the
// one value reader every capture path goes through -- this descriptor, the
// snapshot, the recorder's `dom.input` and the `dom.change` listener -- and it
// returns nothing for a sensitive control, so no caller can capture one by
// forgetting to ask. `hasValue` still reports presence.
//
// The two other readers of what a control *holds* follow that rule and are
// exported beside it, so each is closed by a test of its own rather than only
// through the assembled descriptor: `checkedState`, which for a checkbox or
// radio is everything the control holds, and `selectState`, a select's option
// list and current selection -- the options are the value space, so publishing
// them narrows the secret. All three ask `isWithinSensitiveControl`, so a
// control that merely sits inside a marked element is withheld as a marked
// control itself is (decision D2). The rule
// is the single `isSensitiveFieldSignature` in `shared/sensitive-field.ts`,
// reached through `isSensitiveFormControl`; a second rule anywhere is a leak
// waiting to happen, which is how a card number escaped once already.
//
// Text follows the same rule (decision D2 of the data-extraction plan). A
// sensitive textarea's text and a sensitive select's option labels are what
// those controls hold, so `visibleText` and `directVisibleText` read through
// `textOutsideSensitiveControls` (`sensitive-text.ts`): a sensitive control,
// and anything inside one, gives no `text` or `visibleText`, and a container's
// text leaves those contents out. The snapshot ranks and admits elements by
// the same two readers, so a control known only by its contents is not listed.
// The `accessibleName`, `label` and `context` assembled here come from
// `identity/`, which reads every page string through the same helper, so none
// needs filtering again here.
//
// It does not cover the action verbs, which read `element.value` directly to
// prove their own post-conditions and put it in a validation string
// (`actions/type.ts`, `clear.ts`, `select.ts`). That path is still open and is
// recorded in the Week 1 plan's Phase 1.4 notes.

import { xpathFor } from "./element-finder";
import { visualDocumentBounds, visualViewportBounds } from "./visual-bounds";
import { captureSettings } from "./capture-settings";
import {
  hasClickHandler,
  hasEnteredValue,
  isInteractableUiElement,
  isSemanticTextElement
} from "./element-traits";
import { accessibleNameFor, authoredNameAttribute, elementContext, implicitRole, labelText } from "./identity";
import { selectorFor } from "./selector";
import { isWithinSensitiveControl, textOutsideSensitiveControls } from "./sensitive-text";
import type { DomElementDescriptor } from "./types";

export function describeElement(element: Element): DomElementDescriptor {
  const bounds = visualViewportBounds(element);
  const docBounds = visualDocumentBounds(element);
  const descriptor: DomElementDescriptor = {
    tagName: element.tagName.toLowerCase(),
    selector: selectorFor(element),
    isVisibleOnViewport: Boolean(bounds)
  };
  if (bounds) descriptor.bounds = bounds;
  if (docBounds) descriptor.documentBounds = docBounds;
  if (hasClickHandler(element)) descriptor.hasClickHandler = true;
  const text = isInteractableUiElement(element) || isSemanticTextElement(element)
    ? visibleText(element)
    : directVisibleText(element);
  if (text) {
    descriptor.text = text;
    descriptor.visibleText = text;
  }
  if (element.id) descriptor.id = element.id;
  const classNames = [...element.classList];
  if (classNames.length) descriptor.classNames = classNames;
  descriptor.xpath = xpathFor(element);
  const value = readElementValue(element);
  if (value !== undefined && captureSettings.inputValues) descriptor.value = value;
  const role = element.getAttribute("role");
  if (role) descriptor.role = role;
  const name = authoredNameAttribute(element);
  if (name) descriptor.name = name;
  const href = linkHref(element);
  if (href) descriptor.href = href;
  if (element instanceof HTMLInputElement && element.type) descriptor.inputType = element.type;
  const checked = checkedState(element);
  if (checked !== undefined) descriptor.checked = checked;
  const valuePresent = hasEnteredValue(element);
  if (valuePresent !== undefined) descriptor.hasValue = valuePresent;
  const testId = testIdFor(element);
  if (testId) descriptor.testId = testId;
  const computedName = accessibleNameFor(element);
  if (computedName) descriptor.accessibleName = computedName;
  const label = labelText(element);
  if (label) descriptor.label = label;
  const markupRole = implicitRole(element);
  if (markupRole) descriptor.implicitRole = markupRole;
  const context = elementContext(element);
  if (context) descriptor.context = context;
  const select = selectState(element);
  if (select) {
    descriptor.options = select.options;
    if (select.selectedValue !== undefined) descriptor.selectedValue = select.selectedValue;
  }
  const attributes: Record<string, string> = {};
  // `value` is deliberately absent: value *presence* travels as `hasValue`, so
  // an allowlisted attribute can never carry a sensitive field's content.
  for (const attribute of ["id", "class", "name", "type", "autocomplete", "data-sensitive", "placeholder", "title", "alt", "href", "tabindex", "aria-label", "aria-labelledby", "aria-describedby", "for", "aria-disabled", "aria-expanded", "aria-controls", "aria-pressed", "aria-selected", "data-testid", "data-test", "data-cy", "disabled", "onclick"]) {
    const value = element.getAttribute(attribute);
    if (value !== null) attributes[attribute] = value.slice(0, 500);
  }
  if (Object.keys(attributes).length) descriptor.attributes = attributes;
  return descriptor;
}

/**
 * All text under the element, including descendants -- less every sensitive
 * control's contents, and none for an element that is, or sits inside, one.
 */
export function visibleText(element: Element): string | undefined {
  const text = textOutsideSensitiveControls(element).replace(/\s+/g, " ").trim();
  return text ? text.slice(0, 500) : undefined;
}

/**
 * Only the element's own text nodes, so a container does not inherit its
 * children's words -- and none for an element inside a sensitive control.
 */
export function directVisibleText(element: Element): string | undefined {
  const text = textOutsideSensitiveControls(element, "own").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, 500) : undefined;
}

/**
 * What the control holds, or `undefined` when it holds nothing readable -- and
 * always `undefined` for a sensitive control, whose value must never leave the
 * page on any path, or for an element inside one. A span inside an editable
 * region marked `data-sensitive` is editable itself, and its words are that
 * region's value, so it is asked about as the region is
 * (`isWithinSensitiveControl`, `sensitive-text.ts`).
 *
 * The redaction lives here rather than at each emission point because every
 * capture path comes through here: the recorder's `dom.input`, the `dom.change`
 * listener, the element descriptor and the snapshot's ranking. One test closes
 * all of them and a new caller is safe by default. Presence still travels, as
 * `hasEnteredValue` in `element-traits.ts`.
 */
export function readElementValue(element: Element | null): string | undefined {
  if (!element) return undefined;
  if (isWithinSensitiveControl(element)) return undefined;
  // A file input's value is the chosen file's local name (`C:\fakepath\…`), which
  // is the user's, not the page's. Replay supplies the file itself, and presence
  // still travels as `hasValue`.
  if (element instanceof HTMLInputElement && element.type.toLowerCase() === "file") return undefined;
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    return element.value.slice(0, 2_000);
  }
  if (element instanceof HTMLElement && element.isContentEditable) return element.innerText.slice(0, 2_000);
  return undefined;
}

/**
 * Whether a checkbox or radio is checked, or `undefined` for every other
 * control -- and for a sensitive one, or one inside a sensitive control. The
 * checked state is state rather than a value, but for these two controls it is
 * everything they hold, so it follows the rule `readElementValue` follows: a
 * control the sensitivity rule marks yields nothing, and the wire projection
 * withholds it a second time. A checkbox inside an element marked
 * `data-sensitive` is not marked itself, and its state is still part of what
 * that element holds, so it is asked about as the element is
 * (`isWithinSensitiveControl`, `sensitive-text.ts`).
 */
export function checkedState(element: Element): boolean | undefined {
  if (!(element instanceof HTMLInputElement)) return undefined;
  const type = element.type.toLowerCase();
  if (type !== "checkbox" && type !== "radio") return undefined;
  return isWithinSensitiveControl(element) ? undefined : element.checked;
}

/** A select's option list and, when the selection is one of them, its value. */
type SelectState = {
  options: NonNullable<DomElementDescriptor["options"]>;
  selectedValue?: string | undefined;
};

/**
 * What a `<select>` offers and what it currently holds, or `undefined` for
 * every other element -- and for a select that is, or sits inside, a sensitive
 * control, which yields neither. The option list is the control's value space,
 * so publishing it narrows the secret however the selection itself is withheld,
 * and the labels are the words the page renders for those values.
 *
 * The selection travels only when it is one of the options listed, so a
 * `selectedValue` never says more than the list already did.
 */
export function selectState(element: Element): SelectState | undefined {
  if (!(element instanceof HTMLSelectElement) || isWithinSensitiveControl(element)) return undefined;
  const options = [...element.options].slice(0, 20).map((option) => ({
    value: option.value.slice(0, 200),
    label: (option.label || option.textContent || "").replace(/\s+/gu, " ").trim().slice(0, 200),
  }));
  const state: SelectState = { options };
  if (options.some((option) => option.value === element.value)) state.selectedValue = element.value.slice(0, 200);
  return state;
}

/**
 * The name the author wrote on the element, which is what the snapshot judges
 * an element's identity by. The computed accessible name -- labels, placeholder
 * and content included -- is `accessibleNameFor` in `identity/`, and reaches
 * the wire as the descriptor's `accessibleName`.
 */
export { authoredNameAttribute as accessibleName } from "./identity";

/** The author's test id, in the order the common tools write one. */
export function testIdFor(element: Element): string | undefined {
  return element.getAttribute("data-testid") ??
    element.getAttribute("data-test") ??
    element.getAttribute("data-cy") ??
    undefined;
}

export function linkHref(element: Element): string | undefined {
  if (element instanceof HTMLAnchorElement && element.href) return element.href;
  return element.getAttribute("href") ?? element.getAttribute("xlink:href") ?? undefined;
}

/** An author-supplied identifier that survives a re-render, if the page offers one. */
export function stableElementId(element: Element): string | undefined {
  return testIdFor(element) ??
    element.getAttribute("id") ??
    element.getAttribute("name") ??
    undefined;
}
