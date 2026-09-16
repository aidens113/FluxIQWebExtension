// domain/src/runtime/llm-evidence/tests/limits.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { AUTOMATION_STUDIO_LLM_MAX_FAILURE_EVIDENCE_BYTES as AUTOMATION_STUDIO_LLM_MAX_FAILURE_EVIDENCE_BYTES2, sanitizeAutomationStudioLlmFailureEvidence } from "fluxiq/automation-studio";

// domain/src/runtime/llm-evidence/limits.ts
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

// domain/src/sensitivity/signature.ts
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

// domain/src/sensitivity/descriptor.ts
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

// domain/src/runtime/llm-evidence/location.ts
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

// domain/src/runtime/llm-evidence/present.ts
function present(fields) {
  const source = fields;
  const written = {};
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (value !== void 0) written[key] = value;
  }
  return written;
}

// domain/src/runtime/llm-evidence/untrusted-json.ts
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

// domain/src/runtime/llm-evidence/elements.ts
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
  const element = present({
    target: context.target,
    tag,
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
  return { element, selector: addressed.selector };
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

// domain/src/page-evidence/wire.ts
function pageEvidenceWire(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}

// domain/src/runtime/llm-evidence/page-evidence.ts
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
    const modal = trueFlag(raw.modal);
    if (!role && !name && !modal) continue;
    dialogs.push(present({
      role: role || void 0,
      name: name || void 0,
      modal
    }));
  }
  return dialogs.length ? dialogs : void 0;
}
function evidenceBlocker(input) {
  const blocker = items(input?.blockers).map((item) => pageEvidenceWire(item)).find((item) => item !== void 0);
  if (!blocker) return void 0;
  const role = boundedText(blocker.role, WEB_LLM_EVIDENCE_BOUNDS.role);
  const name = boundedText(blocker.label, WEB_LLM_EVIDENCE_BOUNDS.text);
  const blocks = boundedCount(blocker.blocks, MAX_BLOCKED_CONTROLS);
  if (!role && !name && !blocks) return void 0;
  return present({
    role: role || void 0,
    name: name || void 0,
    blocks: blocks || void 0
  });
}

// domain/src/runtime/llm-evidence/sanitize.ts
var WEB_LLM_EVIDENCE_SCHEMA_VERSION = "web-llm-evidence.v2";
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
    const described = sanitizedEvidenceElement(raw, { target: `target.${elements.length + 1}`, url, focusedSelector });
    if (!described) continue;
    elements.push(described.element);
    selectors.set(described.element.target, described.selector);
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
    budgetTruncated: void 0,
    // Nor are these: `markFailedTarget` writes exactly one of them, and only
    // for a packet that is describing a failure. Named for the same reason.
    failedTarget: void 0,
    failedTargetMissing: void 0,
    failedTargetUnknown: void 0
  });
  markFailedTarget(evidence, selectors, options.failedAction);
  trimToBudget(evidence, selectors, maxEvidenceBytes);
  return { evidence, selectors };
}
function markFailedTarget(evidence, selectors, failedAction) {
  if (!failedAction) return;
  if (!failedAction.selector) {
    evidence.failedTargetUnknown = true;
    return;
  }
  const handle = [...selectors.entries()].find(([, selector]) => selector === failedAction.selector)?.[0];
  if (handle === void 0) evidence.failedTargetMissing = true;
  else evidence.failedTarget = handle;
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
    if (removed && evidence.failedTarget === removed.target) {
      delete evidence.failedTarget;
      evidence.failedTargetMissing = true;
    }
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

// domain/src/runtime/llm-evidence/tool-rejection.ts
var WEB_LLM_TOOL_REJECTION_CODES = [
  "invalid_input",
  "cross_origin",
  "no_progress",
  "target_unobserved",
  "target_unsafe",
  "sensitive_value"
];

// domain/src/runtime/llm-evidence/vocabulary.ts
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

// domain/src/runtime/llm-evidence/tests/limits.test.ts
var bytes = (value) => new TextEncoder().encode(JSON.stringify(value)).byteLength;
var largePage = (count, extra = {}) => ({
  url: "https://example.test/large",
  title: "Large fixture",
  interactiveElements: Array.from({ length: count }, (_, index) => ({
    tagName: "button",
    selector: `[data-index="${index}"]`,
    visibleText: `Item ${index} ${"x".repeat(120)}`
  })),
  ...extra
});
test("the failure budget is Core's own gate, and the exploration budget sits under the shared ceiling", () => {
  assert.equal(WEB_LLM_EVIDENCE_BYTE_BUDGETS.failure, AUTOMATION_STUDIO_LLM_MAX_FAILURE_EVIDENCE_BYTES2);
  assert.equal(WEB_LLM_EVIDENCE_BYTE_BUDGETS.failure, 3e3);
  assert.equal(WEB_LLM_EVIDENCE_BYTE_BUDGETS.exploration, 6e3);
  assert.equal(WEB_LLM_EVIDENCE_BYTE_BUDGETS.ceiling, 12e3);
  assert.equal(WEB_LLM_EVIDENCE_BYTE_BUDGETS.failure < WEB_LLM_EVIDENCE_BYTE_BUDGETS.exploration, true);
  assert.equal(WEB_LLM_EVIDENCE_BYTE_BUDGETS.exploration < WEB_LLM_EVIDENCE_BYTE_BUDGETS.ceiling, true);
});
test("applies each path's default when the caller names no budget", () => {
  const exploration = sanitizeWebLlmSnapshot(largePage(60));
  assert.equal(bytes(exploration) <= WEB_LLM_EVIDENCE_BYTE_BUDGETS.exploration, true, `${bytes(exploration)} bytes`);
  const failure = sanitizeWebLlmSnapshot(largePage(60), { budget: "failure" });
  assert.equal(bytes(failure) <= WEB_LLM_EVIDENCE_BYTE_BUDGETS.failure, true, `${bytes(failure)} bytes`);
  assert.equal(failure.elements.length < exploration.elements.length, true);
});
test("clamps a request above the path's ceiling instead of honouring it", () => {
  const failure = sanitizeWebLlmSnapshot(largePage(60), { budget: "failure", maxEvidenceBytes: 9e3 });
  assert.equal(bytes(failure) <= WEB_LLM_EVIDENCE_BYTE_BUDGETS.failure, true, `${bytes(failure)} bytes`);
  const exploration = sanitizeWebLlmSnapshot(largePage(60), { maxEvidenceBytes: 5e4 });
  assert.equal(bytes(exploration) <= WEB_LLM_EVIDENCE_BYTE_BUDGETS.ceiling, true, `${bytes(exploration)} bytes`);
});
test("refuses a budget that is not a positive bounded integer rather than falling back silently", () => {
  for (const maxEvidenceBytes of [0, -1, 1.5, 100001, Number.NaN]) {
    assert.throws(() => sanitizeWebLlmSnapshot(largePage(2), { maxEvidenceBytes }), /positive bounded integer/u, `budget ${maxEvidenceBytes}`);
  }
});
test("reports truncation and the element count exactly at the budget boundary", () => {
  const page = largePage(12);
  const whole = sanitizeWebLlmSnapshot(page, { maxEvidenceBytes: WEB_LLM_EVIDENCE_BYTE_BUDGETS.ceiling });
  assert.equal(whole.elements.length, 12);
  assert.equal(whole.truncated, false);
  const exact = sanitizeWebLlmSnapshot(page, { maxEvidenceBytes: bytes(whole) });
  assert.equal(exact.elements.length, 12);
  assert.equal(exact.truncated, false);
  assert.equal(bytes(exact), bytes(whole));
  const oneShort = sanitizeWebLlmSnapshot(page, { maxEvidenceBytes: bytes(whole) - 1 });
  assert.equal(oneShort.elements.length, 11);
  assert.equal(oneShort.truncated, true);
  assert.equal(bytes(oneShort) <= bytes(whole) - 1, true);
});
test("names which limit truncated the packet, one row per limit", () => {
  const budget = sanitizeWebLlmSnapshot(largePage(12), { maxEvidenceBytes: 900 });
  assert.equal(budget.budgetTruncated, true, "the budget forced removals: ask again with more room");
  assert.equal(budget.captureTruncated, void 0);
  assert.equal(budget.elementsTruncated, void 0);
  assert.equal(budget.truncated, true);
  const bound = sanitizeWebLlmSnapshot(largePage(WEB_LLM_EVIDENCE_BOUNDS.elements + 1), { maxEvidenceBytes: WEB_LLM_EVIDENCE_BYTE_BUDGETS.ceiling });
  assert.equal(bound.elementsTruncated, true, "more elements were offered than the packet's bound carries");
  assert.equal(bound.elements.length, WEB_LLM_EVIDENCE_BOUNDS.elements);
  assert.equal(bound.captureTruncated, void 0);
  assert.equal(bound.truncated, true);
  const capture = sanitizeWebLlmSnapshot(largePage(2, { truncated: true }), { maxEvidenceBytes: WEB_LLM_EVIDENCE_BYTE_BUDGETS.ceiling });
  assert.equal(capture.captureTruncated, true, "the browser cut before sending: narrowing the capture is the remedy");
  assert.equal(capture.elementsTruncated, void 0);
  assert.equal(capture.budgetTruncated, void 0);
  assert.equal(capture.truncated, true);
  const whole = sanitizeWebLlmSnapshot(largePage(2), { maxEvidenceBytes: WEB_LLM_EVIDENCE_BYTE_BUDGETS.ceiling });
  assert.equal(whole.truncated, false);
  assert.deepEqual([whole.captureTruncated, whole.elementsTruncated, whole.budgetTruncated], [void 0, void 0, void 0], "a whole packet carries none of the three");
});
test("all three limits can fire at once, and each stays separately readable", () => {
  const page = largePage(WEB_LLM_EVIDENCE_BOUNDS.elements + 5, { truncated: true });
  const evidence = sanitizeWebLlmSnapshot(page, { budget: "failure" });
  assert.equal(evidence.captureTruncated, true);
  assert.equal(evidence.elementsTruncated, true);
  assert.equal(evidence.budgetTruncated, true);
  assert.equal(evidence.truncated, true);
  assert.equal(bytes(evidence) <= WEB_LLM_EVIDENCE_BYTE_BUDGETS.failure, true, `${bytes(evidence)} bytes`);
});
test("gives up page facts before the last element, and refuses only when nothing is left to drop", () => {
  const page = {
    url: "https://example.test/checkout",
    title: "Checkout",
    selectedText: "order reference 4471",
    // The producer's shape: one nested `evidence` object, written field for
    // field as `apps/extension/src/content/evidence/types.ts` declares it. The
    // packet reads only this shape, so a fixture in the old flat shape would
    // silently carry no loading state and no dialog and prove nothing about
    // the order they are given up in.
    evidence: {
      loading: { documentState: "interactive", busy: false, busyRegions: [], indicators: [], pendingNavigation: false },
      dialogs: { open: [{ selector: "#confirm", role: "dialog", modal: true, native: false, label: "Confirm your order" }], modal: true }
    },
    interactiveElements: [
      { tagName: "button", selector: "#place-order", visibleText: "Place order" },
      { tagName: "button", selector: "#cancel", visibleText: "Cancel" }
    ]
  };
  const rung = (budget) => sanitizeWebLlmSnapshot(page, { maxEvidenceBytes: budget });
  const shape = (evidence) => ({
    elements: evidence.elements.length,
    selectedText: evidence.selectedText !== void 0,
    title: evidence.title !== void 0,
    loading: evidence.loading !== void 0,
    dialogs: evidence.dialogs !== void 0,
    truncated: evidence.truncated,
    budget: evidence.budgetTruncated === true
  });
  const whole = rung(WEB_LLM_EVIDENCE_BYTE_BUDGETS.ceiling);
  assert.deepEqual(shape(whole), { elements: 2, selectedText: true, title: true, loading: true, dialogs: true, truncated: false, budget: false });
  const oneElement = rung(bytes(whole) - 1);
  assert.deepEqual(shape(oneElement), { elements: 1, selectedText: true, title: true, loading: true, dialogs: true, truncated: true, budget: true });
  const noSelection = rung(bytes(oneElement) - 1);
  assert.deepEqual(shape(noSelection), { elements: 1, selectedText: false, title: true, loading: true, dialogs: true, truncated: true, budget: true });
  const noTitle = rung(bytes(noSelection) - 1);
  assert.deepEqual(shape(noTitle), { elements: 1, selectedText: false, title: false, loading: true, dialogs: true, truncated: true, budget: true });
  const noLoading = rung(bytes(noTitle) - 1);
  assert.deepEqual(shape(noLoading), { elements: 1, selectedText: false, title: false, loading: false, dialogs: true, truncated: true, budget: true });
  const noDialogs = rung(bytes(noLoading) - 1);
  assert.deepEqual(shape(noDialogs), { elements: 1, selectedText: false, title: false, loading: false, dialogs: false, truncated: true, budget: true });
  const nothing = rung(bytes(noDialogs) - 1);
  assert.deepEqual(shape(nothing), { elements: 0, selectedText: false, title: false, loading: false, dialogs: false, truncated: true, budget: true });
  assert.throws(() => rung(bytes(nothing) - 1), /exceeds the evidence byte limit/u);
});
test("a failure packet passes Core's failure-evidence gate whole", () => {
  const evidence = sanitizeWebLlmSnapshot({
    url: "https://example.test/checkout?session=private",
    title: "Checkout",
    frame: { isTop: true },
    selectedText: "order reference 4471",
    loading: { readyState: "interactive", busy: true },
    navigation: { pending: true, to: "https://example.test/receipt" },
    dialogs: [{ role: "dialog", name: "Confirm your order", modal: true, selector: "#confirm" }],
    blockingOverlay: { selector: "#cookie-wall", tagName: "div", name: "We use cookies" },
    elementTotal: 240,
    focusedElement: { tagName: "input", selector: "#coupon", name: "Coupon" },
    interactiveElements: Array.from({ length: 60 }, (_, index) => ({
      tagName: "button",
      selector: `[data-testid="row-${index}"]`,
      name: `Add item ${index}`,
      attributes: { "data-fluxiq-frame-id": index % 2 === 0 ? "0" : "4" },
      context: { formId: "checkout", landmark: "main", heading: "Your basket", listPosition: { index, total: 240 } }
    }))
  }, { budget: "failure" });
  const gated = sanitizeAutomationStudioLlmFailureEvidence("runtime_diagnosis", evidence);
  assert.deepEqual(gated, JSON.parse(JSON.stringify(evidence)));
  assert.equal(bytes(gated) <= AUTOMATION_STUDIO_LLM_MAX_FAILURE_EVIDENCE_BYTES2, true, `${bytes(gated)} bytes`);
  assert.equal(evidence.truncated, true);
  assert.equal(evidence.elements.length > 0, true);
  assert.equal(evidence.elements.length <= WEB_LLM_EVIDENCE_BOUNDS.elements, true);
  assert.doesNotMatch(JSON.stringify(evidence), /session=private/u);
});
