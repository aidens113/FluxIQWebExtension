// src/recording/tests/reducers.test.ts
import assert from "node:assert/strict";
import test from "node:test";

// src/sensitivity/signature.ts
var SENSITIVE_CONTROL_TYPES = /* @__PURE__ */ new Set(["password", "one-time-code", "credit-card"]);
var SENSITIVE_AUTOCOMPLETE_TOKENS = /* @__PURE__ */ new Set(["current-password", "new-password", "one-time-code"]);
var SENSITIVE_AUTOCOMPLETE_PREFIX = "cc-";
function isSensitiveFieldSignature(signature) {
  if (isSensitiveControlType(signature.inputType) || isSensitiveControlType(signature.controlType)) return true;
  if (signature.dataSensitive?.trim().toLowerCase() === "true") return true;
  return (signature.autocomplete ?? "").toLowerCase().split(/\s+/u).some((token) => Boolean(token) && (SENSITIVE_AUTOCOMPLETE_TOKENS.has(token) || token.startsWith(SENSITIVE_AUTOCOMPLETE_PREFIX)));
}
function isSensitiveControlType(type) {
  return type !== void 0 && SENSITIVE_CONTROL_TYPES.has(type.trim().toLowerCase());
}

// src/sensitivity/descriptor.ts
function sensitiveFieldSignatureOfDescriptor(descriptor) {
  if (!descriptor || typeof descriptor !== "object" || Array.isArray(descriptor)) return {};
  const record = descriptor;
  const attributes = record.attributes && typeof record.attributes === "object" && !Array.isArray(record.attributes) ? record.attributes : {};
  return {
    inputType: stringField(record.inputType),
    controlType: stringField(attributes.type),
    autocomplete: stringField(attributes.autocomplete),
    dataSensitive: stringField(attributes["data-sensitive"])
  };
}
function isSensitiveElementDescriptor(descriptor) {
  return isSensitiveFieldSignature(sensitiveFieldSignatureOfDescriptor(descriptor));
}
function stringField(value) {
  return typeof value === "string" ? value : void 0;
}

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
function withWebStateValue(snapshot, path, value, input = {}) {
  const namespace = snapshot.namespaces[WEB_AUTOMATION_STATE_NAMESPACE] ?? {
    schemaId: WEB_AUTOMATION_DOMAIN_ID,
    schemaVersion: WEB_AUTOMATION_SCHEMA_VERSION,
    values: {}
  };
  const observedAt = input.observedAt ?? Date.now();
  const nextValue = {
    type: inferStateType(value),
    value,
    observedAt,
    ...input.sourceId !== void 0 ? { sourceId: input.sourceId } : {},
    volatility: "normal",
    comparable: true,
    ...input.metadata !== void 0 ? { metadata: input.metadata } : {}
  };
  return {
    ...snapshot,
    timestamp: observedAt,
    namespaces: {
      ...snapshot.namespaces,
      [WEB_AUTOMATION_STATE_NAMESPACE]: {
        ...namespace,
        values: {
          ...namespace.values,
          [path]: nextValue
        }
      }
    }
  };
}
function inferStateType(value) {
  if (typeof value === "string") return "string";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
  if (typeof value === "boolean") return "boolean";
  return "json";
}

// src/recording/web-state/compact-json-object.ts
function compactJsonObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== void 0));
}

// src/recording/web-state/element/identity.ts
var MAX_STATE_ID_LENGTH = 120;
function meaningfulText(value) {
  return typeof value === "string" && value.trim().length >= 2;
}
function stableAttribute(element, name) {
  const value = element.attributes?.[name];
  return meaningfulText(value) ? value : void 0;
}
function stableElementId(element) {
  return stableAttribute(element, "data-testid") ?? stableAttribute(element, "data-test") ?? stableAttribute(element, "data-cy") ?? stableAttribute(element, "id") ?? stableAttribute(element, "name");
}
function elementStateId(element) {
  const stable = stableElementPathId(element);
  if (stable) return sanitizeStateId(stable);
  const name = stableAttribute(element, "name");
  if (name) return sanitizeStateId(`${name}.${element.selector}`);
  return sanitizeStateId(element.selector);
}
function elementStateIdAssigner(reservedIds = []) {
  const taken = new Set(reservedIds);
  const occurrences = /* @__PURE__ */ new Map();
  return (element) => {
    const base = elementStateId(element);
    let occurrence = (occurrences.get(base) ?? 0) + 1;
    let candidate = occurrence === 1 ? base : `${base}.${occurrence}`;
    while (taken.has(candidate)) {
      occurrence += 1;
      candidate = `${base}.${occurrence}`;
    }
    occurrences.set(base, occurrence);
    taken.add(candidate);
    return candidate;
  };
}
function stableElementPathId(element) {
  return stableAttribute(element, "data-testid") ?? stableAttribute(element, "data-test") ?? stableAttribute(element, "data-cy") ?? stableAttribute(element, "id");
}
function sanitizeStateId(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "").slice(0, MAX_STATE_ID_LENGTH) || "element";
}

// src/recording/web-state/element/kind.ts
function isLikelyActionableElement(element) {
  const tagName = element.tagName.toLowerCase();
  const role = element.role?.toLowerCase();
  const inputType = element.inputType?.toLowerCase();
  return tagName === "button" || tagName === "a" || tagName === "select" || tagName === "textarea" || tagName === "summary" || tagName === "label" || tagName === "input" && inputType !== "hidden" || role === "button" || role === "link" || role === "menuitem" || role === "checkbox" || role === "radio" || role === "tab" || role === "switch" || element.hasClickHandler === true || element.attributes?.onclick !== void 0;
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
function isEnabled(element) {
  return element.attributes?.disabled === void 0 && element.attributes?.["aria-disabled"] !== "true";
}

// src/recording/web-state/geometry.ts
function stateBounds(bounds) {
  if (!bounds) return void 0;
  const x = finite(bounds.x);
  const y = finite(bounds.y);
  const width = positiveFinite(bounds.width);
  const height = positiveFinite(bounds.height);
  return x !== void 0 && y !== void 0 && width !== void 0 && height !== void 0 ? { x, y, width, height } : void 0;
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
function positiveFinite(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : void 0;
}
function finite(value) {
  return Number.isFinite(value) ? value : void 0;
}

// src/recording/web-state/element/selection.ts
var MAX_STATE_ELEMENTS = 1500;
var WEB_AUTOMATION_ELEMENT_SUMMARY_STATE_IDS = ["count", "captured", "truncated", "captureTruncated", "stateTruncated"];
function shouldCaptureElementState(element) {
  if (!hasElementBounds(element)) return false;
  return Boolean(
    isLikelyInteractableElement(element) && hasMeaningfulElementIdentity(element) || meaningfulText(element.text) || meaningfulText(element.visibleText) || meaningfulText(element.name) || meaningfulText(element.value) || meaningfulText(element.href)
  );
}
function filterStateElements(elements, limit = MAX_STATE_ELEMENTS) {
  const eligible = elements.map((element, documentIndex) => ({ element, documentIndex })).filter((entry) => shouldCaptureElementState(entry.element));
  const ranked = [...eligible].sort(
    (left, right) => stateElementBucket(left.element) - stateElementBucket(right.element) || stateElementScore(right.element) - stateElementScore(left.element)
  );
  const kept = ranked.slice(0, Math.max(0, limit)).map((entry, rank) => ({ ...entry, rank }));
  kept.sort((left, right) => left.documentIndex - right.documentIndex);
  const assignStateId = elementStateIdAssigner(WEB_AUTOMATION_ELEMENT_SUMMARY_STATE_IDS);
  const named = kept.map((entry) => ({ element: entry.element, stateId: assignStateId(entry.element), rank: entry.rank }));
  named.sort((left, right) => left.rank - right.rank);
  return {
    elements: named.map(({ element, stateId }) => ({ element, stateId })),
    total: elements.length,
    eligible: eligible.length,
    captured: named.length,
    truncated: eligible.length > named.length
  };
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
function hasElementBounds(element) {
  return stateBounds(element.documentBounds ?? element.bounds) !== void 0;
}

// src/recording/web-state/visual-frame.ts
var MAX_VISUAL_FRAME_ELEMENTS = 1e3;
var WEB_AUTOMATION_VIEWPORT_VISUALIZER_ID = "web-automation.viewport";
var WEB_AUTOMATION_SCREEN_FRAME_ID = "screen";
var WEB_AUTOMATION_DOCUMENT_FRAME_ID = "document";
function withScreenVisualFrame(state, snapshot, elements, input = {}) {
  const rendered = elements.slice(0, MAX_VISUAL_FRAME_ELEMENTS);
  return {
    ...state,
    id: state.id ?? `web.snapshot.${state.timestamp}`,
    presentation: {
      ...state.presentation ?? {},
      defaultFrameId: WEB_AUTOMATION_SCREEN_FRAME_ID,
      visualFrames: [screenVisualFrame(snapshot, rendered, input), documentVisualFrame(snapshot, rendered)]
    }
  };
}
function safeLayerId(value, fallbackIndex) {
  return value.replace(/[^a-z0-9.]+/gi, ".").replace(/^\.+|\.+$/g, "").slice(0, 80) || String(fallbackIndex);
}
function screenVisualFrame(snapshot, elements, input) {
  const width = positiveFinite(snapshot.viewport.width) ?? 1;
  const height = positiveFinite(snapshot.viewport.height) ?? 1;
  const screenWidth = positiveFinite(input.screenImageSize?.width) ?? width;
  const screenHeight = positiveFinite(input.screenImageSize?.height) ?? height;
  const screenScaleX = screenWidth / width;
  const screenScaleY = screenHeight / height;
  const frameViewportOffset = stateBounds(snapshot.frame?.viewportOffset);
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
  for (const [index, { element, stateId }] of elements.entries()) {
    const bounds = scaledScreenBounds(screenFrameBounds(element.bounds, frameViewportOffset), screenScaleX, screenScaleY);
    if (!bounds) continue;
    layers.push({
      id: `element.${safeLayerId(stateId, index + 1)}`,
      kind: "region",
      label: elementLayerLabel(element),
      bounds,
      statePath: `${WEB_AUTOMATION_STATE_NAMESPACE}.elements.${stateId}`,
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
  return {
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
}
function documentVisualFrame(snapshot, elements) {
  const width = positiveFinite(snapshot.viewport.width) ?? 1;
  const height = positiveFinite(snapshot.viewport.height) ?? 1;
  const rawDocumentWidth = positiveFinite(snapshot.viewport.documentWidth) ?? width;
  const documentMapWidth = width;
  const documentHeight = positiveFinite(snapshot.viewport.documentHeight) ?? height;
  return {
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
      ...elements.flatMap(({ element, stateId }, index) => {
        const bounds = stateBounds(element.documentBounds ?? element.bounds);
        if (!bounds) return [];
        const projectedViewportBounds = element.bounds ? stateBounds({
          x: bounds.x - snapshot.viewport.scrollX,
          y: bounds.y - snapshot.viewport.scrollY,
          width: bounds.width,
          height: bounds.height
        }) : void 0;
        return [{
          id: `document.element.${safeLayerId(stateId, index + 1)}`,
          kind: "region",
          label: elementLayerLabel(element),
          bounds,
          statePath: `${WEB_AUTOMATION_STATE_NAMESPACE}.elements.${stateId}`,
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
}
function elementLayerLabel(element) {
  return element.name ?? element.visibleText ?? element.text ?? element.value ?? element.href ?? element.tagName;
}

// src/recording/web-state/action-target.ts
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

// src/page-evidence/wire.ts
function pageEvidenceWire(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}

// src/recording/web-state/evidence/read.ts
var MAX_TEXT = 200;
function list(value) {
  return Array.isArray(value) ? value : [];
}
function text(value) {
  if (typeof value !== "string") return void 0;
  const collapsed = value.replace(/\s+/gu, " ").trim();
  return collapsed ? collapsed.slice(0, MAX_TEXT) : void 0;
}
function count(value) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : void 0;
}
function flag(value) {
  return typeof value === "boolean" ? value : void 0;
}
function rect(value) {
  const bounds = pageEvidenceWire(value);
  if (!bounds) return void 0;
  const x = finite2(bounds.x);
  const y = finite2(bounds.y);
  const width = finite2(bounds.width);
  const height = finite2(bounds.height);
  return x === void 0 || y === void 0 || width === void 0 || height === void 0 ? void 0 : { x, y, width, height };
}
function isPresent(value) {
  return value !== void 0;
}
function finite2(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : void 0;
}

// src/recording/web-state/evidence/input.ts
function pageEvidenceOfSnapshot(snapshot) {
  return pageEvidenceWire(pageEvidenceWire(snapshot)?.evidence);
}
function pageEvidenceTruncatedElements(evidence) {
  return pageEvidenceWire(evidence?.elements)?.truncated === true;
}

// src/recording/web-state/state-values.ts
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
function addElementStateValues(state, { element, stateId }, timestamp, sourceId) {
  const basePath = `elements.${stateId}`;
  const anchor = boundsAnchor(element.documentBounds ?? element.bounds);
  const secret = isSensitiveElementDescriptor(element);
  const elementLabel = element.name ?? element.visibleText ?? element.text ?? (secret ? void 0 : element.value) ?? element.href ?? element.selector;
  const elementPresentation = anchor ? { group: "Elements", anchor, visualKind: "bounds" } : { group: "Elements" };
  return putStateValue(state, basePath, "json", elementStatePayload(element), timestamp, sourceId, {
    elementKind: "element",
    stableAcrossSessions: Boolean(stableElementId(element)),
    comparable: false,
    sensitive: element.value !== void 0 || secret,
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
function elementStatePayload(element) {
  return compactJsonObject({
    selector: element.selector,
    tagName: element.tagName,
    xpath: element.xpath,
    id: element.id,
    classNames: element.classNames,
    visibleText: element.visibleText,
    text: element.text,
    value: isSensitiveElementDescriptor(element) ? void 0 : element.value,
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

// src/recording/web-state/evidence/project.ts
var EVIDENCE_PATH_PREFIX = "evidence.";
var MAX_DIALOGS = 5;
var MAX_OVERLAY_BLOCKERS = 5;
var MAX_BLOCKED_SELECTORS = 5;
var MAX_LOADING_INDICATORS = 8;
var MAX_BUSY_REGIONS = 8;
var MAX_REGIONS = 20;
var MAX_REPEATING = 8;
var MAX_REPEATING_FIELDS = 8;
var MAX_FORMS = 8;
var MAX_FORM_CONTROLS = 20;
function addPageEvidenceStateValues(state, evidence, timestamp, sourceId) {
  let next = state;
  const put = (path, type, value, input = {}) => {
    next = putStateValue(next, `${EVIDENCE_PATH_PREFIX}${path}`, type, value, timestamp, sourceId, input);
  };
  addElementTotals(put, pageEvidenceWire(evidence.elements));
  addLoading(put, pageEvidenceWire(evidence.loading));
  addNavigation(put, pageEvidenceWire(evidence.navigation));
  addDialogs(put, pageEvidenceWire(evidence.dialogs));
  addOverlays(put, pageEvidenceWire(evidence.overlays));
  addRegions(put, list(evidence.regions));
  addRepeating(put, list(evidence.repeating));
  addForms(put, list(evidence.forms));
  return next;
}
var COUNT = { elementKind: "count" };
var LIVE_COUNT = { elementKind: "count", volatility: "rapid" };
var STATUS = { elementKind: "status" };
var LIVE_STATUS = { elementKind: "status", volatility: "rapid" };
var COLLECTION = { elementKind: "collection", comparable: false };
var LIVE_COLLECTION = { ...COLLECTION, volatility: "rapid" };
var SETTLED_COLLECTION = { ...COLLECTION, volatility: "slow" };
function addElementTotals(put, totals) {
  if (!totals) return;
  putCount(put, "elements.scanned", totals.scanned, COUNT);
  putCount(put, "elements.candidates", totals.candidates, COUNT);
  putCount(put, "elements.matched", totals.matched, COUNT);
  putCount(put, "elements.returned", totals.returned, COUNT);
  putCount(put, "elements.changed", totals.changed, LIVE_COUNT);
  putCount(put, "elements.recentlyInteracted", totals.recentlyInteracted, LIVE_COUNT);
  putFlag(put, "elements.truncated", totals.truncated, STATUS);
}
function addLoading(put, loading) {
  if (!loading) return;
  putText(put, "loading.documentState", loading.documentState, LIVE_STATUS);
  putFlag(put, "loading.busy", loading.busy, LIVE_STATUS);
  putFlag(put, "loading.pendingNavigation", loading.pendingNavigation, LIVE_STATUS);
  putCollection(put, "loading.busyRegions", list(loading.busyRegions), MAX_BUSY_REGIONS, selectorItem, LIVE_COLLECTION);
  putCollection(put, "loading.indicators", list(loading.indicators), MAX_LOADING_INDICATORS, (item) => {
    const indicator = pageEvidenceWire(item);
    return compactJsonObject({
      selector: text(indicator?.selector),
      kind: text(indicator?.kind),
      label: text(indicator?.label)
    });
  }, LIVE_COLLECTION);
}
function addNavigation(put, navigation) {
  if (!navigation) return;
  putText(put, "navigation.origin", navigation.origin, { elementKind: "url", volatility: "slow" });
  putText(put, "navigation.path", navigation.path, { elementKind: "route", volatility: "slow" });
  putText(put, "navigation.referrer", navigation.referrer, { elementKind: "url", volatility: "slow" });
  putText(put, "navigation.type", navigation.type, { elementKind: "status", volatility: "slow" });
  putCount(put, "navigation.redirects", navigation.redirects, COUNT);
  putCount(put, "navigation.historyLength", navigation.historyLength, COUNT);
  putText(put, "navigation.visibility", navigation.visibility, { elementKind: "visibility", volatility: "rapid" });
}
function addDialogs(put, dialogs) {
  if (!dialogs) return;
  const open = list(dialogs.open);
  put("dialogs.openCount", "integer", open.length, LIVE_COUNT);
  putFlag(put, "dialogs.modal", dialogs.modal, LIVE_STATUS);
  putFlag(put, "dialogs.armPending", dialogs.armPending, LIVE_STATUS);
  putCollection(put, "dialogs.open", open, MAX_DIALOGS, (item) => {
    const dialog = pageEvidenceWire(item);
    return compactJsonObject({
      selector: text(dialog?.selector),
      role: text(dialog?.role),
      modal: flag(dialog?.modal),
      native: flag(dialog?.native),
      label: text(dialog?.label),
      bounds: rect(dialog?.bounds)
    });
  }, LIVE_COLLECTION);
  const native = pageEvidenceWire(dialogs.lastNative);
  if (native) {
    put("dialogs.lastNative", "json", compactJsonObject({
      kind: text(native.kind),
      message: text(native.message),
      response: text(native.response),
      at: count(native.at)
    }), { elementKind: "json", comparable: false, volatility: "rapid" });
  }
}
function addOverlays(put, overlays) {
  if (!overlays) return;
  putCount(put, "overlays.tested", overlays.tested, LIVE_COUNT);
  putCount(put, "overlays.blockedCount", overlays.blockedCount, LIVE_COUNT);
  putCollection(put, "overlays.blockers", list(overlays.blockers), MAX_OVERLAY_BLOCKERS, (item) => {
    const blocker = pageEvidenceWire(item);
    const blocked = list(blocker?.blocked);
    return compactJsonObject({
      selector: text(blocker?.selector),
      role: text(blocker?.role),
      label: text(blocker?.label),
      bounds: rect(blocker?.bounds),
      blocks: count(blocker?.blocks),
      blockedCount: blocked.length,
      blocked: blocked.slice(0, MAX_BLOCKED_SELECTORS).map(text).filter(isPresent)
    });
  }, LIVE_COLLECTION);
}
function addRegions(put, regions) {
  putCollection(put, "regions", regions, MAX_REGIONS, (item) => {
    const region = pageEvidenceWire(item);
    return compactJsonObject({
      role: text(region?.role),
      label: text(region?.label),
      selector: text(region?.selector),
      bounds: rect(region?.bounds)
    });
  }, SETTLED_COLLECTION);
}
function addRepeating(put, repeating) {
  putCollection(put, "repeating", repeating, MAX_REPEATING, (item) => {
    const structure = pageEvidenceWire(item);
    const representative = pageEvidenceWire(structure?.representative);
    return compactJsonObject({
      containerSelector: text(structure?.containerSelector),
      signature: text(structure?.signature),
      itemCount: count(structure?.itemCount),
      representative: representative ? compactJsonObject({
        selector: text(representative.selector),
        testId: text(representative.testId),
        text: text(representative.text)
      }) : void 0,
      fields: list(structure?.fields).slice(0, MAX_REPEATING_FIELDS).map(text).filter(isPresent)
    });
  }, COLLECTION);
}
function addForms(put, forms) {
  putCollection(put, "forms", forms, MAX_FORMS, (item) => {
    const form = pageEvidenceWire(item);
    const controls = list(form?.controls);
    return compactJsonObject({
      selector: text(form?.selector),
      name: text(form?.name),
      label: text(form?.label),
      action: text(form?.action),
      method: text(form?.method),
      // The producer's own pre-cap total, kept beside the controls that
      // survived: the same count-plus-kept-list convention as everywhere else.
      controlCount: count(form?.controlCount) ?? controls.length,
      controls: controls.slice(0, MAX_FORM_CONTROLS).map(formControl),
      submit: text(form?.submit)
    });
  }, SETTLED_COLLECTION);
}
function formControl(item) {
  const control = pageEvidenceWire(item);
  const controlType = text(control?.controlType);
  const autocomplete = typeof control?.autocomplete === "string" ? control.autocomplete : void 0;
  const sensitive = control?.sensitive === true || isSensitiveFieldSignature({ inputType: controlType, controlType, autocomplete });
  return compactJsonObject({
    selector: text(control?.selector),
    controlType,
    name: text(control?.name),
    label: text(control?.label),
    required: flag(control?.required),
    disabled: flag(control?.disabled),
    hasValue: sensitive ? void 0 : flag(control?.hasValue),
    sensitive: sensitive ? true : void 0
  });
}
function selectorItem(item) {
  return compactJsonObject({ selector: text(item) });
}
function putCollection(put, path, items, cap, describe, input) {
  if (!items.length) return;
  put(path, "json", {
    count: items.length,
    truncated: items.length > cap,
    items: items.slice(0, cap).map(describe)
  }, input);
}
function putCount(put, path, value, input) {
  const total = count(value);
  if (total !== void 0) put(path, "integer", total, input);
}
function putFlag(put, path, value, input) {
  const state = flag(value);
  if (state !== void 0) put(path, "boolean", state, input);
}
function putText(put, path, value, input) {
  const bounded = text(value);
  if (bounded !== void 0) put(path, "string", bounded, input);
}

// src/recording/web-state/snapshot.ts
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
  const evidence = pageEvidenceOfSnapshot(snapshot);
  if (evidence) state = addPageEvidenceStateValues(state, evidence, timestamp, input.sourceId);
  const selection = filterStateElements(snapshot.interactiveElements);
  state = putStateValue(state, "elements.count", "integer", selection.total, timestamp, input.sourceId, { elementKind: "count" });
  state = putStateValue(state, "elements.captured", "integer", selection.captured, timestamp, input.sourceId, { elementKind: "count" });
  const captureTruncated = pageEvidenceTruncatedElements(evidence);
  state = putStateValue(state, "elements.captureTruncated", "boolean", captureTruncated, timestamp, input.sourceId, { elementKind: "status" });
  state = putStateValue(state, "elements.stateTruncated", "boolean", selection.truncated, timestamp, input.sourceId, { elementKind: "status" });
  state = putStateValue(state, "elements.truncated", "boolean", selection.truncated || captureTruncated, timestamp, input.sourceId, { elementKind: "status" });
  for (const entry of selection.elements) state = addElementStateValues(state, entry, timestamp, input.sourceId);
  return withScreenVisualFrame(state, snapshot, selection.elements, input);
}

// src/recording/reducers.ts
var webAutomationStateReducer = ({ event, previousState }) => {
  const payload = event.payload ?? {};
  const timestamp = event.timestamp ?? Date.now();
  let next = previousState;
  const source = {
    observedAt: timestamp,
    ...event.sourceId !== void 0 ? { sourceId: event.sourceId } : {},
    metadata: { eventType: event.eventType }
  };
  if (typeof payload.url === "string") next = withWebStateValue(next, "page.url", payload.url, source);
  if (typeof payload.title === "string") next = withWebStateValue(next, "page.title", payload.title, source);
  if (payload.element && typeof payload.element === "object") next = withWebStateValue(next, "focus.target", payload.element, source);
  if (typeof payload.inputValue === "string" && event.target?.selector && !isSensitiveElementDescriptor(payload.element)) {
    next = withWebStateValue(next, `forms.${String(event.target.selector)}`, payload.inputValue, source);
  }
  if (payload.scroll && typeof payload.scroll === "object") next = withWebStateValue(next, "scroll.position", payload.scroll, source);
  if (isSnapshotPayload(payload.snapshot)) {
    const snapshotOptions = { timestamp };
    if (event.sourceId !== void 0) snapshotOptions.sourceId = event.sourceId;
    next = mergeWebState(next, createWebAutomationStateFromSnapshot(payload.snapshot, snapshotOptions));
  }
  if (payload.actionResult && typeof payload.actionResult === "object") next = withWebStateValue(next, "runtime.lastActionResult", payload.actionResult, source);
  if (payload.visualTarget && typeof payload.visualTarget === "object") next = withWebStateValue(next, "runtime.lastActionVisualTarget", payload.visualTarget, source);
  if (event.eventType === "web.client.error") next = withWebStateValue(next, "runtime.lastError", payload, source);
  return next;
};
function isSnapshotPayload(value) {
  if (!value || typeof value !== "object") return false;
  const snapshot = value;
  return typeof snapshot.url === "string" && typeof snapshot.title === "string" && Boolean(snapshot.viewport && typeof snapshot.viewport === "object") && Array.isArray(snapshot.interactiveElements);
}
function mergeWebState(previous, incoming) {
  const previousWeb = previous.namespaces.web;
  const incomingWeb = incoming.namespaces.web;
  if (!incomingWeb) return previous;
  const metadata = incomingWeb.metadata ?? previousWeb?.metadata;
  return {
    ...previous,
    timestamp: incoming.timestamp,
    namespaces: {
      ...previous.namespaces,
      web: {
        schemaId: incomingWeb.schemaId,
        schemaVersion: incomingWeb.schemaVersion,
        ...metadata !== void 0 ? { metadata } : {},
        values: {
          ...previousWeb?.values ?? {},
          ...incomingWeb.values
        }
      }
    }
  };
}

// src/recording/tests/reducers.test.ts
var SELECTOR = "input[name=secret]";
var SENT_VALUE = "a-value-the-producer-should-have-withheld";
function reduce(element) {
  return webAutomationStateReducer({
    event: {
      recordingId: "recording.test",
      domainId: "web-automation",
      eventType: "web.element.input_changed",
      timestamp: 42,
      sourceId: "tab:1",
      target: { selector: SELECTOR },
      payload: {
        url: "https://example.test/checkout",
        title: "Checkout",
        inputValue: SENT_VALUE,
        ...element === void 0 ? {} : { element }
      }
    },
    previousState: createWebAutomationInitialState(42)
  });
}
function formValue(state) {
  return state.namespaces.web?.values[`forms.${SELECTOR}`]?.value;
}
var field = (extra) => ({ tagName: "input", selector: SELECTOR, ...extra });
test("an ordinary field's typed value is still written to form state", () => {
  assert.equal(formValue(reduce(field({ inputType: "text", attributes: { name: "coupon" } }))), SENT_VALUE);
  assert.equal(formValue(reduce(field({ inputType: "email", attributes: { autocomplete: "email" } }))), SENT_VALUE);
  assert.equal(formValue(reduce(field({ attributes: { "data-sensitive": "false" } }))), SENT_VALUE);
});
test("a sensitive field's value is refused however the descriptor says it is sensitive", () => {
  const sensitive = [
    ["type=password", field({ inputType: "password" })],
    ["type=PASSWORD", field({ inputType: "PASSWORD" })],
    ["data-sensitive=true", field({ inputType: "text", attributes: { "data-sensitive": "true" } })],
    ["autocomplete=current-password", field({ attributes: { autocomplete: "current-password" } })],
    ["autocomplete=new-password", field({ attributes: { autocomplete: "new-password" } })],
    ["autocomplete=one-time-code", field({ attributes: { autocomplete: "one-time-code" } })],
    ["autocomplete=cc-number", field({ attributes: { autocomplete: "cc-number" } })],
    ["a token list carrying a card field", field({ attributes: { autocomplete: "billing cc-number" } })],
    ["an uppercase token list", field({ attributes: { autocomplete: "Section-Pay Billing CC-CSC" } })]
  ];
  for (const [label, element] of sensitive) {
    const state = reduce(element);
    assert.equal(formValue(state), void 0, `${label}: the value was written to form state`);
    assert.equal(JSON.stringify(state).includes(SENT_VALUE), false, `${label}: the value survived somewhere in the snapshot`);
  }
});
test("refusing the value does not discard the rest of the event", () => {
  const state = reduce(field({ inputType: "password" }));
  assert.equal(state.namespaces.web?.values["page.url"]?.value, "https://example.test/checkout");
  assert.equal(state.namespaces.web?.values["page.title"]?.value, "Checkout");
  assert.deepEqual(state.namespaces.web?.values["focus.target"]?.value, field({ inputType: "password" }));
});
test("an event with no element descriptor is treated as ordinary, and the reducer says so", () => {
  assert.equal(formValue(reduce(void 0)), SENT_VALUE);
});
test("the shared rule adds two signals the reducer's own copy did not read", () => {
  for (const [label, element] of [
    ["the raw type attribute alone", field({ attributes: { type: "password" } })],
    ["inputType=one-time-code", field({ inputType: "one-time-code" })],
    ["inputType=credit-card", field({ inputType: "credit-card" })]
  ]) {
    assert.equal(formValue(reduce(element)), void 0, `${label}: the value was written to form state`);
  }
});
