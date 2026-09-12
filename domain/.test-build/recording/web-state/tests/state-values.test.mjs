// src/recording/web-state/tests/state-values.test.ts
import assert from "node:assert/strict";
import test from "node:test";

// src/constants.ts
var WEB_AUTOMATION_DOMAIN_ID = "web-automation";
var WEB_AUTOMATION_SCHEMA_VERSION = "0.1";

// src/recording/state.ts
var WEB_AUTOMATION_STATE_NAMESPACE = "web";

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

// src/recording/web-state/compact-json-object.ts
function compactJsonObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== void 0));
}

// src/recording/web-state/element/identity.ts
function meaningfulText(value) {
  return typeof value === "string" && value.trim().length >= 2;
}
function stableAttribute(element2, name) {
  const value = element2.attributes?.[name];
  return meaningfulText(value) ? value : void 0;
}
function stableElementId(element2) {
  return stableAttribute(element2, "data-testid") ?? stableAttribute(element2, "data-test") ?? stableAttribute(element2, "data-cy") ?? stableAttribute(element2, "id") ?? stableAttribute(element2, "name");
}

// src/recording/web-state/element/kind.ts
function isEnabled(element2) {
  return element2.attributes?.disabled === void 0 && element2.attributes?.["aria-disabled"] !== "true";
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
function positiveFinite(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : void 0;
}
function finite(value) {
  return Number.isFinite(value) ? value : void 0;
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
function addElementStateValues(state, { element: element2, stateId }, timestamp, sourceId) {
  const basePath = `elements.${stateId}`;
  const anchor = boundsAnchor(element2.documentBounds ?? element2.bounds);
  const secret = isSensitiveElementDescriptor(element2);
  const elementLabel = element2.name ?? element2.visibleText ?? element2.text ?? (secret ? void 0 : element2.value) ?? element2.href ?? element2.selector;
  const elementPresentation = anchor ? { group: "Elements", anchor, visualKind: "bounds" } : { group: "Elements" };
  return putStateValue(state, basePath, "json", elementStatePayload(element2), timestamp, sourceId, {
    elementKind: "element",
    stableAcrossSessions: Boolean(stableElementId(element2)),
    comparable: false,
    sensitive: element2.value !== void 0 || secret,
    presentation: {
      ...elementPresentation,
      label: elementLabel,
      visualKind: anchor ? "bounds" : "text",
      metadata: compactJsonObject({
        boundsKind: "document",
        renderKind: "direct-rendered",
        isVisibleOnViewport: element2.isVisibleOnViewport ?? Boolean(stateBounds(element2.bounds))
      })
    }
  });
}
function elementStatePayload(element2) {
  return compactJsonObject({
    selector: element2.selector,
    tagName: element2.tagName,
    xpath: element2.xpath,
    id: element2.id,
    classNames: element2.classNames,
    visibleText: element2.visibleText,
    text: element2.text,
    value: isSensitiveElementDescriptor(element2) ? void 0 : element2.value,
    role: element2.role,
    name: element2.name,
    href: element2.href,
    inputType: element2.inputType,
    bounds: stateBounds(element2.bounds),
    documentBounds: stateBounds(element2.documentBounds),
    isVisibleOnViewport: element2.isVisibleOnViewport ?? Boolean(stateBounds(element2.bounds)),
    enabled: isEnabled(element2),
    stableId: stableElementId(element2),
    hasClickHandler: element2.hasClickHandler,
    attributes: element2.attributes
  });
}

// src/recording/web-state/tests/state-values.test.ts
var EMPTY = { schemaId: "test", schemaVersion: 1, timestamp: 0, namespaces: {} };
var LEAKED = "synthetic-value-the-producer-should-have-withheld";
function element(overrides) {
  return { tagName: "input", selector: "#field", ...overrides };
}
function storedValue(input) {
  const state = addElementStateValues(EMPTY, { element: input, stateId: "field" }, 1e3, "source.1");
  const value = state.namespaces.web?.values["elements.field"];
  assert.ok(value, "the element was not written into the web namespace");
  return {
    payload: value.value,
    sensitive: value.sensitive,
    label: value.presentation?.label
  };
}
test("a secret-bearing control's value is not stored, however it is marked", () => {
  for (const input of [
    element({ inputType: "password", value: LEAKED }),
    element({ attributes: { type: "password" }, value: LEAKED }),
    element({ attributes: { autocomplete: "billing cc-number" }, value: LEAKED }),
    element({ attributes: { autocomplete: "one-time-code" }, value: LEAKED }),
    element({ tagName: "select", attributes: { "data-sensitive": "true" }, value: LEAKED })
  ]) {
    const stored = storedValue(input);
    assert.equal(stored.payload.value, void 0, JSON.stringify(input.attributes ?? input.inputType));
    assert.doesNotMatch(JSON.stringify(stored), new RegExp(LEAKED, "u"));
  }
});
test("presence and identity still land for a secret-bearing control", () => {
  const stored = storedValue(element({ inputType: "password", name: "Password", value: LEAKED }));
  assert.equal(stored.payload.tagName, "input");
  assert.equal(stored.payload.selector, "#field");
  assert.equal(stored.payload.name, "Password");
  assert.equal(stored.payload.inputType, "password");
});
test("a secret-bearing control with no other identity does not fall back to its value as a label", () => {
  const stored = storedValue(element({ inputType: "password", value: LEAKED }));
  assert.equal(stored.label, "#field");
});
test("an ordinary control keeps its value and its value as a label", () => {
  const stored = storedValue(element({ inputType: "email", value: "synthetic-user@example.test" }));
  assert.equal(stored.payload.value, "synthetic-user@example.test");
  assert.equal(stored.label, "synthetic-user@example.test");
  assert.equal(stored.sensitive, true);
});
test("the sensitive marking is a superset of the rule, never narrower", () => {
  assert.equal(storedValue(element({ inputType: "text", value: "synthetic-text" })).sensitive, true);
  assert.equal(storedValue(element({ inputType: "password" })).sensitive, true);
  assert.equal(storedValue(element({ attributes: { autocomplete: "billing cc-number" } })).sensitive, true);
  assert.equal(storedValue(element({ tagName: "button", selector: "#go", name: "Go" })).sensitive, false);
});
test("the payload builder drops the value on its own, without the writer above it", () => {
  assert.equal(elementStatePayload(element({ inputType: "password", value: LEAKED })).value, void 0);
  assert.equal(elementStatePayload(element({ inputType: "text", value: "synthetic-text" })).value, "synthetic-text");
});
