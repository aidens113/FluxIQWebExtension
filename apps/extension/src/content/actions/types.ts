// The capabilities every action verb in this directory receives from its
// caller. `action-runtime/` supplies them from the page.

import type {
  BrowserActionCommand,
  BrowserActionResult,
  DomElementDescriptor,
  DomSnapshot,
  JsonObject,
  JsonValue
} from "../types";

export type ContentActionDependencies = {
  captureSnapshot(): DomSnapshot;
  resolveTarget(action: BrowserActionCommand): Element;
  describeElement(element: Element): DomElementDescriptor;
  waitForElement(selector: string | undefined, timeoutMs?: number): Promise<Element>;
  waitForText(text: string, timeoutMs?: number): Promise<void>;
  extractElement(element: Element, options?: JsonObject): JsonValue;
  scrollElementIntoView(element: Element): void;
  setElementValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void;
  dispatchInputEvents(element: Element): void;
  success(action: BrowserActionCommand, startedAt: number, message: string, element?: DomElementDescriptor, snapshot?: DomSnapshot, extracted?: JsonValue): BrowserActionResult;
  failure(action: BrowserActionCommand, error: unknown, startedAt?: number): BrowserActionResult;
};
