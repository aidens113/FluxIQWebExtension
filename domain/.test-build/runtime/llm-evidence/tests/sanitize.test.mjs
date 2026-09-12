// src/runtime/llm-evidence/tests/sanitize.test.ts
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

// src/runtime/llm-evidence/page-evidence.ts
var READY_STATES = ["loading", "interactive", "complete"];
function webLlmPageContext(snapshot, childFrameIds) {
  const frame = evidenceFrame(snapshot.frame, childFrameIds);
  const loading = evidenceLoading(snapshot.loading);
  const navigation = evidenceNavigation(snapshot.navigation);
  const dialogs = evidenceDialogs(snapshot.dialogs);
  const blockedBy = evidenceBlocker(snapshot.blockingOverlay);
  const selectedText = boundedText(snapshot.selectedText, WEB_LLM_EVIDENCE_BOUNDS.text);
  return {
    ...frame ? { frame } : {},
    ...loading ? { loading } : {},
    ...navigation ? { navigation } : {},
    ...dialogs ? { dialogs } : {},
    ...trueFlag(snapshot.pendingNativeDialog) ? { pendingNativeDialog: true } : {},
    ...blockedBy ? { blockedBy } : {},
    ...selectedText ? { selectedText } : {}
  };
}
function evidenceElementTotal(snapshot, carried) {
  const declared = boundedCount(snapshot.elementTotal, 1e7);
  const received = Array.isArray(snapshot.interactiveElements) ? snapshot.interactiveElements.length : 0;
  const total = Math.max(declared ?? 0, received);
  return total > carried ? total : void 0;
}
function capturedTruncated(snapshot) {
  return trueFlag(snapshot.truncated) === true;
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
  if (!isJsonRecord(input)) return void 0;
  const rawReadyState = boundedText(input.readyState, WEB_LLM_EVIDENCE_BOUNDS.tag)?.toLowerCase();
  const readyState = rawReadyState && READY_STATES.includes(rawReadyState) ? rawReadyState : void 0;
  const loading = {
    ...readyState && readyState !== "complete" ? { readyState } : {},
    ...trueFlag(input.busy) ? { busy: true } : {},
    ...trueFlag(input.spinner) ? { spinner: true } : {},
    ...trueFlag(input.pendingNavigation) ? { pendingNavigation: true } : {}
  };
  return Object.keys(loading).length ? loading : void 0;
}
function evidenceNavigation(input) {
  if (!isJsonRecord(input)) return void 0;
  const navigation = {
    ...trueFlag(input.pending) ? { pending: true } : {},
    ...locationField("from", input.from),
    ...locationField("to", input.to)
  };
  return Object.keys(navigation).length ? navigation : void 0;
}
function locationField(key, input) {
  try {
    return { [key]: evidenceLocation(safeEvidenceUrl(input)) };
  } catch {
    return {};
  }
}
function evidenceDialogs(input) {
  if (!Array.isArray(input)) return void 0;
  const dialogs = [];
  for (const raw of input.slice(0, WEB_LLM_EVIDENCE_BOUNDS.dialogs)) {
    if (!isJsonRecord(raw)) continue;
    const role = boundedText(raw.role, WEB_LLM_EVIDENCE_BOUNDS.role);
    const name = boundedText(raw.name, WEB_LLM_EVIDENCE_BOUNDS.text);
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
  if (!isJsonRecord(input)) return void 0;
  const selector = boundedText(input.selector, WEB_LLM_EVIDENCE_BOUNDS.selector);
  if (!selector) return void 0;
  const tag = boundedText(input.tag ?? input.tagName, WEB_LLM_EVIDENCE_BOUNDS.tag)?.toLowerCase();
  const role = boundedText(input.role, WEB_LLM_EVIDENCE_BOUNDS.role);
  const name = boundedText(input.name, WEB_LLM_EVIDENCE_BOUNDS.text);
  return {
    selector,
    ...tag ? { tag } : {},
    ...role ? { role } : {},
    ...name ? { name } : {}
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
  const evidence = {
    schemaVersion: WEB_LLM_EVIDENCE_SCHEMA_VERSION,
    trust: "untrusted-page-evidence",
    location: evidenceLocation(url),
    ...title ? { title } : {},
    ...webLlmPageContext(snapshot, childFrameIds),
    ...elementTotal === void 0 ? {} : { elementTotal },
    elements,
    truncated: capturedTruncated(snapshot) || snapshot.interactiveElements.length > WEB_LLM_EVIDENCE_BOUNDS.elements
  };
  trimToBudget(evidence, selectors, maxEvidenceBytes);
  return { evidence, selectors };
}
function budgetFor(options) {
  return options.budget === "failure" ? evidenceByteLimit(options.maxEvidenceBytes, WEB_LLM_EVIDENCE_BYTE_BUDGETS.failure, WEB_LLM_EVIDENCE_BYTE_BUDGETS.failure) : evidenceByteLimit(options.maxEvidenceBytes, WEB_LLM_EVIDENCE_BYTE_BUDGETS.exploration);
}
function trimToBudget(evidence, selectors, maxEvidenceBytes) {
  const popElement = () => {
    const removed = evidence.elements.pop();
    if (removed) selectors.delete(removed.target);
    evidence.truncated = true;
  };
  const droppable = ["selectedText", "title", "navigation", "loading", "elementTotal", "pendingNativeDialog", "dialogs", "blockedBy", "frame"];
  while (serializedBytes(evidence) > maxEvidenceBytes) {
    if (evidence.elements.length > 1) {
      popElement();
      continue;
    }
    const field = droppable.shift();
    if (field !== void 0) {
      if (evidence[field] !== void 0) {
        delete evidence[field];
        evidence.truncated = true;
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

// src/runtime/llm-evidence/tests/sanitize.test.ts
test("sanitizes extension snapshots without values, sensitive controls, or URL secrets", () => {
  const evidence = sanitizeWebLlmSnapshot({
    url: "https://example.test/form?token=private#secret",
    title: "Example",
    interactiveElements: [
      { tagName: "input", selector: "#name", name: "Name", inputType: "text", value: "Ada", attributes: { type: "text" } },
      { tagName: "input", selector: "#password", name: "Password", inputType: "password", value: "private" },
      { tagName: "a", selector: "#next", visibleText: "Next", href: "/next?ticket=private" },
      { tagName: "a", selector: "#away", visibleText: "Away", href: "https://outside.test/" }
    ]
  });
  assert.deepEqual(evidence, {
    schemaVersion: "web-llm-evidence.v1",
    trust: "untrusted-page-evidence",
    location: "https://example.test/form",
    title: "Example",
    // Four elements were captured and three are described: the packet says so
    // rather than letting the model conclude the form has no password field.
    elementTotal: 4,
    truncated: false,
    elements: [
      { target: "target.1", tag: "input", selector: "#name", name: "Name" },
      { target: "target.2", tag: "a", selector: "#next", text: "Next", href: "https://example.test/next" },
      { target: "target.3", tag: "a", selector: "#away", text: "Away" }
    ]
  });
  assert.doesNotMatch(JSON.stringify(evidence), /Ada|private|token|ticket/u);
});
test("retains compact semantic labels, types, select options, and result text needed for instruction-only generation", () => {
  const evidence = sanitizeWebLlmSnapshot({
    url: "https://example.test/scenarios/instruction-only-form/",
    title: "Instruction-only automation",
    interactiveElements: [
      { tagName: "input", selector: "[data-testid=instruction-name]", name: "Name", inputType: "text", hasValue: true, value: "Ada", attributes: { autocomplete: "off" } },
      { tagName: "select", selector: "[data-testid=instruction-plan]", name: "Plan", selectedValue: "team", value: "team", options: [{ value: "starter", label: "Starter" }, { value: "team", label: "Team" }, { value: "enterprise", label: "Enterprise" }] },
      { tagName: "button", selector: "[data-testid=instruction-submit]", name: "Submit", text: "Submit", attributes: { type: "submit" } },
      { tagName: "p", selector: "[data-testid=result]", text: "Not submitted", attributes: { "aria-live": "polite" } }
    ]
  });
  assert.deepEqual(evidence.elements, [
    { target: "target.1", tag: "input", selector: "[data-testid=instruction-name]", name: "Name", hasValue: true },
    { target: "target.2", tag: "select", selector: "[data-testid=instruction-plan]", name: "Plan", selectedValue: "team", options: [{ value: "starter", label: "Starter" }, { value: "team", label: "Team" }, { value: "enterprise", label: "Enterprise" }] },
    { target: "target.3", tag: "button", selector: "[data-testid=instruction-submit]", name: "Submit", controlType: "submit" },
    { target: "target.4", tag: "p", selector: "[data-testid=result]", text: "Not submitted" }
  ]);
  assert.doesNotMatch(JSON.stringify(evidence), /Ada/u);
});
test("exposes only bounded non-secret completion state", () => {
  const evidence = sanitizeWebLlmSnapshot({
    url: "https://example.test/form",
    interactiveElements: [
      { tagName: "textarea", selector: "#notes", hasValue: false, value: "private notes" },
      { tagName: "input", selector: "#hidden", inputType: "hidden", hasValue: true, value: "private hidden" },
      { tagName: "select", selector: "#plan", selectedValue: "unlisted", options: [{ value: "team", label: "Team" }] },
      { tagName: "select", selector: "#secret", selectedValue: "team", options: [{ value: "team", label: "Team" }], attributes: { "data-sensitive": "true" } }
    ]
  });
  assert.deepEqual(evidence.elements, [
    { target: "target.1", tag: "textarea", selector: "#notes", hasValue: false },
    { target: "target.2", tag: "input", selector: "#hidden", inputType: "hidden" },
    { target: "target.3", tag: "select", selector: "#plan", options: [{ value: "team", label: "Team" }] }
  ]);
  assert.doesNotMatch(JSON.stringify(evidence), /private|unlisted/u);
});
test("carries the page selection and marks the focused element, but never announces a focused secret", () => {
  const focusedField = sanitizeWebLlmSnapshot({
    url: "https://example.test/form",
    selectedText: "  order  reference   4471  ",
    focusedElement: { tagName: "input", selector: "#email", name: "Email", inputType: "email" },
    interactiveElements: [
      { tagName: "input", selector: "#email", name: "Email", inputType: "email" },
      { tagName: "button", selector: "#continue", visibleText: "Continue" }
    ]
  });
  assert.equal(focusedField.selectedText, "order reference 4471");
  assert.deepEqual(focusedField.elements.map((element) => [element.target, element.focused]), [["target.1", true], ["target.2", void 0]]);
  const focusedSecret = sanitizeWebLlmSnapshot({
    url: "https://example.test/form",
    focusedElement: { tagName: "input", selector: "#password", name: "Password", inputType: "password" },
    interactiveElements: [
      { tagName: "input", selector: "#password", name: "Password", inputType: "password" },
      { tagName: "button", selector: "#continue", visibleText: "Continue" }
    ]
  });
  assert.equal(focusedSecret.elements.some((element) => element.focused), false);
  assert.doesNotMatch(JSON.stringify(focusedSecret), /password|Password/u);
  const longSelection = sanitizeWebLlmSnapshot({
    url: "https://example.test/form",
    selectedText: "s".repeat(5e3),
    interactiveElements: [{ tagName: "button", selector: "#continue", visibleText: "Continue" }]
  });
  assert.equal(longSelection.selectedText?.length, WEB_LLM_EVIDENCE_BOUNDS.text);
});
test("carries where an element sits: its form, landmark, heading, list position and table cell", () => {
  const evidence = sanitizeWebLlmSnapshot({
    url: "https://example.test/catalog",
    interactiveElements: [
      {
        tagName: "button",
        selector: "[data-testid=add-1]",
        name: "Add to cart",
        context: { formId: "checkout", landmark: "main", heading: "Recommended for you", listPosition: { index: 3, total: 24 } }
      },
      {
        tagName: "td",
        selector: "#row-2-total",
        text: "48.00",
        context: { landmark: "main", heading: "Order summary", tablePosition: { row: 2, column: 4, columnHeader: "Total" } }
      },
      { tagName: "input", selector: "#coupon", name: "Coupon", context: { formName: "discount", heading: "Coupon" } }
    ]
  });
  assert.deepEqual(evidence.elements, [
    {
      target: "target.1",
      tag: "button",
      selector: "[data-testid=add-1]",
      name: "Add to cart",
      form: "checkout",
      landmark: "main",
      heading: "Recommended for you",
      item: { index: 3, total: 24 }
    },
    { target: "target.2", tag: "td", selector: "#row-2-total", text: "48.00", landmark: "main", heading: "Order summary", cell: { row: 2, column: 4, header: "Total" } },
    // The heading only repeats the control's own name, so it is not paid for twice.
    { target: "target.3", tag: "input", selector: "#coupon", name: "Coupon", form: "discount" }
  ]);
});
test("reports child-frame elements with a selector that works inside the frame and the frame that owns it", () => {
  const evidence = sanitizeWebLlmSnapshot({
    url: "https://example.test/checkout",
    frame: { isTop: true },
    interactiveElements: [
      { tagName: "button", selector: "#place-order", visibleText: "Place order" },
      { tagName: "input", selector: "frame[3] >> #card-name", name: "Name on card", attributes: { "data-fluxiq-frame-id": "3", "data-fluxiq-frame-url": "https://payments.example.test/f" } },
      { tagName: "input", selector: "#zip", name: "Postcode", attributes: { "data-fluxiq-frame-id": "7" } }
    ]
  });
  assert.deepEqual(evidence.frame, { isTop: true, childFrameIds: [3, 7] });
  assert.deepEqual(evidence.elements.map((element) => [element.selector, element.frameId]), [
    ["#place-order", void 0],
    ["#card-name", 3],
    ["#zip", 7]
  ]);
  assert.doesNotMatch(JSON.stringify(evidence), /frame\[3\]/u);
});
test("says the capture came from inside a child frame rather than presenting it as the whole page", () => {
  const evidence = sanitizeWebLlmSnapshot({
    url: "https://payments.example.test/fields",
    frame: { isTop: false, viewportOffset: { x: 10, y: 20, width: 300, height: 200 } },
    interactiveElements: [{ tagName: "input", selector: "#card-number", name: "Card number" }]
  });
  assert.deepEqual(evidence.frame, { isTop: false });
});
test("deduplicates representative 50-element semantic evidence without dropping executable selectors", () => {
  const interactiveElements = Array.from({ length: 50 }, (_, index) => ({
    tagName: "button",
    selector: `[data-component="global-navigation-item-${index}"][data-instance="${"x".repeat(72)}"]`,
    name: `Open workspace section ${index}`,
    visibleText: `Open workspace section ${index}`,
    attributes: { type: "button" }
  }));
  const evidence = sanitizeWebLlmSnapshot({ url: "https://example.test/workspace", title: "Workspace", interactiveElements }, { maxEvidenceBytes: 12e3 });
  const compactBytes = new TextEncoder().encode(JSON.stringify(evidence)).byteLength;
  const legacyBytes = new TextEncoder().encode(JSON.stringify({ ...evidence, elements: evidence.elements.map((element) => ({ ...element, text: element.name })) })).byteLength;
  assert.equal(evidence.elements.length, 40);
  assert.equal(evidence.elementTotal, 50);
  assert.equal(evidence.truncated, true);
  assert.equal(compactBytes <= 10500, true, `compact evidence used ${compactBytes} bytes`);
  assert.equal(compactBytes < legacyBytes, true, `compact ${compactBytes} bytes versus duplicate-semantic ${legacyBytes} bytes`);
  assert.match(JSON.stringify(evidence), /selector/u);
});
test("rejects a snapshot that is malformed or off the origin the caller expected", () => {
  assert.throws(() => sanitizeWebLlmSnapshot("not a snapshot"), /must be an object/u);
  assert.throws(() => sanitizeWebLlmSnapshot({ url: "https://example.test/", interactiveElements: "many" }), /elements are malformed/u);
  assert.throws(() => sanitizeWebLlmSnapshot({ url: "ftp://example.test/", interactiveElements: [] }), /HTTP\(S\) URL/u);
  assert.throws(() => sanitizeWebLlmSnapshot({ url: "https://user:secret@example.test/", interactiveElements: [] }), /HTTP\(S\) URL/u);
  assert.throws(
    () => sanitizeWebLlmSnapshot({ url: "https://elsewhere.test/", interactiveElements: [] }, { expectedOrigin: "https://example.test" }),
    /escaped the expected origin/u
  );
});
