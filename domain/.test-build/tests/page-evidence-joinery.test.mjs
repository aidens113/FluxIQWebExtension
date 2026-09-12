// src/tests/page-evidence-joinery.test.ts
import assert from "node:assert/strict";
import test from "node:test";

// src/page-evidence/capture.ts
var WEB_AUTOMATION_PAGE_EVIDENCE_CAPTURES = {
  "modal-flows": {
    "elements": {
      "scanned": 49,
      "candidates": 46,
      "matched": 36,
      "returned": 36,
      "truncated": false,
      "changed": 14,
      "recentlyInteracted": 2
    },
    "loading": {
      "documentState": "complete",
      "busy": false,
      "busyRegions": [],
      "indicators": [],
      "pendingNavigation": false
    },
    "navigation": {
      "url": "http://127.0.0.1:4173/scenarios/modal-flows/",
      "origin": "http://127.0.0.1:4173",
      "path": "/scenarios/modal-flows/",
      "type": "navigate",
      "historyLength": 2,
      "visibility": "visible"
    },
    "dialogs": {
      "open": [
        {
          "selector": "#invite-dialog",
          "role": "dialog",
          "modal": true,
          "native": false,
          "label": "Invite a collaborator",
          "bounds": { "x": 392, "y": 233.55, "width": 496, "height": 252.91 }
        }
      ],
      "modal": true,
      "lastNative": {
        "kind": "confirm",
        "message": "Delete this draft? This cannot be undone.",
        "response": "accept",
        "at": 1789244311829
      }
    },
    "overlays": {
      "tested": 12,
      "blockedCount": 6,
      "blockers": [
        {
          "selector": '[data-testid="invite-backdrop"]',
          "bounds": { "x": 0, "y": 0, "width": 1280, "height": 720 },
          "blocks": 6,
          "blocked": [
            '[data-testid="open-invite"]',
            '[data-testid="consent-accept"]',
            '[data-testid="consent-reject"]',
            '[data-testid="publish-draft"]',
            '[data-testid="add-section"]'
          ]
        }
      ]
    },
    "regions": [
      {
        "role": "banner",
        "selector": "body > div:nth-of-type(1) > header",
        "bounds": { "x": 256, "y": 32, "width": 768, "height": 219.44 }
      },
      {
        "role": "main",
        "selector": "body > div:nth-of-type(1) > main",
        "bounds": { "x": 256, "y": 271.34, "width": 768, "height": 333.91 }
      },
      {
        "role": "region",
        "selector": "body > div:nth-of-type(1) > main > section",
        "label": "Sections",
        "bounds": { "x": 256, "y": 271.34, "width": 768, "height": 125.91 }
      },
      {
        "role": "contentinfo",
        "selector": "body > div:nth-of-type(1) > footer",
        "label": "Draft actions",
        "bounds": { "x": 0, "y": 665, "width": 1280, "height": 55 }
      },
      {
        "role": "region",
        "selector": '[data-testid="consent-banner"]',
        "label": "We use cookies",
        "bounds": { "x": 0, "y": 575.61, "width": 1280, "height": 144.39 }
      }
    ],
    "forms": [
      {
        "selector": '[data-testid="invite-form"]',
        "controlCount": 4,
        "controls": [
          {
            "selector": '[data-testid="invite-email"]',
            "controlType": "email",
            "name": "email",
            "label": "Email address",
            "required": true,
            "hasValue": false,
            "autocomplete": "off"
          },
          {
            "selector": '[data-testid="invite-role"]',
            "controlType": "select",
            "name": "role",
            "label": "Role",
            "hasValue": true
          },
          { "selector": '[data-testid="invite-cancel"]', "controlType": "button", "label": "Cancel" },
          { "selector": '[data-testid="invite-confirm"]', "controlType": "submit", "label": "Confirm" }
        ],
        "submit": '[data-testid="invite-confirm"]'
      }
    ]
  },
  "infinite-feed": {
    "elements": {
      "scanned": 78,
      "candidates": 75,
      "matched": 67,
      "returned": 67,
      "truncated": false,
      "changed": 0,
      "recentlyInteracted": 0
    },
    "loading": {
      "documentState": "complete",
      "busy": true,
      "busyRegions": ['[data-testid="feed"]'],
      "indicators": [{ "selector": '[data-testid="feed-loading"]', "kind": "status", "label": "Loading more posts..." }],
      "pendingNavigation": false
    },
    "navigation": {
      "url": "http://127.0.0.1:4173/scenarios/infinite-feed/",
      "origin": "http://127.0.0.1:4173",
      "path": "/scenarios/infinite-feed/",
      "type": "navigate",
      "historyLength": 2,
      "visibility": "visible"
    },
    "regions": [
      {
        "role": "main",
        "selector": "body > main",
        "bounds": { "x": 256, "y": 32, "width": 768, "height": 1790.44 }
      }
    ],
    "repeating": [
      {
        "containerSelector": '[data-testid="feed-page-1"]',
        "signature": "article||feed-item|feed-item",
        "itemCount": 10,
        "representative": {
          "selector": '[data-testid="feed-item"]',
          "testId": "feed-item",
          "text": "Night market #1 Aiko Tanaka - 2026-03-01 09:00 UTC Notes from Saturday's repair cafe."
        },
        "fields": ["feed-item-title", "feed-item-author", "feed-item-time", "feed-item-summary"]
      }
    ]
  },
  "sensitive-input": {
    "elements": {
      "scanned": 21,
      "candidates": 19,
      "matched": 13,
      "returned": 13,
      "truncated": false,
      "changed": 0,
      "recentlyInteracted": 0
    },
    "loading": {
      "documentState": "complete",
      "busy": false,
      "busyRegions": [],
      "indicators": [],
      "pendingNavigation": false
    },
    "navigation": {
      "url": "http://127.0.0.1:4173/scenarios/sensitive-input/",
      "origin": "http://127.0.0.1:4173",
      "path": "/scenarios/sensitive-input/",
      "type": "navigate",
      "historyLength": 2,
      "visibility": "visible"
    },
    "regions": [
      {
        "role": "main",
        "selector": "body > main",
        "bounds": { "x": 256, "y": 32, "width": 768, "height": 307.44 }
      }
    ],
    "forms": [
      {
        "selector": '[data-testid="sensitive-form"]',
        "controlCount": 5,
        "controls": [
          {
            "selector": 'input[name="username"]',
            "controlType": "text",
            "name": "username",
            "label": "Email",
            "hasValue": true,
            "autocomplete": "off"
          },
          {
            "selector": '[data-testid="password"]',
            "controlType": "password",
            "name": "password",
            "label": "Password",
            "hasValue": true,
            "sensitive": true
          },
          {
            "selector": '[data-testid="payment"]',
            "controlType": "text",
            "name": "payment",
            "label": "Test card",
            "hasValue": true,
            "autocomplete": "cc-number",
            "sensitive": true
          },
          {
            "selector": '[data-testid="billing"]',
            "controlType": "text",
            "name": "billing",
            "label": "Billing card",
            "hasValue": true,
            "autocomplete": "billing cc-number",
            "sensitive": true
          },
          {
            "selector": "body > main > form > button",
            "controlType": "submit",
            "label": "Submit synthetic values"
          }
        ],
        "submit": "body > main > form > button"
      }
    ]
  }
};

// src/page-evidence/wire.ts
function pageEvidenceWire(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
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
function withScreenVisualFrame(state, snapshot2, elements, input = {}) {
  const rendered = elements.slice(0, MAX_VISUAL_FRAME_ELEMENTS);
  return {
    ...state,
    id: state.id ?? `web.snapshot.${state.timestamp}`,
    presentation: {
      ...state.presentation ?? {},
      defaultFrameId: WEB_AUTOMATION_SCREEN_FRAME_ID,
      visualFrames: [screenVisualFrame(snapshot2, rendered, input), documentVisualFrame(snapshot2, rendered)]
    }
  };
}
function safeLayerId(value, fallbackIndex) {
  return value.replace(/[^a-z0-9.]+/gi, ".").replace(/^\.+|\.+$/g, "").slice(0, 80) || String(fallbackIndex);
}
function screenVisualFrame(snapshot2, elements, input) {
  const width = positiveFinite(snapshot2.viewport.width) ?? 1;
  const height = positiveFinite(snapshot2.viewport.height) ?? 1;
  const screenWidth = positiveFinite(input.screenImageSize?.width) ?? width;
  const screenHeight = positiveFinite(input.screenImageSize?.height) ?? height;
  const screenScaleX = screenWidth / width;
  const screenScaleY = screenHeight / height;
  const frameViewportOffset = stateBounds(snapshot2.frame?.viewportOffset);
  const layers = [];
  if (input.screenContentRef) {
    layers.push({
      id: "screenshot",
      kind: "image",
      contentRef: input.screenContentRef,
      bounds: { x: 0, y: 0, width: screenWidth, height: screenHeight },
      metadata: compactJsonObject({
        projectId: input.projectId,
        url: snapshot2.url,
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
    presentation: { label: snapshot2.title || "Browser viewport", visualKind: "bounds", icon: "globe" },
    metadata: compactJsonObject({
      url: snapshot2.url,
      title: snapshot2.title,
      scrollX: snapshot2.viewport.scrollX,
      scrollY: snapshot2.viewport.scrollY,
      devicePixelRatio: snapshot2.viewport.devicePixelRatio,
      frameKind: "viewport-screenshot",
      screenCoordinateSpace: "viewport",
      documentWidth: snapshot2.viewport.documentWidth,
      documentHeight: snapshot2.viewport.documentHeight,
      viewportWidth: width,
      viewportHeight: height,
      imageWidth: screenWidth,
      imageHeight: screenHeight,
      imageScaleX: screenScaleX,
      imageScaleY: screenScaleY,
      frameViewportOffset,
      isTopFrame: snapshot2.frame?.isTop
    })
  };
}
function documentVisualFrame(snapshot2, elements) {
  const width = positiveFinite(snapshot2.viewport.width) ?? 1;
  const height = positiveFinite(snapshot2.viewport.height) ?? 1;
  const rawDocumentWidth = positiveFinite(snapshot2.viewport.documentWidth) ?? width;
  const documentMapWidth = width;
  const documentHeight = positiveFinite(snapshot2.viewport.documentHeight) ?? height;
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
        bounds: { x: snapshot2.viewport.scrollX, y: snapshot2.viewport.scrollY, width, height },
        metadata: compactJsonObject({
          boundsKind: "document",
          renderKind: "viewport-marker"
        })
      },
      ...elements.flatMap(({ element, stateId }, index) => {
        const bounds = stateBounds(element.documentBounds ?? element.bounds);
        if (!bounds) return [];
        const projectedViewportBounds = element.bounds ? stateBounds({
          x: bounds.x - snapshot2.viewport.scrollX,
          y: bounds.y - snapshot2.viewport.scrollY,
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
      url: snapshot2.url,
      title: snapshot2.title,
      scrollX: snapshot2.viewport.scrollX,
      scrollY: snapshot2.viewport.scrollY,
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
function pageEvidenceOfSnapshot(snapshot2) {
  return pageEvidenceWire(pageEvidenceWire(snapshot2)?.evidence);
}
function pageEvidenceTruncatedElements(evidence) {
  return pageEvidenceWire(evidence?.elements)?.truncated === true;
}

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

// src/recording/web-state/state-values.ts
function putStateValue(snapshot2, path, type, value, observedAt, sourceId, input = {}) {
  const namespace = snapshot2.namespaces[WEB_AUTOMATION_STATE_NAMESPACE] ?? {
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
    ...snapshot2,
    timestamp: observedAt,
    namespaces: {
      ...snapshot2.namespaces,
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
function putCollection(put, path, items2, cap, describe, input) {
  if (!items2.length) return;
  put(path, "json", {
    count: items2.length,
    truncated: items2.length > cap,
    items: items2.slice(0, cap).map(describe)
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
function createWebAutomationStateFromSnapshot(snapshot2, input = {}) {
  const timestamp = input.timestamp ?? Date.now();
  let state = createWebAutomationInitialState(timestamp);
  state = putStateValue(state, "page.url", "string", snapshot2.url, timestamp, input.sourceId, { elementKind: "url" });
  state = putStateValue(state, "page.title", "string", snapshot2.title, timestamp, input.sourceId, { elementKind: "text" });
  state = putStateValue(state, "viewport.bounds", "rectangle", { x: 0, y: 0, width: snapshot2.viewport.width, height: snapshot2.viewport.height }, timestamp, input.sourceId, { elementKind: "bounds", volatility: "normal" });
  state = putStateValue(state, "scroll.position", "point", { x: snapshot2.viewport.scrollX, y: snapshot2.viewport.scrollY }, timestamp, input.sourceId, { elementKind: "position", volatility: "rapid" });
  if (snapshot2.selectedText) state = putStateValue(state, "page.selectedText", "string", snapshot2.selectedText, timestamp, input.sourceId, { elementKind: "text" });
  if (snapshot2.focusedElement) {
    const target = webAutomationActionTargetFromElement(snapshot2.focusedElement);
    state = putStateValue(state, "focus.target", "json", target, timestamp, input.sourceId, { elementKind: "json", volatility: "rapid" });
  }
  const evidence = pageEvidenceOfSnapshot(snapshot2);
  if (evidence) state = addPageEvidenceStateValues(state, evidence, timestamp, input.sourceId);
  const selection = filterStateElements(snapshot2.interactiveElements);
  state = putStateValue(state, "elements.count", "integer", selection.total, timestamp, input.sourceId, { elementKind: "count" });
  state = putStateValue(state, "elements.captured", "integer", selection.captured, timestamp, input.sourceId, { elementKind: "count" });
  const captureTruncated = pageEvidenceTruncatedElements(evidence);
  state = putStateValue(state, "elements.captureTruncated", "boolean", captureTruncated, timestamp, input.sourceId, { elementKind: "status" });
  state = putStateValue(state, "elements.stateTruncated", "boolean", selection.truncated, timestamp, input.sourceId, { elementKind: "status" });
  state = putStateValue(state, "elements.truncated", "boolean", selection.truncated || captureTruncated, timestamp, input.sourceId, { elementKind: "status" });
  for (const entry of selection.elements) state = addElementStateValues(state, entry, timestamp, input.sourceId);
  return withScreenVisualFrame(state, snapshot2, selection.elements, input);
}

// src/runtime/llm-evidence/limits.ts
import { AUTOMATION_STUDIO_LLM_MAX_FAILURE_EVIDENCE_BYTES } from "fluxiq/automation-studio";
var WEB_LLM_EVIDENCE_BYTE_BUDGETS = Object.freeze({
  ceiling: 12e3,
  exploration: 6e3,
  failure: AUTOMATION_STUDIO_LLM_MAX_FAILURE_EVIDENCE_BYTES
});
var WEB_LLM_EVIDENCE_BOUNDS = Object.freeze({
  elements: 40,
  url: 2e3,
  text: 300,
  selector: 500,
  tag: 40,
  role: 80,
  attribute: 200,
  options: 20,
  placement: 80,
  dialogs: 3
});
function serializedBytes(input) {
  return new TextEncoder().encode(JSON.stringify(input)).byteLength;
}
function evidenceByteLimit(input, fallback, ceiling = WEB_LLM_EVIDENCE_BYTE_BUDGETS.ceiling) {
  const cap = Math.min(ceiling, WEB_LLM_EVIDENCE_BYTE_BUDGETS.ceiling);
  if (input === void 0) return Math.min(fallback, cap);
  if (!Number.isSafeInteger(input) || Number(input) < 1 || Number(input) > 1e5) throw new Error("maxEvidenceBytes must be a positive bounded integer");
  return Math.min(Number(input), cap);
}

// src/runtime/llm-evidence/location.ts
function safeEvidenceUrl(input) {
  if (typeof input !== "string" || !input || input.length > WEB_LLM_EVIDENCE_BOUNDS.url) throw new Error("web evidence URL must be bounded");
  const url = new URL(input);
  if (url.protocol !== "http:" && url.protocol !== "https:" || url.username || url.password) throw new Error("web evidence URL must be an HTTP(S) URL without credentials");
  return url;
}
function evidenceLocation(url) {
  return `${url.origin}${url.pathname}`;
}
function sameOriginHref(input, base) {
  if (typeof input !== "string" || !input || input.length > WEB_LLM_EVIDENCE_BOUNDS.url) return void 0;
  try {
    const url = new URL(input, base);
    return url.origin === base.origin && (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password ? evidenceLocation(url) : void 0;
  } catch {
    return void 0;
  }
}

// src/runtime/llm-evidence/untrusted-json.ts
function isJsonRecord(input) {
  return Boolean(input) && typeof input === "object" && !Array.isArray(input);
}
function jsonRecord(input, name) {
  if (!isJsonRecord(input)) throw new Error(`${name} must be an object`);
  return input;
}
function boundedText(input, maximum) {
  if (typeof input !== "string") return void 0;
  const value = input.replace(/\s+/gu, " ").trim();
  return value ? value.slice(0, maximum) : void 0;
}
function trueFlag(input) {
  return input === true ? true : void 0;
}
function boundedCount(input, maximum) {
  if (typeof input !== "number" || !Number.isSafeInteger(input) || input < 0 || input > maximum) return void 0;
  return input;
}

// src/runtime/llm-evidence/elements.ts
var FRAME_SELECTOR_PATTERN = /^frame\[(\d{1,6})\]\s*>>\s*(.+)$/u;
var FRAME_ID_ATTRIBUTE = "data-fluxiq-frame-id";
function sanitizedEvidenceElement(raw, context) {
  if (!isJsonRecord(raw)) return void 0;
  const tag = boundedText(raw.tagName, WEB_LLM_EVIDENCE_BOUNDS.tag)?.toLowerCase();
  const addressed = frameAddressedSelector(raw);
  if (!tag || !addressed || isSensitiveElementDescriptor(raw)) return void 0;
  const attributes = isJsonRecord(raw.attributes) ? raw.attributes : {};
  const role = boundedText(raw.role, WEB_LLM_EVIDENCE_BOUNDS.role);
  const name = boundedText(raw.name, WEB_LLM_EVIDENCE_BOUNDS.text);
  const rawText = boundedText(raw.visibleText ?? raw.text, WEB_LLM_EVIDENCE_BOUNDS.text);
  const text2 = rawText === name ? void 0 : rawText;
  const rawInputType = boundedText(raw.inputType, WEB_LLM_EVIDENCE_BOUNDS.tag)?.toLowerCase();
  const inputType = rawInputType === "text" ? void 0 : rawInputType;
  const rawControlType = boundedText(attributes.type, WEB_LLM_EVIDENCE_BOUNDS.tag)?.toLowerCase();
  const controlType = rawControlType === rawInputType || rawControlType === "text" ? void 0 : rawControlType;
  const href = sameOriginHref(raw.href, context.url);
  const options = tag === "select" ? sanitizedOptions(raw.options) : void 0;
  const hasValue = safeFillTag(tag, inputType) && typeof raw.hasValue === "boolean" ? raw.hasValue : void 0;
  const selectedValue = options ? sanitizedSelectedValue(raw.selectedValue, options) : void 0;
  const revealKind = semanticRevealKind(tag, role, attributes);
  const expanded = revealKind === "disclosure" ? semanticExpandedState(attributes) : void 0;
  const placement = elementPlacement(raw.context, { name, text: text2 });
  const focused = context.focusedSelector !== void 0 && context.focusedSelector === addressed.selector ? true : void 0;
  return {
    target: context.target,
    tag,
    selector: addressed.selector,
    ...addressed.frameId === void 0 ? {} : { frameId: addressed.frameId },
    ...role ? { role } : {},
    ...name ? { name } : {},
    ...text2 ? { text: text2 } : {},
    ...inputType ? { inputType } : {},
    ...controlType ? { controlType } : {},
    ...hasValue === void 0 ? {} : { hasValue },
    ...selectedValue ? { selectedValue } : {},
    ...href ? { href } : {},
    ...options?.length ? { options } : {},
    ...revealKind ? { revealKind } : {},
    ...expanded === void 0 ? {} : { expanded },
    ...focused ? { focused } : {},
    ...trueFlag(raw.recentlyInteracted) ? { recent: true } : {},
    ...trueFlag(raw.changed) ? { changed: true } : {},
    ...placement
  };
}
function safeFillTag(tag, inputType) {
  return tag === "textarea" || tag === "input" && (!inputType || ["text", "search", "email", "tel", "url", "number"].includes(inputType));
}
function semanticRevealKind(tag, role, attributes) {
  if (role === "tab" || role === "menuitem" || role === "treeitem") return "view";
  if (tag === "summary") return "disclosure";
  const expanded = boundedText(attributes["aria-expanded"], 10)?.toLowerCase();
  const controls = boundedText(attributes["aria-controls"], WEB_LLM_EVIDENCE_BOUNDS.text);
  return expanded === "true" || expanded === "false" || controls ? "disclosure" : void 0;
}
function semanticExpandedState(attributes) {
  const expanded = boundedText(attributes["aria-expanded"], 10)?.toLowerCase();
  return expanded === "true" ? true : expanded === "false" ? false : void 0;
}
function frameAddressedSelector(raw) {
  const rawSelector = boundedText(raw.selector, WEB_LLM_EVIDENCE_BOUNDS.selector);
  if (!rawSelector) return void 0;
  const match = FRAME_SELECTOR_PATTERN.exec(rawSelector);
  const selector = match ? boundedText(match[2], WEB_LLM_EVIDENCE_BOUNDS.selector) : rawSelector;
  if (!selector) return void 0;
  const frameId = stampedFrameId(raw) ?? (match ? boundedCount(Number(match[1]), 999999) : void 0);
  return frameId ? { selector, frameId } : { selector };
}
function stampedFrameId(raw) {
  const attributes = isJsonRecord(raw.attributes) ? raw.attributes : {};
  const stamped = boundedText(attributes[FRAME_ID_ATTRIBUTE], 20);
  return stamped === void 0 ? void 0 : boundedCount(Number(stamped), 999999);
}
function elementPlacement(input, named) {
  if (!isJsonRecord(input)) return {};
  const form = boundedText(input.formId ?? input.formName, WEB_LLM_EVIDENCE_BOUNDS.placement);
  const landmark = boundedText(input.landmark, WEB_LLM_EVIDENCE_BOUNDS.tag);
  const rawHeading = boundedText(input.heading, WEB_LLM_EVIDENCE_BOUNDS.placement);
  const heading = rawHeading === named.name || rawHeading === named.text ? void 0 : rawHeading;
  return {
    ...form ? { form } : {},
    ...landmark ? { landmark } : {},
    ...heading ? { heading } : {},
    ...listPlacement(input.listPosition),
    ...tablePlacement(input.tablePosition)
  };
}
function listPlacement(input) {
  if (!isJsonRecord(input)) return {};
  const index = boundedCount(input.index, 1e5);
  const total = boundedCount(input.total, 1e5);
  return index === void 0 || total === void 0 ? {} : { item: { index, total } };
}
function tablePlacement(input) {
  if (!isJsonRecord(input)) return {};
  const row = boundedCount(input.row, 1e5);
  const column = boundedCount(input.column, 1e5);
  if (row === void 0 || column === void 0) return {};
  const header = boundedText(input.columnHeader, WEB_LLM_EVIDENCE_BOUNDS.placement);
  return { cell: { row, column, ...header ? { header } : {} } };
}
function sanitizedOptions(input) {
  if (!Array.isArray(input)) return void 0;
  const result = [];
  for (const raw of input.slice(0, WEB_LLM_EVIDENCE_BOUNDS.options)) {
    if (!isJsonRecord(raw)) continue;
    const value = boundedText(raw.value, WEB_LLM_EVIDENCE_BOUNDS.attribute);
    const label = boundedText(raw.label, WEB_LLM_EVIDENCE_BOUNDS.attribute);
    if (value && label) result.push({ value, label });
  }
  return result.length ? result : void 0;
}
function sanitizedSelectedValue(input, options) {
  const value = boundedText(input, WEB_LLM_EVIDENCE_BOUNDS.attribute);
  return value && options.some((option) => option.value === value) ? value : void 0;
}

// src/runtime/llm-evidence/page-evidence.ts
var READY_STATES = ["loading", "interactive", "complete"];
var ORDINARY_NAVIGATION_TYPE = "navigate";
var MAX_REDIRECTS = 100;
var MAX_BLOCKED_CONTROLS = 1e4;
function webLlmPageContext(snapshot2, childFrameIds) {
  const evidence = pageEvidence(snapshot2);
  const frame = evidenceFrame(snapshot2.frame, childFrameIds);
  const loading = evidenceLoading(pageEvidenceWire(evidence?.loading));
  const navigation = evidenceNavigation(pageEvidenceWire(evidence?.navigation));
  const dialogs = evidenceDialogs(pageEvidenceWire(evidence?.dialogs));
  const blockedBy = evidenceBlocker(pageEvidenceWire(evidence?.overlays));
  const selectedText = boundedText(snapshot2.selectedText, WEB_LLM_EVIDENCE_BOUNDS.text);
  return {
    ...frame ? { frame } : {},
    ...loading ? { loading } : {},
    ...navigation ? { navigation } : {},
    ...dialogs ? { dialogs } : {},
    ...blockedBy ? { blockedBy } : {},
    ...selectedText ? { selectedText } : {}
  };
}
function evidenceElementTotal(snapshot2, carried) {
  const declared = boundedCount(snapshot2.elementTotal, 1e7) ?? boundedCount(captureElementTotals(snapshot2)?.matched, 1e7);
  const received = Array.isArray(snapshot2.interactiveElements) ? snapshot2.interactiveElements.length : 0;
  const total = Math.max(declared ?? 0, received);
  return total > carried ? total : void 0;
}
function capturedTruncated(snapshot2) {
  if (trueFlag(snapshot2.truncated) === true) return true;
  return trueFlag(captureElementTotals(snapshot2)?.truncated) === true;
}
function pageEvidence(snapshot2) {
  return pageEvidenceWire(snapshot2.evidence);
}
function captureElementTotals(snapshot2) {
  return pageEvidenceWire(pageEvidence(snapshot2)?.elements);
}
function items(input) {
  return Array.isArray(input) ? input : [];
}
function evidenceFrame(input, childFrameIds) {
  const declared = isJsonRecord(input) ? input : void 0;
  const isTop = typeof declared?.isTop === "boolean" ? declared.isTop : void 0;
  if (isTop === void 0 && !childFrameIds.length) return void 0;
  return {
    isTop: isTop ?? true,
    ...childFrameIds.length ? { childFrameIds } : {}
  };
}
function evidenceLoading(input) {
  if (!input) return void 0;
  const documentState = boundedText(input.documentState, WEB_LLM_EVIDENCE_BOUNDS.tag)?.toLowerCase();
  const readyState = documentState && READY_STATES.includes(documentState) ? documentState : void 0;
  const spinner = items(input.indicators).map((indicator) => pageEvidenceWire(indicator)).some((indicator) => indicator?.kind === "spinner");
  const loading = {
    ...readyState && readyState !== "complete" ? { readyState } : {},
    ...trueFlag(input.busy) ? { busy: true } : {},
    ...spinner ? { spinner: true } : {},
    ...trueFlag(input.pendingNavigation) ? { pendingNavigation: true } : {}
  };
  return Object.keys(loading).length ? loading : void 0;
}
function evidenceNavigation(input) {
  if (!input) return void 0;
  const type = boundedText(input.type, WEB_LLM_EVIDENCE_BOUNDS.tag)?.toLowerCase();
  const redirects = boundedCount(input.redirects, MAX_REDIRECTS);
  const navigation = {
    ...type && type !== ORDINARY_NAVIGATION_TYPE ? { type } : {},
    ...redirects ? { redirects } : {},
    ...safeLocationField("referrer", input.referrer)
  };
  return Object.keys(navigation).length ? navigation : void 0;
}
function safeLocationField(key, input) {
  try {
    return { [key]: evidenceLocation(safeEvidenceUrl(input)) };
  } catch {
    return {};
  }
}
function evidenceDialogs(input) {
  if (!input) return void 0;
  const dialogs = [];
  for (const item of items(input.open).slice(0, WEB_LLM_EVIDENCE_BOUNDS.dialogs)) {
    const raw = pageEvidenceWire(item);
    if (!raw) continue;
    const role = boundedText(raw.role, WEB_LLM_EVIDENCE_BOUNDS.role);
    const name = boundedText(raw.label, WEB_LLM_EVIDENCE_BOUNDS.text);
    const selector = boundedText(raw.selector, WEB_LLM_EVIDENCE_BOUNDS.selector);
    const modal = trueFlag(raw.modal);
    if (!role && !name && !selector && !modal) continue;
    dialogs.push({
      ...role ? { role } : {},
      ...name ? { name } : {},
      ...modal ? { modal } : {},
      ...selector ? { selector } : {}
    });
  }
  return dialogs.length ? dialogs : void 0;
}
function evidenceBlocker(input) {
  const blocker = items(input?.blockers).map((item) => pageEvidenceWire(item)).find((item) => item !== void 0);
  if (!blocker) return void 0;
  const selector = boundedText(blocker.selector, WEB_LLM_EVIDENCE_BOUNDS.selector);
  if (!selector) return void 0;
  const role = boundedText(blocker.role, WEB_LLM_EVIDENCE_BOUNDS.role);
  const name = boundedText(blocker.label, WEB_LLM_EVIDENCE_BOUNDS.text);
  const blocks = boundedCount(blocker.blocks, MAX_BLOCKED_CONTROLS);
  return {
    selector,
    ...role ? { role } : {},
    ...name ? { name } : {},
    ...blocks ? { blocks } : {}
  };
}

// src/runtime/llm-evidence/sanitize.ts
var WEB_LLM_EVIDENCE_SCHEMA_VERSION = "web-llm-evidence.v1";
function sanitizeWebLlmSnapshot(input, options = {}) {
  return sanitizeWebLlmSnapshotWithBindings(input, options).evidence;
}
function sanitizeWebLlmSnapshotWithBindings(input, options = {}) {
  const snapshot2 = jsonRecord(input, "web DOM snapshot");
  const url = safeEvidenceUrl(snapshot2.url);
  if (options.expectedOrigin !== void 0 && url.origin !== options.expectedOrigin) throw new Error("web DOM snapshot escaped the expected origin");
  const maxEvidenceBytes = budgetFor(options);
  if (!Array.isArray(snapshot2.interactiveElements)) throw new Error("web DOM snapshot elements are malformed");
  const focusedSelector = sanitizedEvidenceElement(snapshot2.focusedElement, { target: "target.focus", url })?.selector;
  const elements = [];
  const selectors = /* @__PURE__ */ new Map();
  for (const raw of snapshot2.interactiveElements) {
    if (elements.length >= WEB_LLM_EVIDENCE_BOUNDS.elements) break;
    const element = sanitizedEvidenceElement(raw, { target: `target.${elements.length + 1}`, url, focusedSelector });
    if (!element) continue;
    elements.push(element);
    selectors.set(element.target, element.selector);
  }
  const childFrameIds = [...new Set(elements.map((element) => element.frameId).filter((id) => id !== void 0))].sort((left, right) => left - right);
  const elementTotal = evidenceElementTotal(snapshot2, elements.length);
  const title = boundedText(snapshot2.title, WEB_LLM_EVIDENCE_BOUNDS.text);
  const captureTruncated = capturedTruncated(snapshot2);
  const elementsTruncated = snapshot2.interactiveElements.length > WEB_LLM_EVIDENCE_BOUNDS.elements;
  const evidence = {
    schemaVersion: WEB_LLM_EVIDENCE_SCHEMA_VERSION,
    trust: "untrusted-page-evidence",
    location: evidenceLocation(url),
    ...title ? { title } : {},
    ...webLlmPageContext(snapshot2, childFrameIds),
    ...elementTotal === void 0 ? {} : { elementTotal },
    elements,
    truncated: captureTruncated || elementsTruncated,
    ...captureTruncated ? { captureTruncated: true } : {},
    ...elementsTruncated ? { elementsTruncated: true } : {}
  };
  trimToBudget(evidence, selectors, maxEvidenceBytes);
  return { evidence, selectors };
}
function budgetFor(options) {
  return options.budget === "failure" ? evidenceByteLimit(options.maxEvidenceBytes, WEB_LLM_EVIDENCE_BYTE_BUDGETS.failure, WEB_LLM_EVIDENCE_BYTE_BUDGETS.failure) : evidenceByteLimit(options.maxEvidenceBytes, WEB_LLM_EVIDENCE_BYTE_BUDGETS.exploration);
}
function trimToBudget(evidence, selectors, maxEvidenceBytes) {
  const markBudgetTruncated = () => {
    evidence.truncated = true;
    evidence.budgetTruncated = true;
  };
  const popElement = () => {
    const removed = evidence.elements.pop();
    if (removed) selectors.delete(removed.target);
    markBudgetTruncated();
  };
  const droppable = ["selectedText", "title", "navigation", "loading", "elementTotal", "dialogs", "blockedBy", "frame"];
  while (serializedBytes(evidence) > maxEvidenceBytes) {
    if (evidence.elements.length > 1) {
      popElement();
      continue;
    }
    const field = droppable.shift();
    if (field !== void 0) {
      if (evidence[field] !== void 0) {
        delete evidence[field];
        markBudgetTruncated();
      }
      continue;
    }
    if (evidence.elements.length) {
      popElement();
      continue;
    }
    throw new Error("web DOM snapshot exceeds the evidence byte limit");
  }
}

// src/runtime/llm-evidence/tool-rejection.ts
var WEB_LLM_TOOL_REJECTION_CODES = [
  "invalid_input",
  "cross_origin",
  "no_progress",
  "target_unobserved",
  "target_unsafe",
  "sensitive_value"
];

// src/runtime/llm-evidence/vocabulary.ts
var WEB_LLM_EVIDENCE_TOOL_IDS = ["web.inspect_current_page", "web.navigate_same_origin", "web.reveal_safe"];
var WEB_LLM_INSPECT_TOOL_ID = WEB_LLM_EVIDENCE_TOOL_IDS[0];
var WEB_LLM_NAVIGATE_TOOL_ID = WEB_LLM_EVIDENCE_TOOL_IDS[1];
var WEB_LLM_REVEAL_TOOL_ID = WEB_LLM_EVIDENCE_TOOL_IDS[2];
var WEB_LLM_INSPECT_RESULT_CODE = "web.inspect.succeeded";
var WEB_LLM_ACTION_RESULT_CODE = "web.action.succeeded";
var REJECTION_RESULT_CODE_PREFIX = "web.action.rejected.";
function webLlmToolRejectionResultCode(code) {
  return `${REJECTION_RESULT_CODE_PREFIX}${code}`;
}
var WEB_LLM_EVIDENCE_RESULT_CODES = Object.freeze([
  WEB_LLM_INSPECT_RESULT_CODE,
  WEB_LLM_ACTION_RESULT_CODE,
  ...WEB_LLM_TOOL_REJECTION_CODES.map(webLlmToolRejectionResultCode)
]);

// src/tests/page-evidence-joinery.test.ts
var pageEvidence2 = {
  elements: { scanned: 4200, candidates: 900, matched: 812, returned: 2, truncated: true, changed: 1, recentlyInteracted: 1 },
  loading: {
    documentState: "interactive",
    busy: true,
    busyRegions: ["#basket"],
    indicators: [{ selector: "#spinner", kind: "spinner", label: "Updating total" }],
    pendingNavigation: true
  },
  navigation: {
    url: "https://example.test/checkout",
    origin: "https://example.test",
    path: "/checkout",
    referrer: "https://example.test/cart?session=private",
    type: "back_forward",
    redirects: 2,
    historyLength: 4,
    visibility: "visible"
  },
  dialogs: {
    open: [{ selector: "#terms", role: "dialog", modal: true, native: false, label: "Terms of sale" }],
    modal: true
  },
  overlays: {
    tested: 12,
    blockedCount: 2,
    blockers: [{ selector: "#consent", role: "region", label: "We use cookies", blocks: 2, blocked: ["button.pay", "a.help"] }]
  }
};
var snapshot = {
  url: "https://example.test/checkout",
  title: "Checkout",
  viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 0 },
  selectedText: "Total due",
  interactiveElements: [
    { tagName: "button", selector: "button.pay", visibleText: "Pay", bounds: { x: 20, y: 400, width: 120, height: 40 } },
    { tagName: "input", selector: "input#coupon", name: "Coupon", bounds: { x: 20, y: 300, width: 200, height: 32 } }
  ],
  evidence: pageEvidence2
};
function captureWithout(...omitted) {
  const evidence = Object.fromEntries(Object.entries(pageEvidence2).filter(([key]) => !omitted.includes(key)));
  return { ...snapshot, evidence };
}
function projected(capture) {
  const state = createWebAutomationStateFromSnapshot(capture, { timestamp: 40, sourceId: "tab:9" });
  return state.namespaces.web?.values ?? {};
}
function packet(capture) {
  return sanitizeWebLlmSnapshot(capture);
}
function collection(values, path) {
  return values[path]?.value;
}
test("both readers see the same dialog, under the producer's own field names", () => {
  const values = projected(snapshot);
  const evidence = packet(snapshot);
  const open = collection(values, "evidence.dialogs.open").items[0];
  const carried = evidence.dialogs?.[0];
  assert.ok(carried, "the packet reported no dialog at all: it is reading a path the producer does not write");
  assert.equal(values["evidence.dialogs.openCount"]?.value, 1);
  assert.equal(carried.selector, open?.selector);
  assert.equal(carried.role, open?.role);
  assert.equal(carried.name, open?.label);
  assert.equal(carried.modal, true);
  assert.equal(values["evidence.dialogs.modal"]?.value, true);
});
test("both readers see the same blocking overlay, and the packet takes the one the producer ranked first", () => {
  const values = projected(snapshot);
  const evidence = packet(snapshot);
  const blocker = collection(values, "evidence.overlays.blockers").items[0];
  assert.ok(evidence.blockedBy, "the packet reported nothing covering the page");
  assert.equal(evidence.blockedBy.selector, blocker?.selector);
  assert.equal(evidence.blockedBy.role, blocker?.role);
  assert.equal(evidence.blockedBy.name, blocker?.label);
  assert.equal(evidence.blockedBy.blocks, blocker?.blocks);
  assert.equal(values["evidence.overlays.blockedCount"]?.value, 2);
});
test("both readers see the same loading state, including which kind of indicator is on screen", () => {
  const values = projected(snapshot);
  const evidence = packet(snapshot);
  assert.ok(evidence.loading, "the packet reported nothing about a page still settling");
  assert.equal(evidence.loading.readyState, values["evidence.loading.documentState"]?.value);
  assert.equal(evidence.loading.busy, values["evidence.loading.busy"]?.value);
  assert.equal(evidence.loading.pendingNavigation, values["evidence.loading.pendingNavigation"]?.value);
  const kinds = collection(values, "evidence.loading.indicators").items.map((item) => item.kind);
  assert.equal(evidence.loading.spinner, kinds.includes("spinner") ? true : void 0);
});
test("both readers see the same navigation facts, and the packet strips the query the state keeps", () => {
  const values = projected(snapshot);
  const evidence = packet(snapshot);
  assert.ok(evidence.navigation, "the packet reported nothing about how the page was reached");
  assert.equal(evidence.navigation.type, values["evidence.navigation.type"]?.value);
  assert.equal(evidence.navigation.redirects, values["evidence.navigation.redirects"]?.value);
  const referrer = new URL(String(values["evidence.navigation.referrer"]?.value));
  assert.equal(evidence.navigation.referrer, `${referrer.origin}${referrer.pathname}`);
  assert.doesNotMatch(JSON.stringify(evidence), /session=private/u, "the packet must not carry a query string");
});
test("both readers see the same element funnel, so the model is told what the browser already cut", () => {
  const values = projected(snapshot);
  const evidence = packet(snapshot);
  assert.equal(evidence.elementTotal, values["evidence.elements.matched"]?.value);
  assert.equal(evidence.captureTruncated, values["evidence.elements.truncated"]?.value);
  assert.equal(evidence.truncated, true);
  assert.equal(values["elements.captureTruncated"]?.value, true);
});
test("dropping one producer field silences both readers together", () => {
  const rows = [
    { key: "loading", statePrefix: "evidence.loading.", carried: (evidence) => evidence.loading },
    { key: "navigation", statePrefix: "evidence.navigation.", carried: (evidence) => evidence.navigation },
    { key: "dialogs", statePrefix: "evidence.dialogs.", carried: (evidence) => evidence.dialogs },
    { key: "overlays", statePrefix: "evidence.overlays.", carried: (evidence) => evidence.blockedBy }
  ];
  for (const row of rows) {
    const capture = captureWithout(row.key);
    const paths = Object.keys(projected(capture)).filter((path) => path.startsWith(row.statePrefix));
    assert.deepEqual(paths, [], `the projection still wrote ${row.statePrefix}* without ${row.key}`);
    assert.equal(row.carried(packet(capture)), void 0, `the packet still reported ${row.key} the producer did not send`);
    assert.notEqual(row.carried(packet(snapshot)), void 0, `the packet never reports ${row.key}`);
  }
});
test("a capture with no page evidence at all costs nothing on either side", () => {
  const bare = { ...snapshot, evidence: void 0 };
  const paths = Object.keys(projected(bare)).filter((path) => path.startsWith("evidence."));
  assert.deepEqual(paths, []);
  const evidence = packet(bare);
  assert.deepEqual(
    { loading: evidence.loading, navigation: evidence.navigation, dialogs: evidence.dialogs, blockedBy: evidence.blockedBy, elementTotal: evidence.elementTotal },
    { loading: void 0, navigation: void 0, dialogs: void 0, blockedBy: void 0, elementTotal: void 0 }
  );
  assert.equal(evidence.truncated, false);
  assert.equal(evidence.elements.length, 2);
  assert.equal(evidence.selectedText, "Total due");
});
function realSnapshot(name) {
  const evidence = WEB_AUTOMATION_PAGE_EVIDENCE_CAPTURES[name];
  return {
    url: evidence.navigation.url,
    title: name,
    viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 0 },
    interactiveElements: [{ tagName: "button", selector: "button.only", visibleText: "Only element" }],
    evidence
  };
}
test("real capture: the modal a page was actually showing reaches both readers", () => {
  const capture = realSnapshot("modal-flows");
  const evidence = WEB_AUTOMATION_PAGE_EVIDENCE_CAPTURES["modal-flows"];
  const values = projected(capture);
  const packeted = packet(capture);
  const open = collection(values, "evidence.dialogs.open").items[0];
  const carried = packeted.dialogs?.[0];
  assert.ok(carried, "the packet reported no dialog, and a real browser sent one");
  assert.equal(values["evidence.dialogs.openCount"]?.value, evidence.dialogs?.open.length);
  assert.equal(carried.selector, open?.selector);
  assert.equal(carried.role, open?.role);
  assert.equal(carried.name, open?.label);
  assert.equal(carried.name, evidence.dialogs?.open[0]?.label);
  assert.equal(carried.modal, true);
  assert.equal(values["evidence.dialogs.modal"]?.value, true);
  const lastNative = values["evidence.dialogs.lastNative"]?.value;
  assert.equal(lastNative?.kind, evidence.dialogs?.lastNative?.kind);
  assert.equal(lastNative?.response, evidence.dialogs?.lastNative?.response);
});
test("real capture: what the page painted over its controls reaches both readers", () => {
  const capture = realSnapshot("modal-flows");
  const evidence = WEB_AUTOMATION_PAGE_EVIDENCE_CAPTURES["modal-flows"];
  const values = projected(capture);
  const blockedBy = packet(capture).blockedBy;
  const blocker = collection(values, "evidence.overlays.blockers").items[0];
  assert.ok(blockedBy, "the packet reported nothing covering a page whose every control was behind a backdrop");
  assert.equal(blockedBy.selector, blocker?.selector);
  assert.equal(blockedBy.selector, evidence.overlays?.blockers[0]?.selector);
  assert.equal(blockedBy.blocks, blocker?.blocks);
  assert.equal(values["evidence.overlays.blockedCount"]?.value, evidence.overlays?.blockedCount);
  assert.equal(values["evidence.overlays.tested"]?.value, evidence.overlays?.tested);
  assert.equal(blockedBy.role, void 0);
  assert.equal(blockedBy.name, void 0);
});
test("real capture: a page caught mid-fetch is reported busy by both readers, with the kind of indicator it really had", () => {
  const capture = realSnapshot("infinite-feed");
  const evidence = WEB_AUTOMATION_PAGE_EVIDENCE_CAPTURES["infinite-feed"];
  const values = projected(capture);
  const loading = packet(capture).loading;
  assert.ok(loading, "the packet said nothing about a page that was still fetching");
  assert.equal(loading.busy, values["evidence.loading.busy"]?.value);
  assert.equal(loading.busy, true);
  assert.equal(values["evidence.loading.documentState"]?.value, "complete");
  assert.equal(loading.readyState, void 0);
  assert.deepEqual(
    collection(values, "evidence.loading.indicators").items.map((item) => item.kind),
    evidence.loading.indicators.map((indicator) => indicator.kind)
  );
  assert.equal(loading.spinner, void 0);
  assert.deepEqual(
    collection(values, "evidence.loading.busyRegions").items,
    evidence.loading.busyRegions.map((selector) => ({ selector }))
  );
});
test("real capture: the sensitive controls a real form carried are named to both readers and their contents reach neither", () => {
  const capture = realSnapshot("sensitive-input");
  const evidence = WEB_AUTOMATION_PAGE_EVIDENCE_CAPTURES["sensitive-input"];
  const values = projected(capture);
  const form = collection(values, "evidence.forms").items[0];
  const controls = form?.controls;
  assert.equal(controls.length, evidence.forms?.[0]?.controls.length);
  const card = controls.find((control) => control.selector === '[data-testid="billing"]');
  assert.ok(card, "the billing card field is missing from the projection, so a reader cannot know it is there");
  assert.equal(card.sensitive, true);
  assert.equal(card.hasValue, void 0, "nothing derived from what was typed into a card field travels");
  assert.doesNotMatch(JSON.stringify(packet(capture)), /billing|cc-number/u);
});
test("real captures: every item the browser sent is projected, and nothing else is", () => {
  for (const name of Object.keys(WEB_AUTOMATION_PAGE_EVIDENCE_CAPTURES)) {
    const evidence = WEB_AUTOMATION_PAGE_EVIDENCE_CAPTURES[name];
    const sent = Object.keys(evidence).sort();
    const projectedItems = [...new Set(
      Object.keys(projected(realSnapshot(name))).filter((path) => path.startsWith("evidence.")).map((path) => path.slice("evidence.".length).split(".")[0] ?? "")
    )].sort();
    assert.deepEqual(projectedItems, sent, `${name}: the items the browser sent and the items the projection wrote are not the same set`);
  }
});
