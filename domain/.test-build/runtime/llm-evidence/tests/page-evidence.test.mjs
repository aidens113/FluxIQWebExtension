// src/runtime/llm-evidence/tests/page-evidence.test.ts
import assert from "node:assert/strict";
import test from "node:test";

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
  const text = rawText === name ? void 0 : rawText;
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
  const placement = elementPlacement(raw.context, { name, text });
  const focused = context.focusedSelector !== void 0 && context.focusedSelector === addressed.selector ? true : void 0;
  return {
    target: context.target,
    tag,
    selector: addressed.selector,
    ...addressed.frameId === void 0 ? {} : { frameId: addressed.frameId },
    ...role ? { role } : {},
    ...name ? { name } : {},
    ...text ? { text } : {},
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

// src/page-evidence/wire.ts
function pageEvidenceWire(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}

// src/runtime/llm-evidence/page-evidence.ts
var READY_STATES = ["loading", "interactive", "complete"];
var ORDINARY_NAVIGATION_TYPE = "navigate";
var MAX_REDIRECTS = 100;
var MAX_BLOCKED_CONTROLS = 1e4;
function webLlmPageContext(snapshot, childFrameIds) {
  const evidence = pageEvidence(snapshot);
  const frame = evidenceFrame(snapshot.frame, childFrameIds);
  const loading = evidenceLoading(pageEvidenceWire(evidence?.loading));
  const navigation = evidenceNavigation(pageEvidenceWire(evidence?.navigation));
  const dialogs = evidenceDialogs(pageEvidenceWire(evidence?.dialogs));
  const blockedBy = evidenceBlocker(pageEvidenceWire(evidence?.overlays));
  const selectedText = boundedText(snapshot.selectedText, WEB_LLM_EVIDENCE_BOUNDS.text);
  return {
    ...frame ? { frame } : {},
    ...loading ? { loading } : {},
    ...navigation ? { navigation } : {},
    ...dialogs ? { dialogs } : {},
    ...blockedBy ? { blockedBy } : {},
    ...selectedText ? { selectedText } : {}
  };
}
function evidenceElementTotal(snapshot, carried) {
  const declared = boundedCount(snapshot.elementTotal, 1e7) ?? boundedCount(captureElementTotals(snapshot)?.matched, 1e7);
  const received = Array.isArray(snapshot.interactiveElements) ? snapshot.interactiveElements.length : 0;
  const total = Math.max(declared ?? 0, received);
  return total > carried ? total : void 0;
}
function capturedTruncated(snapshot) {
  if (trueFlag(snapshot.truncated) === true) return true;
  return trueFlag(captureElementTotals(snapshot)?.truncated) === true;
}
function pageEvidence(snapshot) {
  return pageEvidenceWire(snapshot.evidence);
}
function captureElementTotals(snapshot) {
  return pageEvidenceWire(pageEvidence(snapshot)?.elements);
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
  const snapshot = jsonRecord(input, "web DOM snapshot");
  const url = safeEvidenceUrl(snapshot.url);
  if (options.expectedOrigin !== void 0 && url.origin !== options.expectedOrigin) throw new Error("web DOM snapshot escaped the expected origin");
  const maxEvidenceBytes = budgetFor(options);
  if (!Array.isArray(snapshot.interactiveElements)) throw new Error("web DOM snapshot elements are malformed");
  const focusedSelector = sanitizedEvidenceElement(snapshot.focusedElement, { target: "target.focus", url })?.selector;
  const elements = [];
  const selectors = /* @__PURE__ */ new Map();
  for (const raw of snapshot.interactiveElements) {
    if (elements.length >= WEB_LLM_EVIDENCE_BOUNDS.elements) break;
    const element = sanitizedEvidenceElement(raw, { target: `target.${elements.length + 1}`, url, focusedSelector });
    if (!element) continue;
    elements.push(element);
    selectors.set(element.target, element.selector);
  }
  const childFrameIds = [...new Set(elements.map((element) => element.frameId).filter((id) => id !== void 0))].sort((left, right) => left - right);
  const elementTotal = evidenceElementTotal(snapshot, elements.length);
  const title = boundedText(snapshot.title, WEB_LLM_EVIDENCE_BOUNDS.text);
  const captureTruncated = capturedTruncated(snapshot);
  const elementsTruncated = snapshot.interactiveElements.length > WEB_LLM_EVIDENCE_BOUNDS.elements;
  const evidence = {
    schemaVersion: WEB_LLM_EVIDENCE_SCHEMA_VERSION,
    trust: "untrusted-page-evidence",
    location: evidenceLocation(url),
    ...title ? { title } : {},
    ...webLlmPageContext(snapshot, childFrameIds),
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

// src/runtime/llm-evidence/tests/page-evidence.test.ts
var page = (evidence, extra = {}) => ({
  url: "https://example.test/checkout",
  title: "Checkout",
  interactiveElements: [{ tagName: "button", selector: "#place-order", visibleText: "Place order" }],
  ...extra,
  ...Object.keys(evidence).length ? { evidence } : {}
});
test("reports the open dialogs the producer lists, by the producer's own field names", () => {
  const evidence = sanitizeWebLlmSnapshot(page({
    dialogs: {
      open: [
        { selector: "#confirm-dialog", role: "dialog", modal: true, native: false, label: "Confirm your order" },
        { selector: "#session", role: "alertdialog", modal: false, native: false, label: "Session expiring" },
        { selector: "", role: "", modal: false, native: false },
        { selector: "#fourth", role: "dialog", modal: false, native: false, label: "Beyond the cap" }
      ],
      modal: true
    }
  }));
  assert.deepEqual(evidence.dialogs, [
    { role: "dialog", name: "Confirm your order", modal: true, selector: "#confirm-dialog" },
    { role: "alertdialog", name: "Session expiring", selector: "#session" }
  ]);
});
test("reports the top-most blocking overlay so a click that cannot land is explicable", () => {
  const evidence = sanitizeWebLlmSnapshot(page({
    overlays: {
      tested: 24,
      blockedCount: 2,
      blockers: [
        { selector: "#cookie-wall", role: "dialog", label: "We use cookies", blocks: 2, blocked: ["#place-order", "a.help"] },
        { selector: "#cookie-wall h2", role: "heading", label: "Cookies", blocks: 1, blocked: ["#place-order"] }
      ]
    }
  }));
  assert.deepEqual(evidence.blockedBy, { selector: "#cookie-wall", role: "dialog", name: "We use cookies", blocks: 2 });
  assert.equal(sanitizeWebLlmSnapshot(page({ overlays: { blockers: [{ label: "no selector" }] } })).blockedBy, void 0);
  assert.equal(sanitizeWebLlmSnapshot(page({ overlays: { tested: 24, blockedCount: 0, blockers: [] } })).blockedBy, void 0);
});
test("reports loading state only while the page is still settling", () => {
  assert.deepEqual(
    sanitizeWebLlmSnapshot(page({
      loading: {
        documentState: "interactive",
        busy: true,
        busyRegions: ["#cart"],
        indicators: [{ selector: "#spinner", kind: "spinner", label: "Loading more" }],
        pendingNavigation: true
      }
    })).loading,
    { readyState: "interactive", busy: true, spinner: true, pendingNavigation: true }
  );
  assert.equal(
    sanitizeWebLlmSnapshot(page({ loading: { documentState: "complete", busy: false, busyRegions: [], indicators: [], pendingNavigation: false } })).loading,
    void 0
  );
  assert.equal(sanitizeWebLlmSnapshot(page({ loading: { documentState: "wat" } })).loading, void 0);
  assert.deepEqual(sanitizeWebLlmSnapshot(page({ loading: { documentState: "loading" } })).loading, { readyState: "loading" });
  assert.deepEqual(
    sanitizeWebLlmSnapshot(page({ loading: { documentState: "complete", busy: true, indicators: [{ selector: "#more", kind: "status", label: "Loading more posts" }] } })).loading,
    { busy: true }
  );
});
test("reports how the document was reached, and nothing that only restates the location", () => {
  const evidence = sanitizeWebLlmSnapshot(page({
    navigation: {
      url: "https://example.test/checkout",
      origin: "https://example.test",
      path: "/checkout",
      referrer: "https://example.test/cart?session=private",
      type: "back_forward",
      redirects: 2,
      historyLength: 4,
      visibility: "visible"
    }
  }));
  assert.deepEqual(evidence.navigation, { type: "back_forward", redirects: 2, referrer: "https://example.test/cart" });
  assert.doesNotMatch(JSON.stringify(evidence), /session=private/u);
  assert.equal(
    sanitizeWebLlmSnapshot(page({ navigation: { url: "https://example.test/checkout", origin: "https://example.test", path: "/checkout", type: "navigate", redirects: 0, historyLength: 1, visibility: "visible" } })).navigation,
    void 0
  );
  assert.equal(sanitizeWebLlmSnapshot(page({ navigation: { referrer: "javascript:alert(1)" } })).navigation, void 0);
});
test("reports the pre-filter element total the capture declares, and that the capture itself truncated", () => {
  const declared = sanitizeWebLlmSnapshot(page({}, { elementTotal: 812, truncated: true }));
  assert.equal(declared.elementTotal, 812);
  assert.equal(declared.truncated, true);
  assert.equal(declared.captureTruncated, true, "the capture cut, so narrowing the capture is the remedy");
  assert.equal(declared.elementsTruncated, void 0, "the packet's own bound was nowhere near");
  assert.equal(declared.budgetTruncated, void 0, "and the budget was not what cut");
  assert.equal(sanitizeWebLlmSnapshot(page({})).elementTotal, void 0);
  assert.equal(sanitizeWebLlmSnapshot(page({})).truncated, false);
  assert.equal(sanitizeWebLlmSnapshot(page({})).captureTruncated, void 0);
});
test("reads the capture's own funnel, not only a bare top-level flag", () => {
  const nested = sanitizeWebLlmSnapshot(page({
    elements: { scanned: 4200, candidates: 900, matched: 812, returned: 40, truncated: true, changed: 3, recentlyInteracted: 1 }
  }));
  assert.equal(nested.captureTruncated, true);
  assert.equal(nested.truncated, true);
  assert.equal(nested.elementTotal, 812, "the funnel's matched count is the number half of the same fact");
  const settled = sanitizeWebLlmSnapshot(page({
    elements: { scanned: 90, candidates: 12, matched: 1, returned: 1, truncated: false, changed: 0, recentlyInteracted: 0 }
  }));
  assert.equal(settled.captureTruncated, void 0);
  assert.equal(settled.truncated, false);
  assert.equal(settled.elementTotal, void 0, "one element carried out of one matched restates nothing");
});
test("carries element-level recency and change flags as fields, not as ordering alone", () => {
  const evidence = sanitizeWebLlmSnapshot(page({}, {
    interactiveElements: [
      { tagName: "input", selector: "#quantity", name: "Quantity", recentlyInteracted: true, changed: true },
      { tagName: "button", selector: "#place-order", visibleText: "Place order", recentlyInteracted: false, changed: false }
    ]
  }));
  assert.deepEqual(evidence.elements, [
    { target: "target.1", tag: "input", selector: "#quantity", name: "Quantity", recent: true, changed: true },
    { target: "target.2", tag: "button", selector: "#place-order", text: "Place order" }
  ]);
});
test("the flat shape the reader was first written against is not read at all", () => {
  const evidence = sanitizeWebLlmSnapshot(page({}, {
    loading: { readyState: "interactive", busy: true, spinner: true, pendingNavigation: true },
    navigation: { pending: true, from: "https://example.test/cart", to: "https://example.test/checkout" },
    dialogs: [{ role: "dialog", name: "Confirm your order", modal: true, selector: "#confirm-dialog" }],
    blockingOverlay: { selector: "#cookie-wall", tagName: "DIV", role: "dialog", name: "We use cookies" },
    pendingNativeDialog: true
  }));
  assert.deepEqual(
    { loading: evidence.loading, navigation: evidence.navigation, dialogs: evidence.dialogs, blockedBy: evidence.blockedBy },
    { loading: void 0, navigation: void 0, dialogs: void 0, blockedBy: void 0 }
  );
  assert.doesNotMatch(JSON.stringify(evidence), /Confirm your order|cookie-wall|example\.test\/cart/u);
});
test("no snapshot can make the packet claim a native dialog is pending", () => {
  for (const evidence of [
    { dialogs: { open: [], modal: false, armPending: true } },
    { dialogs: { open: [{ selector: "#d", role: "dialog", modal: true, native: true, label: "Native" }], modal: true, armPending: true } },
    { dialogs: { open: [], modal: false, lastNative: { kind: "confirm", message: "Leave this page?", response: "dismiss", at: 1700 } } }
  ]) {
    const packet = sanitizeWebLlmSnapshot(page(evidence));
    assert.equal("pendingNativeDialog" in packet, false, JSON.stringify(evidence));
  }
});
test("ignores a page item that arrives malformed rather than failing the whole packet", () => {
  const evidence = sanitizeWebLlmSnapshot(page({
    dialogs: "one dialog",
    overlays: 7,
    loading: null,
    navigation: [],
    elements: "a funnel"
  }, { frame: { isTop: "yes" }, elementTotal: -3 }));
  assert.deepEqual(
    { dialogs: evidence.dialogs, blockedBy: evidence.blockedBy, loading: evidence.loading, navigation: evidence.navigation, elementTotal: evidence.elementTotal, frame: evidence.frame },
    { dialogs: void 0, blockedBy: void 0, loading: void 0, navigation: void 0, elementTotal: void 0, frame: void 0 }
  );
  assert.equal(evidence.elements.length, 1);
  assert.equal(sanitizeWebLlmSnapshot(page({}, { evidence: "not an object" })).dialogs, void 0);
});
