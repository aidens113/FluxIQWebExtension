// src/runtime/llm-evidence/tests/target-override.test.ts
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

// src/runtime/llm-evidence/present.ts
function present(fields) {
  const source = fields;
  const written = {};
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (value !== void 0) written[key] = value;
  }
  return written;
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
  return present({
    target: context.target,
    tag,
    selector: addressed.selector,
    frameId: addressed.frameId,
    role: role || void 0,
    name: name || void 0,
    text: text || void 0,
    inputType: inputType || void 0,
    controlType: controlType || void 0,
    hasValue,
    selectedValue: selectedValue || void 0,
    href: href || void 0,
    options: options?.length ? options : void 0,
    revealKind,
    expanded,
    focused,
    recent: trueFlag(raw.recentlyInteracted),
    changed: trueFlag(raw.changed),
    form: placement.form,
    landmark: placement.landmark,
    heading: placement.heading,
    item: placement.item,
    cell: placement.cell
  });
}
function safeFillTag(tag, inputType) {
  return tag === "textarea" || tag === "input" && (!inputType || ["text", "search", "email", "tel", "url", "number"].includes(inputType));
}
function actionableEvidenceElement(element) {
  if (["button", "a", "summary", "select", "textarea"].includes(element.tag)) return true;
  if (element.tag === "input") return element.inputType !== "hidden";
  return ["button", "link", "checkbox", "radio", "option", "switch", "tab", "menuitem", "treeitem"].includes(element.role ?? "");
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
  const described = isJsonRecord(input) ? input : {};
  const form = boundedText(described.formId ?? described.formName, WEB_LLM_EVIDENCE_BOUNDS.placement);
  const landmark = boundedText(described.landmark, WEB_LLM_EVIDENCE_BOUNDS.tag);
  const rawHeading = boundedText(described.heading, WEB_LLM_EVIDENCE_BOUNDS.placement);
  const heading = rawHeading === named.name || rawHeading === named.text ? void 0 : rawHeading;
  return {
    form: form || void 0,
    landmark: landmark || void 0,
    heading: heading || void 0,
    item: listPlacement(described.listPosition),
    cell: tablePlacement(described.tablePosition)
  };
}
function listPlacement(input) {
  if (!isJsonRecord(input)) return void 0;
  const index = boundedCount(input.index, 1e5);
  const total = boundedCount(input.total, 1e5);
  return index === void 0 || total === void 0 ? void 0 : { index, total };
}
function tablePlacement(input) {
  if (!isJsonRecord(input)) return void 0;
  const row = boundedCount(input.row, 1e5);
  const column = boundedCount(input.column, 1e5);
  if (row === void 0 || column === void 0) return void 0;
  const header = boundedText(input.columnHeader, WEB_LLM_EVIDENCE_BOUNDS.placement);
  return present({ row, column, header: header || void 0 });
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
  return present({
    frame,
    loading,
    navigation,
    dialogs,
    blockedBy,
    selectedText: selectedText || void 0,
    // The one page-context field this reader does not read. It is the element
    // funnel's number, so `sanitize.ts` supplies it beside the elements it
    // counted. Named here rather than left out, because leaving a field out is
    // exactly what this seam exists to make impossible.
    elementTotal: void 0
  });
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
  return present({
    isTop: isTop ?? true,
    childFrameIds: childFrameIds.length ? childFrameIds : void 0
  });
}
function evidenceLoading(input) {
  if (!input) return void 0;
  const documentState = boundedText(input.documentState, WEB_LLM_EVIDENCE_BOUNDS.tag)?.toLowerCase();
  const readyState = documentState && READY_STATES.includes(documentState) ? documentState : void 0;
  const spinner = items(input.indicators).map((indicator) => pageEvidenceWire(indicator)).some((indicator) => indicator?.kind === "spinner");
  const loading = present({
    readyState: readyState && readyState !== "complete" ? readyState : void 0,
    busy: trueFlag(input.busy),
    spinner: spinner ? true : void 0,
    pendingNavigation: trueFlag(input.pendingNavigation)
  });
  return Object.keys(loading).length ? loading : void 0;
}
function evidenceNavigation(input) {
  if (!input) return void 0;
  const type = boundedText(input.type, WEB_LLM_EVIDENCE_BOUNDS.tag)?.toLowerCase();
  const redirects = boundedCount(input.redirects, MAX_REDIRECTS);
  const navigation = present({
    type: type && type !== ORDINARY_NAVIGATION_TYPE ? type : void 0,
    redirects: redirects || void 0,
    referrer: safeLocation(input.referrer)
  });
  return Object.keys(navigation).length ? navigation : void 0;
}
function safeLocation(input) {
  try {
    return evidenceLocation(safeEvidenceUrl(input));
  } catch {
    return void 0;
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
    dialogs.push(present({
      role: role || void 0,
      name: name || void 0,
      modal,
      selector: selector || void 0
    }));
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
  return present({
    selector,
    role: role || void 0,
    name: name || void 0,
    blocks: blocks || void 0
  });
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
  const context = webLlmPageContext(snapshot, childFrameIds);
  const evidence = present({
    schemaVersion: WEB_LLM_EVIDENCE_SCHEMA_VERSION,
    trust: "untrusted-page-evidence",
    location: evidenceLocation(url),
    title: title || void 0,
    // The page context is carried field by field rather than spread, so a
    // packet field renamed or dropped in `page-evidence.ts` fails here instead
    // of quietly leaving the packet.
    frame: context.frame,
    loading: context.loading,
    navigation: context.navigation,
    dialogs: context.dialogs,
    blockedBy: context.blockedBy,
    selectedText: context.selectedText,
    elementTotal,
    elements,
    truncated: captureTruncated || elementsTruncated,
    captureTruncated: captureTruncated ? true : void 0,
    elementsTruncated: elementsTruncated ? true : void 0,
    // Not written here: `trimToBudget` below sets it if and only if a removal
    // was needed. Mentioned so the packet's key set stays exhaustive.
    budgetTruncated: void 0
  });
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

// src/runtime/llm-evidence/target-override.ts
function validateWebRuntimeTargetOverrideEvidence(evidence, target, failedAction) {
  const matches = evidence.elements.filter((element) => element.selector === target.selector);
  if (matches.length > 1) return { status: "ambiguous" };
  if (matches.length === 1 && targetCompatibleWithFailedAction(matches[0], failedAction.definitionId)) return { status: "matched" };
  const compatible = evidence.elements.filter((element) => targetCompatibleWithFailedAction(element, failedAction.definitionId));
  if (compatible.length === 0) return { status: "absent" };
  if (compatible.length > 1) return { status: "ambiguous" };
  const resolved = compatible[0];
  return evidence.elements.filter((element) => element.selector === resolved.selector).length === 1 ? { status: "resolved", target: { selector: resolved.selector } } : { status: "ambiguous" };
}
function targetCompatibleWithFailedAction(element, definitionId) {
  if (definitionId === "web.output.dom-type" || definitionId === "web.output.dom-clear") return safeFillTag(element.tag, element.inputType);
  if (definitionId === "web.output.dom-select") return element.tag === "select";
  if (definitionId === "web.output.dom-click") return actionableEvidenceElement(element);
  if (definitionId === "web.output.dom-keypress") return safeFillTag(element.tag, element.inputType) || element.tag === "select" || actionableEvidenceElement(element);
  return definitionId === "web.output.dom-wait_for_selector" || definitionId === "web.output.dom-extract";
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

// src/runtime/llm-evidence/tests/target-override.test.ts
test("validates target overrides only when one exact selector has semantics compatible with the failed action", () => {
  const evidence = sanitizeWebLlmSnapshot({
    url: "https://example.test/form",
    interactiveElements: [
      { tagName: "textarea", selector: "#name", name: "Name" },
      { tagName: "select", selector: "#plan", name: "Plan", options: [{ value: "team", label: "Team" }] },
      { tagName: "button", selector: "#unique", name: "Unique" },
      { tagName: "button", selector: ".duplicate", name: "First" },
      { tagName: "button", selector: ".duplicate", name: "Second" }
    ]
  });
  const typeAction = { nodeId: "name", definitionId: "web.output.dom-type" };
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, { selector: "#name" }, typeAction), { status: "matched" });
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, { selector: "#plan" }, typeAction), { status: "resolved", target: { selector: "#name" } });
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, { selector: "#unique" }, typeAction), { status: "resolved", target: { selector: "#name" } });
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, { selector: "#missing" }, typeAction), { status: "resolved", target: { selector: "#name" } });
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, { selector: ".duplicate" }, { nodeId: "submit", definitionId: "web.output.dom-click" }), { status: "ambiguous" });
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, { selector: "#plan" }, { nodeId: "plan", definitionId: "web.output.dom-select" }), { status: "matched" });
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, { selector: "#unique" }, { nodeId: "submit", definitionId: "web.output.dom-click" }), { status: "matched" });
  const noTypeableTarget = sanitizeWebLlmSnapshot({ url: "https://example.test/form", interactiveElements: [{ tagName: "select", selector: "#plan" }] });
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(noTypeableTarget, { selector: "#missing" }, typeAction), { status: "absent" });
  const multipleTypeableTargets = sanitizeWebLlmSnapshot({ url: "https://example.test/form", interactiveElements: [{ tagName: "input", selector: "#first" }, { tagName: "textarea", selector: "#second" }] });
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(multipleTypeableTargets, { selector: "#missing" }, typeAction), { status: "ambiguous" });
});
test("matches a child-frame target on the selector that works inside its frame", () => {
  const evidence = sanitizeWebLlmSnapshot({
    url: "https://example.test/checkout",
    interactiveElements: [
      { tagName: "input", selector: "frame[3] >> #card-name", name: "Name on card", attributes: { "data-fluxiq-frame-id": "3" } }
    ]
  });
  const typeAction = { nodeId: "card", definitionId: "web.output.dom-type" };
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, { selector: "#card-name" }, typeAction), { status: "matched" });
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, { selector: "frame[3] >> #card-name" }, typeAction), { status: "resolved", target: { selector: "#card-name" } });
});
