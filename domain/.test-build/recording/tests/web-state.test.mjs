// src/recording/tests/web-state.test.ts
import assert from "node:assert/strict";
import { validateStateSnapshot } from "fluxiq/automation-studio";

// src/constants.ts
var WEB_AUTOMATION_DOMAIN_ID = "web-automation";
var WEB_AUTOMATION_SCHEMA_VERSION = "0.1";

// src/recording/state.ts
var WEB_AUTOMATION_STATE_NAMESPACE = "web";
function createWebAutomationInitialState(timestamp = Date.now()) {
  return {
    timestamp,
    namespaces: {
      [WEB_AUTOMATION_STATE_NAMESPACE]: {
        schemaId: WEB_AUTOMATION_DOMAIN_ID,
        schemaVersion: WEB_AUTOMATION_SCHEMA_VERSION,
        values: {},
        metadata: { domainId: WEB_AUTOMATION_DOMAIN_ID }
      }
    }
  };
}

// src/recording/web-state.ts
var MAX_STATE_ELEMENTS = 1500;
var MAX_VISUAL_FRAME_ELEMENTS = 1e3;
var WEB_AUTOMATION_VIEWPORT_VISUALIZER_ID = "web-automation.viewport";
var WEB_AUTOMATION_SCREEN_FRAME_ID = "screen";
var WEB_AUTOMATION_DOCUMENT_FRAME_ID = "document";
function createWebAutomationStateFromSnapshot(snapshot, input = {}) {
  const timestamp = input.timestamp ?? Date.now();
  let state = createWebAutomationInitialState(timestamp);
  state = putStateValue(state, "page.url", "string", snapshot.url, timestamp, input.sourceId, { elementKind: "url" });
  state = putStateValue(state, "page.title", "string", snapshot.title, timestamp, input.sourceId, { elementKind: "text" });
  state = putStateValue(state, "viewport.bounds", "rectangle", { x: 0, y: 0, width: snapshot.viewport.width, height: snapshot.viewport.height }, timestamp, input.sourceId, { elementKind: "bounds", volatility: "normal" });
  state = putStateValue(state, "scroll.position", "point", { x: snapshot.viewport.scrollX, y: snapshot.viewport.scrollY }, timestamp, input.sourceId, { elementKind: "position", volatility: "rapid" });
  if (snapshot.selectedText) state = putStateValue(state, "page.selectedText", "string", snapshot.selectedText, timestamp, input.sourceId, { elementKind: "text" });
  if (snapshot.focusedElement) {
    const target = webAutomationActionTargetFromElement(snapshot.focusedElement);
    state = putStateValue(state, "focus.target", "json", target, timestamp, input.sourceId, { elementKind: "json", volatility: "rapid" });
  }
  const elements = filterStateElements(snapshot.interactiveElements);
  state = putStateValue(state, "elements.count", "integer", elements.length, timestamp, input.sourceId, { elementKind: "count" });
  for (const element of elements) state = addElementStateValues(state, element, timestamp, input.sourceId);
  return withScreenVisualFrame(state, snapshot, elements, input);
}
function filterStateElements(elements, limit = MAX_STATE_ELEMENTS) {
  const seen = /* @__PURE__ */ new Set();
  const filtered = [];
  const prioritized = [...elements].sort(
    (left, right) => stateElementBucket(left) - stateElementBucket(right) || stateElementScore(right) - stateElementScore(left)
  );
  for (const element of prioritized) {
    if (!shouldCaptureElementState(element)) continue;
    const id = elementStateId(element);
    if (seen.has(id)) continue;
    seen.add(id);
    filtered.push(element);
    if (filtered.length >= limit) break;
  }
  return filtered;
}
function shouldCaptureElementState(element) {
  if (!hasElementBounds(element)) return false;
  return Boolean(
    isLikelyInteractableElement(element) && hasMeaningfulElementIdentity(element) || meaningfulText(element.text) || meaningfulText(element.visibleText) || meaningfulText(element.name) || meaningfulText(element.value) || meaningfulText(element.href)
  );
}
function webAutomationActionTargetFromElement(element) {
  return compactJsonObject({
    type: element.role ?? element.inputType ?? element.tagName,
    id: stableAttribute(element, "data-testid") ?? stableAttribute(element, "id") ?? stableAttribute(element, "name"),
    label: element.name ?? element.visibleText ?? element.text ?? element.value,
    selector: element.selector,
    bounds: element.bounds,
    metadata: compactJsonObject({
      tagName: element.tagName,
      xpath: element.xpath,
      id: element.id,
      classNames: element.classNames,
      visibleText: element.visibleText,
      role: element.role,
      href: element.href,
      inputType: element.inputType,
      documentBounds: stateBounds(element.documentBounds),
      isVisibleOnViewport: element.isVisibleOnViewport ?? Boolean(stateBounds(element.bounds)),
      hasClickHandler: element.hasClickHandler,
      attributes: element.attributes
    })
  });
}
function webAutomationActionVisualTargetFromElement(element, input = {}) {
  const stateId = elementStateId(element);
  const statePath = `${WEB_AUTOMATION_STATE_NAMESPACE}.elements.${stateId}`;
  const bounds = stateBounds(element.bounds);
  const documentBounds = stateBounds(element.documentBounds ?? element.bounds);
  const anchorBounds = documentBounds ?? bounds;
  const safeId = safeLayerId(stateId, input.layerIndex ?? 1);
  return compactJsonObject({
    namespace: WEB_AUTOMATION_STATE_NAMESPACE,
    statePath,
    selector: element.selector,
    frameId: WEB_AUTOMATION_SCREEN_FRAME_ID,
    layerId: `element.${safeId}`,
    documentLayerId: `document.element.${safeId}`,
    bounds,
    documentBounds,
    anchor: anchorBounds ? { type: "bounds", bounds: anchorBounds } : void 0,
    confidence: input.confidence ?? (stableElementId(element) ? 0.98 : 0.88),
    metadata: compactJsonObject({
      tagName: element.tagName,
      xpath: element.xpath,
      id: element.id,
      classNames: element.classNames,
      visibleText: element.visibleText,
      role: element.role,
      name: element.name,
      href: element.href,
      inputType: element.inputType,
      stableId: stableElementId(element),
      isVisibleOnViewport: element.isVisibleOnViewport ?? Boolean(bounds)
    })
  });
}
function addElementStateValues(state, element, timestamp, sourceId) {
  const basePath = `elements.${elementStateId(element)}`;
  const anchor = boundsAnchor(element.documentBounds ?? element.bounds);
  const elementLabel = element.name ?? element.visibleText ?? element.text ?? element.value ?? element.href ?? element.selector;
  const elementPresentation = anchor ? { group: "Elements", anchor, visualKind: "bounds" } : { group: "Elements" };
  return putStateValue(state, basePath, "json", elementStatePayload(element), timestamp, sourceId, {
    elementKind: "element",
    stableAcrossSessions: Boolean(stableElementId(element)),
    comparable: false,
    sensitive: element.value !== void 0,
    presentation: {
      ...elementPresentation,
      label: elementLabel,
      visualKind: anchor ? "bounds" : "text",
      metadata: compactJsonObject({
        boundsKind: "document",
        renderKind: "direct-rendered",
        isVisibleOnViewport: element.isVisibleOnViewport ?? Boolean(stateBounds(element.bounds))
      })
    }
  });
}
function withScreenVisualFrame(state, snapshot, elements, input = {}) {
  const width = positiveFinite(snapshot.viewport.width) ?? 1;
  const height = positiveFinite(snapshot.viewport.height) ?? 1;
  const screenWidth = positiveFinite(input.screenImageSize?.width) ?? width;
  const screenHeight = positiveFinite(input.screenImageSize?.height) ?? height;
  const screenScaleX = screenWidth / width;
  const screenScaleY = screenHeight / height;
  const frameViewportOffset = stateBounds(snapshot.frame?.viewportOffset);
  const rawDocumentWidth = positiveFinite(snapshot.viewport.documentWidth) ?? width;
  const documentMapWidth = width;
  const documentHeight = positiveFinite(snapshot.viewport.documentHeight) ?? height;
  const layers = [];
  if (input.screenContentRef) {
    layers.push({
      id: "screenshot",
      kind: "image",
      contentRef: input.screenContentRef,
      bounds: { x: 0, y: 0, width: screenWidth, height: screenHeight },
      metadata: compactJsonObject({
        projectId: input.projectId,
        url: snapshot.url,
        frameKind: "viewport-screenshot",
        boundsKind: "screenshot",
        viewportWidth: width,
        viewportHeight: height,
        imageWidth: screenWidth,
        imageHeight: screenHeight
      })
    });
  }
  for (const [index, element] of elements.slice(0, MAX_VISUAL_FRAME_ELEMENTS).entries()) {
    const bounds = scaledScreenBounds(screenFrameBounds(element.bounds, frameViewportOffset), screenScaleX, screenScaleY);
    if (!bounds) continue;
    const statePath = `${WEB_AUTOMATION_STATE_NAMESPACE}.elements.${elementStateId(element)}`;
    layers.push({
      id: `element.${safeLayerId(elementStateId(element), index + 1)}`,
      kind: "region",
      label: element.name ?? element.visibleText ?? element.text ?? element.value ?? element.href ?? element.tagName,
      bounds,
      statePath,
      anchor: { type: "bounds", bounds },
      metadata: compactJsonObject({
        selector: element.selector,
        tagName: element.tagName,
        boundsKind: "screenshot",
        renderKind: "screenshot-bbox",
        isVisibleOnViewport: true
      })
    });
  }
  const screenFrame = {
    id: WEB_AUTOMATION_SCREEN_FRAME_ID,
    rendererId: WEB_AUTOMATION_VIEWPORT_VISUALIZER_ID,
    label: "Viewport Screenshot",
    coordinateSpace: { width: screenWidth, height: screenHeight, unit: "px", origin: "top-left" },
    layers,
    presentation: { label: snapshot.title || "Browser viewport", visualKind: "bounds", icon: "globe" },
    metadata: compactJsonObject({
      url: snapshot.url,
      title: snapshot.title,
      scrollX: snapshot.viewport.scrollX,
      scrollY: snapshot.viewport.scrollY,
      devicePixelRatio: snapshot.viewport.devicePixelRatio,
      frameKind: "viewport-screenshot",
      screenCoordinateSpace: "viewport",
      documentWidth: snapshot.viewport.documentWidth,
      documentHeight: snapshot.viewport.documentHeight,
      viewportWidth: width,
      viewportHeight: height,
      imageWidth: screenWidth,
      imageHeight: screenHeight,
      imageScaleX: screenScaleX,
      imageScaleY: screenScaleY,
      frameViewportOffset,
      isTopFrame: snapshot.frame?.isTop
    })
  };
  const documentFrame = {
    id: WEB_AUTOMATION_DOCUMENT_FRAME_ID,
    rendererId: WEB_AUTOMATION_VIEWPORT_VISUALIZER_ID,
    label: "Document Map",
    coordinateSpace: { width: documentMapWidth, height: documentHeight, unit: "px", origin: "top-left" },
    layers: [
      {
        id: "viewport",
        kind: "region",
        label: "Viewport",
        bounds: { x: snapshot.viewport.scrollX, y: snapshot.viewport.scrollY, width, height },
        metadata: compactJsonObject({
          boundsKind: "document",
          renderKind: "viewport-marker"
        })
      },
      ...elements.slice(0, MAX_VISUAL_FRAME_ELEMENTS).flatMap((element, index) => {
        const bounds = stateBounds(element.documentBounds ?? element.bounds);
        if (!bounds) return [];
        const projectedViewportBounds = element.bounds ? stateBounds({
          x: bounds.x - snapshot.viewport.scrollX,
          y: bounds.y - snapshot.viewport.scrollY,
          width: bounds.width,
          height: bounds.height
        }) : void 0;
        const statePath = `${WEB_AUTOMATION_STATE_NAMESPACE}.elements.${elementStateId(element)}`;
        return [{
          id: `document.element.${safeLayerId(elementStateId(element), index + 1)}`,
          kind: "region",
          label: element.name ?? element.visibleText ?? element.text ?? element.value ?? element.href ?? element.tagName,
          bounds,
          statePath,
          anchor: { type: "bounds", bounds },
          metadata: compactJsonObject({
            selector: element.selector,
            tagName: element.tagName,
            boundsKind: "document",
            renderKind: "direct-rendered",
            isVisibleOnViewport: element.isVisibleOnViewport ?? Boolean(stateBounds(element.bounds)),
            projectedViewportBounds
          })
        }];
      })
    ],
    presentation: { label: "Document map", visualKind: "bounds", icon: "map" },
    metadata: compactJsonObject({
      url: snapshot.url,
      title: snapshot.title,
      scrollX: snapshot.viewport.scrollX,
      scrollY: snapshot.viewport.scrollY,
      viewportWidth: width,
      viewportHeight: height,
      frameKind: "document-map",
      screenCoordinateSpace: "document-map",
      documentWidth: rawDocumentWidth,
      documentMapWidth,
      documentHeight
    })
  };
  return {
    ...state,
    id: state.id ?? `web.snapshot.${state.timestamp}`,
    presentation: {
      ...state.presentation ?? {},
      defaultFrameId: WEB_AUTOMATION_SCREEN_FRAME_ID,
      visualFrames: [screenFrame, documentFrame]
    }
  };
}
function putStateValue(snapshot, path, type, value, observedAt, sourceId, input = {}) {
  const namespace = snapshot.namespaces[WEB_AUTOMATION_STATE_NAMESPACE] ?? {
    schemaId: WEB_AUTOMATION_DOMAIN_ID,
    schemaVersion: WEB_AUTOMATION_SCHEMA_VERSION,
    values: {},
    metadata: { domainId: WEB_AUTOMATION_DOMAIN_ID }
  };
  const stateValue = compactJsonObject({
    type,
    value,
    observedAt,
    sourceId,
    confidence: input.confidence ?? 0.95,
    volatility: input.volatility ?? "normal",
    comparable: input.comparable ?? true,
    sensitive: input.sensitive,
    presentation: input.presentation,
    metadata: compactJsonObject({
      elementKind: input.elementKind,
      stableAcrossSessions: input.stableAcrossSessions
    })
  });
  return {
    ...snapshot,
    timestamp: observedAt,
    namespaces: {
      ...snapshot.namespaces,
      [WEB_AUTOMATION_STATE_NAMESPACE]: {
        ...namespace,
        values: {
          ...namespace.values,
          [path]: stateValue
        }
      }
    }
  };
}
function elementStateId(element) {
  const stable = stableElementPathId(element);
  if (stable) return sanitizeStateId(stable);
  const name = stableAttribute(element, "name");
  if (name) return sanitizeStateId(`${name}.${element.selector}`);
  return sanitizeStateId(element.selector);
}
function elementStatePayload(element) {
  return compactJsonObject({
    selector: element.selector,
    tagName: element.tagName,
    xpath: element.xpath,
    id: element.id,
    classNames: element.classNames,
    visibleText: element.visibleText,
    text: element.text,
    value: element.value,
    role: element.role,
    name: element.name,
    href: element.href,
    inputType: element.inputType,
    bounds: stateBounds(element.bounds),
    documentBounds: stateBounds(element.documentBounds),
    isVisibleOnViewport: element.isVisibleOnViewport ?? Boolean(stateBounds(element.bounds)),
    enabled: isEnabled(element),
    stableId: stableElementId(element),
    hasClickHandler: element.hasClickHandler,
    attributes: element.attributes
  });
}
function stableElementId(element) {
  return stableAttribute(element, "data-testid") ?? stableAttribute(element, "data-test") ?? stableAttribute(element, "data-cy") ?? stableAttribute(element, "id") ?? stableAttribute(element, "name");
}
function stableElementPathId(element) {
  return stableAttribute(element, "data-testid") ?? stableAttribute(element, "data-test") ?? stableAttribute(element, "data-cy") ?? stableAttribute(element, "id");
}
function sanitizeStateId(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "").slice(0, 120) || "element";
}
function meaningfulText(value) {
  return typeof value === "string" && value.trim().length >= 2;
}
function stableAttribute(element, name) {
  const value = element.attributes?.[name];
  return meaningfulText(value) ? value : void 0;
}
function hasElementBounds(element) {
  return stateBounds(element.documentBounds ?? element.bounds) !== void 0;
}
function isEnabled(element) {
  return element.attributes?.disabled === void 0 && element.attributes?.["aria-disabled"] !== "true";
}
function stateElementBucket(element) {
  if (isPrimaryControlElement(element) && hasMeaningfulElementIdentity(element)) return 0;
  if (isLikelyInteractableElement(element) && hasMeaningfulElementIdentity(element)) return 1;
  if (isSemanticTextElement(element) && hasTextualElementIdentity(element)) return 2;
  if (hasTextualElementIdentity(element)) return 3;
  if (meaningfulText(element.href)) return 4;
  return 5;
}
function stateElementScore(element) {
  let score = 0;
  if (isLikelyInteractableElement(element)) score += 200;
  if (isLikelyActionableElement(element)) score += 100;
  if (hasStableElementIdentity(element)) score += 60;
  if (meaningfulText(element.name)) score += 45;
  if (meaningfulText(element.value)) score += 35;
  if (meaningfulText(element.text) || meaningfulText(element.visibleText)) score += 25;
  const bounds = element.documentBounds ?? element.bounds;
  if (bounds) score += Math.min(20, Math.sqrt(bounds.width * bounds.height) / 8);
  return score;
}
function hasMeaningfulElementIdentity(element) {
  return hasStableElementIdentity(element) || hasTextualElementIdentity(element) || meaningfulText(element.href);
}
function hasTextualElementIdentity(element) {
  return meaningfulText(element.text) || meaningfulText(element.visibleText) || meaningfulText(element.name) || meaningfulText(element.value);
}
function hasStableElementIdentity(element) {
  return Boolean(
    stableAttribute(element, "data-testid") || stableAttribute(element, "data-test") || stableAttribute(element, "data-cy") || stableAttribute(element, "aria-label") || stableAttribute(element, "name") || stableAttribute(element, "id")
  );
}
function isLikelyInteractableElement(element) {
  return isLikelyActionableElement(element) || element.attributes?.tabindex !== void 0 || element.attributes?.["aria-expanded"] !== void 0 || element.attributes?.["aria-controls"] !== void 0 || element.attributes?.["aria-pressed"] !== void 0 || element.attributes?.["aria-selected"] !== void 0;
}
function isPrimaryControlElement(element) {
  const tagName = element.tagName.toLowerCase();
  const role = element.role?.toLowerCase();
  return tagName === "button" || tagName === "a" || tagName === "summary" || role === "button" || role === "link" || role === "menuitem" || role === "tab";
}
function isSemanticTextElement(element) {
  const tagName = element.tagName.toLowerCase();
  return tagName === "p" || tagName === "li" || tagName === "td" || tagName === "th" || tagName === "dt" || tagName === "dd" || tagName === "figcaption" || tagName === "blockquote" || /^h[1-6]$/.test(tagName);
}
function isLikelyActionableElement(element) {
  const tagName = element.tagName.toLowerCase();
  const role = element.role?.toLowerCase();
  const inputType = element.inputType?.toLowerCase();
  return tagName === "button" || tagName === "a" || tagName === "select" || tagName === "textarea" || tagName === "summary" || tagName === "label" || tagName === "input" && inputType !== "hidden" || role === "button" || role === "link" || role === "menuitem" || role === "checkbox" || role === "radio" || role === "tab" || role === "switch" || element.hasClickHandler === true || element.attributes?.onclick !== void 0;
}
function boundsAnchor(bounds) {
  const normalized = stateBounds(bounds);
  return normalized ? { type: "bounds", bounds: normalized } : void 0;
}
function screenFrameBounds(bounds, frameViewportOffset) {
  const normalized = stateBounds(bounds);
  if (!normalized) return void 0;
  if (!frameViewportOffset) return normalized;
  return stateBounds({
    x: frameViewportOffset.x + normalized.x,
    y: frameViewportOffset.y + normalized.y,
    width: normalized.width,
    height: normalized.height
  });
}
function scaledScreenBounds(bounds, scaleX, scaleY) {
  if (!bounds) return void 0;
  return stateBounds({
    x: bounds.x * scaleX,
    y: bounds.y * scaleY,
    width: bounds.width * scaleX,
    height: bounds.height * scaleY
  });
}
function stateBounds(bounds) {
  if (!bounds) return void 0;
  const x = finite(bounds.x);
  const y = finite(bounds.y);
  const width = positiveFinite(bounds.width);
  const height = positiveFinite(bounds.height);
  return x !== void 0 && y !== void 0 && width !== void 0 && height !== void 0 ? { x, y, width, height } : void 0;
}
function finite(value) {
  return Number.isFinite(value) ? value : void 0;
}
function positiveFinite(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : void 0;
}
function safeLayerId(value, fallbackIndex) {
  return value.replace(/[^a-z0-9.]+/gi, ".").replace(/^\.+|\.+$/g, "").slice(0, 80) || String(fallbackIndex);
}
function compactJsonObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== void 0));
}

// src/recording/tests/web-state.test.ts
var initialState = createWebAutomationInitialState(1);
assert.equal(initialState.namespaces.web?.schemaId, WEB_AUTOMATION_DOMAIN_ID);
var filteredElements = filterStateElements([
  { tagName: "button", selector: "button.icon" },
  { tagName: "button", selector: "button.save", text: "Save", bounds: { x: 20, y: 30, width: 80, height: 32 } },
  { tagName: "a", selector: "a.home", href: "https://example.test/home", bounds: { x: 120, y: 30, width: 96, height: 24 } },
  { tagName: "input", selector: "input[name=search]", attributes: { name: "search" }, bounds: { x: 20, y: 80, width: 240, height: 36 } }
]);
assert.deepEqual(filteredElements.map((item) => item.selector), ["button.save", "a.home", "input[name=search]"]);
var saveVisualTarget = webAutomationActionVisualTargetFromElement(filteredElements[0]);
assert.equal(saveVisualTarget?.statePath, "web.elements.button.save");
assert.equal(saveVisualTarget?.documentLayerId, "document.element.button.save");
var prioritizedElements = filterStateElements([
  { tagName: "section", selector: "section.hero", attributes: { id: "hero" }, bounds: { x: 0, y: 0, width: 800, height: 300 } },
  { tagName: "p", selector: "p.summary", text: "Account summary", bounds: { x: 20, y: 120, width: 220, height: 24 } },
  { tagName: "p", selector: "p.disclaimer", text: "Disclosures below the fold", documentBounds: { x: 20, y: 1200, width: 260, height: 24 }, isVisibleOnViewport: false },
  { tagName: "button", selector: "button.deposit", text: "Deposit", bounds: { x: 20, y: 40, width: 90, height: 36 } },
  { tagName: "div", selector: "div.empty", bounds: { x: 20, y: 180, width: 100, height: 20 } }
]);
assert.equal(prioritizedElements[0]?.selector, "button.deposit");
assert.equal(prioritizedElements.some((item) => item.selector === "p.summary"), true);
assert.equal(prioritizedElements.some((item) => item.selector === "p.disclaimer"), true);
var noisyElements = Array.from({ length: 1600 }, (_, index) => ({
  tagName: "div",
  selector: `div.wrapper-${index}`,
  text: `Wrapper ${index}`,
  bounds: { x: 0, y: index * 20, width: 800, height: 18 }
}));
var prioritySurvivors = filterStateElements([
  ...noisyElements,
  { tagName: "a", selector: "a.billing", href: "https://example.test/billing", text: "Billing", bounds: { x: 20, y: 20, width: 80, height: 24 } },
  { tagName: "p", selector: "p.balance", text: "Available balance", bounds: { x: 20, y: 60, width: 160, height: 24 } },
  { tagName: "h2", selector: "h2.accounts", text: "Accounts", bounds: { x: 20, y: 100, width: 140, height: 32 } }
]);
assert.equal(prioritySurvivors.some((item) => item.selector === "a.billing"), true);
assert.equal(prioritySurvivors.some((item) => item.selector === "p.balance"), true);
assert.equal(prioritySurvivors.some((item) => item.selector === "h2.accounts"), true);
var repeatedNamedControlsState = createWebAutomationStateFromSnapshot({
  url: "https://example.test/preferences",
  title: "Preferences",
  viewport: { width: 800, height: 600, scrollX: 0, scrollY: 0 },
  interactiveElements: [
    { tagName: "input", selector: "form > label:nth-of-type(1) > input", inputType: "radio", attributes: { name: "plan", type: "radio" }, bounds: { x: 10, y: 10, width: 16, height: 16 } },
    { tagName: "input", selector: "form > label:nth-of-type(2) > input", inputType: "radio", attributes: { name: "plan", type: "radio" }, bounds: { x: 10, y: 40, width: 16, height: 16 } }
  ]
}, { timestamp: 18 });
assert.equal(repeatedNamedControlsState.namespaces.web?.values["elements.count"]?.value, 2);
var snapshotState = createWebAutomationStateFromSnapshot({
  url: "https://example.test/search",
  title: "Search",
  viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 25 },
  interactiveElements: filteredElements
}, {
  timestamp: 20,
  sourceId: "tab:1",
  projectId: "project.test",
  screenContentRef: "automation-object://project/project.test/0000000000000000000000000000000000000000000000000000000000000000"
});
var webValues = snapshotState.namespaces.web?.values ?? {};
assert.equal(webValues["page.url"]?.value, "https://example.test/search");
assert.equal(webValues["scroll.position"]?.type, "point");
assert.equal(webValues["elements.count"]?.value, 3);
assert.equal(Object.keys(webValues).some((path) => path.includes("button.icon")), false);
assert.equal(Object.keys(webValues).some((path) => path.endsWith(".selector")), false);
assert.equal(snapshotState.presentation?.defaultFrameId, "screen");
assert.equal(snapshotState.presentation?.visualFrames?.[0]?.rendererId, "web-automation.viewport");
assert.equal(snapshotState.presentation?.visualFrames?.[0]?.layers[0]?.id, "screenshot");
assert.equal(snapshotState.presentation?.visualFrames?.[0]?.layers.some((layer) => layer.kind === "region"), true);
assert.equal(snapshotState.presentation?.visualFrames?.[0]?.metadata?.frameKind, "viewport-screenshot");
assert.equal(snapshotState.presentation?.visualFrames?.[1]?.id, "document");
assert.equal(snapshotState.presentation?.visualFrames?.[1]?.metadata?.frameKind, "document-map");
assert.equal(webValues["elements.button.save"]?.type, "json");
assert.equal(webValues["elements.button.save"]?.value?.selector, "button.save");
assert.equal(webValues["elements.button.save"]?.value?.isVisibleOnViewport, true);
assert.equal(webValues["elements.button.save"]?.presentation?.anchor?.type, "bounds");
assert.equal(webValues["elements.button.save"]?.presentation?.metadata?.boundsKind, "document");
var saveScreenLayer = snapshotState.presentation?.visualFrames?.[0]?.layers.find((layer) => layer.id.includes("button.save"));
assert.equal(saveScreenLayer !== void 0 && "statePath" in saveScreenLayer ? saveScreenLayer.statePath : void 0, "web.elements.button.save");
assert.equal(saveScreenLayer?.metadata?.boundsKind, "screenshot");
assert.equal(validateStateSnapshot(snapshotState).ok, true);
var scaledScreenshotState = createWebAutomationStateFromSnapshot({
  url: "https://example.test/scaled",
  title: "Scaled",
  viewport: { width: 800, height: 600, scrollX: 0, scrollY: 0, documentWidth: 800, documentHeight: 900 },
  interactiveElements: [
    { tagName: "a", selector: "a.statement", text: "Statement", bounds: { x: 100, y: 50, width: 80, height: 20 }, documentBounds: { x: 100, y: 50, width: 80, height: 20 } }
  ]
}, {
  timestamp: 25,
  screenContentRef: "automation-object://project/project.test/2222222222222222222222222222222222222222222222222222222222222222",
  screenImageSize: { width: 1600, height: 1200 }
});
var scaledScreenFrame = scaledScreenshotState.presentation?.visualFrames?.find((frame) => frame.id === "screen");
var scaledDocumentFrame = scaledScreenshotState.presentation?.visualFrames?.find((frame) => frame.id === "document");
assert.equal(scaledScreenFrame?.coordinateSpace.width, 1600);
assert.equal(scaledScreenFrame?.coordinateSpace.height, 1200);
assert.equal(scaledScreenFrame?.layers.find((layer) => layer.id === "screenshot")?.bounds?.width, 1600);
assert.equal(scaledScreenFrame?.layers.find((layer) => layer.id.includes("a.statement"))?.bounds?.x, 200);
assert.equal(scaledScreenFrame?.layers.find((layer) => layer.id.includes("a.statement"))?.bounds?.width, 160);
assert.equal(scaledDocumentFrame?.coordinateSpace.width, 800);
assert.equal(scaledDocumentFrame?.layers.find((layer) => layer.id.includes("a.statement"))?.bounds?.x, 100);
assert.equal(validateStateSnapshot(scaledScreenshotState).ok, true);
var iframeScreenshotState = createWebAutomationStateFromSnapshot({
  url: "https://widget.example.test",
  title: "Widget",
  viewport: { width: 400, height: 300, scrollX: 0, scrollY: 0, documentWidth: 400, documentHeight: 300 },
  frame: {
    isTop: false,
    viewportOffset: { x: 900, y: 120, width: 400, height: 300 }
  },
  interactiveElements: [
    { tagName: "button", selector: "button.pay", text: "Pay", bounds: { x: 20, y: 30, width: 100, height: 40 }, documentBounds: { x: 20, y: 30, width: 100, height: 40 } }
  ]
}, {
  timestamp: 26,
  screenContentRef: "automation-object://project/project.test/3333333333333333333333333333333333333333333333333333333333333333",
  screenImageSize: { width: 1534, height: 945 }
});
var iframeScreenFrame = iframeScreenshotState.presentation?.visualFrames?.find((frame) => frame.id === "screen");
var iframeDocumentFrame = iframeScreenshotState.presentation?.visualFrames?.find((frame) => frame.id === "document");
assert.equal(iframeScreenFrame?.layers.find((layer) => layer.id.includes("button.pay"))?.bounds?.x, 3528.2);
assert.equal(iframeScreenFrame?.layers.find((layer) => layer.id.includes("button.pay"))?.bounds?.y, 472.5);
assert.equal(iframeDocumentFrame?.layers.find((layer) => layer.id.includes("button.pay"))?.bounds?.x, 20);
assert.equal(iframeScreenFrame?.metadata?.frameViewportOffset?.x, 900);
assert.equal(validateStateSnapshot(iframeScreenshotState).ok, true);
var fullPageState = createWebAutomationStateFromSnapshot({
  url: "https://example.test/long",
  title: "Long page",
  viewport: { width: 800, height: 600, scrollX: 0, scrollY: 0, documentWidth: 800, documentHeight: 1400 },
  interactiveElements: [
    { tagName: "p", selector: "p.disclaimer", text: "Disclosures below the fold", documentBounds: { x: 20, y: 1200, width: 260, height: 24 }, isVisibleOnViewport: false }
  ]
}, {
  timestamp: 30,
  screenContentRef: "automation-object://project/project.test/1111111111111111111111111111111111111111111111111111111111111111"
});
assert.equal(fullPageState.presentation?.visualFrames?.[0]?.coordinateSpace.height, 600);
assert.equal(fullPageState.presentation?.visualFrames?.[0]?.layers.some((layer) => layer.id.includes("p.disclaimer")), false);
assert.equal(fullPageState.presentation?.visualFrames?.[1]?.coordinateSpace.width, 800);
assert.equal(fullPageState.presentation?.visualFrames?.[1]?.coordinateSpace.height, 1400);
assert.equal(fullPageState.presentation?.visualFrames?.[1]?.metadata?.screenCoordinateSpace, "document-map");
assert.equal(fullPageState.presentation?.visualFrames?.[1]?.metadata?.documentMapWidth, 800);
assert.equal(fullPageState.presentation?.visualFrames?.[1]?.layers.find((layer) => layer.id.includes("p.disclaimer"))?.bounds?.y, 1200);
assert.equal(fullPageState.presentation?.visualFrames?.[1]?.layers.find((layer) => layer.id.includes("p.disclaimer"))?.metadata?.renderKind, "direct-rendered");
assert.equal(validateStateSnapshot(fullPageState).ok, true);
console.log("Web automation recording state tests passed.");
