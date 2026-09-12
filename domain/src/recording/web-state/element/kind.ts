import type { WebAutomationElementStateInput } from "../types";

// What kind of thing an element is, judged from its tag, its ARIA role and the
// attributes a page uses to make an arbitrary node behave like a control.
// These are the page's own claims, read without a DOM: the recorder ships tag,
// role and attributes, and nothing here may consult a live element. Selection
// ranks with them; the element payload reports `isEnabled`.

// A control a person can operate directly.
export function isLikelyActionableElement(element: WebAutomationElementStateInput): boolean {
  const tagName = element.tagName.toLowerCase();
  const role = element.role?.toLowerCase();
  const inputType = element.inputType?.toLowerCase();
  return tagName === "button" ||
    tagName === "a" ||
    tagName === "select" ||
    tagName === "textarea" ||
    tagName === "summary" ||
    tagName === "label" ||
    tagName === "input" && inputType !== "hidden" ||
    role === "button" ||
    role === "link" ||
    role === "menuitem" ||
    role === "checkbox" ||
    role === "radio" ||
    role === "tab" ||
    role === "switch" ||
    element.hasClickHandler === true ||
    element.attributes?.onclick !== undefined;
}

// Actionable, or wired for interaction some other way: focusable, or carrying
// one of the ARIA state attributes only an interactive widget declares.
export function isLikelyInteractableElement(element: WebAutomationElementStateInput): boolean {
  return isLikelyActionableElement(element) ||
    element.attributes?.tabindex !== undefined ||
    element.attributes?.["aria-expanded"] !== undefined ||
    element.attributes?.["aria-controls"] !== undefined ||
    element.attributes?.["aria-pressed"] !== undefined ||
    element.attributes?.["aria-selected"] !== undefined;
}

// The controls a page's primary navigation and commands are built from. They
// are captured ahead of everything else when the element budget is tight.
export function isPrimaryControlElement(element: WebAutomationElementStateInput): boolean {
  const tagName = element.tagName.toLowerCase();
  const role = element.role?.toLowerCase();
  return tagName === "button" ||
    tagName === "a" ||
    tagName === "summary" ||
    role === "button" ||
    role === "link" ||
    role === "menuitem" ||
    role === "tab";
}

// Content elements whose text is evidence rather than decoration: a heading, a
// paragraph, a table cell, a list item.
export function isSemanticTextElement(element: WebAutomationElementStateInput): boolean {
  const tagName = element.tagName.toLowerCase();
  return tagName === "p" ||
    tagName === "li" ||
    tagName === "td" ||
    tagName === "th" ||
    tagName === "dt" ||
    tagName === "dd" ||
    tagName === "figcaption" ||
    tagName === "blockquote" ||
    /^h[1-6]$/.test(tagName);
}

// Operable right now. Absence of the attribute is the enabled case, so an
// element that never declares either is enabled.
export function isEnabled(element: WebAutomationElementStateInput): boolean {
  return element.attributes?.disabled === undefined && element.attributes?.["aria-disabled"] !== "true";
}
