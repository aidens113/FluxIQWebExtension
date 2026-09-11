// The elements the user has actually touched, and how to find them from a raw
// event. A page can style any element to behave like a control, so an event's
// composed path is better evidence of what is interactive than the DOM alone;
// remembered elements are ranked first in the next snapshot. The queue is
// bounded so a long session cannot grow it without limit.

import { hasClickHandler, isActionableElement } from "./element-traits";

const MAX_OBSERVED_EVENT_ELEMENTS = 500;

const observedEventElements = new WeakSet<Element>();
const queue: Element[] = [];

/** Elements seen in an event path, oldest first. Read by the snapshot path. */
export const observedEventElementQueue: readonly Element[] = queue;

/** Records the element a user acted on plus any click-handling ancestor on the path. */
export function rememberEventPathElements(event: Event): void {
  const target = eventTargetElement(event);
  const activationTarget = target ? pointerActivationTarget(target) ?? target : undefined;
  rememberObservedEventElement(activationTarget);
  for (const entry of event.composedPath()) {
    if (!(entry instanceof Element)) continue;
    if (entry === document.documentElement || entry === document.body) continue;
    if (!hasClickHandler(entry)) continue;
    rememberObservedEventElement(entry);
  }
}

/** True when the user has already interacted with the element, or it handles clicks. */
export function isEventBackedElement(element: Element): boolean {
  return observedEventElements.has(element) ||
    hasClickHandler(element);
}

/** The first element on the event's composed path, which sees through shadow roots. */
export function eventTargetElement(event: Event): Element | undefined {
  for (const entry of event.composedPath()) {
    if (entry instanceof Element) return entry;
  }
  return event.target instanceof Element ? event.target : undefined;
}

/** Walks up to the control that a pointer press actually activates, if there is one. */
export function pointerActivationTarget(element: Element): Element | undefined {
  let current: Element | null = element;
  for (let depth = 0; current && current !== document.documentElement && depth < 12; depth += 1) {
    if (isActionableElement(current)) return current;
    current = current.parentElement;
  }
  current = element;
  for (let depth = 0; current && current !== document.documentElement && depth < 12; depth += 1) {
    if (current instanceof HTMLElement && getComputedStyle(current).cursor === "pointer") return current;
    current = current.parentElement;
  }
  return undefined;
}

export function actionEventTarget(element: Element): Element {
  return pointerActivationTarget(element) ?? element;
}

function rememberObservedEventElement(element: Element | undefined): void {
  if (!element || observedEventElements.has(element)) return;
  observedEventElements.add(element);
  queue.push(element);
  while (queue.length > MAX_OBSERVED_EVENT_ELEMENTS) queue.shift();
}
