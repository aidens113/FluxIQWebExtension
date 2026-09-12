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
  var VALUELESS_INPUT_TYPES = /* @__PURE__ */ new Set(["hidden", "button", "submit", "reset", "image", "checkbox", "radio"]);
  function hasEnteredValue(element) {
    if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return element.value.length > 0;
    if (element instanceof HTMLInputElement) {
      return VALUELESS_INPUT_TYPES.has(element.type.toLowerCase()) ? void 0 : element.value.length > 0;
    }
    if (element instanceof HTMLElement && element.isContentEditable) return (element.textContent ?? "").trim().length > 0;
    return void 0;
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

  // src/content/identity/bounded-text.ts
  function boundedText(value, maxLength) {
    const text = (value ?? "").replace(/\s+/gu, " ").trim();
    return text ? text.slice(0, maxLength) : void 0;
  }

  // src/content/identity/label.ts
  var MAX_LABEL_LENGTH = 200;
  var MAX_NEARBY_LABEL_LENGTH = 80;
  var MAX_ASSOCIATED_LABELS = 4;
  var MAX_NEARBY_SIBLINGS = 4;
  var NEARBY_LABEL_TAGS = /* @__PURE__ */ new Set(["label", "span", "div", "p", "dt", "strong", "b", "legend", "th"]);
  var NESTED_CONTROL_SELECTOR = "input,select,textarea,button";
  function associatedLabel(element) {
    const texts = associatedLabelElements(element).map((label) => labelElementText(label, element));
    return boundedText(texts.filter(Boolean).join(" "), MAX_LABEL_LENGTH);
  }
  function labelText(element) {
    return associatedLabel(element) ?? nearbyLabel(element);
  }
  function associatedLabelElements(element) {
    const native = element.labels;
    if (native) return [...native].slice(0, MAX_ASSOCIATED_LABELS);
    const labels = [];
    if (element.id) {
      for (const label of document.querySelectorAll(`label[for="${cssString2(element.id)}"]`)) labels.push(label);
    }
    const ancestor = element.closest("label");
    if (ancestor && !labels.includes(ancestor)) labels.push(ancestor);
    return labels.slice(0, MAX_ASSOCIATED_LABELS);
  }
  function labelElementText(label, control) {
    const parts = [];
    collectLabelText(label, control, parts, 0);
    return parts.join(" ").replace(/\s+/gu, " ").trim();
  }
  function collectLabelText(node, control, parts, depth) {
    if (parts.length > 40 || depth > 8) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      if (text?.trim()) parts.push(text);
      return;
    }
    if (!(node instanceof Element)) return;
    if (node === control || node.matches(NESTED_CONTROL_SELECTOR)) return;
    for (const child of node.childNodes) collectLabelText(child, control, parts, depth + 1);
  }
  function nearbyLabel(element) {
    if (!isLabelableControl(element)) return void 0;
    const fromSiblings = labelBeforeSiblings(element);
    if (fromSiblings) return fromSiblings;
    const wrapper = element.parentElement;
    return wrapper?.childElementCount === 1 ? labelBeforeSiblings(wrapper) : void 0;
  }
  function labelBeforeSiblings(element) {
    let sibling = element.previousElementSibling;
    let scanned = 0;
    while (sibling && scanned < MAX_NEARBY_SIBLINGS) {
      scanned += 1;
      const text = nearbyLabelText(sibling);
      if (text) return text;
      sibling = sibling.previousElementSibling;
    }
    return void 0;
  }
  function nearbyLabelText(candidate) {
    if (!NEARBY_LABEL_TAGS.has(candidate.tagName.toLowerCase())) return void 0;
    if (candidate.querySelector(NESTED_CONTROL_SELECTOR)) return void 0;
    return boundedText(candidate.textContent, MAX_NEARBY_LABEL_LENGTH);
  }
  function isLabelableControl(element) {
    if (element instanceof HTMLInputElement) return element.type.toLowerCase() !== "hidden";
    if (element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) return true;
    return element instanceof HTMLElement && element.isContentEditable;
  }
  function cssString2(value) {
    return CSS.escape(value).replace(/"/gu, '\\"');
  }

  // src/content/identity/accessible-name.ts
  var MAX_NAME_LENGTH = 200;
  var MAX_LABELLEDBY_IDS = 8;
  var BUTTON_INPUT_TYPES = /* @__PURE__ */ new Set(["submit", "button", "reset"]);
  var NAME_FROM_CONTENT_TAGS = /* @__PURE__ */ new Set([
    "a",
    "button",
    "summary",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "th",
    "td",
    "li",
    "label",
    "legend",
    "option",
    "caption",
    "figcaption",
    "dt",
    "dd"
  ]);
  var NAME_FROM_CONTENT_ROLES = /* @__PURE__ */ new Set([
    "button",
    "link",
    "menuitem",
    "menuitemcheckbox",
    "menuitemradio",
    "option",
    "tab",
    "heading",
    "treeitem",
    "gridcell",
    "cell",
    "columnheader",
    "rowheader",
    "row",
    "switch",
    "checkbox",
    "radio",
    "tooltip",
    "listitem"
  ]);
  function accessibleNameFor(element) {
    return labelledByName(element) ?? boundedText(element.getAttribute("aria-label"), MAX_NAME_LENGTH) ?? associatedLabel(element) ?? boundedText(element.getAttribute("title") ?? element.getAttribute("alt"), MAX_NAME_LENGTH) ?? boundedText(element.getAttribute("placeholder"), MAX_NAME_LENGTH) ?? buttonValueName(element) ?? nameFromContent(element);
  }
  function authoredNameAttribute(element) {
    return element.getAttribute("aria-label") ?? element.getAttribute("title") ?? element.getAttribute("alt") ?? void 0;
  }
  function labelledByName(element) {
    const ids = (element.getAttribute("aria-labelledby") ?? "").split(/\s+/u).filter(Boolean).slice(0, MAX_LABELLEDBY_IDS);
    if (!ids.length) return void 0;
    const parts = ids.flatMap((id) => {
      const target = document.getElementById(id);
      const text = target === element ? void 0 : boundedText(target?.textContent, MAX_NAME_LENGTH);
      return text ? [text] : [];
    });
    return boundedText(parts.join(" "), MAX_NAME_LENGTH);
  }
  function buttonValueName(element) {
    if (!(element instanceof HTMLInputElement)) return void 0;
    if (!BUTTON_INPUT_TYPES.has(element.type.toLowerCase())) return void 0;
    if (isSensitiveFormControl(element)) return void 0;
    return boundedText(element.value, MAX_NAME_LENGTH);
  }
  function nameFromContent(element) {
    return supportsNameFromContent(element) ? boundedText(element.textContent, MAX_NAME_LENGTH) : void 0;
  }
  function supportsNameFromContent(element) {
    if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) return false;
    if (element instanceof HTMLElement && element.isContentEditable) return false;
    const role = element.getAttribute("role")?.trim().toLowerCase();
    if (role) return NAME_FROM_CONTENT_ROLES.has(role);
    return NAME_FROM_CONTENT_TAGS.has(element.tagName.toLowerCase());
  }

  // src/content/identity/context.ts
  var MAX_CONTEXT_TEXT = 200;
  var HEADING_SELECTOR = "h1,h2,h3,h4,h5,h6,[role='heading']";
  var LIST_ITEM_SELECTOR = "li,[role='listitem'],[role='option'],[role='treeitem']";
  var MAX_LANDMARK_DEPTH = 30;
  var MAX_HEADING_LEVELS = 10;
  var MAX_HEADING_SIBLINGS = 12;
  var MAX_HEADING_SUBTREE_QUERIES = 24;
  var LANDMARK_ROLES = /* @__PURE__ */ new Set(["banner", "complementary", "contentinfo", "form", "main", "navigation", "region", "search"]);
  var LANDMARK_TAG_ROLES = {
    main: "main",
    nav: "navigation",
    header: "banner",
    footer: "contentinfo",
    aside: "complementary",
    search: "search",
    section: "region",
    form: "form"
  };
  function elementContext(element) {
    const context = compactObject({
      ...formContext(element),
      fieldsetLegend: fieldsetLegend(element),
      landmark: nearestLandmark(element),
      heading: nearestHeading(element),
      listPosition: listPosition(element),
      tablePosition: tablePosition(element)
    });
    return Object.keys(context).length ? context : void 0;
  }
  function formContext(element) {
    const owned = element.form;
    const form = owned ?? element.closest("form");
    if (!form) return {};
    return {
      formId: boundedText(form.getAttribute("id"), MAX_CONTEXT_TEXT),
      formName: boundedText(form.getAttribute("name"), MAX_CONTEXT_TEXT),
      formAction: boundedText(form.getAttribute("action"), MAX_CONTEXT_TEXT)
    };
  }
  function fieldsetLegend(element) {
    const legend = element.closest("fieldset")?.querySelector(":scope > legend");
    return boundedText(legend?.textContent, MAX_CONTEXT_TEXT);
  }
  function nearestLandmark(element) {
    let current = element;
    let depth = 0;
    while (current && depth < MAX_LANDMARK_DEPTH) {
      depth += 1;
      const role = landmarkRole(current);
      if (role) return role;
      current = current.parentElement;
    }
    return void 0;
  }
  function landmarkRole(element) {
    const explicit = element.getAttribute("role")?.trim().toLowerCase();
    if (explicit) return LANDMARK_ROLES.has(explicit) ? explicit : void 0;
    const tag = element.tagName.toLowerCase();
    const implicit = LANDMARK_TAG_ROLES[tag];
    if (!implicit) return void 0;
    if ((tag === "section" || tag === "form") && !hasAuthoredName(element)) return void 0;
    return implicit;
  }
  function nearestHeading(element) {
    let current = element;
    let levels = 0;
    let queries = 0;
    while (current && levels < MAX_HEADING_LEVELS) {
      levels += 1;
      let sibling = current.previousElementSibling;
      let scanned = 0;
      while (sibling && scanned < MAX_HEADING_SIBLINGS) {
        scanned += 1;
        if (sibling.matches(HEADING_SELECTOR)) return boundedText(sibling.textContent, MAX_CONTEXT_TEXT);
        if (sibling.firstElementChild && queries < MAX_HEADING_SUBTREE_QUERIES) {
          queries += 1;
          const headings = sibling.querySelectorAll(HEADING_SELECTOR);
          const last = headings[headings.length - 1];
          if (last) return boundedText(last.textContent, MAX_CONTEXT_TEXT);
        }
        sibling = sibling.previousElementSibling;
      }
      current = current.parentElement;
    }
    return void 0;
  }
  function listPosition(element) {
    const item = element.closest(LIST_ITEM_SELECTOR);
    const parent = item?.parentElement;
    if (!item || !parent) return void 0;
    const siblings = [...parent.children].filter((child) => child.matches(LIST_ITEM_SELECTOR));
    const index = siblings.indexOf(item);
    return index < 0 ? void 0 : { index: index + 1, total: siblings.length };
  }
  function tablePosition(element) {
    const cell = element.closest("td,th");
    if (!(cell instanceof HTMLTableCellElement)) return void 0;
    const row = cell.closest("tr");
    if (!(row instanceof HTMLTableRowElement) || row.rowIndex < 0 || cell.cellIndex < 0) return void 0;
    return compactObject({
      row: row.rowIndex + 1,
      column: cell.cellIndex + 1,
      columnHeader: columnHeader(row, cell)
    });
  }
  function columnHeader(row, cell) {
    const table = row.closest("table");
    if (!(table instanceof HTMLTableElement)) return void 0;
    const headerRow = table.tHead?.rows[0] ?? table.rows[0];
    return boundedText(headerRow?.cells[cell.cellIndex]?.textContent, MAX_CONTEXT_TEXT);
  }
  function hasAuthoredName(element) {
    return element.hasAttribute("aria-label") || element.hasAttribute("aria-labelledby") || element.hasAttribute("title");
  }

  // src/content/identity/implicit-role.ts
  var INPUT_TYPE_ROLES = {
    "": "textbox",
    text: "textbox",
    search: "searchbox",
    email: "textbox",
    tel: "textbox",
    url: "textbox",
    number: "spinbutton",
    checkbox: "checkbox",
    radio: "radio",
    range: "slider",
    button: "button",
    submit: "button",
    reset: "button",
    image: "button"
  };
  var TAG_ROLES = {
    button: "button",
    textarea: "textbox",
    table: "table",
    thead: "rowgroup",
    tbody: "rowgroup",
    tfoot: "rowgroup",
    tr: "row",
    td: "cell",
    caption: "caption",
    ul: "list",
    ol: "list",
    menu: "list",
    li: "listitem",
    datalist: "listbox",
    optgroup: "group",
    option: "option",
    fieldset: "group",
    details: "group",
    summary: "button",
    dialog: "dialog",
    output: "status",
    progress: "progressbar",
    meter: "meter",
    hr: "separator",
    p: "paragraph",
    article: "article",
    figure: "figure",
    blockquote: "blockquote",
    main: "main",
    nav: "navigation",
    header: "banner",
    footer: "contentinfo",
    aside: "complementary",
    search: "search"
  };
  function implicitRole(element) {
    const tag = element.tagName.toLowerCase();
    if (tag === "input") return inputRole(element);
    if (tag === "select") return selectRole(element);
    if (tag === "a" || tag === "area") return element.hasAttribute("href") ? "link" : void 0;
    if (tag === "img") return element.getAttribute("alt") === "" ? "presentation" : "img";
    if (tag === "th") return headerCellRole(element);
    if (/^h[1-6]$/u.test(tag)) return "heading";
    if (tag === "section") return hasAuthoredName2(element) ? "region" : void 0;
    if (tag === "form") return hasAuthoredName2(element) ? "form" : void 0;
    return TAG_ROLES[tag];
  }
  function inputRole(element) {
    const type = element instanceof HTMLInputElement ? element.type.toLowerCase() : "";
    const role = INPUT_TYPE_ROLES[type];
    if ((role === "textbox" || role === "searchbox") && element.hasAttribute("list")) return "combobox";
    return role;
  }
  function selectRole(element) {
    if (!(element instanceof HTMLSelectElement)) return "combobox";
    return element.multiple || element.size > 1 ? "listbox" : "combobox";
  }
  function headerCellRole(element) {
    return element.getAttribute("scope")?.trim().toLowerCase() === "row" ? "rowheader" : "columnheader";
  }
  function hasAuthoredName2(element) {
    return element.hasAttribute("aria-label") || element.hasAttribute("aria-labelledby") || element.hasAttribute("title");
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
    const name = authoredNameAttribute(element);
    if (name) descriptor.name = name;
    const href = linkHref(element);
    if (href) descriptor.href = href;
    if (element instanceof HTMLInputElement && element.type) descriptor.inputType = element.type;
    const valuePresent = hasEnteredValue(element);
    if (valuePresent !== void 0) descriptor.hasValue = valuePresent;
    const testId = testIdFor(element);
    if (testId) descriptor.testId = testId;
    const computedName = accessibleNameFor(element);
    if (computedName) descriptor.accessibleName = computedName;
    const label = labelText(element);
    if (label) descriptor.label = label;
    const markupRole = implicitRole(element);
    if (markupRole) descriptor.implicitRole = markupRole;
    const context = elementContext(element);
    if (context) descriptor.context = context;
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
    for (const attribute of ["id", "class", "name", "type", "autocomplete", "data-sensitive", "placeholder", "title", "alt", "href", "tabindex", "aria-label", "aria-labelledby", "aria-describedby", "for", "aria-disabled", "aria-expanded", "aria-controls", "aria-pressed", "aria-selected", "data-testid", "data-test", "data-cy", "disabled", "onclick"]) {
      const value2 = element.getAttribute(attribute);
      if (value2 !== null) attributes[attribute] = value2.slice(0, 500);
    }
    if (Object.keys(attributes).length) descriptor.attributes = attributes;
    return descriptor;
  }
  function selectorFor(element) {
    if (element.id) return `#${CSS.escape(element.id)}`;
    const testId = element.getAttribute("data-testid");
    if (testId) return `[data-testid="${cssString3(testId)}"]`;
    const name = element.getAttribute("name");
    if (name) return `${element.tagName.toLowerCase()}[name="${cssString3(name)}"]`;
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
  function testIdFor(element) {
    return element.getAttribute("data-testid") ?? element.getAttribute("data-test") ?? element.getAttribute("data-cy") ?? void 0;
  }
  function linkHref(element) {
    if (element instanceof HTMLAnchorElement && element.href) return element.href;
    return element.getAttribute("href") ?? element.getAttribute("xlink:href") ?? void 0;
  }
  function stableElementId(element) {
    return testIdFor(element) ?? element.getAttribute("id") ?? element.getAttribute("name") ?? void 0;
  }
  function cssString3(value) {
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
      stableElementId(element) || meaningfulText(authoredNameAttribute(element)) || meaningfulText(visibleText(element)) || meaningfulText(directVisibleText(element)) || meaningfulText(readElementValue(element)) || meaningfulText(element.getAttribute("title")) || meaningfulText(element.getAttribute("alt")) || meaningfulText(element.getAttribute("placeholder")) || meaningfulText(linkHref(element))
    );
  }
  function hasEventElementPresentation(element) {
    return hasMeaningfulInteractableIdentity(element) || hasElementPresentation(element);
  }
  function hasElementPresentation(element) {
    return meaningfulText(visibleText(element)) || meaningfulText(authoredNameAttribute(element)) || meaningfulText(readElementValue(element)) || hasVisualMedia(element);
  }
  function elementPriority(element) {
    let score = 0;
    if (isInteractableUiElement(element)) score += 200;
    if (isActionableElement(element)) score += 100;
    if (stableElementId(element)) score += 60;
    if (meaningfulText(authoredNameAttribute(element))) score += 45;
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
    return deps.success(action, startedAt, "Snapshot captured.", { status: "none", reason: "evidence-only" }, {
      snapshot: deps.captureSnapshot()
    });
  }

  // src/content/actions/wait-for-selector.ts
  async function waitForSelectorAction(action, deps, startedAt) {
    const condition = action.wait?.condition ?? "present";
    const url = action.wait?.url ?? action.url;
    const outcome = await deps.waitForCondition({
      condition,
      selector: action.selector,
      url,
      timeoutMs: action.timeoutMs,
      stableForMs: action.wait?.stableForMs
    });
    const phrases = phrasesFor(condition, action.selector, url);
    if (!outcome.ok) {
      return deps.timedOut(action, startedAt, phrases.timedOut, { status: "failed", expected: phrases.expected, actual: outcome.actual }, {
        snapshot: deps.captureSnapshot()
      });
    }
    return deps.success(action, startedAt, phrases.satisfied, { status: "passed", expected: phrases.expected, actual: outcome.actual }, {
      ...outcome.element ? { element: deps.describeElement(outcome.element) } : {},
      snapshot: deps.captureSnapshot()
    });
  }
  function phrasesFor(condition, selector, url) {
    const target = selector ?? "(no selector)";
    if (condition === "visible") {
      return { expected: `a visible element matching ${target}`, satisfied: "The element is visible.", timedOut: `Timed out waiting for a visible element: ${target}` };
    }
    if (condition === "enabled") {
      return { expected: `an enabled element matching ${target}`, satisfied: "The element is enabled.", timedOut: `Timed out waiting for an enabled element: ${target}` };
    }
    if (condition === "absent") {
      return { expected: `no element matching ${target}`, satisfied: "The element is gone.", timedOut: `Timed out waiting for the element to go: ${target}` };
    }
    if (condition === "url") {
      const address = url ?? "(no url)";
      return { expected: `the page URL to be ${address}`, satisfied: "The URL matched.", timedOut: `Timed out waiting for the URL: ${address}` };
    }
    if (condition === "stable") {
      return { expected: "the page to stop changing", satisfied: "The page is stable.", timedOut: "Timed out waiting for the page to stop changing." };
    }
    return { expected: `an element matching ${target}`, satisfied: "Selector found.", timedOut: `Timed out waiting for selector: ${target}` };
  }

  // src/content/actions/wait-for-text.ts
  async function waitForTextAction(action, deps, startedAt) {
    const condition = action.wait?.condition ?? "present";
    const text = action.text ?? action.value ?? "";
    const url = action.wait?.url ?? action.url;
    const outcome = await deps.waitForCondition({
      condition,
      text,
      url,
      timeoutMs: action.timeoutMs,
      stableForMs: action.wait?.stableForMs
    });
    const phrases = phrasesFor2(condition, text, url);
    if (!outcome.ok) {
      return deps.timedOut(action, startedAt, phrases.timedOut, { status: "failed", expected: phrases.expected, actual: outcome.actual }, {
        snapshot: deps.captureSnapshot()
      });
    }
    return deps.success(action, startedAt, phrases.satisfied, { status: "passed", expected: phrases.expected, actual: outcome.actual }, {
      snapshot: deps.captureSnapshot()
    });
  }
  function phrasesFor2(condition, text, url) {
    if (condition === "visible") {
      return { expected: `visible page text containing ${text}`, satisfied: "The text is visible.", timedOut: `Timed out waiting for visible text: ${text}` };
    }
    if (condition === "absent") {
      return { expected: `no page text containing ${text}`, satisfied: "The text is gone.", timedOut: `Timed out waiting for the text to go: ${text}` };
    }
    if (condition === "url") {
      const address = url ?? "(no url)";
      return { expected: `the page URL to be ${address}`, satisfied: "The URL matched.", timedOut: `Timed out waiting for the URL: ${address}` };
    }
    if (condition === "stable") {
      return { expected: "the page to stop changing", satisfied: "The page is stable.", timedOut: "Timed out waiting for the page to stop changing." };
    }
    return { expected: `page text containing ${text}`, satisfied: "Text found.", timedOut: `Timed out waiting for text: ${text}` };
  }

  // src/content/actions/extract.ts
  function extractAction(action, deps, startedAt) {
    const element = deps.resolveTarget(action);
    const extracted = deps.extractElement(element, action.options);
    return deps.success(action, startedAt, "Value extracted.", { status: "none", reason: "evidence-only" }, {
      element: deps.describeElement(element),
      snapshot: deps.captureSnapshot(),
      extracted
    });
  }

  // src/content/actions/click.ts
  function clickAction(action, deps, startedAt) {
    const element = deps.resolveTarget(action);
    const evidence = () => ({
      element: deps.describeElement(element),
      snapshot: deps.captureSnapshot()
    });
    const report = deps.checkActionability(element);
    if (!report.actionable) {
      return deps.rejected(action, startedAt, report.code, "a target that can be clicked", report.detail, evidence());
    }
    const link = navigatingLink(element);
    const document2 = element.ownerDocument;
    const before = document2.location.href;
    const accepted = dispatchClickGesture(element, report.point);
    const after = document2.location.href;
    const validation = link ? navigationValidation(link.href, before, after, accepted) : hitTestValidation(report.detail, accepted);
    return deps.success(action, startedAt, "Element clicked.", validation, evidence());
  }
  function navigatingLink(element) {
    const anchor = element.closest("a[href]");
    if (!anchor || typeof anchor.href !== "string" || !anchor.href) return void 0;
    if (anchor.protocol === "javascript:") return void 0;
    return { href: anchor.href };
  }
  function navigationValidation(href, before, after, accepted) {
    const expected = `navigation to ${href} begins`;
    if (after !== before) return { status: "passed", expected, actual: `the page navigated to ${after}` };
    if (accepted) return { status: "passed", expected, actual: `navigation to ${href} was initiated` };
    return { status: "failed", expected, actual: "the click was prevented and the location did not change" };
  }
  function hitTestValidation(detail, accepted) {
    return {
      status: "passed",
      expected: "the click lands on the target or something inside it",
      actual: accepted ? detail : `${detail}; the page prevented the click's default action`
    };
  }
  function dispatchClickGesture(element, point) {
    const base = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: element.ownerDocument.defaultView,
      clientX: point.x,
      clientY: point.y,
      button: 0,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true
    };
    const hover = { ...base, buttons: 0 };
    const entering = { ...hover, bubbles: false, cancelable: false };
    const press = { ...base, buttons: 1, detail: 1 };
    const release = { ...base, buttons: 0, detail: 1 };
    dispatchPointer(element, "pointerover", hover);
    dispatchPointer(element, "pointerenter", entering);
    element.dispatchEvent(new MouseEvent("mouseover", hover));
    element.dispatchEvent(new MouseEvent("mouseenter", entering));
    dispatchPointer(element, "pointermove", hover);
    element.dispatchEvent(new MouseEvent("mousemove", hover));
    dispatchPointer(element, "pointerdown", press);
    if (element.dispatchEvent(new MouseEvent("mousedown", press))) focusForPress(element);
    dispatchPointer(element, "pointerup", release);
    element.dispatchEvent(new MouseEvent("mouseup", release));
    return element.dispatchEvent(new MouseEvent("click", release));
  }
  function dispatchPointer(element, type, init) {
    if (typeof PointerEvent !== "function") return;
    element.dispatchEvent(new PointerEvent(type, init));
  }
  function focusForPress(element) {
    const target = element.closest("a[href],button,input,select,textarea,summary,[tabindex],[contenteditable]");
    const focusable = target;
    if (focusable && typeof focusable.focus === "function") focusable.focus({ preventScroll: true });
  }

  // src/content/actions/type.ts
  function typeAction(action, deps, startedAt) {
    const element = deps.resolveTarget(action);
    const text = action.text ?? action.value ?? "";
    const evidence = () => ({ element: deps.describeElement(element), snapshot: deps.captureSnapshot() });
    const report = deps.checkActionability(element);
    if (!report.actionable) {
      return deps.rejected(action, startedAt, report.code, "a target that can be typed into", report.detail, evidence());
    }
    if (!holdsText(element)) {
      return deps.success(action, startedAt, "The target holds no typed text.", {
        status: "failed",
        expected: `a text field or editable element holding "${text}"`,
        actual: `the target is a <${element.tagName.toLowerCase()}>, which holds no typed text`
      }, evidence());
    }
    deps.keyboard.typeText(element, text);
    const actual = enteredText(element);
    const held = actual === text;
    return deps.success(action, startedAt, held ? "Text entered." : "The field did not keep the text.", {
      status: held ? "passed" : "failed",
      expected: `the field holds "${text}"`,
      actual: `the field holds "${actual}"`
    }, evidence());
  }
  function holdsText(element) {
    if (element instanceof HTMLTextAreaElement) return true;
    if (element instanceof HTMLInputElement) return !["checkbox", "radio", "file"].includes(element.type);
    return element instanceof HTMLElement && element.isContentEditable;
  }
  function enteredText(element) {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) return element.value;
    return element.textContent ?? "";
  }

  // src/content/actions/clear.ts
  function clearAction(action, deps, startedAt) {
    const element = deps.resolveTarget(action);
    const evidence = () => ({ element: deps.describeElement(element), snapshot: deps.captureSnapshot() });
    const report = deps.checkActionability(element);
    if (!report.actionable) {
      return deps.rejected(action, startedAt, report.code, "a target that can be cleared", report.detail, evidence());
    }
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
      return deps.success(action, startedAt, "The target has no value to clear.", {
        status: "failed",
        expected: "a field whose value can be emptied",
        actual: `the target is a <${element.tagName.toLowerCase()}>, which has no value`
      }, evidence());
    }
    element.focus();
    deps.setElementValue(element, "");
    deps.dispatchInputEvents(element);
    const actual = element.value;
    const empty = actual === "";
    return deps.success(action, startedAt, empty ? "Field cleared." : "The field did not stay empty.", {
      status: empty ? "passed" : "failed",
      expected: "the field is empty",
      actual: empty ? "the field is empty" : `the field holds "${actual}"`
    }, evidence());
  }

  // src/content/actions/select.ts
  var OPTIONS_LISTED_ON_FAILURE = 20;
  function selectAction(action, deps, startedAt) {
    const element = deps.resolveTarget(action);
    const evidence = () => ({ element: deps.describeElement(element), snapshot: deps.captureSnapshot() });
    const request = requestedOption(action);
    const report = deps.checkActionability(element);
    if (!report.actionable) {
      return deps.rejected(action, startedAt, report.code, "a target that can be selected in", report.detail, evidence());
    }
    if (!request) {
      return deps.success(action, startedAt, "No option was named.", {
        status: "failed",
        expected: "an option named by value, label, or index",
        actual: "the command named none"
      }, evidence());
    }
    if (!(element instanceof HTMLSelectElement)) {
      return deps.success(action, startedAt, "The target is not a select element.", {
        status: "failed",
        expected: `a select element to choose ${describeRequest(request)} in`,
        actual: `the target is a <${element.tagName.toLowerCase()}>`
      }, evidence());
    }
    const option = findOption(element, request);
    if (!option) {
      return deps.success(action, startedAt, `No option matched ${describeRequest(request)}.`, {
        status: "failed",
        expected: `an option matching ${describeRequest(request)} is selected`,
        actual: `no option matched; the select still holds "${element.value}" and offers ${listOptions(element)}`
      }, evidence());
    }
    if (option.matches(":disabled")) {
      return deps.rejected(
        action,
        startedAt,
        "disabled",
        `a selectable option matching ${describeRequest(request)}`,
        `the option "${option.value}" (${normalizeLabel(optionLabel(option))}) is disabled`,
        evidence()
      );
    }
    element.focus();
    element.selectedIndex = option.index;
    deps.dispatchInputEvents(element);
    const selected = element.value;
    const held = selected === option.value;
    return deps.success(action, startedAt, held ? "Option selected." : "The select did not keep the chosen option.", {
      status: held ? "passed" : "failed",
      expected: `selected value "${option.value}" (${describeRequest(request)})`,
      actual: `selected value "${selected}"`
    }, evidence());
  }
  function requestedOption(action) {
    if (action.option) return action.option;
    if (action.value !== void 0) return { by: "value", value: action.value };
    return void 0;
  }
  function findOption(element, request) {
    const options = [...element.options];
    if (request.by === "value") return options.find((option) => option.value === request.value);
    if (request.by === "label") {
      const wanted = normalizeLabel(request.label);
      return options.find((option) => normalizeLabel(optionLabel(option)) === wanted);
    }
    return Number.isInteger(request.index) ? options[request.index] : void 0;
  }
  function describeRequest(request) {
    if (request.by === "value") return `value "${request.value}"`;
    if (request.by === "label") return `label "${request.label}"`;
    return `index ${request.index}`;
  }
  function listOptions(element) {
    const options = [...element.options];
    const listed = options.slice(0, OPTIONS_LISTED_ON_FAILURE).map((option) => `"${option.value}" (${normalizeLabel(optionLabel(option))})`).join(", ");
    if (!listed) return "no options";
    return options.length > OPTIONS_LISTED_ON_FAILURE ? `${listed}, and ${options.length - OPTIONS_LISTED_ON_FAILURE} more` : listed;
  }
  function optionLabel(option) {
    return option.label || option.textContent || "";
  }
  function normalizeLabel(label) {
    return label.replace(/\s+/gu, " ").trim();
  }

  // src/content/actions/scroll.ts
  var GROWTH_WINDOW_MS = 900;
  var GROWTH_POLL_MS = 50;
  var SMOOTH_SETTLE_MS = 1e3;
  var POSITION_TOLERANCE_PX = 2;
  async function scrollAction(action, deps, startedAt) {
    try {
      const request = action.scroll;
      if (request?.mode === "toElement") return scrollToElement(action, deps, startedAt);
      if (request?.mode === "untilStable") return await scrollUntilStable(action, request, deps, startedAt);
      return await scrollToPosition(action, requestedPosition(action, request), deps, startedAt);
    } catch (error) {
      return deps.failure(action, error, startedAt);
    }
  }
  function requestedPosition(action, request) {
    const from = currentPosition();
    if (request) return clampToDocument({ x: from.x + finiteNumber(request.x, 0), y: from.y + finiteNumber(request.y, 0) });
    return clampToDocument({
      x: finiteNumber(action.options?.x ?? action.coordinates?.x, from.x),
      y: finiteNumber(action.options?.y ?? action.coordinates?.y, from.y)
    });
  }
  async function scrollToPosition(action, target, deps, startedAt) {
    const from = currentPosition();
    const smooth = action.options?.smooth === true;
    window.scrollTo({ left: target.x, top: target.y, behavior: smooth ? "smooth" : "instant" });
    if (smooth) await settleAt(target);
    return deps.success(action, startedAt, "Page scrolled.", positionValidation(target, currentPosition(), from), {
      snapshot: deps.captureSnapshot()
    });
  }
  function scrollToElement(action, deps, startedAt) {
    const element = deps.resolveTarget(action);
    deps.scrollElementIntoView(element);
    const rect = element.getBoundingClientRect();
    const inView = rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
    return deps.success(action, startedAt, "Scrolled the target into view.", {
      status: inView ? "passed" : "failed",
      expected: "the target within the viewport",
      actual: `the target is at ${Math.round(rect.left)},${Math.round(rect.top)} in a ${window.innerWidth}x${window.innerHeight} viewport`
    }, { element: deps.describeElement(element), snapshot: deps.captureSnapshot() });
  }
  async function scrollUntilStable(action, request, deps, startedAt) {
    const cap = Math.max(1, Math.floor(finiteNumber(request.maxScrolls, 1)));
    const step = request.y === void 0 ? void 0 : finiteNumber(request.y, 0);
    const startHeight = documentHeight();
    let height = startHeight;
    let scrolls = 0;
    let settled = false;
    while (scrolls < cap) {
      const from = currentPosition();
      const bottom = scrollLimits().y;
      window.scrollTo({ left: from.x, top: step === void 0 ? bottom : Math.min(from.y + step, bottom), behavior: "instant" });
      scrolls += 1;
      const grown = await waitForGrowth(height);
      if (grown !== void 0) {
        height = grown;
        continue;
      }
      if (atBottom() || currentPosition().y === from.y) {
        settled = true;
        break;
      }
    }
    return deps.success(
      action,
      startedAt,
      settled ? "Scrolled until the document stopped growing." : `Stopped at the ${cap}-scroll cap while the document was still growing.`,
      {
        status: settled ? "passed" : "failed",
        expected: `the document to stop growing within ${cap} ${scrollWord(cap)}`,
        actual: settled ? `the document stopped growing after ${scrolls} ${scrollWord(scrolls)}, at ${height} pixels` : `the document was still growing after ${scrolls} ${scrollWord(scrolls)}, from ${startHeight} to ${height} pixels`
      },
      { snapshot: deps.captureSnapshot() }
    );
  }
  function positionValidation(target, actual, from) {
    const reached = Math.abs(actual.x - target.x) <= POSITION_TOLERANCE_PX && Math.abs(actual.y - target.y) <= POSITION_TOLERANCE_PX;
    return {
      status: reached ? "passed" : "failed",
      expected: `scroll position ${target.x},${target.y}`,
      actual: `scroll position ${actual.x},${actual.y}, moved from ${from.x},${from.y}`
    };
  }
  async function waitForGrowth(previousHeight) {
    const deadline = Date.now() + GROWTH_WINDOW_MS;
    do {
      await delay(GROWTH_POLL_MS);
      const height = documentHeight();
      if (height > previousHeight) return height;
    } while (Date.now() < deadline);
    return void 0;
  }
  async function settleAt(target) {
    const deadline = Date.now() + SMOOTH_SETTLE_MS;
    do {
      const position = currentPosition();
      if (Math.abs(position.x - target.x) <= POSITION_TOLERANCE_PX && Math.abs(position.y - target.y) <= POSITION_TOLERANCE_PX) return;
      await delay(GROWTH_POLL_MS);
    } while (Date.now() < deadline);
  }
  function currentPosition() {
    return { x: Math.round(window.scrollX), y: Math.round(window.scrollY) };
  }
  function documentHeight() {
    return Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0);
  }
  function scrollLimits() {
    const width = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0);
    return { x: Math.max(0, Math.round(width - window.innerWidth)), y: Math.max(0, Math.round(documentHeight() - window.innerHeight)) };
  }
  function atBottom() {
    return currentPosition().y >= scrollLimits().y - POSITION_TOLERANCE_PX;
  }
  function clampToDocument(point) {
    const limits = scrollLimits();
    return { x: clamp(Math.round(point.x), limits.x), y: clamp(Math.round(point.y), limits.y) };
  }
  function clamp(value, limit) {
    return Math.min(Math.max(value, 0), limit);
  }
  function finiteNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  function scrollWord(count2) {
    return count2 === 1 ? "scroll" : "scrolls";
  }
  function delay(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  // src/content/actions/keypress.ts
  function keypressAction(action, deps, startedAt) {
    const named = Boolean(action.selector);
    const target = named ? deps.resolveTarget(action) : document.activeElement ?? document.body;
    const key = action.key ?? action.text ?? "";
    const evidence = () => ({ element: deps.describeElement(target), snapshot: deps.captureSnapshot() });
    if (named) {
      const report = deps.checkActionability(target);
      if (!report.actionable) {
        return deps.rejected(action, startedAt, report.code, "a target that can receive the key press", report.detail, evidence());
      }
    }
    const outcome = deps.keyboard.pressKey(target, key, action.modifiers);
    if (outcome.defaultAction === "unsupported") {
      return deps.rejected(action, startedAt, "unsupported_key", outcome.expected, outcome.detail, evidence());
    }
    return deps.success(action, startedAt, outcome.held ? "Key pressed." : "The key press had no observable effect.", {
      status: outcome.held ? "passed" : "failed",
      expected: outcome.expected,
      actual: outcome.detail
    }, evidence());
  }

  // src/content/actions/check.ts
  function checkAction(action, deps, startedAt) {
    const element = deps.resolveTarget(action);
    const requested = action.checked ?? true;
    deps.scrollElementIntoView(element);
    const outcome = deps.setCheckedState(element, requested);
    const evidence = { element: deps.describeElement(element), snapshot: deps.captureSnapshot() };
    const expected = `the control is ${stateWord(requested)}`;
    if (!outcome.ok) {
      const code = outcome.code === "disabled" ? "disabled" : "not_checkable";
      return deps.rejected(action, startedAt, code, expected, outcome.reason, evidence);
    }
    const actual = `the ${outcome.kind} is ${stateWord(outcome.checked)}`;
    const validation = outcome.checked === requested ? { status: "passed", expected, actual } : { status: "failed", expected, actual };
    return deps.success(action, startedAt, outcome.changed ? "Check state set." : "Check state already set.", validation, evidence);
  }
  function stateWord(checked) {
    return checked ? "checked" : "unchecked";
  }

  // src/content/actions/assert.ts
  async function assertAction(action, deps, startedAt) {
    try {
      const request = action.assert;
      if (!request) throw new Error("web.dom.assert requires assert parameters naming the kind of claim.");
      const target = assertionTarget(action, deps);
      const outcome = await deps.evaluateAssertion(request, target);
      const evidence = {
        ...target.element ? { element: deps.describeElement(target.element) } : {},
        snapshot: deps.captureSnapshot()
      };
      const validation = outcome.held ? { status: "passed", expected: outcome.expected, actual: outcome.actual } : { status: "failed", expected: outcome.expected, actual: outcome.actual };
      const message = outcome.held ? `Assertion held: ${request.kind}.` : `Assertion did not hold: ${request.kind}.`;
      const result = deps.success(action, startedAt, message, validation, evidence);
      return outcome.held ? result : { ...result, failure: stateMismatchFailure(request.kind, result.validation) };
    } catch (error) {
      return deps.failure(action, error, startedAt);
    }
  }
  function assertionTarget(action, deps) {
    if (action.selector) return { selector: action.selector };
    try {
      return { element: deps.resolveTarget(action) };
    } catch {
      return {};
    }
  }
  function stateMismatchFailure(kind, validation) {
    return {
      category: "expected_state_missing",
      code: `web.assert.${kind}`,
      retryable: true,
      stage: "verification",
      ...validation.status === "none" ? {} : { expected: validation.expected, actual: validation.actual }
    };
  }

  // src/content/actions/extract-list.ts
  async function extractListAction(action, deps, startedAt) {
    const request = action.extractList;
    if (!request) return deps.failure(action, new Error("web.dom.extract_list needs extractList parameters."), startedAt);
    try {
      const outcome = await deps.extractList(request);
      return deps.success(action, startedAt, "List extracted.", validationFor(outcome, Object.keys(request.fields)), {
        extracted: outcome.records,
        snapshot: deps.captureSnapshot()
      });
    } catch (error) {
      return deps.failure(action, error, startedAt);
    }
  }
  function validationFor(outcome, fieldNames) {
    const expected = `every record carries ${fieldNames.join(", ")}`;
    const read = `${count(outcome.records.length, "record")} from ${count(outcome.pagesRead, "page")}${outcome.truncated ? ", truncated" : ""}`;
    return outcome.missingFields.length === 0 ? { status: "passed", expected, actual: `${read}; every declared field present` } : { status: "failed", expected, actual: `${read}; missing from some records: ${outcome.missingFields.join(", ")}` };
  }
  function count(value, noun) {
    return `${value} ${noun}${value === 1 ? "" : "s"}`;
  }

  // src/content/actions/upload.ts
  function uploadAction(action, deps, startedAt) {
    const files = action.upload?.files ?? [];
    const element = deps.resolveTarget(action);
    const evidence = { element: deps.describeElement(element), snapshot: deps.captureSnapshot() };
    const expected = fileNameList(files.map((file) => file.name));
    const outcome = deps.setInputFiles(element, files);
    if (!outcome.ok) {
      return deps.rejected(action, startedAt, "upload_rejected", expected, outcome.reason, evidence);
    }
    const actual = fileNameList(outcome.fileNames);
    return deps.success(action, startedAt, "Files uploaded.", {
      status: actual === expected ? "passed" : "failed",
      expected,
      actual
    }, evidence);
  }
  function fileNameList(names) {
    return names.length === 0 ? "(no files)" : names.join(", ");
  }

  // src/content/actions/dialog.ts
  function dialogAction(action, deps, startedAt) {
    const request = action.dialog;
    if (!request) {
      return deps.rejected(action, startedAt, "dialog_no_response", "a dialog response to arm", "the command carried no dialog request");
    }
    const expected = request.response === "accept" ? `the next dialog is accepted${request.promptText === void 0 ? "" : " with the supplied text"}` : "the next dialog is dismissed";
    const armed = deps.dialogControl.arm(request);
    const previous = deps.dialogControl.observed();
    const evidence = {
      snapshot: deps.captureSnapshot(),
      ...previous ? { extracted: observedAsJson(previous) } : {}
    };
    if (!armed) {
      return deps.rejected(action, startedAt, "dialog_override_missing", expected, "the page-world dialog override is not installed on this page", evidence);
    }
    return deps.success(action, startedAt, "Dialog response armed.", {
      status: "passed",
      expected,
      actual: "the response was armed and acknowledged by the page"
    }, evidence);
  }
  function observedAsJson(observed) {
    return {
      kind: observed.kind,
      message: observed.message,
      response: observed.response,
      at: observed.at,
      ...observed.promptText === void 0 ? {} : { promptText: observed.promptText }
    };
  }

  // src/content/actions/execute.ts
  async function executeContentAction(action, deps) {
    const startedAt = Date.now();
    try {
      if (action.actionType === "web.dom.capture_snapshot") {
        return await captureSnapshotAction(action, deps, startedAt);
      }
      if (action.actionType === "web.dom.wait_for_selector") {
        return await waitForSelectorAction(action, deps, startedAt);
      }
      if (action.actionType === "web.dom.wait_for_text") {
        return await waitForTextAction(action, deps, startedAt);
      }
      if (action.actionType === "web.dom.extract") {
        return await extractAction(action, deps, startedAt);
      }
      if (action.actionType === "web.dom.click") {
        return await clickAction(action, deps, startedAt);
      }
      if (action.actionType === "web.dom.type") {
        return await typeAction(action, deps, startedAt);
      }
      if (action.actionType === "web.dom.clear") {
        return await clearAction(action, deps, startedAt);
      }
      if (action.actionType === "web.dom.select") {
        return await selectAction(action, deps, startedAt);
      }
      if (action.actionType === "web.dom.scroll") {
        return await scrollAction(action, deps, startedAt);
      }
      if (action.actionType === "web.dom.keypress") {
        return await keypressAction(action, deps, startedAt);
      }
      if (action.actionType === "web.dom.check") {
        return await checkAction(action, deps, startedAt);
      }
      if (action.actionType === "web.dom.assert") {
        return await assertAction(action, deps, startedAt);
      }
      if (action.actionType === "web.dom.extract_list") {
        return await extractListAction(action, deps, startedAt);
      }
      if (action.actionType === "web.dom.upload") {
        return await uploadAction(action, deps, startedAt);
      }
      if (action.actionType === "web.dom.dialog") {
        return await dialogAction(action, deps, startedAt);
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

  // src/content/action-runtime/actionability.ts
  function checkActionability(element) {
    if (!element.isConnected) return reject("hidden", "the element is not in the document");
    const view = element.ownerDocument.defaultView;
    if (!view) return reject("hidden", "the element's document is not displayed");
    const hidden = hiddenReason(element, view);
    if (hidden) return reject("hidden", hidden);
    const disabled = disabledReason(element);
    if (disabled) return reject("disabled", disabled);
    scrollElementIntoView(element);
    const point = hitPoint(element, view);
    if (!point) return reject("hidden", "no part of the element is inside the viewport, even after scrolling");
    const hit = topmostAt(element.ownerDocument, point);
    if (!hit) return reject("covered", `nothing is painted at ${describePoint(point)}`, point);
    if (hit === element) return { actionable: true, point, detail: `the point ${describePoint(point)} landed on the target` };
    if (isWithin(element, hit)) {
      return { actionable: true, point, detail: `the point ${describePoint(point)} landed on ${elementLabel(hit)}, inside the target` };
    }
    return reject("covered", `the point ${describePoint(point)} landed on ${elementLabel(hit)}, which covers the target`, point);
  }
  function reject(code, detail, point) {
    return { actionable: false, code, detail, ...point ? { point } : {} };
  }
  function hiddenReason(element, view) {
    if (element.closest("[inert]")) return "the element is inert";
    const style = view.getComputedStyle(element);
    if (style.display === "none") return "the element's display is none";
    if (style.visibility !== "visible") return `the element's visibility is ${style.visibility}`;
    if (style.opacity === "0") return "the element's opacity is 0";
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return "the element has a zero-size box";
    const checkable = element;
    if (typeof checkable.checkVisibility === "function") {
      const visible = checkable.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true, contentVisibilityAuto: true });
      if (!visible) return "the element is not rendered";
    }
    return void 0;
  }
  function disabledReason(element) {
    if (element.matches(":disabled")) return "the element is disabled";
    const ariaDisabled = element.closest('[aria-disabled="true"]');
    if (ariaDisabled === element) return "the element is aria-disabled";
    if (ariaDisabled) return `${elementLabel(ariaDisabled)}, an ancestor of the element, is aria-disabled`;
    if (element.hasAttribute("disabled")) return "the element has a disabled attribute";
    return void 0;
  }
  function hitPoint(element, view) {
    const rect = element.getBoundingClientRect();
    const left = Math.max(rect.left, 0);
    const top = Math.max(rect.top, 0);
    const right = Math.min(rect.right, view.innerWidth);
    const bottom = Math.min(rect.bottom, view.innerHeight);
    if (right <= left || bottom <= top) return void 0;
    return { x: (left + right) / 2, y: (top + bottom) / 2 };
  }
  function topmostAt(document2, point) {
    let hit = document2.elementFromPoint(point.x, point.y) ?? void 0;
    for (let depth = 0; depth < 16; depth += 1) {
      const root = hit?.shadowRoot;
      if (!root) break;
      const deeper = root.elementFromPoint(point.x, point.y);
      if (!deeper || deeper === hit) break;
      hit = deeper;
    }
    return hit;
  }
  function isWithin(ancestor, node) {
    let current = node;
    while (current) {
      if (current === ancestor) return true;
      current = current instanceof ShadowRoot ? current.host : current.parentNode;
    }
    return false;
  }
  function elementLabel(element) {
    const tag = element.tagName.toLowerCase();
    const testId = element.getAttribute("data-testid");
    if (testId) return `${tag}[data-testid="${testId}"]`;
    if (element.id) return `${tag}#${element.id}`;
    const className = typeof element.className === "string" ? element.className.trim().split(/\s+/u)[0] : void 0;
    return className ? `${tag}.${className}` : tag;
  }
  function describePoint(point) {
    return `${Math.round(point.x)},${Math.round(point.y)}`;
  }

  // src/content/action-runtime/keyboard/key-event.ts
  var NAMED_KEYS = {
    Enter: { code: "Enter", keyCode: 13 },
    Tab: { code: "Tab", keyCode: 9 },
    Escape: { code: "Escape", keyCode: 27 },
    Backspace: { code: "Backspace", keyCode: 8 },
    Delete: { code: "Delete", keyCode: 46 },
    ArrowUp: { code: "ArrowUp", keyCode: 38 },
    ArrowDown: { code: "ArrowDown", keyCode: 40 },
    ArrowLeft: { code: "ArrowLeft", keyCode: 37 },
    ArrowRight: { code: "ArrowRight", keyCode: 39 },
    Home: { code: "Home", keyCode: 36 },
    End: { code: "End", keyCode: 35 },
    PageUp: { code: "PageUp", keyCode: 33 },
    PageDown: { code: "PageDown", keyCode: 34 },
    " ": { code: "Space", keyCode: 32 }
  };
  function dispatchKeyEvent(target, type, key, modifiers) {
    const { code, keyCode } = keyIdentifiers(key);
    return target.dispatchEvent(new KeyboardEvent(type, {
      key,
      code,
      keyCode,
      which: keyCode,
      bubbles: true,
      cancelable: true,
      composed: true,
      altKey: modifiers?.alt ?? false,
      ctrlKey: modifiers?.ctrl ?? false,
      metaKey: modifiers?.meta ?? false,
      shiftKey: modifiers?.shift ?? false
    }));
  }
  function keyIdentifiers(key) {
    const named = NAMED_KEYS[key];
    if (named) return named;
    if (key.length !== 1) return { code: "", keyCode: 0 };
    const upper = key.toUpperCase();
    if (upper >= "A" && upper <= "Z") return { code: `Key${upper}`, keyCode: upper.charCodeAt(0) };
    if (key >= "0" && key <= "9") return { code: `Digit${key}`, keyCode: key.charCodeAt(0) };
    return { code: "", keyCode: upper.charCodeAt(0) };
  }

  // src/content/action-runtime/keyboard/editable-target.ts
  var NON_TEXT_INPUT_TYPES = /* @__PURE__ */ new Set([
    "checkbox",
    "radio",
    "file",
    "submit",
    "reset",
    "button",
    "image",
    "range",
    "color",
    "hidden"
  ]);
  function isTextField(element) {
    if (element instanceof HTMLTextAreaElement) return true;
    return element instanceof HTMLInputElement && !NON_TEXT_INPUT_TYPES.has(element.type);
  }
  function isEditableHost(element) {
    return element instanceof HTMLElement && element.isContentEditable;
  }

  // src/content/action-runtime/keyboard/text-edits.ts
  function insertText(element, data) {
    if (!acceptsEdits(element)) return false;
    if (!beforeInput(element, "insertText", data)) return false;
    if (isTextField(element)) insertIntoField(element, data);
    else insertIntoHost(element, data);
    afterInput(element, "insertText", data);
    return true;
  }
  function deleteAllContent(element) {
    if (!acceptsEdits(element)) return false;
    if (isTextField(element)) {
      if (!element.value) return true;
      if (!beforeInput(element, "deleteContentBackward")) return false;
      setElementValue(element, "");
    } else {
      if (!element.textContent) return true;
      if (!beforeInput(element, "deleteContentBackward")) return false;
      element.replaceChildren();
    }
    afterInput(element, "deleteContentBackward");
    return true;
  }
  function acceptsEdits(element) {
    return !isTextField(element) || !element.readOnly && !element.disabled;
  }
  function beforeInput(element, inputType, data) {
    return element.dispatchEvent(new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      composed: true,
      inputType,
      ...data === void 0 ? {} : { data }
    }));
  }
  function afterInput(element, inputType, data) {
    element.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      cancelable: false,
      composed: true,
      inputType,
      ...data === void 0 ? {} : { data }
    }));
  }
  function insertIntoField(element, data) {
    const selection = fieldSelection(element);
    const value = element.value;
    const start = selection?.start ?? value.length;
    const end = selection?.end ?? value.length;
    setElementValue(element, value.slice(0, start) + data + value.slice(end));
    const caret = start + data.length;
    try {
      element.setSelectionRange(caret, caret);
    } catch {
    }
  }
  function fieldSelection(element) {
    try {
      const start = element.selectionStart;
      const end = element.selectionEnd;
      return start === null || end === null ? void 0 : { start, end };
    } catch {
      return void 0;
    }
  }
  function insertIntoHost(element, data) {
    const selection = document.getSelection();
    const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : void 0;
    if (!selection || !range || !element.contains(range.commonAncestorContainer)) {
      element.append(data);
      return;
    }
    range.deleteContents();
    const text = document.createTextNode(data);
    range.insertNode(text);
    range.setStartAfter(text);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  // src/content/action-runtime/keyboard/implicit-submission.ts
  function submitOwningForm(element) {
    if (!(element instanceof HTMLInputElement) || !isTextField(element)) {
      return { kind: "not-a-form-field", detail: `Enter has no default action on <${element.tagName.toLowerCase()}>` };
    }
    const form = element.form;
    if (!form) return { kind: "not-a-form-field", detail: "the field belongs to no form, so Enter submits nothing" };
    const label = formLabel(form);
    const submitter = defaultSubmitButton(form);
    if (!submitter && implicitSubmissionBlockers(form) !== 1) {
      return { kind: "no-default-button", form: label, detail: `${label} has no submit button and more than one field, so Enter does not submit it` };
    }
    return requestSubmit(form, label, submitter);
  }
  function requestSubmit(form, label, submitter) {
    let submitted = false;
    const observe = () => {
      submitted = true;
    };
    form.addEventListener("submit", observe, { capture: true, once: true });
    try {
      if (submitter) form.requestSubmit(submitter);
      else form.requestSubmit();
    } catch (error) {
      return { kind: "blocked", form: label, detail: `${label} refused to submit: ${error instanceof Error ? error.message : "the browser rejected the request"}` };
    } finally {
      form.removeEventListener("submit", observe, { capture: true });
    }
    if (!submitted) {
      return { kind: "blocked", form: label, detail: `${label} did not fire a submit event; its own constraint validation refused the submission` };
    }
    return {
      kind: "submitted",
      form: label,
      detail: `${label} fired a submit event${submitter ? ` with ${buttonLabel(submitter)} as the submitter` : " with no submitter"}`
    };
  }
  function defaultSubmitButton(form) {
    for (const candidate of form.elements) {
      if (candidate instanceof HTMLButtonElement && candidate.type === "submit" && !candidate.disabled) return candidate;
      if (candidate instanceof HTMLInputElement && candidate.type === "submit" && !candidate.disabled) return candidate;
    }
    return void 0;
  }
  function implicitSubmissionBlockers(form) {
    let count2 = 0;
    for (const candidate of form.elements) {
      if (candidate instanceof HTMLInputElement && isTextField(candidate)) count2 += 1;
    }
    return count2;
  }
  function formLabel(form) {
    const testId = form.dataset.testid;
    if (testId) return `the form [data-testid="${testId}"]`;
    if (form.id) return `the form #${form.id}`;
    if (form.name) return `the form named "${form.name}"`;
    return "the form";
  }
  function buttonLabel(button) {
    const testId = button.dataset.testid;
    if (testId) return `[data-testid="${testId}"]`;
    if (button.id) return `#${button.id}`;
    const text = button.textContent?.replace(/\s+/gu, " ").trim();
    return text ? `the "${text}" button` : "the form's default button";
  }

  // src/content/action-runtime/keyboard/tab-order.ts
  var TABBABLE_SELECTOR = [
    "a[href]",
    "area[href]",
    "button",
    "input",
    "select",
    "textarea",
    "summary",
    "iframe",
    "[contenteditable]:not([contenteditable='false'])",
    "[tabindex]"
  ].join(", ");
  function moveFocusByTab(from, backwards) {
    const order = tabOrder();
    if (order.length === 0) return void 0;
    const index = order.indexOf(from);
    const step = backwards ? -1 : 1;
    const next = index === -1 ? order[backwards ? order.length - 1 : 0] : order[(index + step + order.length) % order.length];
    if (!next) return void 0;
    next.focus();
    return document.activeElement === next ? next : void 0;
  }
  function tabOrder() {
    const candidates = [...document.querySelectorAll(TABBABLE_SELECTOR)].filter(isTabbable);
    const prioritized = candidates.filter((element) => element.tabIndex > 0).sort((a, b) => a.tabIndex - b.tabIndex);
    return [...prioritized, ...candidates.filter((element) => element.tabIndex === 0)];
  }
  function isTabbable(element) {
    if (element.tabIndex < 0 || isDisabled(element)) return false;
    if (element.hidden || element.closest("[inert]")) return false;
    if (element.getClientRects().length === 0) return false;
    if (getComputedStyle(element).visibility === "hidden") return false;
    return !isSkippedRadio(element);
  }
  function isDisabled(element) {
    const disableable = element instanceof HTMLButtonElement || element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement;
    return disableable && element.disabled;
  }
  function isSkippedRadio(element) {
    if (!(element instanceof HTMLInputElement) || element.type !== "radio" || !element.name) return false;
    const group = [...(element.form ?? document).querySelectorAll('input[type="radio"]')].filter((radio) => radio.name === element.name);
    const checked = group.find((radio) => radio.checked);
    return checked ? checked !== element : group[0] !== element;
  }

  // src/content/action-runtime/keyboard/press-key.ts
  var ARROW_KEYS = /* @__PURE__ */ new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);
  function pressKey(target, key, modifiers) {
    if (!key) {
      return { dispatched: false, defaultAction: "none", expected: "a key to press", detail: "the command named no key", held: false };
    }
    if (target instanceof HTMLElement) target.focus();
    const allowed = dispatchKeyEvent(target, "keydown", key, modifiers);
    const outcome = allowed ? defaultActionFor(target, key, modifiers) : pageHandled(key);
    dispatchKeyEvent(document.activeElement ?? target, "keyup", key, modifiers);
    return outcome;
  }
  function pageHandled(key) {
    return {
      dispatched: true,
      defaultAction: "none",
      expected: `the page receives the ${key} key`,
      detail: `the page handled ${key} and cancelled its default action`,
      held: true
    };
  }
  function defaultActionFor(target, key, modifiers) {
    if (key === "Enter") return enterPressed(target);
    if (key === "Tab") return tabPressed(target, modifiers?.shift === true);
    const refused = unsupportedDefault(target, key);
    if (refused) return refused;
    if (isPrintable(key, modifiers) && (isTextField(target) || isEditableHost(target))) return characterTyped(target, key);
    return {
      dispatched: true,
      defaultAction: "none",
      expected: `the page receives the ${key} key`,
      detail: `${key} was delivered; it has no default action on this target`,
      held: true
    };
  }
  function enterPressed(target) {
    if (target instanceof HTMLTextAreaElement || isEditableHost(target)) {
      const inserted = insertText(target, "\n");
      return {
        dispatched: true,
        defaultAction: "none",
        expected: "Enter inserts a line break",
        detail: inserted ? "a line break was inserted" : "the page cancelled the line break",
        held: inserted
      };
    }
    const submission = submitOwningForm(target);
    if (submission.kind === "submitted") {
      return { dispatched: true, defaultAction: "submitted", expected: `Enter submits ${submission.form ?? "the form"}`, detail: submission.detail, held: true };
    }
    if (submission.kind === "blocked") {
      return { dispatched: true, defaultAction: "none", expected: `Enter submits ${submission.form ?? "the form"}`, detail: submission.detail, held: false };
    }
    return { dispatched: true, defaultAction: "none", expected: "the page receives the Enter key", detail: submission.detail, held: true };
  }
  function tabPressed(target, backwards) {
    const direction = backwards ? "the previous" : "the next";
    const landed = moveFocusByTab(target, backwards);
    return {
      dispatched: true,
      defaultAction: landed ? "focus-moved" : "none",
      expected: `focus moves to ${direction} tabbable element`,
      detail: landed ? `focus moved to ${describe(landed)}` : "focus did not move: nothing else on the page is tabbable",
      held: landed !== void 0
    };
  }
  function characterTyped(target, key) {
    const inserted = insertText(target, key);
    return {
      dispatched: true,
      defaultAction: "none",
      expected: `the character "${key}" is inserted`,
      detail: inserted ? `"${key}" was inserted` : "the page cancelled the insertion",
      held: inserted
    };
  }
  function unsupportedDefault(target, key) {
    if (ARROW_KEYS.has(key) && isRadio(target)) {
      return unsupported(key, "moving a radio group's selection needs a trusted key event", "web.dom.check");
    }
    if (ARROW_KEYS.has(key) && target instanceof HTMLSelectElement) {
      return unsupported(key, "changing a select's option needs a trusted key event", "web.dom.select");
    }
    if (key === " " && (isRadio(target) || isCheckbox(target))) {
      return unsupported(key, "toggling a checkbox or radio needs a trusted key event", "web.dom.check");
    }
    if (key === " " && isButton(target)) {
      return unsupported(key, "activating a button needs a trusted key event", "web.dom.click");
    }
    return void 0;
  }
  function unsupported(key, why, verb) {
    return {
      dispatched: true,
      defaultAction: "unsupported",
      expected: `${key} performs its default action on this target`,
      detail: `${why}; the key was delivered but nothing changed -- use ${verb} instead`,
      held: false
    };
  }
  function isPrintable(key, modifiers) {
    if ([...key].length !== 1) return false;
    return !(modifiers?.ctrl ?? false) && !(modifiers?.meta ?? false) && !(modifiers?.alt ?? false);
  }
  function isRadio(target) {
    return target instanceof HTMLInputElement && target.type === "radio";
  }
  function isCheckbox(target) {
    return target instanceof HTMLInputElement && target.type === "checkbox";
  }
  function isButton(target) {
    if (target instanceof HTMLButtonElement) return true;
    return target instanceof HTMLInputElement && ["submit", "reset", "button", "image"].includes(target.type);
  }
  function describe(element) {
    const testId = element.dataset.testid;
    if (testId) return `[data-testid="${testId}"]`;
    if (element.id) return `#${element.id}`;
    return `<${element.tagName.toLowerCase()}>`;
  }

  // src/content/action-runtime/keyboard/type-text.ts
  function typeText(element, text) {
    if (!isTextField(element) && !isEditableHost(element)) return;
    if (element instanceof HTMLElement) element.focus();
    deleteAllContent(element);
    for (const character of text) {
      if (dispatchKeyEvent(element, "keydown", character)) insertText(element, character);
      dispatchKeyEvent(element, "keyup", character);
    }
    if (isTextField(element)) element.dispatchEvent(new Event("change", { bubbles: true }));
    else element.normalize();
  }

  // src/content/action-runtime/keyboard/capability.ts
  var keyboard = { typeText, pressKey };

  // src/content/action-runtime/checkable-state.ts
  function setCheckedState(element, checked) {
    const input = checkableInput(element);
    if (!input) {
      return { ok: false, reason: `${describeTarget(element)} is not a checkbox or a radio`, code: "not-checkable" };
    }
    if (isDisabled2(input)) {
      return { ok: false, reason: `the ${kindOf(input)} is disabled`, code: "disabled" };
    }
    if (kindOf(input) === "radio" && !checked) {
      return { ok: false, reason: "a radio cannot be unchecked; check another radio in its group instead", code: "not-checkable" };
    }
    const kind = kindOf(input);
    if (input.checked === checked) return { ok: true, kind, checked: input.checked, changed: false };
    input.focus();
    input.checked = checked;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return { ok: true, kind, checked: input.checked, changed: true };
  }
  function checkableInput(element) {
    if (element.tagName !== "INPUT") return void 0;
    const input = element;
    return input.type === "checkbox" || input.type === "radio" ? input : void 0;
  }
  function kindOf(input) {
    return input.type === "radio" ? "radio" : "checkbox";
  }
  function isDisabled2(input) {
    return input.matches(":disabled") || input.getAttribute("aria-disabled") === "true";
  }
  function describeTarget(element) {
    const type = element.tagName === "INPUT" ? `[type=${element.type}]` : "";
    return `<${element.tagName.toLowerCase()}${type}>`;
  }

  // src/content/action-runtime/list-extraction.ts
  var EXTRACT_MAX_PAGES = 50;
  var LIST_CHANGE_TIMEOUT_MS = 1e4;
  var LIST_CHANGE_POLL_MS = 25;
  var COLUMN_PREFIX = "column:";
  var ATTRIBUTE_NAME = /^[A-Za-z_][-A-Za-z0-9_:.]*$/u;
  function parseExtractField(spec) {
    if (spec.startsWith(COLUMN_PREFIX)) {
      const header = normalizeText2(spec.slice(COLUMN_PREFIX.length));
      if (!header) throw new Error(`The extract_list field ${JSON.stringify(spec)} names no column header.`);
      return { kind: "column", header };
    }
    const at = spec.lastIndexOf("@");
    const candidate = at < 0 ? "" : spec.slice(at + 1);
    const attribute = ATTRIBUTE_NAME.test(candidate) ? candidate : void 0;
    const selector = (attribute === void 0 ? spec : spec.slice(0, at)).trim();
    return {
      kind: "element",
      ...selector ? { selector } : {},
      ...attribute === void 0 ? {} : { attribute }
    };
  }
  async function extractList(request) {
    const item = request.item.trim();
    if (!item) throw new Error("An extract_list request needs an item selector.");
    const fields = Object.entries(request.fields).map(([name, spec]) => [name, parseExtractField(spec)]);
    if (fields.length === 0) throw new Error("An extract_list request names no fields.");
    const maxPages = request.paginate ? Math.min(Math.max(1, Math.trunc(request.paginate.maxPages)), EXTRACT_MAX_PAGES) : 1;
    const maxItems = request.maxItems === void 0 ? void 0 : Math.max(0, Math.trunc(request.maxItems));
    const records = [];
    const missing = /* @__PURE__ */ new Set();
    let pagesRead = 0;
    let truncated = false;
    for (; ; ) {
      const items = Array.from(document.querySelectorAll(item));
      pagesRead += 1;
      for (const element of items) {
        if (maxItems !== void 0 && records.length >= maxItems) {
          truncated = true;
          break;
        }
        records.push(readRecord(element, fields, missing));
      }
      if (truncated) break;
      const paginate = request.paginate;
      const next = paginate ? document.querySelector(paginate.next) : null;
      if (!paginate || !next) break;
      if (pagesRead >= maxPages) {
        truncated = true;
        break;
      }
      if (!(next instanceof HTMLElement)) throw new Error(`The pagination control ${JSON.stringify(paginate.next)} is not a clickable element.`);
      next.click();
      if (!await waitForListChange(item, items)) {
        throw new Error(`The list did not change within ${LIST_CHANGE_TIMEOUT_MS}ms of following ${JSON.stringify(paginate.next)} to page ${pagesRead + 1}.`);
      }
    }
    return { records, pagesRead, truncated, missingFields: [...missing].sort() };
  }
  function readRecord(item, fields, missing) {
    const record = {};
    for (const [name, field] of fields) {
      const value = readField(item, field);
      if (value === void 0) missing.add(name);
      else record[name] = value;
    }
    return record;
  }
  function readField(item, field) {
    if (field.kind === "column") return readColumn(item, field.header);
    const element = field.selector ? item.querySelector(field.selector) : item;
    if (!element) return void 0;
    if (field.attribute !== void 0) return element.getAttribute(field.attribute) ?? void 0;
    return normalizeText2(element.textContent ?? "");
  }
  function readColumn(item, header) {
    const row = item;
    const table = row.tagName === "TR" ? row.closest("table") : null;
    if (!table) throw new Error("A column field needs extract_list items that are table rows.");
    const headerRow = table.tHead?.rows[0] ?? Array.from(table.rows).find((candidate) => Array.from(candidate.cells).some((cell2) => cell2.tagName === "TH"));
    const index = headerRow ? Array.from(headerRow.cells).findIndex((cell2) => normalizeText2(cell2.textContent ?? "") === header) : -1;
    if (index < 0) return void 0;
    const cell = row.cells[index];
    return cell ? normalizeText2(cell.textContent ?? "") : void 0;
  }
  async function waitForListChange(itemSelector, previous) {
    const deadline = Date.now() + LIST_CHANGE_TIMEOUT_MS;
    while (!listChanged(itemSelector, previous)) {
      if (Date.now() >= deadline) return false;
      await delay2(LIST_CHANGE_POLL_MS);
    }
    return true;
  }
  function listChanged(itemSelector, previous) {
    const current = document.querySelectorAll(itemSelector);
    const first = previous[0];
    if (!first) return current.length > 0;
    return !first.isConnected || current.length !== previous.length || current[0] !== first;
  }
  function delay2(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
  function normalizeText2(text) {
    return text.replace(/\s+/gu, " ").trim();
  }

  // src/content/action-runtime/file-input.ts
  var UPLOAD_MAX_FILE_BYTES = 1048576;
  var UPLOAD_MAX_TOTAL_BYTES = 4194304;
  function setInputFiles(element, files) {
    if (!(element instanceof HTMLInputElement) || element.type !== "file") {
      return { ok: false, reason: `the target is a ${element.tagName.toLowerCase()}, not a file input` };
    }
    if (files.length === 0) return { ok: false, reason: "the command carried no files" };
    if (files.length > 1 && !element.multiple) {
      return { ok: false, reason: `the file input accepts one file, but ${files.length} were supplied` };
    }
    const transfer = new DataTransfer();
    let totalBytes = 0;
    for (const file of files) {
      const content = decodeBase64(file.contentBase64);
      if (!content) return { ok: false, reason: `the content of ${file.name} is not valid base64` };
      if (content.byteLength > UPLOAD_MAX_FILE_BYTES) {
        return { ok: false, reason: `${file.name} is ${content.byteLength} bytes, over the ${UPLOAD_MAX_FILE_BYTES}-byte file limit` };
      }
      totalBytes += content.byteLength;
      if (totalBytes > UPLOAD_MAX_TOTAL_BYTES) {
        return { ok: false, reason: `the upload is over the ${UPLOAD_MAX_TOTAL_BYTES}-byte total limit` };
      }
      transfer.items.add(new File([content], file.name, { type: file.mimeType }));
    }
    try {
      element.files = transfer.files;
    } catch {
      return { ok: false, reason: "the file input rejected the files" };
    }
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    const assigned = element.files;
    return { ok: true, fileNames: assigned ? [...assigned].map((file) => file.name) : [] };
  }
  function decodeBase64(contentBase64) {
    let binary;
    try {
      binary = atob(contentBase64);
    } catch {
      return void 0;
    }
    const buffer = new ArrayBuffer(binary.length);
    const bytes = new Uint8Array(buffer);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return buffer;
  }

  // src/shared/dialog-channel.ts
  var DIALOG_ARM_ATTRIBUTE = "data-fluxiq-dialog-arm";
  var DIALOG_OBSERVED_ATTRIBUTE = "data-fluxiq-dialog-observed";
  var DIALOG_ARM_EVENT = "fluxiq:dialog-arm";
  var DIALOG_TEXT_MAX_LENGTH = 1024;
  function encodeDialogArm(arm) {
    return JSON.stringify({
      response: arm.response,
      ...arm.promptText === void 0 ? {} : { promptText: boundText(arm.promptText) }
    });
  }
  function decodeDialogObserved(raw) {
    const value = parseObject(raw);
    if (!value) return void 0;
    const response = dialogResponse(value["response"]);
    const kind = dialogKind(value["kind"]);
    const message = value["message"];
    const at = value["at"];
    if (!response || !kind || typeof message !== "string" || typeof at !== "number") return void 0;
    const promptText = value["promptText"];
    return typeof promptText === "string" ? { kind, message, response, promptText, at } : { kind, message, response, at };
  }
  function boundText(value) {
    return value.length <= DIALOG_TEXT_MAX_LENGTH ? value : value.slice(0, DIALOG_TEXT_MAX_LENGTH);
  }
  function parseObject(raw) {
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : void 0;
    } catch {
      return void 0;
    }
  }
  function dialogResponse(value) {
    return value === "accept" || value === "dismiss" ? value : void 0;
  }
  function dialogKind(value) {
    return value === "alert" || value === "confirm" || value === "prompt" || value === "beforeunload" ? value : void 0;
  }

  // src/content/action-runtime/dialog-control.ts
  var dialogControl = {
    arm(request) {
      const root = document.documentElement;
      if (!root) return false;
      try {
        root.setAttribute(DIALOG_ARM_ATTRIBUTE, encodeDialogArm({
          response: request.response,
          ...request.promptText === void 0 ? {} : { promptText: request.promptText }
        }));
      } catch {
        return false;
      }
      document.dispatchEvent(new CustomEvent(DIALOG_ARM_EVENT));
      if (!root.hasAttribute(DIALOG_ARM_ATTRIBUTE)) return true;
      root.removeAttribute(DIALOG_ARM_ATTRIBUTE);
      return false;
    },
    observed() {
      const raw = document.documentElement?.getAttribute(DIALOG_OBSERVED_ATTRIBUTE);
      return raw === null || raw === void 0 ? void 0 : decodeDialogObserved(raw);
    }
  };

  // src/content/action-runtime/assertion-evaluation.ts
  var DEFAULT_ASSERT_TIMEOUT_MS = 5e3;
  var POLL_INTERVAL_MS = 50;
  async function evaluateAssertion(request, target) {
    const timeoutMs = Math.max(0, request.timeoutMs ?? DEFAULT_ASSERT_TIMEOUT_MS);
    const deadline = Date.now() + timeoutMs;
    let outcome = evaluateOnce(request, target);
    while (!outcome.held && Date.now() < deadline) {
      await delay3(Math.min(POLL_INTERVAL_MS, deadline - Date.now()));
      outcome = evaluateOnce(request, target);
    }
    return outcome;
  }
  function evaluateOnce(request, target) {
    if (request.kind === "url") return urlOutcome(request.expected);
    const where = target.selector ? `"${target.selector}"` : "the resolved element";
    const found = currentElement(target);
    if (request.kind === "exists") {
      if (!target.selector && !target.element) {
        return { held: false, expected: "an element to test for existence", actual: "the action named no selector and no element" };
      }
      return { held: Boolean(found), expected: `an element matching ${where} exists`, actual: found ? "it exists" : `nothing matched ${where}` };
    }
    if (request.kind === "absent") {
      return { held: !found, expected: `no element matches ${where}`, actual: found ? `${where} is still present` : `nothing matched ${where}` };
    }
    if (request.kind === "text") return textOutcome(request.expected ?? "", target, found, where);
    if (!found) {
      const claim = request.kind === "visible" ? "visible" : "enabled";
      return { held: false, expected: `${where} is ${claim}`, actual: `nothing matched ${where}` };
    }
    if (request.kind === "visible") {
      const visible = isVisible(found);
      return { held: visible, expected: `${where} is visible`, actual: visible ? "it is visible" : "it is present but not visible" };
    }
    const enabled = isEnabled(found);
    return { held: enabled, expected: `${where} is enabled`, actual: enabled ? "it is enabled" : "it is present but disabled" };
  }
  function currentElement(target) {
    if (target.selector) return document.querySelector(target.selector) ?? void 0;
    if (target.element) return target.element.isConnected ? target.element : void 0;
    return void 0;
  }
  function textOutcome(wanted, target, found, where) {
    const scope = target.selector || target.element ? found : document.body;
    const label = target.selector || target.element ? where : "the page";
    if (!scope) return { held: false, expected: `${label} contains "${wanted}"`, actual: `nothing matched ${where}` };
    const text = readText(scope);
    return {
      held: text.includes(wanted),
      expected: `${label} contains "${wanted}"`,
      actual: text ? `${label} reads "${text}"` : `${label} has no text`
    };
  }
  function readText(element) {
    const tagName = element.tagName;
    const value = tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT" ? element.value : element.innerText ?? element.textContent ?? "";
    return value.replace(/\s+/gu, " ").trim();
  }
  function urlOutcome(expected) {
    const href = location.href;
    const wanted = expected ?? "";
    const held = wanted !== "" && (href === wanted || href.includes(wanted));
    return {
      held,
      expected: wanted ? `the page URL is ${wanted}` : "the assertion to name the expected URL",
      actual: `the page URL is ${href}`
    };
  }
  function isVisible(element) {
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const style = getComputedStyle(element);
    return style.visibility !== "hidden" && style.display !== "none" && Number.parseFloat(style.opacity) !== 0;
  }
  function isEnabled(element) {
    return !element.matches(":disabled") && element.getAttribute("aria-disabled") !== "true";
  }
  function delay3(ms) {
    return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
  }

  // src/content/action-runtime/waits.ts
  var POLL_INTERVAL_MS2 = 50;
  var DEFAULT_WAIT_TIMEOUT_MS = 1e4;
  function waitUntil(evaluate, timeoutMs = DEFAULT_WAIT_TIMEOUT_MS) {
    const startedAt = Date.now();
    const progress = { startedAt, lastChangeAt: startedAt };
    const immediate = evaluate(progress);
    if (immediate !== void 0) return Promise.resolve(immediate);
    return new Promise((resolve, reject2) => {
      let settled = false;
      const stop = () => {
        settled = true;
        clearTimeout(timer);
        clearInterval(poll);
        observer2.disconnect();
      };
      const check = () => {
        if (settled) return;
        let value;
        try {
          value = evaluate(progress);
        } catch (error) {
          stop();
          reject2(error instanceof Error ? error : new Error(String(error)));
          return;
        }
        if (value === void 0) return;
        stop();
        resolve(value);
      };
      const timer = setTimeout(() => {
        stop();
        resolve(void 0);
      }, timeoutMs);
      const poll = setInterval(check, POLL_INTERVAL_MS2);
      const observer2 = new MutationObserver(() => {
        progress.lastChangeAt = Date.now();
        check();
      });
      observer2.observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
    });
  }
  function pageText() {
    return document.body?.innerText ?? "";
  }

  // src/content/action-runtime/wait-conditions.ts
  var DEFAULT_STABLE_FOR_MS = 500;
  async function waitForCondition(request) {
    const startedAt = Date.now();
    const hit = await waitUntil(evaluatorFor(request), request.timeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS);
    const waitedMs = Date.now() - startedAt;
    if (!hit) return { ok: false, condition: request.condition, actual: unmetActual(request), waitedMs };
    return {
      ok: true,
      condition: request.condition,
      ...hit.element ? { element: hit.element } : {},
      actual: hit.actual,
      waitedMs
    };
  }
  function evaluatorFor(request) {
    const { condition } = request;
    if (condition === "present") return () => presentHit(request);
    if (condition === "visible") return () => visibleHit(request);
    if (condition === "enabled") return () => enabledHit(request);
    if (condition === "absent") return () => absentHit(request);
    if (condition === "url") return () => urlHit(request);
    if (condition === "stable") return (progress) => stableHit(request, progress);
    return noEvaluator(condition);
  }
  function noEvaluator(condition) {
    throw new Error(`The wait condition "${String(condition)}" has no evaluator.`);
  }
  function presentHit(request) {
    if (request.selector) {
      const element = document.querySelector(request.selector);
      return element ? { element, actual: "the element was found" } : void 0;
    }
    return pageText().includes(requireText(request)) ? { actual: "the text was found" } : void 0;
  }
  function visibleHit(request) {
    if (request.selector) {
      const element = document.querySelector(request.selector);
      return element && isVisible2(element) ? { element, actual: "the element was visible" } : void 0;
    }
    return pageText().includes(requireText(request)) ? { actual: "the text was visible" } : void 0;
  }
  function enabledHit(request) {
    const element = document.querySelector(requireSelector(request));
    return element && isEnabled2(element) ? { element, actual: "the element was enabled" } : void 0;
  }
  function absentHit(request) {
    if (request.selector) {
      return document.querySelector(request.selector) ? void 0 : { actual: "no element matched the selector" };
    }
    return pageText().includes(requireText(request)) ? void 0 : { actual: "the text was absent" };
  }
  function urlHit(request) {
    const requested = request.url;
    if (!requested) throw new Error('The "url" wait condition needs the URL to wait for.');
    return urlMatches(location.href, requested) ? { actual: location.href } : void 0;
  }
  function stableHit(request, progress) {
    const stableForMs = request.stableForMs ?? DEFAULT_STABLE_FOR_MS;
    if (Date.now() - progress.lastChangeAt < stableForMs) return void 0;
    return { actual: `the page stopped changing for ${stableForMs} ms` };
  }
  function unmetActual(request) {
    const { condition } = request;
    if (condition === "present") return request.selector ? "no element matched before the timeout" : "the text did not appear before the timeout";
    if (condition === "visible") return request.selector ? "the element was not visible before the timeout" : "the text was not visible before the timeout";
    if (condition === "enabled") return "the element was not enabled before the timeout";
    if (condition === "absent") return request.selector ? "the element was still present after the timeout" : "the text was still present after the timeout";
    if (condition === "url") return `the page was still on ${location.href}`;
    return "the page was still changing after the timeout";
  }
  function isVisible2(element) {
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const visibility = getComputedStyle(element).visibility;
    return visibility !== "hidden" && visibility !== "collapse";
  }
  function isEnabled2(element) {
    if (element.getAttribute("aria-disabled") === "true") return false;
    return !element.matches(":disabled");
  }
  function urlMatches(current, requested) {
    if (current === requested || current.includes(requested)) return true;
    try {
      return new URL(requested, document.baseURI).href === current;
    } catch {
      return false;
    }
  }
  function requireSelector(request) {
    if (!request.selector) throw new Error(`The "${request.condition}" wait condition needs a selector.`);
    return request.selector;
  }
  function requireText(request) {
    if (!request.text) throw new Error(`The "${request.condition}" wait condition needs a selector or text to wait for.`);
    return request.text;
  }

  // src/content/action-runtime/validation-outcome.ts
  var VALIDATION_TEXT_MAX_LENGTH = 1024;
  function truncateValidationText(value) {
    const collapsed = value.replace(/\s+/gu, " ").trim();
    if (!collapsed) return "(none)";
    return collapsed.length <= VALIDATION_TEXT_MAX_LENGTH ? collapsed : `${collapsed.slice(0, VALIDATION_TEXT_MAX_LENGTH - 1)}\u2026`;
  }
  function boundValidation(validation) {
    if (validation.status === "none") return validation;
    return {
      status: validation.status,
      expected: truncateValidationText(validation.expected),
      actual: truncateValidationText(validation.actual)
    };
  }
  function statusForValidation(validation) {
    return validation.status === "failed" ? "failed" : "succeeded";
  }
  function outputNotObservedFailure(validation) {
    if (validation.status !== "failed") return void 0;
    return {
      category: "output_not_observed",
      code: "web.validation.output_not_observed",
      retryable: true,
      stage: "verification",
      expected: validation.expected,
      actual: validation.actual
    };
  }
  function rejectionFailure(code, validation) {
    return {
      category: "blocked_by_capability_or_policy",
      code: `web.action.${code}`,
      retryable: false,
      stage: "execution",
      ...comparedText(validation)
    };
  }
  function timeoutFailure(validation) {
    return {
      category: "timeout",
      code: "web.action.timeout",
      retryable: true,
      stage: "execution",
      ...comparedText(validation)
    };
  }
  function notImplementedFailure() {
    return {
      category: "blocked_by_capability_or_policy",
      code: "web.action.not_implemented",
      retryable: false,
      stage: "dispatch"
    };
  }
  function comparedText(validation) {
    return validation.status === "none" ? {} : { expected: validation.expected, actual: validation.actual };
  }

  // src/content/action-runtime/results.ts
  function actionFailure(action, error, startedAt = Date.now()) {
    const snapshot = captureSettings.snapshots ? captureSnapshot() : void 0;
    return {
      commandId: action.commandId,
      actionType: action.actionType,
      status: "failed",
      validation: { status: "none", reason: "not-yet-validated" },
      message: error instanceof Error ? error.message : "Action failed.",
      url: location.href,
      title: document.title,
      ...snapshot ? { snapshot } : {},
      startedAt,
      finishedAt: Date.now()
    };
  }
  function success(action, startedAt, message, validation, evidence = {}) {
    const bounded = boundValidation(validation);
    return buildResult(action, startedAt, {
      status: statusForValidation(bounded),
      validation: bounded,
      message,
      failure: outputNotObservedFailure(bounded)
    }, evidence);
  }
  function actionRejected(action, startedAt, code, expected, actual, evidence = {}) {
    const validation = boundValidation({ status: "failed", expected, actual });
    return buildResult(action, startedAt, {
      status: "failed",
      validation,
      message: `Action rejected: ${validation.status === "failed" ? validation.actual : actual}`,
      failure: rejectionFailure(code, validation)
    }, evidence);
  }
  function actionTimedOut(action, startedAt, message, validation, evidence = {}) {
    const bounded = boundValidation(validation);
    return buildResult(action, startedAt, {
      status: "timed_out",
      validation: bounded,
      message,
      failure: timeoutFailure(bounded)
    }, evidence);
  }
  function actionNotImplemented(action, startedAt, what) {
    return buildResult(action, startedAt, {
      status: "failed",
      validation: { status: "none", reason: "not-yet-validated" },
      message: `${what} is not implemented yet.`,
      failure: notImplementedFailure()
    }, {});
  }
  function buildResult(action, startedAt, core, evidence) {
    const result = {
      commandId: action.commandId,
      actionType: action.actionType,
      status: core.status,
      validation: core.validation,
      url: location.href,
      title: document.title,
      startedAt,
      finishedAt: Date.now()
    };
    if (core.message !== void 0) result.message = core.message;
    if (core.failure !== void 0) result.failure = core.failure;
    if (evidence.element) result.element = evidence.element;
    if (action.visualTarget) result.visualTarget = action.visualTarget;
    if (evidence.snapshot ?? captureSettings.snapshots) result.snapshot = evidence.snapshot ?? captureSnapshot();
    if (evidence.extracted !== void 0) result.extracted = evidence.extracted;
    if (evidence.resolution) result.resolution = evidence.resolution;
    return result;
  }

  // src/content/action-runtime/execute-action.ts
  async function executeAction(action) {
    return executeContentAction(action, {
      captureSnapshot,
      resolveTarget,
      describeElement,
      extractElement,
      scrollElementIntoView,
      setElementValue,
      dispatchInputEvents,
      checkActionability,
      keyboard,
      setCheckedState,
      extractList,
      setInputFiles,
      dialogControl,
      evaluateAssertion,
      waitForCondition,
      success,
      failure: actionFailure,
      rejected: actionRejected,
      timedOut: actionTimedOut,
      notImplemented: actionNotImplemented
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
