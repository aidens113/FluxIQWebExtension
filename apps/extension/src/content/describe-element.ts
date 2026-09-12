// Turns one element into the descriptor that travels on the wire, plus the
// field accessors that build it. The accessors are exported because the
// snapshot path judges elements by the same fields before deciding to describe
// them.
//
// The identity signals Core's fingerprint normalizer scores -- `testId`,
// `accessibleName`, `label`, `implicitRole` and `context` -- are derived in
// `identity/`, one rule per module, and only assembled here (Phase 1.3).
//
// Sensitivity is handled at the source (Phase 1.4): `readElementValue` is the
// one value reader every capture path goes through -- this descriptor, the
// snapshot, the recorder's `dom.input` and the `dom.change` listener -- and it
// returns nothing for a sensitive control, so no caller can capture one by
// forgetting to ask. `hasValue` still reports presence, and `describeElement`
// withholds `selectedValue` and the option list of a sensitive select. The rule
// is the single `isSensitiveFieldSignature` in `shared/sensitive-field.ts`,
// reached through `isSensitiveFormControl`; a second rule anywhere is a leak
// waiting to happen, which is how a card number escaped once already.
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
  isSemanticTextElement,
  isSensitiveFormControl
} from "./element-traits";
import { accessibleNameFor, authoredNameAttribute, elementContext, implicitRole, labelText } from "./identity";
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
  // A sensitive select yields neither its selection nor its option list: the
  // options are the value space, so publishing them narrows the secret.
  if (element instanceof HTMLSelectElement && !isSensitiveFormControl(element)) {
    descriptor.options = [...element.options].slice(0, 20).map((option) => ({
      value: option.value.slice(0, 200),
      label: (option.label || option.textContent || "").replace(/\s+/gu, " ").trim().slice(0, 200),
    }));
    if (descriptor.options.some((option) => option.value === element.value)) {
      descriptor.selectedValue = element.value.slice(0, 200);
    }
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

/** The most stable CSS selector available, preferring id, then test id, then name. */
export function selectorFor(element: Element): string {
  if (element.id) return `#${CSS.escape(element.id)}`;
  const testId = element.getAttribute("data-testid");
  if (testId) return `[data-testid="${cssString(testId)}"]`;
  const name = element.getAttribute("name");
  if (name) return `${element.tagName.toLowerCase()}[name="${cssString(name)}"]`;
  const parts: string[] = [];
  let current: Element | null = element;
  while (current && current !== document.documentElement && parts.length < 5) {
    const parent: Element | null = current.parentElement;
    const tag = current.tagName.toLowerCase();
    const siblings = parent ? [...parent.children].filter((child) => child.tagName === current?.tagName) : [];
    const index = siblings.indexOf(current) + 1;
    parts.unshift(siblings.length > 1 ? `${tag}:nth-of-type(${index})` : tag);
    current = parent;
  }
  return parts.join(" > ");
}

/** All text under the element, including descendants. */
export function visibleText(element: Element): string | undefined {
  const text = element.textContent?.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, 500) : undefined;
}

/** Only the element's own text nodes, so a container does not inherit its children's words. */
export function directVisibleText(element: Element): string | undefined {
  const text = [...element.childNodes]
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent ?? "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.slice(0, 500) : undefined;
}

/**
 * What the control holds, or `undefined` when it holds nothing readable -- and
 * always `undefined` for a sensitive control, whose value must never leave the
 * page on any path.
 *
 * The redaction lives here rather than at each emission point because every
 * capture path comes through here: the recorder's `dom.input`, the `dom.change`
 * listener, the element descriptor and the snapshot's ranking. One test closes
 * all of them and a new caller is safe by default. Presence still travels, as
 * `hasEnteredValue` in `element-traits.ts`.
 */
export function readElementValue(element: Element | null): string | undefined {
  if (!element) return undefined;
  if (isSensitiveFormControl(element)) return undefined;
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    return element.value.slice(0, 2_000);
  }
  if (element instanceof HTMLElement && element.isContentEditable) return element.innerText.slice(0, 2_000);
  return undefined;
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

function cssString(value: string): string {
  return CSS.escape(value).replace(/"/g, '\\"');
}
