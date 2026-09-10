type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };

export type RectDescriptor = { x: number; y: number; width: number; height: number };
export type DomElementDescriptor = {
  tagName: string;
  selector: string;
  xpath?: string | undefined;
  id?: string | undefined;
  classNames?: string[] | undefined;
  visibleText?: string | undefined;
  text?: string | undefined;
  value?: string | undefined;
  role?: string | undefined;
  name?: string | undefined;
  href?: string | undefined;
  inputType?: string | undefined;
  hasValue?: boolean | undefined;
  selectedValue?: string | undefined;
  bounds?: RectDescriptor | undefined;
  documentBounds?: RectDescriptor | undefined;
  isVisibleOnViewport?: boolean | undefined;
  hasClickHandler?: boolean | undefined;
  attributes?: Record<string, string> | undefined;
  options?: Array<{ value: string; label: string }> | undefined;
};
export type DomSnapshot = {
  url: string;
  title: string;
  viewport: { width: number; height: number; scrollX: number; scrollY: number; documentWidth?: number | undefined; documentHeight?: number | undefined; devicePixelRatio?: number | undefined };
  frame?: { isTop: boolean; viewportOffset?: RectDescriptor | undefined } | undefined;
  focusedElement?: DomElementDescriptor | undefined;
  selectedText?: string | undefined;
  interactiveElements: DomElementDescriptor[];
};
export type BrowserActionCommand = {
  commandId: string;
  actionType: string;
  selector?: string | undefined;
  text?: string | undefined;
  value?: string | undefined;
  key?: string | undefined;
  timeoutMs?: number | undefined;
  coordinates?: { x: number; y: number } | undefined;
  visualTarget?: {
    bounds?: RectDescriptor | undefined;
    documentBounds?: RectDescriptor | undefined;
    anchor?: { type: "bounds"; bounds: RectDescriptor } | undefined;
    selector?: string | undefined;
  } | undefined;
  options?: JsonObject | undefined;
};
export type BrowserActionResult = {
  commandId: string;
  actionType: string;
  status: "succeeded" | "failed" | "timed_out" | "cancelled";
  message?: string | undefined;
  url?: string | undefined;
  title?: string | undefined;
  element?: DomElementDescriptor | undefined;
  visualTarget?: BrowserActionCommand["visualTarget"] | undefined;
  snapshot?: DomSnapshot | undefined;
  extracted?: JsonValue | undefined;
  startedAt: number;
  finishedAt: number;
};

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
