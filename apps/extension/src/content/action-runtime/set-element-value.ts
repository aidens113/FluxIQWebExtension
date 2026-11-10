// Writes a field's value through the prototype's native setter, bypassing any
// setter a framework installed on the element itself.

import { actedClock } from "./acted-at";

export function setElementValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  actedClock.note();
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  descriptor?.set?.call(element, value);
}
