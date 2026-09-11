// Turns one element into the descriptor that travels on the wire, plus the
// field accessors that build it. The accessors are exported because the
// snapshot path judges elements by the same fields before deciding to describe
// them. Sensitive values are filtered here, not by the caller.

import { xpathFor } from "./element-finder";
import { visualDocumentBounds, visualViewportBounds } from "./visual-bounds";
import { captureSettings } from "./capture-settings";
import {
  hasClickHandler,
  isInteractableUiElement,
  isOrdinaryNonSensitiveFillControl,
  isSemanticTextElement,
  isSensitiveFormControl
} from "./element-traits";
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
  const name = accessibleName(element);
  if (name) descriptor.name = name;
  const href = linkHref(element);
  if (href) descriptor.href = href;
  if (element instanceof HTMLInputElement && element.type) descriptor.inputType = element.type;
  if (isOrdinaryNonSensitiveFillControl(element)) descriptor.hasValue = element.value.length > 0;
  if (element instanceof HTMLSelectElement) {
    descriptor.options = [...element.options].slice(0, 20).map((option) => ({
      value: option.value.slice(0, 200),
      label: (option.label || option.textContent || "").replace(/\s+/gu, " ").trim().slice(0, 200),
    }));
    if (!isSensitiveFormControl(element) && descriptor.options.some((option) => option.value === element.value)) {
      descriptor.selectedValue = element.value.slice(0, 200);
    }
  }
  const attributes: Record<string, string> = {};
  for (const attribute of ["id", "class", "name", "type", "autocomplete", "data-sensitive", "placeholder", "title", "alt", "href", "tabindex", "aria-label", "aria-disabled", "aria-expanded", "aria-controls", "aria-pressed", "aria-selected", "data-testid", "data-test", "data-cy", "disabled", "onclick"]) {
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

export function readElementValue(element: Element | null): string | undefined {
  if (!element) return undefined;
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    return element.value.slice(0, 2_000);
  }
  if (element instanceof HTMLElement && element.isContentEditable) return element.innerText.slice(0, 2_000);
  return undefined;
}

export function accessibleName(element: Element): string | undefined {
  return element.getAttribute("aria-label") ?? element.getAttribute("title") ?? element.getAttribute("alt") ?? undefined;
}

export function linkHref(element: Element): string | undefined {
  if (element instanceof HTMLAnchorElement && element.href) return element.href;
  return element.getAttribute("href") ?? element.getAttribute("xlink:href") ?? undefined;
}

/** An author-supplied identifier that survives a re-render, if the page offers one. */
export function stableElementId(element: Element): string | undefined {
  return element.getAttribute("data-testid") ??
    element.getAttribute("data-test") ??
    element.getAttribute("data-cy") ??
    element.getAttribute("id") ??
    element.getAttribute("name") ??
    undefined;
}

function cssString(value: string): string {
  return CSS.escape(value).replace(/"/g, '\\"');
}
