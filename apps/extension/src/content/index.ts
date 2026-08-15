type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };

import { findClosestFingerprint, xpathFor } from "./element-finder";

type RectDescriptor = { x: number; y: number; width: number; height: number };
type DomElementDescriptor = {
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
  bounds?: RectDescriptor | undefined;
  attributes?: Record<string, string> | undefined;
};
type DomSnapshot = {
  url: string;
  title: string;
  viewport: { width: number; height: number; scrollX: number; scrollY: number; devicePixelRatio?: number | undefined };
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
const SNAPSHOT_CANDIDATE_SELECTOR = [
  "a[href]",
  "button",
  "input:not([type=hidden])",
  "textarea",
  "select",
  "summary",
  "label",
  "[role=button]",
  "[role=link]",
  "[role=menuitem]",
  "[role=checkbox]",
  "[role=radio]",
  "[role=tab]",
  "[role=switch]",
  "[contenteditable=true]",
  "[onclick]",
  "[aria-label]",
  "[data-testid]",
  "[data-test]",
  "[data-cy]",
  "[placeholder]",
  "[title]",
  "[alt]",
  "[role]",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "span",
  "div",
  "li",
  "td",
  "th",
  "strong",
  "em",
  "small"
].join(",");
const MAX_SNAPSHOT_CANDIDATES = 150;
const MAX_SNAPSHOT_SCAN_ELEMENTS = 2_000;
const POINTER_CLICK_DEDUPE_MS = 750;
let recording = false;
let sequence = 0;
let captureMutations = true;
let captureInputValues = true;
let captureSnapshots = true;
let scrollTimer: ReturnType<typeof setTimeout> | undefined;
let mutationTimer: ReturnType<typeof setTimeout> | undefined;
let inputTimer: ReturnType<typeof setTimeout> | undefined;
let pendingInput: { element: Element; inputValue?: string | undefined } | undefined;
let pendingMutation = { added: 0, removed: 0, attributes: 0, text: 0 };
let lastPointerActivation: { signature: string; timestamp: number } | undefined;

sendReady();

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  const typed = message as { type?: string; recording?: boolean; settings?: { captureMutations?: boolean; captureInputValues?: boolean; captureSnapshots?: boolean }; action?: BrowserActionCommand; commandId?: string };
  if (typed.type === "fluxiq.ping") {
    sendResponse({ ok: true });
    return false;
  }
  if (typed.type === "recording") {
    if (!typed.recording) flushPendingInput();
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

document.addEventListener("pointerdown", (event) => {
  if (!event.isTrusted) return;
  if (event.button !== 0 || event.isPrimary === false) return;
  const target = event.target instanceof Element ? pointerActivationTarget(event.target) : null;
  if (!target) return;
  lastPointerActivation = { signature: eventTargetSignature(target), timestamp: Date.now() };
  emit("dom.click", compactObject({
    element: describeElement(target),
    metadata: compactObject({
      ...pointerMetadata(event),
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      sourceEvent: "pointerdown"
    })
  }));
}, true);

document.addEventListener("click", (event) => {
  if (!event.isTrusted) return;
  const target = event.target instanceof Element ? actionEventTarget(event.target) : null;
  if (target && shouldSkipClickAfterPointerActivation(target)) return;
  emit("dom.click", compactObject({
    element: target ? describeElement(target) : undefined,
    metadata: compactObject({
      ...pointerMetadata(event),
      sourceEvent: "click"
    })
  }));
}, true);

document.addEventListener("input", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (target && isTextEntryElement(target)) {
    scheduleInputEvent(target);
    return;
  }
  emitInputEvent(target);
}, true);

document.addEventListener("change", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (target && isTextEntryElement(target)) {
    flushPendingInput();
    return;
  }
  if (target && !shouldRecordChangeEvent(target)) return;
  emit("dom.change", compactObject({
    element: target ? describeElement(target) : undefined,
    inputValue: captureInputValues ? readElementValue(target) : undefined
  }));
}, true);

document.addEventListener("submit", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  emit("dom.submit", compactObject({ element: target ? describeElement(target) : undefined }));
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
  if (scrollTimer) clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => {
    emit("dom.scroll", {
      scroll: { x: window.scrollX, y: window.scrollY },
      metadata: {
        sourceEvent: "wheel",
        deltaX: event.deltaX,
        deltaY: event.deltaY,
        deltaZ: event.deltaZ,
        deltaMode: event.deltaMode,
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey
      }
    });
  }, 400);
}, true);

window.addEventListener("scroll", () => {
  if (scrollTimer) clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => {
    emit("dom.scroll", { scroll: { x: window.scrollX, y: window.scrollY } });
  }, 400);
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

function scheduleInputEvent(element: Element): void {
  pendingInput = { element, inputValue: captureInputValues ? readElementValue(element) : undefined };
  if (inputTimer) clearTimeout(inputTimer);
  inputTimer = setTimeout(() => flushPendingInput(), 350);
}

function flushPendingInput(): void {
  if (inputTimer) clearTimeout(inputTimer);
  inputTimer = undefined;
  const pending = pendingInput;
  pendingInput = undefined;
  if (!pending) return;
  emit("dom.input", compactObject({
    element: describeElement(pending.element),
    inputValue: pending.inputValue
  }));
}

function emitInputEvent(element: Element | null): void {
  emit("dom.input", compactObject({
    element: element ? describeElement(element) : undefined,
    inputValue: captureInputValues ? readElementValue(element) : undefined
  }));
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
  if (captureSnapshots) {
    const snapshot = details.snapshot ?? (shouldAttachStateSnapshot(kind) ? captureSnapshot() : undefined);
    if (snapshot) payload.snapshot = snapshot;
  }
  if (details.inputValue !== undefined) payload.inputValue = details.inputValue;
  if (details.key !== undefined) payload.key = details.key;
  if (details.scroll) payload.scroll = details.scroll;
  if (details.mutation) payload.mutation = details.mutation;
  if (details.actionResult) payload.actionResult = details.actionResult;
  if (details.metadata) payload.metadata = details.metadata;
  return payload;
}

function shouldAttachStateSnapshot(kind: string): boolean {
  return kind === "dom.click" ||
    kind === "dom.input" ||
    kind === "dom.change" ||
    kind === "dom.submit" ||
    kind === "dom.keydown";
}

async function executeAction(action: BrowserActionCommand): Promise<BrowserActionResult> {
  const startedAt = Date.now();
  try {
    if (action.actionType === "web.dom.capture_snapshot" || action.actionType === "dom.capture_snapshot") {
      return success(action, startedAt, "Snapshot captured.", undefined, captureSnapshot());
    }
  if (action.actionType === "web.dom.wait_for_selector" || action.actionType === "dom.wait_for_selector") {
      const element = await waitForElement(action.selector, action.timeoutMs);
      return success(action, startedAt, "Selector found.", describeElement(element), captureSnapshot());
    }
    if (action.actionType === "web.dom.wait_for_text" || action.actionType === "dom.wait_for_text") {
      await waitForText(action.text ?? action.value ?? "", action.timeoutMs);
      return success(action, startedAt, "Text found.", undefined, captureSnapshot());
    }
    if (action.actionType === "web.dom.extract" || action.actionType === "dom.extract") {
      const element = resolveTarget(action);
      const extracted = extractElement(element, action.options);
      return success(action, startedAt, "Value extracted.", describeElement(element), captureSnapshot(), extracted);
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
      return success(action, startedAt, "Key event dispatched.", target instanceof Element ? describeElement(target) : undefined, captureSnapshot());
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
  const fingerprint = action.options?.element;
  if (fingerprint && typeof fingerprint === "object" && !Array.isArray(fingerprint)) {
    const element = findClosestFingerprint(fingerprint as Parameters<typeof findClosestFingerprint>[0]);
    if (element) return element;
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
  if (snapshot ?? captureSnapshots) result.snapshot = snapshot ?? captureSnapshot();
  if (extracted !== undefined) result.extracted = extracted;
  return result;
}

function actionFailure(action: BrowserActionCommand, error: unknown, startedAt = Date.now()): BrowserActionResult {
  const snapshot = captureSnapshots ? captureSnapshot() : undefined;
  return {
    commandId: action.commandId,
    actionType: action.actionType,
    status: "failed",
    message: error instanceof Error ? error.message : "Action failed.",
    url: location.href,
    title: document.title,
    ...(snapshot ? { snapshot } : {}),
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
      scrollY: window.scrollY,
      devicePixelRatio: window.devicePixelRatio
    },
    interactiveElements: snapshotElements()
  };
  const focused = document.activeElement instanceof Element ? describeElement(document.activeElement) : undefined;
  if (focused) snapshot.focusedElement = focused;
  const selectedText = window.getSelection()?.toString();
  if (selectedText) snapshot.selectedText = selectedText.slice(0, 2_000);
  return snapshot;
}

function describeElement(element: Element): DomElementDescriptor {
  const bounds = visibleViewportBounds(element);
  const descriptor: DomElementDescriptor = {
    tagName: element.tagName.toLowerCase(),
    selector: selectorFor(element)
  };
  if (bounds) descriptor.bounds = bounds;
  const text = visibleText(element);
  if (text) {
    descriptor.text = text;
    descriptor.visibleText = text;
  }
  if (element.id) descriptor.id = element.id;
  const classNames = [...element.classList];
  if (classNames.length) descriptor.classNames = classNames;
  descriptor.xpath = xpathFor(element);
  const value = readElementValue(element);
  if (value !== undefined && captureInputValues) descriptor.value = value;
  const role = element.getAttribute("role");
  if (role) descriptor.role = role;
  const name = accessibleName(element);
  if (name) descriptor.name = name;
  if (element instanceof HTMLAnchorElement && element.href) descriptor.href = element.href;
  if (element instanceof HTMLInputElement && element.type) descriptor.inputType = element.type;
  const attributes: Record<string, string> = {};
  for (const attribute of ["id", "class", "name", "type", "placeholder", "title", "alt", "href", "tabindex", "aria-label", "aria-disabled", "aria-expanded", "aria-controls", "aria-pressed", "aria-selected", "data-testid", "data-test", "data-cy", "disabled", "onclick"]) {
    const value = element.getAttribute(attribute);
    if (value !== null) attributes[attribute] = value.slice(0, 500);
  }
  if (Object.keys(attributes).length) descriptor.attributes = attributes;
  return descriptor;
}

function snapshotElements(): DomElementDescriptor[] {
  const seen = new Set<Element>();
  const candidates: Element[] = [];
  for (const element of [...document.querySelectorAll(SNAPSHOT_CANDIDATE_SELECTOR)].slice(0, MAX_SNAPSHOT_SCAN_ELEMENTS)) {
    if (seen.has(element) || !shouldIncludeSnapshotElement(element)) continue;
    seen.add(element);
    candidates.push(element);
  }
  return candidates
    .sort((left, right) =>
      snapshotElementBucket(left) - snapshotElementBucket(right) ||
      elementPriority(right) - elementPriority(left) ||
      documentOrder(left, right)
    )
    .slice(0, MAX_SNAPSHOT_CANDIDATES)
    .map((element) => describeElement(element));
}

function shouldIncludeSnapshotElement(element: Element): boolean {
  if (element.closest("script, style, noscript, template")) return false;
  const bounds = visibleViewportBounds(element);
  if (!bounds) return false;
  const style = getComputedStyle(element);
  if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) return false;
  return hasMeaningfulElementIdentity(element);
}

function snapshotElementBucket(element: Element): number {
  if (isPrimaryControlElement(element)) return 0;
  if (isInteractableUiElement(element)) return 1;
  if (meaningfulText(visibleText(element)) || meaningfulText(accessibleName(element)) || meaningfulText(readElementValue(element))) return 2;
  if (visibleViewportBounds(element) && stableElementId(element)) return 3;
  return 4;
}

function hasMeaningfulElementIdentity(element: Element): boolean {
  return Boolean(
    stableElementId(element) ||
    meaningfulText(accessibleName(element)) ||
    meaningfulText(visibleText(element)) ||
    meaningfulText(readElementValue(element)) ||
    meaningfulText(element.getAttribute("title")) ||
    meaningfulText(element.getAttribute("alt")) ||
    meaningfulText(element.getAttribute("placeholder")) ||
    meaningfulText(element.getAttribute("href"))
  );
}

function visibleViewportBounds(element: Element): RectDescriptor | undefined {
  const rect = element.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const left = Math.max(0, rect.left);
  const top = Math.max(0, rect.top);
  const right = Math.min(viewportWidth, rect.right);
  const bottom = Math.min(viewportHeight, rect.bottom);
  const width = right - left;
  const height = bottom - top;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 2 || height < 2) return undefined;
  return {
    x: Math.round(left * 100) / 100,
    y: Math.round(top * 100) / 100,
    width: Math.round(width * 100) / 100,
    height: Math.round(height * 100) / 100
  };
}

function elementPriority(element: Element): number {
  let score = 0;
  if (isInteractableUiElement(element)) score += 200;
  if (isActionableElement(element)) score += 100;
  if (stableElementId(element)) score += 60;
  if (meaningfulText(accessibleName(element))) score += 45;
  if (meaningfulText(readElementValue(element))) score += 35;
  if (meaningfulText(visibleText(element))) score += 25;
  const bounds = visibleViewportBounds(element);
  if (bounds) score += Math.min(20, Math.sqrt(bounds.width * bounds.height) / 8);
  return score;
}

function documentOrder(left: Element, right: Element): number {
  if (left === right) return 0;
  return left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}

function isActionableElement(element: Element): boolean {
  const tagName = element.tagName.toLowerCase();
  const role = element.getAttribute("role")?.toLowerCase();
  return tagName === "a" ||
    tagName === "button" ||
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    tagName === "summary" ||
    tagName === "label" ||
    role === "button" ||
    role === "link" ||
    role === "menuitem" ||
    role === "checkbox" ||
    role === "radio" ||
    role === "tab" ||
    role === "switch" ||
    element.hasAttribute("onclick") ||
    element instanceof HTMLElement && element.isContentEditable;
}

function isInteractableUiElement(element: Element): boolean {
  return isActionableElement(element) ||
    element instanceof HTMLElement && getComputedStyle(element).cursor === "pointer" ||
    element.hasAttribute("tabindex") ||
    element.hasAttribute("aria-expanded") ||
    element.hasAttribute("aria-controls") ||
    element.hasAttribute("aria-pressed") ||
    element.hasAttribute("aria-selected");
}

function isPrimaryControlElement(element: Element): boolean {
  const tagName = element.tagName.toLowerCase();
  const role = element.getAttribute("role")?.toLowerCase();
  return tagName === "button" ||
    tagName === "a" ||
    tagName === "summary" ||
    role === "button" ||
    role === "link" ||
    role === "menuitem" ||
    role === "tab";
}

function actionEventTarget(element: Element): Element {
  return pointerActivationTarget(element) ?? element;
}

function pointerActivationTarget(element: Element): Element | undefined {
  let current: Element | null = element;
  for (let depth = 0; current && current !== document.documentElement && depth < 6; depth += 1) {
    if (isActionableElement(current) || getComputedStyle(current).cursor === "pointer") return current;
    current = current.parentElement;
  }
  return undefined;
}

function eventTargetSignature(element: Element): string {
  const rect = element.getBoundingClientRect();
  return [
    selectorFor(element),
    Math.round(rect.left),
    Math.round(rect.top),
    Math.round(rect.width),
    Math.round(rect.height)
  ].join("|");
}

function shouldSkipClickAfterPointerActivation(element: Element): boolean {
  if (!lastPointerActivation) return false;
  if (Date.now() - lastPointerActivation.timestamp > POINTER_CLICK_DEDUPE_MS) return false;
  return lastPointerActivation.signature === eventTargetSignature(element);
}

function stableElementId(element: Element): string | undefined {
  return element.getAttribute("data-testid") ??
    element.getAttribute("data-test") ??
    element.getAttribute("data-cy") ??
    element.getAttribute("id") ??
    element.getAttribute("name") ??
    undefined;
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

function meaningfulText(value: string | undefined | null): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function readElementValue(element: Element | null): string | undefined {
  if (!element) return undefined;
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    return element.value.slice(0, 2_000);
  }
  if (element instanceof HTMLElement && element.isContentEditable) return element.innerText.slice(0, 2_000);
  return undefined;
}

function isTextEntryElement(element: Element): boolean {
  if (element instanceof HTMLTextAreaElement) return true;
  if (element instanceof HTMLElement && element.isContentEditable) return true;
  if (!(element instanceof HTMLInputElement)) return false;
  const type = element.type.toLowerCase();
  return type === "" ||
    type === "text" ||
    type === "search" ||
    type === "email" ||
    type === "password" ||
    type === "tel" ||
    type === "url" ||
    type === "number";
}

function shouldRecordChangeEvent(element: Element): boolean {
  if (element instanceof HTMLSelectElement) return true;
  if (!(element instanceof HTMLInputElement)) return true;
  const type = element.type.toLowerCase();
  return type === "checkbox" ||
    type === "radio" ||
    type === "file" ||
    type === "date" ||
    type === "datetime-local" ||
    type === "month" ||
    type === "time" ||
    type === "week" ||
    type === "color" ||
    type === "range";
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
