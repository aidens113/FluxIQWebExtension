"use strict";
(() => {
  // src/content/element-finder.ts
  function findClosestFingerprint(fingerprint) {
    const bySelector = query(fingerprint.selector);
    if (bySelector) return bySelector;
    if (fingerprint.xpath) {
      const result = document.evaluate(fingerprint.xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      if (result instanceof Element) return result;
    }
    if (fingerprint.id) {
      const byId = document.getElementById(fingerprint.id);
      if (byId) return byId;
    }
    const tag = fingerprint.tagName || "*";
    const testId = fingerprint.attributes?.["data-testid"];
    if (testId) {
      const byTestId = query(`[data-testid="${cssString(testId)}"]`);
      if (byTestId) return byTestId;
    }
    if (fingerprint.name) {
      const byName = query(`${tag}[aria-label="${cssString(fingerprint.name)}"], ${tag}[name="${cssString(fingerprint.name)}"]`);
      if (byName) return byName;
    }
    if (fingerprint.classNames?.length) {
      const byClass = query(`${tag}${fingerprint.classNames.map((className) => `.${CSS.escape(className)}`).join("")}`);
      if (byClass) return byClass;
    }
    if (fingerprint.visibleText) {
      const normalized = normalizeText(fingerprint.visibleText);
      return [...document.querySelectorAll(tag)].find((element) => normalizeText(element.textContent ?? "") === normalized) ?? null;
    }
    return null;
  }
  function xpathFor(element) {
    const parts = [];
    let current = element;
    while (current) {
      if (current.id) {
        parts.unshift(`*[@id=${xpathString(current.id)}]`);
        break;
      }
      const siblings = current.parentElement ? [...current.parentElement.children].filter((sibling) => sibling.tagName === current.tagName) : [];
      parts.unshift(`${current.tagName.toLowerCase()}[${Math.max(1, siblings.indexOf(current) + 1)}]`);
      current = current.parentElement;
    }
    return `/${parts.join("/")}`;
  }
  function query(selector) {
    if (!selector) return null;
    try {
      return document.querySelector(selector);
    } catch {
      return null;
    }
  }
  function normalizeText(value) {
    return value.replace(/\s+/g, " ").trim();
  }
  function cssString(value) {
    return CSS.escape(value).replace(/"/g, '\\"');
  }
  function xpathString(value) {
    return `"${value.replace(/"/g, '\\"')}"`;
  }

  // src/content/index.ts
  var CONTENT_EVENT = "fluxiq.contentEvent";
  var CONTENT_READY = "fluxiq.contentReady";
  var MAX_SNAPSHOT_CANDIDATES = 800;
  var MAX_SNAPSHOT_SCAN_ELEMENTS = 5e4;
  var ACTIVE_CONTENT_INSTANCE_KEY = "__fluxiqWebAutomationActiveContentInstance";
  var PAGE_LISTENER_ATTRIBUTE = "data-fluxiq-event-listeners";
  var MAX_OBSERVED_EVENT_ELEMENTS = 500;
  var CONTENT_INSTANCE_ID = `${Date.now()}.${Math.random().toString(36).slice(2)}`;
  var contentWindow = window;
  contentWindow[ACTIVE_CONTENT_INSTANCE_KEY] = CONTENT_INSTANCE_ID;
  var recording = false;
  var sequence = 0;
  var captureMutations = true;
  var captureInputValues = true;
  var captureSnapshots = true;
  var scrollTimer;
  var mutationTimer;
  var inputTimer;
  var pendingInput;
  var pendingMutation = { added: 0, removed: 0, attributes: 0, text: 0 };
  var observedEventElements = /* @__PURE__ */ new WeakSet();
  var observedEventElementQueue = [];
  sendReady();
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const typed = message;
    if (typed.type === "fluxiq.ping") {
      sendResponse({ ok: true, active: isActiveContentInstance() });
      return false;
    }
    if (!isActiveContentInstance()) return false;
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
      void executeAction(typed.action).then(sendResponse).catch((error) => sendResponse(actionFailure(typed.action, error)));
      return true;
    }
    return false;
  });
  document.addEventListener("pointerdown", (event) => {
    if (!event.isTrusted) return;
    if (event.button !== 0 || event.isPrimary === false) return;
    rememberEventPathElements(event);
    const eventElement = eventTargetElement(event);
    const target = eventElement ? pointerActivationTarget(eventElement) : null;
    if (!target) return;
    emit("dom.click", compactObject({
      element: describeElement(target),
      metadata: compactObject({
        ...pointerMetadata(event),
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        sourceEvent: "pointerdown",
        captureTiming: "before-action"
      })
    }));
  }, true);
  document.addEventListener("click", (event) => {
    if (!event.isTrusted) return;
    rememberEventPathElements(event);
    const eventElement = eventTargetElement(event);
    const target = eventElement ? actionEventTarget(eventElement) : null;
    emit("dom.click", compactObject({
      element: target ? describeElement(target) : void 0,
      metadata: compactObject({
        ...pointerMetadata(event),
        sourceEvent: "click"
      })
    }));
  }, true);
  document.addEventListener("input", (event) => {
    rememberEventPathElements(event);
    const target = event.target instanceof Element ? event.target : null;
    if (target && isTextEntryElement(target)) {
      scheduleInputEvent(target);
      return;
    }
    emitInputEvent(target);
  }, true);
  document.addEventListener("change", (event) => {
    rememberEventPathElements(event);
    const target = event.target instanceof Element ? event.target : null;
    if (target && isTextEntryElement(target)) {
      flushPendingInput();
      return;
    }
    if (target && !shouldRecordChangeEvent(target)) return;
    emit("dom.change", compactObject({
      element: target ? describeElement(target) : void 0,
      inputValue: captureInputValues ? readElementValue(target) : void 0
    }));
  }, true);
  document.addEventListener("submit", (event) => {
    rememberEventPathElements(event);
    const target = event.target instanceof Element ? event.target : null;
    emit("dom.submit", compactObject({ element: target ? describeElement(target) : void 0 }));
  }, true);
  document.addEventListener("keydown", (event) => {
    if (!event.isTrusted) return;
    rememberEventPathElements(event);
    emit("dom.keydown", compactObject({
      key: event.key,
      element: event.target instanceof Element ? describeElement(event.target) : void 0,
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
  var observer = new MutationObserver((mutations) => {
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
  function sendReady() {
    if (!isActiveContentInstance()) return;
    const payload = basePayload("content.ready", {
      snapshot: captureSnapshot(),
      metadata: { readyState: document.readyState }
    });
    void chrome.runtime.sendMessage({ type: CONTENT_READY, payload });
  }
  function emit(kind, details) {
    if (!isActiveContentInstance()) return;
    if (!recording && kind !== "content.ready") return;
    const payload = basePayload(kind, details);
    void chrome.runtime.sendMessage({ type: CONTENT_EVENT, payload });
  }
  function isActiveContentInstance() {
    return contentWindow[ACTIVE_CONTENT_INSTANCE_KEY] === CONTENT_INSTANCE_ID;
  }
  function scheduleInputEvent(element) {
    pendingInput = { element, inputValue: captureInputValues ? readElementValue(element) : void 0 };
    if (inputTimer) clearTimeout(inputTimer);
    inputTimer = setTimeout(() => flushPendingInput(), 350);
  }
  function flushPendingInput() {
    if (inputTimer) clearTimeout(inputTimer);
    inputTimer = void 0;
    const pending = pendingInput;
    pendingInput = void 0;
    if (!pending) return;
    emit("dom.input", compactObject({
      element: describeElement(pending.element),
      inputValue: pending.inputValue
    }));
  }
  function emitInputEvent(element) {
    emit("dom.input", compactObject({
      element: element ? describeElement(element) : void 0,
      inputValue: captureInputValues ? readElementValue(element) : void 0
    }));
  }
  function basePayload(kind, details) {
    const payload = {
      kind,
      sequence: ++sequence,
      url: location.href,
      title: document.title,
      eventTimestampMs: Date.now()
    };
    if (details.element) payload.element = details.element;
    if (captureSnapshots) {
      const snapshot = details.snapshot ?? (shouldAttachStateSnapshot(kind) ? captureSnapshot() : void 0);
      if (snapshot) payload.snapshot = snapshot;
    }
    if (details.inputValue !== void 0) payload.inputValue = details.inputValue;
    if (details.key !== void 0) payload.key = details.key;
    if (details.scroll) payload.scroll = details.scroll;
    if (details.mutation) payload.mutation = details.mutation;
    if (details.actionResult) payload.actionResult = details.actionResult;
    if (details.metadata) payload.metadata = details.metadata;
    return payload;
  }
  function shouldAttachStateSnapshot(kind) {
    return kind === "dom.click" || kind === "dom.input" || kind === "dom.change" || kind === "dom.submit" || kind === "dom.keydown";
  }
  async function executeAction(action) {
    const startedAt = Date.now();
    try {
      if (action.actionType === "web.dom.capture_snapshot" || action.actionType === "dom.capture_snapshot") {
        return success(action, startedAt, "Snapshot captured.", void 0, captureSnapshot());
      }
      if (action.actionType === "web.dom.wait_for_selector" || action.actionType === "dom.wait_for_selector") {
        const element = await waitForElement(action.selector, action.timeoutMs);
        return success(action, startedAt, "Selector found.", describeElement(element), captureSnapshot());
      }
      if (action.actionType === "web.dom.wait_for_text" || action.actionType === "dom.wait_for_text") {
        await waitForText(action.text ?? action.value ?? "", action.timeoutMs);
        return success(action, startedAt, "Text found.", void 0, captureSnapshot());
      }
      if (action.actionType === "web.dom.extract" || action.actionType === "dom.extract") {
        const element = resolveTarget(action);
        const extracted = extractElement(element, action.options);
        return success(action, startedAt, "Value extracted.", describeElement(element), captureSnapshot(), extracted);
      }
      if (action.actionType === "web.dom.click" || action.actionType === "dom.click") {
        const element = resolveTarget(action);
        scrollElementIntoView(element);
        element.click();
        return success(action, startedAt, "Element clicked.", describeElement(element), captureSnapshot());
      }
      if (action.actionType === "web.dom.type" || action.actionType === "dom.type") {
        const element = resolveTarget(action);
        element.focus();
        setElementValue(element, action.text ?? action.value ?? "");
        dispatchInputEvents(element);
        return success(action, startedAt, "Text entered.", describeElement(element), captureSnapshot());
      }
      if (action.actionType === "web.dom.clear" || action.actionType === "dom.clear") {
        const element = resolveTarget(action);
        element.focus();
        setElementValue(element, "");
        dispatchInputEvents(element);
        return success(action, startedAt, "Field cleared.", describeElement(element), captureSnapshot());
      }
      if (action.actionType === "web.dom.select" || action.actionType === "dom.select") {
        const element = resolveTarget(action);
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
        return success(action, startedAt, "Page scrolled.", void 0, captureSnapshot());
      }
      if (action.actionType === "web.dom.keypress" || action.actionType === "dom.keypress") {
        const target = action.selector ? resolveTarget(action) : document.activeElement ?? document.body;
        const key = action.key ?? action.text ?? "";
        target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
        target.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true, cancelable: true }));
        return success(action, startedAt, "Key event dispatched.", target instanceof Element ? describeElement(target) : void 0, captureSnapshot());
      }
      throw new Error(`Unsupported action type: ${action.actionType}`);
    } catch (error) {
      return actionFailure(action, error, startedAt);
    }
  }
  function resolveTarget(action) {
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
      const element = findClosestFingerprint(fingerprint);
      if (element) return element;
    }
    const active = document.activeElement;
    if (active) return active;
    throw new Error("No selector, coordinates, or active element was available.");
  }
  function success(action, startedAt, message, element, snapshot, extracted) {
    const result = {
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
    if (extracted !== void 0) result.extracted = extracted;
    return result;
  }
  function actionFailure(action, error, startedAt = Date.now()) {
    const snapshot = captureSnapshots ? captureSnapshot() : void 0;
    return {
      commandId: action.commandId,
      actionType: action.actionType,
      status: "failed",
      message: error instanceof Error ? error.message : "Action failed.",
      url: location.href,
      title: document.title,
      ...snapshot ? { snapshot } : {},
      startedAt,
      finishedAt: Date.now()
    };
  }
  function captureSnapshot() {
    const snapshot = {
      url: location.href,
      title: document.title,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth, window.innerWidth),
        documentHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, window.innerHeight),
        devicePixelRatio: window.devicePixelRatio
      },
      interactiveElements: snapshotElements()
    };
    const focused = document.activeElement instanceof Element ? describeElement(document.activeElement) : void 0;
    if (focused) snapshot.focusedElement = focused;
    const selectedText = window.getSelection()?.toString();
    if (selectedText) snapshot.selectedText = selectedText.slice(0, 2e3);
    return snapshot;
  }
  function describeElement(element) {
    const bounds = visualViewportBounds(element);
    const docBounds = visualDocumentBounds(element);
    const descriptor = {
      tagName: element.tagName.toLowerCase(),
      selector: selectorFor(element),
      isVisibleOnViewport: Boolean(bounds)
    };
    if (bounds) descriptor.bounds = bounds;
    if (docBounds) descriptor.documentBounds = docBounds;
    if (hasClickHandler(element)) descriptor.hasClickHandler = true;
    const text = isInteractableUiElement(element) || isSemanticTextElement(element) ? visibleText(element) : directVisibleText(element);
    if (text) {
      descriptor.text = text;
      descriptor.visibleText = text;
    }
    if (element.id) descriptor.id = element.id;
    const classNames = [...element.classList];
    if (classNames.length) descriptor.classNames = classNames;
    descriptor.xpath = xpathFor(element);
    const value = readElementValue(element);
    if (value !== void 0 && captureInputValues) descriptor.value = value;
    const role = element.getAttribute("role");
    if (role) descriptor.role = role;
    const name = accessibleName(element);
    if (name) descriptor.name = name;
    const href = linkHref(element);
    if (href) descriptor.href = href;
    if (element instanceof HTMLInputElement && element.type) descriptor.inputType = element.type;
    const attributes = {};
    for (const attribute of ["id", "class", "name", "type", "placeholder", "title", "alt", "href", "tabindex", "aria-label", "aria-disabled", "aria-expanded", "aria-controls", "aria-pressed", "aria-selected", "data-testid", "data-test", "data-cy", "disabled", "onclick"]) {
      const value2 = element.getAttribute(attribute);
      if (value2 !== null) attributes[attribute] = value2.slice(0, 500);
    }
    if (Object.keys(attributes).length) descriptor.attributes = attributes;
    return descriptor;
  }
  function snapshotElements() {
    const seen = /* @__PURE__ */ new Set();
    const candidates = snapshotCandidateElements();
    const included = [];
    for (const element of candidates) {
      if (seen.has(element) || !shouldIncludeSnapshotElement(element)) continue;
      seen.add(element);
      included.push(element);
    }
    return included.sort(
      (left, right) => snapshotElementBucket(left) - snapshotElementBucket(right) || elementPriority(right) - elementPriority(left) || documentOrder(left, right)
    ).slice(0, MAX_SNAPSHOT_CANDIDATES).map((element) => describeElement(element));
  }
  function snapshotCandidateElements() {
    const seen = /* @__PURE__ */ new Set();
    const candidates = [];
    const add = (element) => {
      if (!element || seen.has(element)) return;
      seen.add(element);
      candidates.push(element);
    };
    for (const element of observedEventElementQueue) {
      if (element.isConnected) add(element);
    }
    for (const element of document.querySelectorAll(`[${PAGE_LISTENER_ATTRIBUTE}]`)) add(element);
    let scanned = 0;
    for (const element of document.querySelectorAll("*")) {
      scanned += 1;
      if (scanned > MAX_SNAPSHOT_SCAN_ELEMENTS) break;
      if (!hasElementPresentation(element)) continue;
      add(element);
    }
    return candidates;
  }
  function shouldIncludeSnapshotElement(element) {
    if (element === document.documentElement || element === document.body) return false;
    if (element.closest("script, style, noscript, template")) return false;
    if (element.closest("[hidden], [aria-hidden='true']")) return false;
    const bounds = visualDocumentBounds(element);
    if (!bounds) return false;
    const style = getComputedStyle(element);
    if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) return false;
    return isEventBackedElement(element) ? hasEventElementPresentation(element) : hasElementPresentation(element);
  }
  function snapshotElementBucket(element) {
    if (isEventBackedElement(element)) return 0;
    if (isPrimaryControlElement(element)) return 1;
    if (isInteractableUiElement(element)) return 2;
    if (isSemanticTextElement(element)) return 3;
    if (meaningfulText(directVisibleText(element))) return 4;
    if (hasVisualMedia(element)) return 5;
    return 6;
  }
  function hasMeaningfulInteractableIdentity(element) {
    return Boolean(
      stableElementId(element) || meaningfulText(accessibleName(element)) || meaningfulText(visibleText(element)) || meaningfulText(directVisibleText(element)) || meaningfulText(readElementValue(element)) || meaningfulText(element.getAttribute("title")) || meaningfulText(element.getAttribute("alt")) || meaningfulText(element.getAttribute("placeholder")) || meaningfulText(linkHref(element))
    );
  }
  function hasEventElementPresentation(element) {
    return hasMeaningfulInteractableIdentity(element) || hasElementPresentation(element);
  }
  function hasElementPresentation(element) {
    return meaningfulText(visibleText(element)) || meaningfulText(accessibleName(element)) || meaningfulText(readElementValue(element)) || hasVisualMedia(element);
  }
  function hasVisualMedia(element) {
    return element.matches("svg,img,picture,canvas,video") || Boolean(element.querySelector("svg,img,picture,canvas,video"));
  }
  function isEventBackedElement(element) {
    return observedEventElements.has(element) || hasTrackedPageEventListener(element) || hasClickHandler(element);
  }
  function hasTrackedPageEventListener(element) {
    return Boolean(element.getAttribute(PAGE_LISTENER_ATTRIBUTE));
  }
  function visibleViewportBounds(element) {
    const rect = element.getBoundingClientRect();
    const fallbackBounds = !hasUsableRect(rect) ? directTextViewportBounds(element) : void 0;
    if (fallbackBounds) return fallbackBounds;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const left = Math.max(0, rect.left);
    const top = Math.max(0, rect.top);
    const right = Math.min(viewportWidth, rect.right);
    const bottom = Math.min(viewportHeight, rect.bottom);
    const width = right - left;
    const height = bottom - top;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 2 || height < 2) return void 0;
    return {
      x: Math.round(left * 100) / 100,
      y: Math.round(top * 100) / 100,
      width: Math.round(width * 100) / 100,
      height: Math.round(height * 100) / 100
    };
  }
  function visualViewportBounds(element) {
    return visibleViewportBounds(element) ?? (isInteractableUiElement(element) ? renderedTextViewportBounds(element) : directTextViewportBounds(element));
  }
  function visualDocumentBounds(element) {
    return documentBounds(element) ?? (isInteractableUiElement(element) ? renderedTextBounds(element) : directTextBounds(element));
  }
  function documentBounds(element) {
    const rect = element.getBoundingClientRect();
    if (!hasUsableRect(rect)) return void 0;
    const width = rect.width;
    const height = rect.height;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 2 || height < 2) return void 0;
    return {
      x: Math.round((rect.left + window.scrollX) * 100) / 100,
      y: Math.round((rect.top + window.scrollY) * 100) / 100,
      width: Math.round(width * 100) / 100,
      height: Math.round(height * 100) / 100
    };
  }
  function directTextBounds(element) {
    return textRangeBounds(element, "document", "direct");
  }
  function renderedTextBounds(element) {
    return textRangeBounds(element, "document", "descendant");
  }
  function directTextViewportBounds(element) {
    return textRangeBounds(element, "viewport", "direct");
  }
  function renderedTextViewportBounds(element) {
    return textRangeBounds(element, "viewport", "descendant");
  }
  function textRangeBounds(element, coordinateSpace, scope) {
    const textNodes = scope === "direct" ? directTextNodes(element) : descendantTextNodes(element);
    if (!textNodes.length) return void 0;
    const rects = [];
    for (const node of textNodes) {
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        if (hasUsableRect(rect)) rects.push(rect);
      }
      range.detach();
    }
    return mergedBounds(rects, coordinateSpace);
  }
  function directTextNodes(element) {
    return [...element.childNodes].filter(
      (node) => node.nodeType === Node.TEXT_NODE && meaningfulText(node.textContent)
    );
  }
  function descendantTextNodes(element) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => meaningfulText(node.textContent) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    });
    const nodes = [];
    let current = walker.nextNode();
    while (current) {
      nodes.push(current);
      current = walker.nextNode();
    }
    return nodes;
  }
  function mergedBounds(rects, coordinateSpace) {
    if (!rects.length) return void 0;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    let left = Number.POSITIVE_INFINITY;
    let top = Number.POSITIVE_INFINITY;
    let right = Number.NEGATIVE_INFINITY;
    let bottom = Number.NEGATIVE_INFINITY;
    for (const rect of rects) {
      const rectLeft = coordinateSpace === "viewport" ? Math.max(0, rect.left) : rect.left + window.scrollX;
      const rectTop = coordinateSpace === "viewport" ? Math.max(0, rect.top) : rect.top + window.scrollY;
      const rectRight = coordinateSpace === "viewport" ? Math.min(viewportWidth, rect.right) : rect.right + window.scrollX;
      const rectBottom = coordinateSpace === "viewport" ? Math.min(viewportHeight, rect.bottom) : rect.bottom + window.scrollY;
      if (rectRight - rectLeft < 2 || rectBottom - rectTop < 2) continue;
      left = Math.min(left, rectLeft);
      top = Math.min(top, rectTop);
      right = Math.max(right, rectRight);
      bottom = Math.max(bottom, rectBottom);
    }
    const width = right - left;
    const height = bottom - top;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 2 || height < 2) return void 0;
    return {
      x: Math.round(left * 100) / 100,
      y: Math.round(top * 100) / 100,
      width: Math.round(width * 100) / 100,
      height: Math.round(height * 100) / 100
    };
  }
  function hasUsableRect(rect) {
    return Number.isFinite(rect.width) && Number.isFinite(rect.height) && rect.width >= 2 && rect.height >= 2;
  }
  function elementPriority(element) {
    let score = 0;
    if (isInteractableUiElement(element)) score += 200;
    if (isActionableElement(element)) score += 100;
    if (stableElementId(element)) score += 60;
    if (meaningfulText(accessibleName(element))) score += 45;
    if (meaningfulText(visibleText(element))) score += 35;
    if (meaningfulText(readElementValue(element))) score += 35;
    if (meaningfulText(directVisibleText(element))) score += 25;
    if (meaningfulText(linkHref(element))) score += 40;
    const bounds = visualDocumentBounds(element);
    if (bounds) score += Math.min(20, Math.sqrt(bounds.width * bounds.height) / 8);
    return score;
  }
  function documentOrder(left, right) {
    if (left === right) return 0;
    return left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
  }
  function isActionableElement(element) {
    const tagName = element.tagName.toLowerCase();
    const role = element.getAttribute("role")?.toLowerCase();
    return tagName === "a" || tagName === "button" || tagName === "input" || tagName === "textarea" || tagName === "select" || tagName === "summary" || tagName === "label" || role === "button" || role === "link" || role === "menuitem" || role === "checkbox" || role === "radio" || role === "tab" || role === "switch" || hasClickHandler(element) || element instanceof HTMLElement && element.isContentEditable;
  }
  function isInteractableUiElement(element) {
    return isActionableElement(element) || element instanceof HTMLElement && getComputedStyle(element).cursor === "pointer" || element.hasAttribute("tabindex") || element.hasAttribute("aria-expanded") || element.hasAttribute("aria-controls") || element.hasAttribute("aria-pressed") || element.hasAttribute("aria-selected");
  }
  function isPrimaryControlElement(element) {
    const tagName = element.tagName.toLowerCase();
    const role = element.getAttribute("role")?.toLowerCase();
    return tagName === "button" || tagName === "a" || tagName === "summary" || role === "button" || role === "link" || role === "menuitem" || role === "tab";
  }
  function hasClickHandler(element) {
    const htmlElement = element;
    return element.hasAttribute("onclick") || typeof htmlElement.onclick === "function";
  }
  function isSemanticTextElement(element) {
    const tagName = element.tagName.toLowerCase();
    return tagName === "p" || tagName === "li" || tagName === "td" || tagName === "th" || tagName === "blockquote" || /^h[1-6]$/.test(tagName);
  }
  function rememberEventPathElements(event) {
    const target = eventTargetElement(event);
    const activationTarget = target ? pointerActivationTarget(target) ?? target : void 0;
    rememberObservedEventElement(activationTarget);
    for (const entry of event.composedPath()) {
      if (!(entry instanceof Element)) continue;
      if (entry === document.documentElement || entry === document.body) continue;
      if (!hasTrackedPageEventListener(entry) && !hasClickHandler(entry)) continue;
      rememberObservedEventElement(entry);
    }
  }
  function rememberObservedEventElement(element) {
    if (!element || observedEventElements.has(element)) return;
    observedEventElements.add(element);
    observedEventElementQueue.push(element);
    while (observedEventElementQueue.length > MAX_OBSERVED_EVENT_ELEMENTS) observedEventElementQueue.shift();
  }
  function actionEventTarget(element) {
    return pointerActivationTarget(element) ?? element;
  }
  function eventTargetElement(event) {
    for (const entry of event.composedPath()) {
      if (entry instanceof Element) return entry;
    }
    return event.target instanceof Element ? event.target : void 0;
  }
  function pointerActivationTarget(element) {
    let current = element;
    for (let depth = 0; current && current !== document.documentElement && depth < 12; depth += 1) {
      if (isActionableElement(current)) return current;
      current = current.parentElement;
    }
    current = element;
    for (let depth = 0; current && current !== document.documentElement && depth < 12; depth += 1) {
      if (current instanceof HTMLElement && getComputedStyle(current).cursor === "pointer") return current;
      current = current.parentElement;
    }
    return void 0;
  }
  function linkHref(element) {
    if (element instanceof HTMLAnchorElement && element.href) return element.href;
    return element.getAttribute("href") ?? element.getAttribute("xlink:href") ?? void 0;
  }
  function stableElementId(element) {
    return element.getAttribute("data-testid") ?? element.getAttribute("data-test") ?? element.getAttribute("data-cy") ?? element.getAttribute("id") ?? element.getAttribute("name") ?? void 0;
  }
  function selectorFor(element) {
    if (element.id) return `#${CSS.escape(element.id)}`;
    const testId = element.getAttribute("data-testid");
    if (testId) return `[data-testid="${cssString2(testId)}"]`;
    const name = element.getAttribute("name");
    if (name) return `${element.tagName.toLowerCase()}[name="${cssString2(name)}"]`;
    const parts = [];
    let current = element;
    while (current && current !== document.documentElement && parts.length < 5) {
      const parent = current.parentElement;
      const tag = current.tagName.toLowerCase();
      const siblings = parent ? [...parent.children].filter((child) => child.tagName === current?.tagName) : [];
      const index = siblings.indexOf(current) + 1;
      parts.unshift(siblings.length > 1 ? `${tag}:nth-of-type(${index})` : tag);
      current = parent;
    }
    return parts.join(" > ");
  }
  function visibleText(element) {
    const text = element.textContent?.replace(/\s+/g, " ").trim();
    return text ? text.slice(0, 500) : void 0;
  }
  function directVisibleText(element) {
    const text = [...element.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent ?? "").join(" ").replace(/\s+/g, " ").trim();
    return text ? text.slice(0, 500) : void 0;
  }
  function meaningfulText(value) {
    return typeof value === "string" && value.trim().length > 0;
  }
  function readElementValue(element) {
    if (!element) return void 0;
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
      return element.value.slice(0, 2e3);
    }
    if (element instanceof HTMLElement && element.isContentEditable) return element.innerText.slice(0, 2e3);
    return void 0;
  }
  function isTextEntryElement(element) {
    if (element instanceof HTMLTextAreaElement) return true;
    if (element instanceof HTMLElement && element.isContentEditable) return true;
    if (!(element instanceof HTMLInputElement)) return false;
    const type = element.type.toLowerCase();
    return type === "" || type === "text" || type === "search" || type === "email" || type === "password" || type === "tel" || type === "url" || type === "number";
  }
  function shouldRecordChangeEvent(element) {
    if (element instanceof HTMLSelectElement) return true;
    if (!(element instanceof HTMLInputElement)) return true;
    const type = element.type.toLowerCase();
    return type === "checkbox" || type === "radio" || type === "file" || type === "date" || type === "datetime-local" || type === "month" || type === "time" || type === "week" || type === "color" || type === "range";
  }
  function accessibleName(element) {
    return element.getAttribute("aria-label") ?? element.getAttribute("title") ?? element.getAttribute("alt") ?? void 0;
  }
  function pointerMetadata(event) {
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
  function cssString2(value) {
    return CSS.escape(value).replace(/"/g, '\\"');
  }
  function scrollElementIntoView(element) {
    element.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
  }
  function setElementValue(element, value) {
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
    descriptor?.set?.call(element, value);
  }
  function dispatchInputEvents(element) {
    element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function waitForElement(selector, timeoutMs = 1e4) {
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
  function waitForText(text, timeoutMs = 1e4) {
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
  function extractElement(element, options) {
    const mode = options?.mode;
    if (mode === "html") return element.innerHTML;
    if (mode === "attribute" && typeof options?.attribute === "string") return element.getAttribute(options.attribute) ?? "";
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return element.value;
    return element.textContent?.replace(/\s+/g, " ").trim() ?? "";
  }
  function compactObject(value) {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== void 0));
  }
})();
//# sourceMappingURL=index.js.map
