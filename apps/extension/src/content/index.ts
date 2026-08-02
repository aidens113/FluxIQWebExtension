type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };

type RectDescriptor = { x: number; y: number; width: number; height: number };
type DomElementDescriptor = {
  tagName: string;
  selector: string;
  text?: string | undefined;
  value?: string | undefined;
  role?: string | undefined;
  name?: string | undefined;
  href?: string | undefined;
  inputType?: string | undefined;
  bounds?: RectDescriptor | undefined;
  attributes?: Record<string, string> | undefined;
};
type DomSnapshot = {
  url: string;
  title: string;
  viewport: { width: number; height: number; scrollX: number; scrollY: number };
  focusedElement?: DomElementDescriptor | undefined;
  selectedText?: string | undefined;
  interactiveElements: DomElementDescriptor[];
};
type RecordingEventPayload = {
  kind: string;
  sequence: number;
  url: string;
  title: string;
  eventTimestampMs: number;
  element?: DomElementDescriptor | undefined;
  snapshot?: DomSnapshot | undefined;
  inputValue?: string | undefined;
  key?: string | undefined;
  scroll?: { x: number; y: number } | undefined;
  mutation?: { added: number; removed: number; attributes: number; text: number } | undefined;
  actionResult?: BrowserActionResult | undefined;
  metadata?: JsonObject | undefined;
};
type BrowserActionCommand = {
  commandId: string;
  actionType: string;
  selector?: string | undefined;
  text?: string | undefined;
  value?: string | undefined;
  key?: string | undefined;
  timeoutMs?: number | undefined;
  coordinates?: { x: number; y: number } | undefined;
  options?: JsonObject | undefined;
};
type BrowserActionResult = {
  commandId: string;
  actionType: string;
  status: "succeeded" | "failed" | "timed_out" | "cancelled";
  message?: string | undefined;
  url?: string | undefined;
  title?: string | undefined;
  element?: DomElementDescriptor | undefined;
  snapshot?: DomSnapshot | undefined;
  extracted?: JsonValue | undefined;
  startedAt: number;
  finishedAt: number;
};

const CONTENT_EVENT = "fluxiq.contentEvent";
const CONTENT_READY = "fluxiq.contentReady";
let recording = false;
let sequence = 0;
let captureMutations = true;
let captureInputValues = true;
let captureSnapshots = true;
let scrollTimer: ReturnType<typeof setTimeout> | undefined;
let mutationTimer: ReturnType<typeof setTimeout> | undefined;
let pendingMutation = { added: 0, removed: 0, attributes: 0, text: 0 };

sendReady();

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  const typed = message as { type?: string; recording?: boolean; settings?: { captureMutations?: boolean; captureInputValues?: boolean; captureSnapshots?: boolean }; action?: BrowserActionCommand; commandId?: string };
  if (typed.type === "fluxiq.ping") {
    sendResponse({ ok: true });
    return false;
  }
  if (typed.type === "recording") {
    recording = Boolean(typed.recording);
    captureMutations = typed.settings?.captureMutations ?? captureMutations;
    captureInputValues = typed.settings?.captureInputValues ?? captureInputValues;
    captureSnapshots = typed.settings?.captureSnapshots ?? captureSnapshots;
    sendResponse({ ok: true });
    return true;
  }
  if (typed.type === "captureSnapshot") {
    sendResponse(captureSnapshot());
    return true;
  }
  if (typed.type === "executeAction" && typed.action) {
    void executeAction(typed.action)
      .then(sendResponse)
      .catch((error: unknown) => sendResponse(actionFailure(typed.action as BrowserActionCommand, error)));
    return true;
  }
  return false;
});

document.addEventListener("click", (event) => {
  if (!event.isTrusted) return;
  const target = event.target instanceof Element ? event.target : null;
  emit("dom.click", compactObject({ element: target ? describeElement(target) : undefined, metadata: pointerMetadata(event) }));
}, true);

document.addEventListener("input", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  emit("dom.input", compactObject({
    element: target ? describeElement(target) : undefined,
    inputValue: captureInputValues ? readElementValue(target) : undefined
  }));
}, true);

document.addEventListener("change", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  emit("dom.change", compactObject({
    element: target ? describeElement(target) : undefined,
    inputValue: captureInputValues ? readElementValue(target) : undefined
  }));
}, true);

document.addEventListener("submit", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  emit("dom.submit", compactObject({ element: target ? describeElement(target) : undefined }));
}, true);

document.addEventListener("focus", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  emit("dom.focus", compactObject({ element: target ? describeElement(target) : undefined }));
}, true);

document.addEventListener("blur", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  emit("dom.blur", compactObject({ element: target ? describeElement(target) : undefined }));
}, true);

document.addEventListener("keydown", (event) => {
  if (!event.isTrusted) return;
  emit("dom.keydown", compactObject({
    key: event.key,
    element: event.target instanceof Element ? describeElement(event.target) : undefined,
    metadata: {
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey
    }
  }));
}, true);

document.addEventListener("wheel", (event) => {
  if (!event.isTrusted) return;
  emit("dom.wheel", compactObject({
    scroll: { x: window.scrollX, y: window.scrollY },
    metadata: {
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      deltaZ: event.deltaZ,
      deltaMode: event.deltaMode,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey
    }
  }));
}, true);

window.addEventListener("scroll", () => {
  if (scrollTimer) clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => {
    emit("dom.scroll", { scroll: { x: window.scrollX, y: window.scrollY } });
  }, 150);
}, true);

const observer = new MutationObserver((mutations) => {
  if (!captureMutations || !recording) return;
  for (const mutation of mutations) {
    pendingMutation.added += mutation.addedNodes.length;
    pendingMutation.removed += mutation.removedNodes.length;
    if (mutation.type === "attributes") pendingMutation.attributes += 1;
    if (mutation.type === "characterData") pendingMutation.text += 1;
  }
  if (mutationTimer) clearTimeout(mutationTimer);
  mutationTimer = setTimeout(() => {
    emit("dom.mutation", { mutation: pendingMutation });
    pendingMutation = { added: 0, removed: 0, attributes: 0, text: 0 };
  }, 500);
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  characterData: true
});

function sendReady(): void {
  const payload = basePayload("content.ready", {
    snapshot: captureSnapshot(),
    metadata: { readyState: document.readyState }
  });
  void chrome.runtime.sendMessage({ type: CONTENT_READY, payload });
}

function emit(kind: string, details: Partial<RecordingEventPayload>): void {
  if (!recording && kind !== "content.ready") return;
  const payload = basePayload(kind, details);
  void chrome.runtime.sendMessage({ type: CONTENT_EVENT, payload });
}

function basePayload(kind: string, details: Partial<RecordingEventPayload>): RecordingEventPayload {
  const payload: RecordingEventPayload = {
    kind,
    sequence: ++sequence,
    url: location.href,
    title: document.title,
    eventTimestampMs: Date.now()
  };
  if (details.element) payload.element = details.element;
  if (details.snapshot && captureSnapshots) payload.snapshot = details.snapshot;
  if (details.inputValue !== undefined) payload.inputValue = details.inputValue;
  if (details.key !== undefined) payload.key = details.key;
  if (details.scroll) payload.scroll = details.scroll;
  if (details.mutation) payload.mutation = details.mutation;
  if (details.actionResult) payload.actionResult = details.actionResult;
  if (details.metadata) payload.metadata = details.metadata;
  return payload;
}

async function executeAction(action: BrowserActionCommand): Promise<BrowserActionResult> {
  const startedAt = Date.now();
  try {
    if (action.actionType === "web.dom.capture_snapshot" || action.actionType === "dom.capture_snapshot") {
      return success(action, startedAt, "Snapshot captured.", undefined, captureSnapshot());
    }
    if (action.actionType === "web.dom.wait_for_selector" || action.actionType === "dom.wait_for_selector") {
      const element = await waitForElement(action.selector, action.timeoutMs);
      return success(action, startedAt, "Selector found.", describeElement(element));
    }
    if (action.actionType === "web.dom.wait_for_text" || action.actionType === "dom.wait_for_text") {
      await waitForText(action.text ?? action.value ?? "", action.timeoutMs);
      return success(action, startedAt, "Text found.");
    }
    if (action.actionType === "web.dom.extract" || action.actionType === "dom.extract") {
      const element = resolveTarget(action);
      const extracted = extractElement(element, action.options);
      return success(action, startedAt, "Value extracted.", describeElement(element), undefined, extracted);
    }
    if (action.actionType === "web.dom.click" || action.actionType === "dom.click") {
      const element = resolveTarget(action);
      scrollElementIntoView(element);
      (element as HTMLElement).click();
      return success(action, startedAt, "Element clicked.", describeElement(element), captureSnapshot());
    }
    if (action.actionType === "web.dom.type" || action.actionType === "dom.type") {
      const element = resolveTarget(action) as HTMLInputElement | HTMLTextAreaElement;
      element.focus();
      setElementValue(element, action.text ?? action.value ?? "");
      dispatchInputEvents(element);
      return success(action, startedAt, "Text entered.", describeElement(element), captureSnapshot());
    }
    if (action.actionType === "web.dom.clear" || action.actionType === "dom.clear") {
      const element = resolveTarget(action) as HTMLInputElement | HTMLTextAreaElement;
      element.focus();
      setElementValue(element, "");
      dispatchInputEvents(element);
      return success(action, startedAt, "Field cleared.", describeElement(element), captureSnapshot());
    }
    if (action.actionType === "web.dom.select" || action.actionType === "dom.select") {
      const element = resolveTarget(action) as HTMLSelectElement;
      element.focus();
      element.value = action.value ?? "";
      dispatchInputEvents(element);
      return success(action, startedAt, "Option selected.", describeElement(element), captureSnapshot());
    }
    if (action.actionType === "web.dom.scroll" || action.actionType === "dom.scroll") {
      window.scrollTo({
        left: Number(action.options?.x ?? action.coordinates?.x ?? window.scrollX),
        top: Number(action.options?.y ?? action.coordinates?.y ?? window.scrollY),
        behavior: action.options?.smooth === true ? "smooth" : "instant"
      });
      return success(action, startedAt, "Page scrolled.", undefined, captureSnapshot());
    }
    if (action.actionType === "web.dom.keypress" || action.actionType === "dom.keypress") {
      const target = action.selector ? resolveTarget(action) : document.activeElement ?? document.body;
      const key = action.key ?? action.text ?? "";
      target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
      target.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true, cancelable: true }));
      return success(action, startedAt, "Key event dispatched.", target instanceof Element ? describeElement(target) : undefined);
    }
    throw new Error(`Unsupported action type: ${action.actionType}`);
  } catch (error) {
    return actionFailure(action, error, startedAt);
  }
}

function resolveTarget(action: BrowserActionCommand): Element {
  if (action.selector) {
    const element = document.querySelector(action.selector);
    if (!element) throw new Error(`No element matches selector: ${action.selector}`);
    return element;
  }
  if (action.coordinates) {
    const element = document.elementFromPoint(action.coordinates.x, action.coordinates.y);
    if (!element) throw new Error("No element exists at the requested coordinates.");
    return element;
  }
  const active = document.activeElement;
  if (active) return active;
  throw new Error("No selector, coordinates, or active element was available.");
}

function success(
  action: BrowserActionCommand,
  startedAt: number,
  message: string,
  element?: DomElementDescriptor,
  snapshot?: DomSnapshot,
  extracted?: JsonValue
): BrowserActionResult {
  const result: BrowserActionResult = {
    commandId: action.commandId,
    actionType: action.actionType,
    status: "succeeded",
    message,
    url: location.href,
    title: document.title,
    startedAt,
    finishedAt: Date.now()
  };
  if (element) result.element = element;
  if (snapshot) result.snapshot = snapshot;
  if (extracted !== undefined) result.extracted = extracted;
  return result;
}

function actionFailure(action: BrowserActionCommand, error: unknown, startedAt = Date.now()): BrowserActionResult {
  return {
    commandId: action.commandId,
    actionType: action.actionType,
    status: "failed",
    message: error instanceof Error ? error.message : "Action failed.",
    url: location.href,
    title: document.title,
    startedAt,
    finishedAt: Date.now()
  };
}

function captureSnapshot(): DomSnapshot {
  const snapshot: DomSnapshot = {
    url: location.href,
    title: document.title,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY
    },
    interactiveElements: [...document.querySelectorAll("a, button, input, textarea, select, [role=button], [contenteditable=true]")]
      .slice(0, 200)
      .map((element) => describeElement(element))
  };
  const focused = document.activeElement instanceof Element ? describeElement(document.activeElement) : undefined;
  if (focused) snapshot.focusedElement = focused;
  const selectedText = window.getSelection()?.toString();
  if (selectedText) snapshot.selectedText = selectedText.slice(0, 2_000);
  return snapshot;
}

function describeElement(element: Element): DomElementDescriptor {
  const rect = element.getBoundingClientRect();
  const descriptor: DomElementDescriptor = {
    tagName: element.tagName.toLowerCase(),
    selector: selectorFor(element),
    bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
  };
  const text = visibleText(element);
  if (text) descriptor.text = text;
  const value = readElementValue(element);
  if (value !== undefined && captureInputValues) descriptor.value = value;
  const role = element.getAttribute("role");
  if (role) descriptor.role = role;
  const name = accessibleName(element);
  if (name) descriptor.name = name;
  if (element instanceof HTMLAnchorElement && element.href) descriptor.href = element.href;
  if (element instanceof HTMLInputElement && element.type) descriptor.inputType = element.type;
  const attributes: Record<string, string> = {};
  for (const attribute of ["id", "class", "name", "type", "placeholder", "aria-label", "data-testid"]) {
    const value = element.getAttribute(attribute);
    if (value) attributes[attribute] = value.slice(0, 500);
  }
  if (Object.keys(attributes).length) descriptor.attributes = attributes;
  return descriptor;
}

function selectorFor(element: Element): string {
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

function visibleText(element: Element): string | undefined {
  const text = element.textContent?.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, 500) : undefined;
}

function readElementValue(element: Element | null): string | undefined {
  if (!element) return undefined;
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    return element.value.slice(0, 2_000);
  }
  if (element instanceof HTMLElement && element.isContentEditable) return element.innerText.slice(0, 2_000);
  return undefined;
}

function accessibleName(element: Element): string | undefined {
  return element.getAttribute("aria-label") ?? element.getAttribute("title") ?? element.getAttribute("alt") ?? undefined;
}

function pointerMetadata(event: MouseEvent): JsonObject {
  return {
    clientX: event.clientX,
    clientY: event.clientY,
    button: event.button,
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey
  };
}

function cssString(value: string): string {
  return CSS.escape(value).replace(/"/g, '\\"');
}

function scrollElementIntoView(element: Element): void {
  element.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
}

function setElementValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  descriptor?.set?.call(element, value);
}

function dispatchInputEvents(element: Element): void {
  element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function waitForElement(selector: string | undefined, timeoutMs = 10_000): Promise<Element> {
  if (!selector) return Promise.reject(new Error("Selector is required."));
  const existing = document.querySelector(selector);
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      waitObserver.disconnect();
      reject(new Error(`Timed out waiting for selector: ${selector}`));
    }, timeoutMs);
    const waitObserver = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (!element) return;
      clearTimeout(timeout);
      waitObserver.disconnect();
      resolve(element);
    });
    waitObserver.observe(document.documentElement, { childList: true, subtree: true });
  });
}

function waitForText(text: string, timeoutMs = 10_000): Promise<void> {
  if (document.body.innerText.includes(text)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      waitObserver.disconnect();
      reject(new Error(`Timed out waiting for text: ${text}`));
    }, timeoutMs);
    const waitObserver = new MutationObserver(() => {
      if (!document.body.innerText.includes(text)) return;
      clearTimeout(timeout);
      waitObserver.disconnect();
      resolve();
    });
    waitObserver.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  });
}

function extractElement(element: Element, options?: JsonObject): JsonValue {
  const mode = options?.mode;
  if (mode === "html") return element.innerHTML;
  if (mode === "attribute" && typeof options?.attribute === "string") return element.getAttribute(options.attribute) ?? "";
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return element.value;
  return element.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

function compactObject<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}
