// What each browser action type does, expressed against capabilities the caller
// supplies rather than against the DOM directly. `action-runtime.ts` provides
// those capabilities; the action-type strings here are a contract with the
// domain action registry.

import type {
  BrowserActionCommand,
  BrowserActionResult,
  DomElementDescriptor,
  DomSnapshot,
  JsonObject,
  JsonValue
} from "./types";

export type {
  BrowserActionCommand,
  BrowserActionResult,
  DomElementDescriptor,
  DomSnapshot,
  RectDescriptor
} from "./types";

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

export async function executeContentAction(action: BrowserActionCommand, deps: ContentActionDependencies): Promise<BrowserActionResult> {
  const startedAt = Date.now();
  try {
    if (action.actionType === "web.dom.capture_snapshot" || action.actionType === "dom.capture_snapshot") {
      return deps.success(action, startedAt, "Snapshot captured.", undefined, deps.captureSnapshot());
    }
    if (action.actionType === "web.dom.wait_for_selector" || action.actionType === "dom.wait_for_selector") {
      const element = await deps.waitForElement(action.selector, action.timeoutMs);
      return deps.success(action, startedAt, "Selector found.", deps.describeElement(element), deps.captureSnapshot());
    }
    if (action.actionType === "web.dom.wait_for_text" || action.actionType === "dom.wait_for_text") {
      await deps.waitForText(action.text ?? action.value ?? "", action.timeoutMs);
      return deps.success(action, startedAt, "Text found.", undefined, deps.captureSnapshot());
    }
    if (action.actionType === "web.dom.extract" || action.actionType === "dom.extract") {
      const element = deps.resolveTarget(action);
      const extracted = deps.extractElement(element, action.options);
      return deps.success(action, startedAt, "Value extracted.", deps.describeElement(element), deps.captureSnapshot(), extracted);
    }
    if (action.actionType === "web.dom.click" || action.actionType === "dom.click") {
      const element = deps.resolveTarget(action);
      deps.scrollElementIntoView(element);
      (element as HTMLElement).click();
      return deps.success(action, startedAt, "Element clicked.", deps.describeElement(element), deps.captureSnapshot());
    }
    if (action.actionType === "web.dom.type" || action.actionType === "dom.type") {
      const element = deps.resolveTarget(action) as HTMLInputElement | HTMLTextAreaElement;
      element.focus();
      deps.setElementValue(element, action.text ?? action.value ?? "");
      deps.dispatchInputEvents(element);
      return deps.success(action, startedAt, "Text entered.", deps.describeElement(element), deps.captureSnapshot());
    }
    if (action.actionType === "web.dom.clear" || action.actionType === "dom.clear") {
      const element = deps.resolveTarget(action) as HTMLInputElement | HTMLTextAreaElement;
      element.focus();
      deps.setElementValue(element, "");
      deps.dispatchInputEvents(element);
      return deps.success(action, startedAt, "Field cleared.", deps.describeElement(element), deps.captureSnapshot());
    }
    if (action.actionType === "web.dom.select" || action.actionType === "dom.select") {
      const element = deps.resolveTarget(action) as HTMLSelectElement;
      element.focus();
      element.value = action.value ?? "";
      deps.dispatchInputEvents(element);
      return deps.success(action, startedAt, "Option selected.", deps.describeElement(element), deps.captureSnapshot());
    }
    if (action.actionType === "web.dom.scroll" || action.actionType === "dom.scroll") {
      window.scrollTo({
        left: Number(action.options?.x ?? action.coordinates?.x ?? window.scrollX),
        top: Number(action.options?.y ?? action.coordinates?.y ?? window.scrollY),
        behavior: action.options?.smooth === true ? "smooth" : "instant"
      });
      return deps.success(action, startedAt, "Page scrolled.", undefined, deps.captureSnapshot());
    }
    if (action.actionType === "web.dom.keypress" || action.actionType === "dom.keypress") {
      const target = action.selector ? deps.resolveTarget(action) : document.activeElement ?? document.body;
      const key = action.key ?? action.text ?? "";
      target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
      target.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true, cancelable: true }));
      return deps.success(action, startedAt, "Key event dispatched.", target instanceof Element ? deps.describeElement(target) : undefined, deps.captureSnapshot());
    }
    throw new Error(`Unsupported action type: ${action.actionType}`);
  } catch (error) {
    return deps.failure(action, error, startedAt);
  }
}
