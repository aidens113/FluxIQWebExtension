"use strict";
(() => {
  // src/content/messages.ts
  var CONTENT_EVENT = "fluxiq.contentEvent";
  var CONTENT_READY = "fluxiq.contentReady";
  var FRAME_GEOMETRY_REQUEST = "fluxiq.frameGeometryRequest";
  var FRAME_GEOMETRY_RESPONSE = "fluxiq.frameGeometryResponse";

  // src/content/frame-geometry.ts
  var frameViewportOffset = isTopFrame() ? { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight } : void 0;
  var frameGeometryRequestId = 0;
  function isTopFrame() {
    return window.top === window;
  }
  function currentFrameViewportOffset() {
    if (isTopFrame()) return { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
    return frameViewportOffset;
  }
  function installFrameGeometryBridge() {
    window.addEventListener("message", (event) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === FRAME_GEOMETRY_REQUEST) {
        const requestId = typeof data.requestId === "number" ? data.requestId : void 0;
        const geometry = childFrameViewportOffset(event.source);
        if (!geometry || !event.source || typeof event.source.postMessage !== "function") return;
        event.source.postMessage({
          type: FRAME_GEOMETRY_RESPONSE,
          requestId,
          geometry
        }, "*");
        return;
      }
      if (data.type === FRAME_GEOMETRY_RESPONSE) {
        const geometry = rectFromUnknown(data.geometry);
        if (geometry) frameViewportOffset = geometry;
      }
    });
    window.addEventListener("resize", () => {
      if (isTopFrame()) frameViewportOffset = { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
      else void requestFrameGeometry();
    }, true);
    window.addEventListener("scroll", () => {
      if (!isTopFrame()) void requestFrameGeometry();
    }, true);
  }
  function requestFrameGeometry() {
    if (isTopFrame()) {
      frameViewportOffset = { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
      return Promise.resolve(frameViewportOffset);
    }
    const requestId = ++frameGeometryRequestId;
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(frameViewportOffset), 75);
      const listener = (event) => {
        const data = event.data;
        if (!data || data.type !== FRAME_GEOMETRY_RESPONSE || data.requestId !== requestId) return;
        const geometry = rectFromUnknown(data.geometry);
        if (geometry) frameViewportOffset = geometry;
        clearTimeout(timeout);
        window.removeEventListener("message", listener);
        resolve(frameViewportOffset);
      };
      window.addEventListener("message", listener);
      window.parent.postMessage({ type: FRAME_GEOMETRY_REQUEST, requestId }, "*");
    });
  }
  function childFrameViewportOffset(source) {
    if (!source) return void 0;
    const frameElement = [...document.querySelectorAll("iframe,frame")].find(
      (element) => (element instanceof HTMLIFrameElement || element instanceof HTMLFrameElement) && element.contentWindow === source
    );
    if (!frameElement) return void 0;
    const rect = frameElement.getBoundingClientRect();
    const parentOffset = currentFrameViewportOffset() ?? { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
    return {
      x: Math.round((parentOffset.x + rect.left) * 100) / 100,
      y: Math.round((parentOffset.y + rect.top) * 100) / 100,
      width: Math.round(rect.width * 100) / 100,
      height: Math.round(rect.height * 100) / 100
    };
  }
  function rectFromUnknown(value) {
    if (!value || typeof value !== "object") return void 0;
    const rect = value;
    return typeof rect.x === "number" && typeof rect.y === "number" && typeof rect.width === "number" && typeof rect.height === "number" ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : void 0;
  }

  // src/content/instance.ts
  var ACTIVE_CONTENT_INSTANCE_KEY = "__fluxiqWebAutomationActiveContentInstance";
  var CONTENT_SCRIPT_VERSION = 2;
  var CONTENT_INSTANCE_ID = `${Date.now()}.${Math.random().toString(36).slice(2)}`;
  var contentWindow = window;
  contentWindow[ACTIVE_CONTENT_INSTANCE_KEY] = CONTENT_INSTANCE_ID;
  function isActiveContentInstance() {
    return contentWindow[ACTIVE_CONTENT_INSTANCE_KEY] === CONTENT_INSTANCE_ID;
  }

  // src/content/capture-settings.ts
  var captureSettings = {
    mutations: true,
    inputValues: true,
    snapshots: true
  };

  // src/content/compact-object.ts
  function compactObject(value) {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== void 0));
  }

  // src/shared/sensitive-field.ts
  var SENSITIVE_AUTOCOMPLETE_TOKENS = /* @__PURE__ */ new Set(["current-password", "new-password", "one-time-code"]);
  function isSensitiveFieldSignature(signature) {
    if (signature.inputType?.toLowerCase() === "password") return true;
    if (signature.dataSensitive === "true") return true;
    const tokens = (signature.autocomplete ?? "").toLowerCase().split(/\s+/u).filter(Boolean);
    return tokens.some((token) => SENSITIVE_AUTOCOMPLETE_TOKENS.has(token) || token.startsWith("cc-"));
  }

  // src/content/element-traits.ts
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
    return tagName === "p" || tagName === "li" || tagName === "td" || tagName === "th" || tagName === "dt" || tagName === "dd" || tagName === "figcaption" || tagName === "blockquote" || /^h[1-6]$/.test(tagName);
  }
  function hasVisualMedia(element) {
    return element.matches("svg,img,picture,canvas,video") || Boolean(element.querySelector("svg,img,picture,canvas,video"));
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
  function isSensitiveFormControl(element) {
    return isSensitiveFieldSignature({
      inputType: element instanceof HTMLInputElement ? element.type : void 0,
      autocomplete: element.getAttribute("autocomplete") ?? void 0,
      dataSensitive: element.getAttribute("data-sensitive") ?? void 0
    });
  }
  function isOrdinaryNonSensitiveFillControl(element) {
    if (isSensitiveFormControl(element)) return false;
    if (element instanceof HTMLTextAreaElement) return true;
    return element instanceof HTMLInputElement && ["text", "search", "email", "tel", "url", "number"].includes(element.type.toLowerCase());
  }
  function meaningfulText(value) {
    return typeof value === "string" && value.trim().length > 0;
  }

  // src/content/event-elements.ts
  var MAX_OBSERVED_EVENT_ELEMENTS = 500;
  var observedEventElements = /* @__PURE__ */ new WeakSet();
  var queue = [];
  var observedEventElementQueue = queue;
  function rememberEventPathElements(event) {
    const target = eventTargetElement(event);
    const activationTarget = target ? pointerActivationTarget(target) ?? target : void 0;
    rememberObservedEventElement(activationTarget);
    for (const entry of event.composedPath()) {
      if (!(entry instanceof Element)) continue;
      if (entry === document.documentElement || entry === document.body) continue;
      if (!hasClickHandler(entry)) continue;
      rememberObservedEventElement(entry);
    }
  }
  function isEventBackedElement(element) {
    return observedEventElements.has(element) || hasClickHandler(element);
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
  function actionEventTarget(element) {
    return pointerActivationTarget(element) ?? element;
  }
  function rememberObservedEventElement(element) {
    if (!element || observedEventElements.has(element)) return;
    observedEventElements.add(element);
    queue.push(element);
    while (queue.length > MAX_OBSERVED_EVENT_ELEMENTS) queue.shift();
  }

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

  // src/content/visual-bounds.ts
  function visualViewportBounds(element) {
    return visibleViewportBounds(element) ?? (isInteractableUiElement(element) ? renderedTextViewportBounds(element) : directTextViewportBounds(element));
  }
  function visualDocumentBounds(element) {
    return documentBounds(element) ?? (isInteractableUiElement(element) ? renderedTextBounds(element) : directTextBounds(element));
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

  // src/content/describe-element.ts
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
    if (value !== void 0 && captureSettings.inputValues) descriptor.value = value;
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
        label: (option.label || option.textContent || "").replace(/\s+/gu, " ").trim().slice(0, 200)
      }));
      if (!isSensitiveFormControl(element) && descriptor.options.some((option) => option.value === element.value)) {
        descriptor.selectedValue = element.value.slice(0, 200);
      }
    }
    const attributes = {};
    for (const attribute of ["id", "class", "name", "type", "autocomplete", "data-sensitive", "placeholder", "title", "alt", "href", "tabindex", "aria-label", "aria-disabled", "aria-expanded", "aria-controls", "aria-pressed", "aria-selected", "data-testid", "data-test", "data-cy", "disabled", "onclick"]) {
      const value2 = element.getAttribute(attribute);
      if (value2 !== null) attributes[attribute] = value2.slice(0, 500);
    }
    if (Object.keys(attributes).length) descriptor.attributes = attributes;
    return descriptor;
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
  function readElementValue(element) {
    if (!element) return void 0;
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
      return element.value.slice(0, 2e3);
    }
    if (element instanceof HTMLElement && element.isContentEditable) return element.innerText.slice(0, 2e3);
    return void 0;
  }
  function accessibleName(element) {
    return element.getAttribute("aria-label") ?? element.getAttribute("title") ?? element.getAttribute("alt") ?? void 0;
  }
  function linkHref(element) {
    if (element instanceof HTMLAnchorElement && element.href) return element.href;
    return element.getAttribute("href") ?? element.getAttribute("xlink:href") ?? void 0;
  }
  function stableElementId(element) {
    return element.getAttribute("data-testid") ?? element.getAttribute("data-test") ?? element.getAttribute("data-cy") ?? element.getAttribute("id") ?? element.getAttribute("name") ?? void 0;
  }
  function cssString2(value) {
    return CSS.escape(value).replace(/"/g, '\\"');
  }

  // src/content/dom-snapshot.ts
  var MAX_SNAPSHOT_CANDIDATES = 2e3;
  var MAX_SNAPSHOT_SCAN_ELEMENTS = 5e4;
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
      frame: compactObject({
        isTop: isTopFrame(),
        viewportOffset: currentFrameViewportOffset()
      }),
      interactiveElements: snapshotElements()
    };
    const focused = document.activeElement instanceof Element ? describeElement(document.activeElement) : void 0;
    if (focused) snapshot.focusedElement = focused;
    const selectedText = window.getSelection()?.toString();
    if (selectedText) snapshot.selectedText = selectedText.slice(0, 2e3);
    return snapshot;
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
    for (const element of document.querySelectorAll("a[href],button,input:not([type=hidden]),textarea,select,summary,label,[role=button],[role=link],[role=menuitem],[role=checkbox],[role=radio],[role=tab],[role=switch],[contenteditable=true]")) add(element);
    for (const element of document.querySelectorAll("p,h1,h2,h3,h4,h5,h6,li,td,th,blockquote,dt,dd,figcaption")) add(element);
    for (const element of document.querySelectorAll("img,svg,picture,canvas,video")) add(element);
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
    return isEventBackedElement(element) ? hasEventElementPresentation(element) : isInteractableUiElement(element) ? hasMeaningfulInteractableIdentity(element) : hasElementPresentation(element);
  }
  function snapshotElementBucket(element) {
    if (isEventBackedElement(element)) return 0;
    if (isPrimaryControlElement(element)) return 1;
    if (isInteractableUiElement(element)) return 2;
    if (isSemanticTextElement(element)) return 3;
    if (meaningfulText(directVisibleText(element))) return 4;
    if (hasVisualMedia(element)) return 5;
    if (meaningfulText(visibleText(element))) return 6;
    return 7;
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

  // src/content/snapshots.ts
  function shouldAttachStateSnapshot(kind) {
    return kind === "dom.click" || kind === "dom.input" || kind === "dom.change" || kind === "dom.submit" || kind === "dom.keydown";
  }

  // src/content/recorder.ts
  var recording = false;
  var sequence = 0;
  var mutationTimer;
  var inputTimer;
  var pendingInput;
  var pendingMutation = { added: 0, removed: 0, attributes: 0, text: 0 };
  var observer = new MutationObserver((mutations) => {
    if (!captureSettings.mutations || !recording) return;
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
  function isRecording() {
    return recording;
  }
  function sendReady() {
    if (!isActiveContentInstance()) return;
    const payload = basePayload("content.ready", {
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
  function setRecordingState(nextRecording) {
    if (!nextRecording) flushPendingInput();
    recording = nextRecording;
    if (recording && captureSettings.mutations) {
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true
      });
    } else {
      observer.disconnect();
      if (mutationTimer) clearTimeout(mutationTimer);
      mutationTimer = void 0;
      pendingMutation = { added: 0, removed: 0, attributes: 0, text: 0 };
    }
  }
  function scheduleInputEvent(element) {
    pendingInput = { element, inputValue: captureSettings.inputValues ? readElementValue(element) : void 0 };
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
      inputValue: captureSettings.inputValues ? readElementValue(element) : void 0
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
    if (captureSettings.snapshots) {
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

  // src/content/action-runtime/capture-snapshot-for-response.ts
  async function captureSnapshotForResponse() {
    if (!isTopFrame()) await requestFrameGeometry();
    return captureSnapshot();
  }

  // src/content/actions/capture-snapshot.ts
  function captureSnapshotAction(action, deps, startedAt) {
    return deps.success(action, startedAt, "Snapshot captured.", void 0, deps.captureSnapshot());
  }

  // src/content/actions/wait-for-selector.ts
  async function waitForSelectorAction(action, deps, startedAt) {
    const element = await deps.waitForElement(action.selector, action.timeoutMs);
    return deps.success(action, startedAt, "Selector found.", deps.describeElement(element), deps.captureSnapshot());
  }

  // src/content/actions/wait-for-text.ts
  async function waitForTextAction(action, deps, startedAt) {
    await deps.waitForText(action.text ?? action.value ?? "", action.timeoutMs);
    return deps.success(action, startedAt, "Text found.", void 0, deps.captureSnapshot());
  }

  // src/content/actions/extract.ts
  function extractAction(action, deps, startedAt) {
    const element = deps.resolveTarget(action);
    const extracted = deps.extractElement(element, action.options);
    return deps.success(action, startedAt, "Value extracted.", deps.describeElement(element), deps.captureSnapshot(), extracted);
  }

  // src/content/actions/click.ts
  function clickAction(action, deps, startedAt) {
    const element = deps.resolveTarget(action);
    deps.scrollElementIntoView(element);
    element.click();
    return deps.success(action, startedAt, "Element clicked.", deps.describeElement(element), deps.captureSnapshot());
  }

  // src/content/actions/type.ts
  function typeAction(action, deps, startedAt) {
    const element = deps.resolveTarget(action);
    element.focus();
    deps.setElementValue(element, action.text ?? action.value ?? "");
    deps.dispatchInputEvents(element);
    return deps.success(action, startedAt, "Text entered.", deps.describeElement(element), deps.captureSnapshot());
  }

  // src/content/actions/clear.ts
  function clearAction(action, deps, startedAt) {
    const element = deps.resolveTarget(action);
    element.focus();
    deps.setElementValue(element, "");
    deps.dispatchInputEvents(element);
    return deps.success(action, startedAt, "Field cleared.", deps.describeElement(element), deps.captureSnapshot());
  }

  // src/content/actions/select.ts
  function selectAction(action, deps, startedAt) {
    const element = deps.resolveTarget(action);
    element.focus();
    element.value = action.value ?? "";
    deps.dispatchInputEvents(element);
    return deps.success(action, startedAt, "Option selected.", deps.describeElement(element), deps.captureSnapshot());
  }

  // src/content/actions/scroll.ts
  function scrollAction(action, deps, startedAt) {
    window.scrollTo({
      left: Number(action.options?.x ?? action.coordinates?.x ?? window.scrollX),
      top: Number(action.options?.y ?? action.coordinates?.y ?? window.scrollY),
      behavior: action.options?.smooth === true ? "smooth" : "instant"
    });
    return deps.success(action, startedAt, "Page scrolled.", void 0, deps.captureSnapshot());
  }

  // src/content/actions/keypress.ts
  function keypressAction(action, deps, startedAt) {
    const target = action.selector ? deps.resolveTarget(action) : document.activeElement ?? document.body;
    const key = action.key ?? action.text ?? "";
    target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    target.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true, cancelable: true }));
    return deps.success(action, startedAt, "Key event dispatched.", target instanceof Element ? deps.describeElement(target) : void 0, deps.captureSnapshot());
  }

  // src/content/actions/execute.ts
  async function executeContentAction(action, deps) {
    const startedAt = Date.now();
    try {
      if (action.actionType === "web.dom.capture_snapshot") {
        return captureSnapshotAction(action, deps, startedAt);
      }
      if (action.actionType === "web.dom.wait_for_selector") {
        return await waitForSelectorAction(action, deps, startedAt);
      }
      if (action.actionType === "web.dom.wait_for_text") {
        return await waitForTextAction(action, deps, startedAt);
      }
      if (action.actionType === "web.dom.extract") {
        return extractAction(action, deps, startedAt);
      }
      if (action.actionType === "web.dom.click") {
        return clickAction(action, deps, startedAt);
      }
      if (action.actionType === "web.dom.type") {
        return typeAction(action, deps, startedAt);
      }
      if (action.actionType === "web.dom.clear") {
        return clearAction(action, deps, startedAt);
      }
      if (action.actionType === "web.dom.select") {
        return selectAction(action, deps, startedAt);
      }
      if (action.actionType === "web.dom.scroll") {
        return scrollAction(action, deps, startedAt);
      }
      if (action.actionType === "web.dom.keypress") {
        return keypressAction(action, deps, startedAt);
      }
      throw new Error(`Unsupported action type: ${action.actionType}`);
    } catch (error) {
      return deps.failure(action, error, startedAt);
    }
  }

  // src/content/action-runtime/resolve-target.ts
  function resolveTarget(action) {
    const misses = [];
    if (action.selector) {
      const element = document.querySelector(action.selector);
      if (element) return element;
      misses.push(`selector ${action.selector}`);
    }
    if (action.coordinates) {
      const element = document.elementFromPoint(action.coordinates.x, action.coordinates.y);
      if (element) return element;
      misses.push(`coordinates ${action.coordinates.x},${action.coordinates.y}`);
    }
    const visualPoint = pointFromVisualTarget(action.visualTarget);
    if (visualPoint) {
      const element = document.elementFromPoint(visualPoint.x, visualPoint.y);
      if (element) return element;
      misses.push(`visual target ${Math.round(visualPoint.x)},${Math.round(visualPoint.y)}`);
    }
    const fingerprint = action.options?.element;
    if (fingerprint && typeof fingerprint === "object" && !Array.isArray(fingerprint)) {
      const element = findClosestFingerprint(fingerprint);
      if (element) return element;
      misses.push("element fingerprint");
    }
    if (!misses.length) {
      const active = document.activeElement;
      if (active) return active;
    }
    if (misses.length) throw new Error(`No target resolved from ${misses.join(", ")}.`);
    throw new Error("No selector, coordinates, or active element was available.");
  }
  function pointFromVisualTarget(visualTarget) {
    const bounds = visualTarget?.bounds ?? visualTarget?.anchor?.bounds;
    if (bounds) return centerPoint(bounds);
    if (visualTarget?.documentBounds) {
      const center = centerPoint(visualTarget.documentBounds);
      return { x: center.x - window.scrollX, y: center.y - window.scrollY };
    }
    return void 0;
  }
  function centerPoint(rect) {
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  }

  // src/content/action-runtime/waits.ts
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

  // src/content/action-runtime/extract.ts
  function extractElement(element, options) {
    const mode = options?.mode;
    if (mode === "html") return element.innerHTML;
    if (mode === "attribute" && typeof options?.attribute === "string") return element.getAttribute(options.attribute) ?? "";
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return element.value;
    return element.textContent?.replace(/\s+/g, " ").trim() ?? "";
  }

  // src/content/action-runtime/scroll-element-into-view.ts
  function scrollElementIntoView(element) {
    element.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
  }

  // src/content/action-runtime/set-element-value.ts
  function setElementValue(element, value) {
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
    descriptor?.set?.call(element, value);
  }

  // src/content/action-runtime/input-events.ts
  function dispatchInputEvents(element) {
    element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // src/content/action-runtime/results.ts
  function actionFailure(action, error, startedAt = Date.now()) {
    const snapshot = captureSettings.snapshots ? captureSnapshot() : void 0;
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
    if (action.visualTarget) result.visualTarget = action.visualTarget;
    if (snapshot ?? captureSettings.snapshots) result.snapshot = snapshot ?? captureSnapshot();
    if (extracted !== void 0) result.extracted = extracted;
    return result;
  }

  // src/content/action-runtime/execute-action.ts
  async function executeAction(action) {
    return executeContentAction(action, {
      captureSnapshot,
      resolveTarget,
      describeElement,
      waitForElement,
      waitForText,
      extractElement,
      scrollElementIntoView,
      setElementValue,
      dispatchInputEvents,
      success,
      failure: actionFailure
    });
  }

  // src/content/message-handler.ts
  function installMessageHandler() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      const typed = message;
      if (typed.type === "fluxiq.ping") {
        sendResponse({ ok: true, active: isActiveContentInstance(), version: CONTENT_SCRIPT_VERSION });
        return false;
      }
      if (!isActiveContentInstance()) return false;
      if (typed.type === "recording") {
        captureSettings.mutations = typed.settings?.captureMutations ?? captureSettings.mutations;
        captureSettings.inputValues = typed.settings?.captureInputValues ?? captureSettings.inputValues;
        captureSettings.snapshots = typed.settings?.captureSnapshots ?? captureSettings.snapshots;
        setRecordingState(Boolean(typed.recording));
        sendResponse({ ok: true });
        return true;
      }
      if (typed.type === "captureSnapshot") {
        void captureSnapshotForResponse().then(sendResponse);
        return true;
      }
      if (typed.type === "executeAction" && typed.action) {
        if (typed.topFrameOnly === true && !isTopFrame()) return false;
        void executeAction(typed.action).then(sendResponse).catch((error) => sendResponse(actionFailure(typed.action, error)));
        return true;
      }
      return false;
    });
  }

  // src/content/dom-events.ts
  var scrollTimer;
  function installRecordingEventListeners() {
    document.addEventListener("pointerdown", (event) => {
      if (!isRecording()) return;
      if (!event.isTrusted) return;
      if (event.button !== 0 || event.isPrimary === false) return;
      rememberEventPathElements(event);
      flushPendingInput();
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
      if (!isRecording()) return;
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
      if (!isRecording()) return;
      if (!event.isTrusted) return;
      rememberEventPathElements(event);
      const target = event.target instanceof Element ? event.target : null;
      if (target && isTextEntryElement(target)) {
        scheduleInputEvent(target);
        return;
      }
      flushPendingInput();
      if (target && shouldRecordChangeEvent(target)) return;
      emitInputEvent(target);
    }, true);
    document.addEventListener("change", (event) => {
      if (!isRecording()) return;
      if (!event.isTrusted) return;
      rememberEventPathElements(event);
      const target = event.target instanceof Element ? event.target : null;
      if (target && isTextEntryElement(target)) {
        flushPendingInput();
        return;
      }
      if (target && !shouldRecordChangeEvent(target)) return;
      emit("dom.change", compactObject({
        element: target ? describeElement(target) : void 0,
        inputValue: captureSettings.inputValues ? readElementValue(target) : void 0
      }));
    }, true);
    document.addEventListener("submit", (event) => {
      if (!isRecording()) return;
      rememberEventPathElements(event);
      const target = event.target instanceof Element ? event.target : null;
      emit("dom.submit", compactObject({ element: target ? describeElement(target) : void 0 }));
    }, true);
    document.addEventListener("keydown", (event) => {
      if (!isRecording()) return;
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
      if (!isRecording()) return;
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
      if (!isRecording()) return;
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        emit("dom.scroll", { scroll: { x: window.scrollX, y: window.scrollY } });
      }, 400);
    }, true);
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

  // src/content/index.ts
  sendReady();
  installFrameGeometryBridge();
  installMessageHandler();
  installRecordingEventListeners();
})();
//# sourceMappingURL=index.js.map
