// src/runtime/llm-evidence/tests/target-override.test.ts
import assert from "node:assert/strict";
import test from "node:test";

// src/constants.ts
var WEB_AUTOMATION_DOMAIN_ID = "web-automation";

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

// src/runtime/llm-evidence/harness-options/execute.ts
import { automationStudioExplorationScopeAllows } from "fluxiq/automation-studio";

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
  const name = boundedText(raw.accessibleName ?? raw.name, WEB_LLM_EVIDENCE_BOUNDS.text);
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
  const declared2 = boundedCount(snapshot.elementTotal, 1e7) ?? boundedCount(captureElementTotals(snapshot)?.matched, 1e7);
  const received = Array.isArray(snapshot.interactiveElements) ? snapshot.interactiveElements.length : 0;
  const total = Math.max(declared2 ?? 0, received);
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
  const declared2 = isJsonRecord(input) ? input : void 0;
  const isTop = typeof declared2?.isTop === "boolean" ? declared2.isTop : void 0;
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

// src/runtime/llm-evidence/sanitize.ts
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
    // Nor are these: `markFailedTarget` writes exactly one of the three marks,
    // and the repair parameters where the producer gave them, and only for a
    // packet that is describing a failure. Named for the same reason.
    failedTarget: void 0,
    failedTargetMissing: void 0,
    failedTargetUnknown: void 0,
    repairParameters: void 0
  });
  markFailedTarget(evidence, selectors, options.failedAction);
  trimToBudget(evidence, selectors, maxEvidenceBytes);
  return { evidence, selectors };
}
function markFailedTarget(evidence, selectors, failedAction) {
  if (!failedAction) return;
  if (failedAction.repairParameters) evidence.repairParameters = { ...failedAction.repairParameters };
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
  const droppable = ["selectedText", "title", "navigation", "loading", "elementTotal", "dialogs", "blockedBy", "frame", "repairParameters"];
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
  "out_of_scope",
  "no_progress",
  "target_unobserved",
  "target_unsafe",
  "sensitive_value",
  "no_repeating_structure"
];

// src/runtime/llm-evidence/vocabulary.ts
var WEB_LLM_EVIDENCE_TOOL_IDS = ["web.inspect_current_page", "web.navigate_same_origin", "web.reveal_safe", "web.detect_repeating_structure"];
var WEB_LLM_INSPECT_TOOL_ID = WEB_LLM_EVIDENCE_TOOL_IDS[0];
var WEB_LLM_NAVIGATE_TOOL_ID = WEB_LLM_EVIDENCE_TOOL_IDS[1];
var WEB_LLM_REVEAL_TOOL_ID = WEB_LLM_EVIDENCE_TOOL_IDS[2];
var WEB_LLM_DETECT_STRUCTURE_TOOL_ID = WEB_LLM_EVIDENCE_TOOL_IDS[3];
var WEB_LLM_INSPECT_RESULT_CODE = "web.inspect.succeeded";
var WEB_LLM_ACTION_RESULT_CODE = "web.action.succeeded";
var WEB_LLM_STRUCTURE_RESULT_CODE = "web.structure.detected";
var REJECTION_RESULT_CODE_PREFIX = "web.action.rejected.";
function webLlmToolRejectionResultCode(code) {
  return `${REJECTION_RESULT_CODE_PREFIX}${code}`;
}
var WEB_LLM_EVIDENCE_RESULT_CODES = Object.freeze([
  WEB_LLM_INSPECT_RESULT_CODE,
  WEB_LLM_ACTION_RESULT_CODE,
  WEB_LLM_STRUCTURE_RESULT_CODE,
  ...WEB_LLM_TOOL_REJECTION_CODES.map(webLlmToolRejectionResultCode)
]);

// src/runtime/llm-evidence/harness-options/vocabulary.ts
var WEB_RECOVERY_HARNESS_OPTION_IDS = [
  "web.recovery.inspect",
  "web.recovery.reveal",
  "web.recovery.act_safe",
  "web.recovery.wait_for_change",
  "web.recovery.navigate_in_scope"
];
var WEB_RECOVERY_INSPECT_OPTION_ID = WEB_RECOVERY_HARNESS_OPTION_IDS[0];
var WEB_RECOVERY_REVEAL_OPTION_ID = WEB_RECOVERY_HARNESS_OPTION_IDS[1];
var WEB_RECOVERY_ACT_OPTION_ID = WEB_RECOVERY_HARNESS_OPTION_IDS[2];
var WEB_RECOVERY_WAIT_OPTION_ID = WEB_RECOVERY_HARNESS_OPTION_IDS[3];
var WEB_RECOVERY_NAVIGATE_OPTION_ID = WEB_RECOVERY_HARNESS_OPTION_IDS[4];

// src/runtime/llm-evidence/harness-options/execute.ts
var WEB_RECOVERY_WAIT_BOUNDS = Object.freeze({ minMs: 100, maxMs: 5e3, defaultMs: 1e3 });

// src/actions/extraction/field-key.ts
var FIELD_KEY_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;
var RESERVED_FIELD_KEYS = /* @__PURE__ */ new Set(["__proto__", "constructor", "prototype"]);
function isWebAutomationExtractFieldKey(key) {
  return typeof key === "string" && FIELD_KEY_PATTERN.test(key) && !RESERVED_FIELD_KEYS.has(key);
}

// src/output-nodes/targets/targets.ts
function elementFingerprint(value) {
  const element = objectValue(value);
  if (!element) return void 0;
  const attributes = elementAttributes(element.attributes);
  return compact({
    selector: stringValue(element.selector),
    xpath: stringValue(element.xpath),
    id: stringValue(element.id),
    classNames: Array.isArray(element.classNames) ? element.classNames.filter((item) => typeof item === "string") : void 0,
    visibleText: stringValue(element.visibleText),
    tagName: stringValue(element.tagName),
    text: stringValue(element.text),
    value: stringValue(element.value),
    role: stringValue(element.role),
    implicitRole: stringValue(element.implicitRole),
    name: stringValue(element.name),
    href: stringValue(element.href),
    inputType: stringValue(element.inputType),
    checked: booleanValue(element.checked),
    testId: elementTestId(element, attributes),
    accessibleName: stringValue(element.accessibleName) ?? stringValue(attributes?.["aria-label"]),
    label: stringValue(element.label),
    attributes,
    context: elementContext(element.context),
    // Core's remaining fingerprint signals, named so their absence is a
    // decision and so a signal Core adds stops this producer compiling. A
    // browser recording has no source for any of them: the first four are a
    // host application's own identifiers and a Core state path, `url` names
    // the page rather than the control, `bounds` are the capture's viewport
    // and not this instant's (which is why `content/identity/score.ts` refuses
    // to compare them), and `metadata` is Core's own passthrough slot, which
    // this normalizer must not start writing into behind the declared fields.
    automationId: void 0,
    entityId: void 0,
    entityKind: void 0,
    statePath: void 0,
    queryPath: void 0,
    url: void 0,
    bounds: void 0,
    metadata: void 0
  });
}
function elementContext(value) {
  const context = objectValue(value);
  if (!context) return void 0;
  const fields = compact({
    formId: stringValue(context.formId),
    formName: stringValue(context.formName),
    formAction: stringValue(context.formAction),
    fieldsetLegend: stringValue(context.fieldsetLegend),
    landmark: stringValue(context.landmark),
    landmarkName: stringValue(context.landmarkName),
    heading: stringValue(context.heading),
    listPosition: listPosition(context.listPosition),
    tablePosition: tablePosition(context.tablePosition)
  });
  return Object.keys(fields).length > 0 ? fields : void 0;
}
function listPosition(value) {
  const position = objectValue(value);
  const index = numberValue(position?.index);
  const total = numberValue(position?.total);
  return index === void 0 || total === void 0 ? void 0 : { index, total };
}
function tablePosition(value) {
  const position = objectValue(value);
  const row = numberValue(position?.row);
  const column = numberValue(position?.column);
  if (row === void 0 || column === void 0) return void 0;
  const columnHeader = stringValue(position?.columnHeader);
  return columnHeader === void 0 ? { row, column } : { row, column, columnHeader };
}
function elementAttributes(value) {
  const attributes = objectValue(value);
  if (!attributes) return void 0;
  const strings = {};
  for (const [name, item] of Object.entries(attributes)) {
    if (typeof item === "string") strings[name] = item;
  }
  return strings;
}
function elementTestId(element, attributes) {
  return stringValue(element.testId) ?? stringValue(attributes?.["data-testid"]) ?? stringValue(attributes?.["data-test"]) ?? stringValue(attributes?.["data-cy"]);
}
function compact(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== void 0));
}
function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
function stringValue(value) {
  return typeof value === "string" ? value : void 0;
}
function numberValue(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : void 0;
}
function booleanValue(value) {
  return typeof value === "boolean" ? value : void 0;
}

// src/actions/extraction/request.ts
var WEB_AUTOMATION_EXTRACT_PAGINATION_MODES = ["next", "loadMore", "scroll", "numbered"];
var WEB_AUTOMATION_EXTRACT_FIELD_KINDS = ["text", "attribute", "link", "value", "column"];
var WEB_AUTOMATION_EXTRACT_FIELD_HANDLINGS = ["include", "exclude", "encrypt"];
var WEB_AUTOMATION_EXTRACT_READ_MODES = ["text", "attribute", "value", "html"];
var WEB_AUTOMATION_EXTRACT_MAX_PAGES = 50;
var WEB_AUTOMATION_EXTRACT_MAX_ITEMS = 1e3;
var WEB_AUTOMATION_EXTRACT_PAGE_TIMEOUT_MS = 1e4;

// src/actions/extraction/read-request.ts
function webAutomationExtractListRequestValue(value) {
  const request = jsonObject(value);
  const item = nonEmptyString(request?.item);
  const fields = fieldMapValue(request?.fields);
  if (!request || item === void 0 || fields === void 0) return void 0;
  if (FRAME_KEYS.some((key) => request[key] !== void 0)) return void 0;
  const itemElement = optionalValue(request.itemElement, fingerprintValue);
  if (itemElement === REFUSED) return void 0;
  const paginate = request.paginate === void 0 ? void 0 : paginationValue(request.paginate);
  if (request.paginate !== void 0 && paginate === void 0) return void 0;
  const namedMaxItems = positiveInteger(request.maxItems);
  const maxItems = namedMaxItems === void 0 ? void 0 : Math.min(namedMaxItems, WEB_AUTOMATION_EXTRACT_MAX_ITEMS);
  const minItems = nonNegativeInteger(request.minItems);
  if (request.minItems !== void 0 && minItems === void 0) return void 0;
  if (minItems !== void 0 && minItems > (maxItems ?? WEB_AUTOMATION_EXTRACT_MAX_ITEMS)) return void 0;
  return {
    item,
    ...itemElement !== void 0 ? { itemElement } : {},
    fields,
    ...paginate !== void 0 ? { paginate } : {},
    ...maxItems !== void 0 ? { maxItems } : {},
    ...minItems !== void 0 ? { minItems } : {}
  };
}
function fieldMapValue(value) {
  const fields = jsonObject(value);
  if (!fields) return void 0;
  const read = [];
  for (const [key, entry] of Object.entries(fields)) {
    const field = isWebAutomationExtractFieldKey(key) ? fieldValue(entry) : void 0;
    if (field === void 0) return void 0;
    read.push([key, field]);
  }
  if (read.length === 0 || read.every(([, field]) => typeof field !== "string" && field.handling === "exclude")) return void 0;
  return Object.fromEntries(read);
}
function fieldValue(value) {
  if (typeof value === "string") return value.length > 0 ? value : void 0;
  const spec = jsonObject(value);
  const kind = memberOf(spec?.kind, WEB_AUTOMATION_EXTRACT_FIELD_KINDS);
  if (!spec || kind === void 0) return void 0;
  const attribute = kind === "attribute" ? nonEmptyString(spec.attribute) : void 0;
  const header = kind === "column" ? nonEmptyString(spec.header) : void 0;
  if (kind === "attribute" ? attribute === void 0 : spec.attribute !== void 0) return void 0;
  if (kind === "column" ? header === void 0 : spec.header !== void 0) return void 0;
  const selector = optionalValue(spec.selector, nonEmptyString);
  const required = optionalValue(spec.required, booleanValue2);
  const handling = optionalValue(spec.handling, (entry) => memberOf(entry, WEB_AUTOMATION_EXTRACT_FIELD_HANDLINGS));
  const element = optionalValue(spec.element, fingerprintValue);
  if (selector === REFUSED || required === REFUSED || handling === REFUSED || element === REFUSED) return void 0;
  const field = {
    kind,
    ...selector !== void 0 ? { selector } : {},
    ...attribute !== void 0 ? { attribute } : {},
    ...header !== void 0 ? { header } : {},
    ...required !== void 0 ? { required } : {},
    ...handling !== void 0 ? { handling } : {},
    ...element !== void 0 ? { element } : {}
  };
  return field;
}
function paginationValue(value) {
  const paginate = jsonObject(value);
  if (!paginate) return void 0;
  const mode = paginate.mode === void 0 ? "next" : memberOf(paginate.mode, WEB_AUTOMATION_EXTRACT_PAGINATION_MODES);
  if (mode === void 0) return void 0;
  const ownKeys = PAGINATION_KEYS[mode];
  if (Object.values(PAGINATION_KEYS).flat().some((key) => !ownKeys.includes(key) && paginate[key] !== void 0)) return void 0;
  if (mode === "scroll") {
    const maxScrolls = positiveInteger(paginate.maxScrolls);
    return maxScrolls === void 0 ? void 0 : { mode, maxScrolls: Math.min(maxScrolls, WEB_AUTOMATION_EXTRACT_MAX_PAGES) };
  }
  const requestedPages = positiveInteger(paginate.maxPages);
  if (requestedPages === void 0) return void 0;
  const maxPages = Math.min(requestedPages, WEB_AUTOMATION_EXTRACT_MAX_PAGES);
  if (mode === "next") {
    const next = nonEmptyString(paginate.next);
    return next === void 0 ? void 0 : { next, maxPages };
  }
  if (mode === "loadMore") {
    const control = nonEmptyString(paginate.control);
    return control === void 0 ? void 0 : { mode, control, maxPages };
  }
  const pages = nonEmptyString(paginate.pages);
  return pages === void 0 ? void 0 : { mode, pages, maxPages };
}
var FRAME_KEYS = ["frame", "frameId", "frameSelector", "frameUrlPath"];
var PAGINATION_KEYS = {
  next: ["next", "maxPages"],
  loadMore: ["control", "maxPages"],
  scroll: ["maxScrolls"],
  numbered: ["pages", "maxPages"]
};
function fingerprintValue(value) {
  const fingerprint = elementFingerprint(value);
  return fingerprint !== void 0 && Object.keys(fingerprint).length > 0 ? fingerprint : void 0;
}
var REFUSED = Symbol("refused");
function optionalValue(value, read) {
  if (value === void 0) return void 0;
  const readable2 = read(value);
  return readable2 === void 0 ? REFUSED : readable2;
}
function booleanValue2(value) {
  return typeof value === "boolean" ? value : void 0;
}
function nonNegativeInteger(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : void 0;
}
function positiveInteger(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : void 0;
}
function nonEmptyString(value) {
  return typeof value === "string" && value.length > 0 ? value : void 0;
}
function memberOf(value, members) {
  return typeof value === "string" && members.includes(value) ? value : void 0;
}
function jsonObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}

// src/actions/extraction/schema.ts
function webAutomationExtractListSchema(elementFingerprintSchema2) {
  const pageBound = { type: "integer", minimum: 1, maximum: WEB_AUTOMATION_EXTRACT_MAX_PAGES };
  const fieldSpecSchema = {
    type: "object",
    label: "Field",
    required: ["kind"],
    properties: {
      kind: { type: "string", label: "Reads", enum: [...WEB_AUTOMATION_EXTRACT_FIELD_KINDS] },
      selector: { type: "string", label: "Selector inside the item" },
      attribute: { type: "string", label: "Attribute" },
      header: { type: "string", label: "Column header" },
      required: { type: "boolean", label: "Required" },
      // `encrypt` is reserved (D13) and refused at dispatch until it is built.
      handling: { type: "string", label: "Column", enum: [...WEB_AUTOMATION_EXTRACT_FIELD_HANDLINGS] },
      element: elementFingerprintSchema2
    }
  };
  return {
    type: "object",
    label: "List extraction",
    required: ["item", "fields"],
    properties: {
      item: { type: "string", label: "Item selector" },
      itemElement: elementFingerprintSchema2,
      fields: {
        type: "object",
        label: "Field map",
        description: "Each field key maps to a selector string (`selector`, `selector@attribute`, `column:<header>`) or a field spec.",
        metadata: { fieldSpec: fieldSpecSchema }
      },
      // No member is required of every mode, so nothing is required here: the
      // lift refuses a mode missing its own bound or naming another mode's key.
      paginate: {
        type: "object",
        label: "Pagination",
        properties: {
          mode: { type: "string", label: "Mode", enum: [...WEB_AUTOMATION_EXTRACT_PAGINATION_MODES] },
          next: { type: "string", label: "Next control" },
          control: { type: "string", label: "Load-more control" },
          pages: { type: "string", label: "Page controls" },
          maxPages: { ...pageBound, label: "Maximum pages" },
          maxScrolls: { ...pageBound, label: "Maximum scrolls" }
        }
      },
      maxItems: { type: "integer", label: "Maximum items", minimum: 1, maximum: WEB_AUTOMATION_EXTRACT_MAX_ITEMS },
      // Default 1 where absent, so an empty list fails unless the Flow says empty
      // is an answer; above the item bound no page could satisfy it.
      minItems: { type: "integer", label: "Minimum items", minimum: 0, maximum: WEB_AUTOMATION_EXTRACT_MAX_ITEMS }
    }
  };
}

// src/actions/types.ts
var WEB_AUTOMATION_ACTION_TYPES = [
  "web.browser.navigate",
  "web.dom.click",
  "web.dom.type",
  "web.dom.clear",
  "web.dom.select",
  "web.dom.scroll",
  "web.dom.keypress",
  "web.dom.wait_for_selector",
  "web.dom.wait_for_text",
  "web.dom.extract",
  "web.dom.capture_snapshot",
  "web.dom.check",
  "web.dom.assert",
  "web.dom.extract_list",
  "web.dom.upload",
  "web.dom.dialog",
  "web.browser.tab",
  "web.browser.download"
];

// src/actions/safety.ts
var WEB_AUTOMATION_ACTION_SAFETY = {
  "web.browser.navigate": "review",
  "web.dom.click": "review",
  "web.dom.type": "review",
  "web.dom.clear": "review",
  "web.dom.select": "review",
  "web.dom.scroll": "review",
  "web.dom.keypress": "review",
  "web.dom.wait_for_selector": "safe",
  "web.dom.wait_for_text": "safe",
  "web.dom.extract": "safe",
  "web.dom.capture_snapshot": "safe",
  // Added in Week 1 (decision D6). An assertion and a list extraction only read
  // the page, so they are safe; check, upload, and dialog change it, and a tab
  // or download acts on the browser, so all five need approval.
  "web.dom.check": "review",
  "web.dom.assert": "safe",
  "web.dom.extract_list": "safe",
  "web.dom.upload": "review",
  "web.dom.dialog": "review",
  "web.browser.tab": "review",
  "web.browser.download": "review"
};

// src/actions/schemas.ts
var elementFingerprintSchema = {
  type: "object",
  label: "Element fingerprint",
  properties: {
    selector: { type: "string", label: "CSS selector" },
    xpath: { type: "string", label: "XPath" },
    id: { type: "string", label: "ID" },
    classNames: { type: "array", label: "Class names" },
    visibleText: { type: "string", label: "Visible text" },
    tagName: { type: "string", label: "Tag name" },
    role: { type: "string", label: "ARIA role" },
    name: { type: "string", label: "Accessible name" },
    href: { type: "string", label: "Link URL" },
    attributes: { type: "object", label: "Attributes" },
    testId: { type: "string", label: "Test id" },
    accessibleName: { type: "string", label: "Accessible name" },
    label: { type: "string", label: "Label" }
  }
};
var visualTargetSchema = {
  type: "object",
  label: "Visual target",
  properties: {
    namespace: { type: "string", label: "State namespace" },
    statePath: { type: "string", label: "State path" },
    selector: { type: "string", label: "CSS selector" },
    frameId: { type: "string", label: "Visual frame" },
    layerId: { type: "string", label: "Visual layer" },
    documentLayerId: { type: "string", label: "Document visual layer" },
    bounds: { type: "object", label: "Viewport bounds" },
    documentBounds: { type: "object", label: "Document bounds" },
    anchor: { type: "object", label: "Anchor" },
    confidence: { type: "number", label: "Confidence" },
    metadata: { type: "object", label: "Metadata" }
  }
};
var elementProperties = { selector: { type: "string", label: "CSS selector" }, element: elementFingerprintSchema, visualTarget: visualTargetSchema };
var selectorSchema = {
  type: "object",
  required: ["selector"],
  properties: {
    ...elementProperties,
    timeoutMs: { type: "integer", label: "Timeout in ms" }
  }
};
var waitSchema = {
  type: "object",
  label: "Wait condition",
  properties: {
    condition: { type: "string", label: "Condition", enum: ["present", "visible", "enabled", "absent", "url", "stable"] },
    url: { type: "string", label: "URL" },
    stableForMs: { type: "integer", label: "Stable for, in ms" }
  }
};
var keyModifiersSchema = {
  type: "object",
  label: "Modifier keys",
  properties: {
    alt: { type: "boolean", label: "Alt" },
    ctrl: { type: "boolean", label: "Control" },
    meta: { type: "boolean", label: "Meta" },
    shift: { type: "boolean", label: "Shift" }
  }
};
var optionSelectorSchema = {
  type: "object",
  label: "Option",
  required: ["by"],
  properties: {
    by: { type: "string", label: "Match by", enum: ["value", "label", "index"] },
    value: { type: "string", label: "Option value" },
    label: { type: "string", label: "Option label" },
    index: { type: "integer", label: "Option index" }
  }
};
var scrollRequestSchema = {
  type: "object",
  label: "Scroll",
  required: ["mode"],
  properties: {
    mode: { type: "string", label: "Mode", enum: ["by", "toElement", "untilStable"] },
    x: { type: "number", label: "X delta" },
    y: { type: "number", label: "Y delta" },
    maxScrolls: { type: "integer", label: "Maximum scrolls" }
  }
};
var waitForSelectorSchema = {
  type: "object",
  required: ["selector"],
  properties: {
    ...elementProperties,
    timeoutMs: { type: "integer", label: "Timeout in ms" },
    wait: waitSchema
  }
};
var assertSchema = {
  type: "object",
  label: "Assertion",
  required: ["kind"],
  properties: {
    kind: { type: "string", label: "Condition", enum: ["exists", "absent", "text", "url", "visible", "enabled"] },
    expected: { type: "string", label: "Expected" },
    timeoutMs: { type: "integer", label: "Timeout in ms" }
  }
};
var extractListSchema = webAutomationExtractListSchema(elementFingerprintSchema);
var extractReadSchema = {
  type: "object",
  label: "Read",
  required: ["mode"],
  properties: {
    mode: { type: "string", label: "Reads", enum: [...WEB_AUTOMATION_EXTRACT_READ_MODES] },
    attribute: { type: "string", label: "Attribute" }
  }
};
var uploadSchema = {
  type: "object",
  label: "Files",
  required: ["files"],
  properties: {
    files: {
      type: "array",
      label: "Files",
      minItems: 1,
      items: {
        type: "object",
        required: ["name", "mimeType", "contentBase64"],
        properties: {
          name: { type: "string", label: "File name" },
          mimeType: { type: "string", label: "MIME type" },
          contentBase64: { type: "string", label: "Base64 content" }
        }
      }
    }
  }
};
var dialogSchema = {
  type: "object",
  label: "Dialog",
  required: ["response"],
  properties: {
    response: { type: "string", label: "Response", enum: ["accept", "dismiss"] },
    promptText: { type: "string", label: "Prompt text" }
  }
};
var tabSchema = {
  type: "object",
  label: "Tab",
  required: ["operation"],
  properties: {
    operation: { type: "string", label: "Operation", enum: ["open", "switch", "close"] },
    url: { type: "string", label: "URL" },
    active: { type: "boolean", label: "Activate" },
    tabId: { type: "integer", label: "Tab id" },
    urlPattern: { type: "string", label: "URL contains" },
    urlPath: { type: "string", label: "URL path" }
  }
};
var downloadSchema = {
  type: "object",
  label: "Download",
  properties: {
    filename: { type: "string", label: "File name" },
    timeoutMs: { type: "integer", label: "Timeout in ms" }
  }
};
var webAutomationActionDefinitions = [
  {
    actionType: "web.browser.navigate",
    label: "Navigate",
    description: "Navigate a browser tab to a URL.",
    parameterSchema: {
      type: "object",
      required: ["url"],
      properties: { url: { type: "string", label: "URL" }, newTab: { type: "boolean", label: "Open in a new tab" } }
    }
  },
  { actionType: "web.dom.click", label: "Click", description: "Click a DOM element.", parameterSchema: selectorSchema },
  {
    actionType: "web.dom.type",
    label: "Type Text",
    description: "Enter text into an editable DOM element.",
    // `text` is required. It was not, and that is why a recorded password step
    // replayed as a field typed empty: `payloads.ts` filled `text` with `""`
    // when the recorder had withheld the value, `hasExecutableParameters`
    // (`io/input-model.ts`) checks only the parameters this list names, so the
    // node validated, survived, ran, and reported success having typed
    // nothing. An entry the user emptied is `web.dom.clear`, never this, so a
    // type action with no text is always a value that went missing.
    //
    // A withheld value is supplied at run time instead of carried: `text` may
    // therefore also be the secret request `output-nodes/secret-binding.ts`
    // builds, which names the run input the value arrives in and never a value.
    parameterSchema: { type: "object", required: ["selector", "text"], properties: { ...elementProperties, text: { type: "string", label: "Text, or the secret request it is supplied through" }, value: { type: "string" } } }
  },
  { actionType: "web.dom.clear", label: "Clear Field", description: "Clear an editable DOM element.", parameterSchema: selectorSchema },
  {
    actionType: "web.dom.select",
    label: "Select Option",
    description: "Choose an option of a select element by value, label, or index.",
    parameterSchema: {
      type: "object",
      required: ["selector"],
      properties: { ...elementProperties, value: { type: "string" }, option: optionSelectorSchema, timeoutMs: { type: "integer", label: "Timeout in ms" } }
    }
  },
  {
    actionType: "web.dom.scroll",
    label: "Scroll",
    description: "Scroll by a delta, to an element, or until the page stops growing.",
    parameterSchema: {
      type: "object",
      properties: { ...elementProperties, x: { type: "number" }, y: { type: "number" }, smooth: { type: "boolean" }, scroll: scrollRequestSchema }
    }
  },
  {
    actionType: "web.dom.keypress",
    label: "Key Press",
    description: "Dispatch a keyboard event, with modifier keys.",
    parameterSchema: { type: "object", properties: { ...elementProperties, key: { type: "string" }, text: { type: "string" }, modifiers: keyModifiersSchema } }
  },
  {
    actionType: "web.dom.wait_for_selector",
    label: "Wait For Selector",
    description: "Wait until an element is present, visible, enabled, or absent.",
    parameterSchema: waitForSelectorSchema
  },
  {
    actionType: "web.dom.wait_for_text",
    label: "Wait For Text",
    description: "Wait until page text appears or the page settles.",
    parameterSchema: { type: "object", required: ["text"], properties: { text: { type: "string" }, timeoutMs: { type: "integer" }, wait: waitSchema } }
  },
  {
    actionType: "web.dom.extract",
    label: "Extract",
    description: "Extract text, value, or attributes from an element.",
    // `selector` stays required, so this keeps declaring an element target. The
    // structured `extract` says which value to read; the legacy `options.mode`
    // beside it still works for a Flow that authored one.
    parameterSchema: {
      type: "object",
      required: ["selector"],
      properties: { ...elementProperties, timeoutMs: { type: "integer", label: "Timeout in ms" }, extract: extractReadSchema }
    }
  },
  {
    actionType: "web.dom.capture_snapshot",
    label: "Capture Snapshot",
    description: "Capture a structured DOM snapshot.",
    parameterSchema: { type: "object", properties: {} }
  },
  // The seven actions added in Week 1 (decision D6). Each parameter is named
  // and shaped as the field of `WebAutomationActionCommand` it becomes, so a
  // Flow's parameters reach the verb that runs them without being reshaped.
  {
    actionType: "web.dom.check",
    label: "Set Checked",
    description: "Set a checkbox or radio to a checked state.",
    parameterSchema: {
      type: "object",
      required: ["selector"],
      properties: { ...elementProperties, checked: { type: "boolean", label: "Checked" }, timeoutMs: { type: "integer", label: "Timeout in ms" } }
    }
  },
  {
    actionType: "web.dom.assert",
    label: "Assert",
    description: "Verify a condition about the page and fail when it does not hold.",
    parameterSchema: { type: "object", required: ["assert"], properties: { ...elementProperties, assert: assertSchema } }
  },
  {
    actionType: "web.dom.extract_list",
    label: "Extract List",
    description: "Extract a field map from every item of a repeating structure, following pagination.",
    parameterSchema: { type: "object", required: ["extractList"], properties: { extractList: extractListSchema } }
  },
  {
    actionType: "web.dom.upload",
    label: "Upload Files",
    description: "Set the files of a file input.",
    parameterSchema: { type: "object", required: ["selector", "upload"], properties: { ...elementProperties, upload: uploadSchema } }
  },
  {
    actionType: "web.dom.dialog",
    label: "Answer Dialog",
    description: "Arm the answer to the next native alert, confirm, or prompt.",
    parameterSchema: { type: "object", required: ["dialog"], properties: { dialog: dialogSchema } }
  },
  {
    actionType: "web.browser.tab",
    label: "Browser Tab",
    description: "Open, switch to, or close a browser tab.",
    parameterSchema: { type: "object", required: ["tab"], properties: { tab: tabSchema } }
  },
  {
    actionType: "web.browser.download",
    label: "Await Download",
    description: "Wait for a browser download to complete.",
    parameterSchema: { type: "object", properties: { download: downloadSchema } }
  }
];

// src/output-nodes/extract-list/catalog-text.ts
var WEB_AUTOMATION_EXTRACT_LIST_TAGS = [
  "scrape",
  "collect",
  "extract",
  "list",
  "table",
  "rows",
  "records",
  "dataset",
  "every page",
  "next page",
  "load more",
  "infinite scroll",
  "pagination"
];
var WEB_AUTOMATION_EXTRACT_LIST_DESCRIPTION = [
  "Scrape every item of a repeating list or table into a dataset, across pages.",
  "Detect the list with web.detect_repeating_structure; name it in extractList by its handle.",
  "It saves its rows itself: no recordOutput or save node needed."
].join(" ");
var WEB_AUTOMATION_EXTRACT_LIST_GRAMMAR = [
  `Detected: {handle: "extraction.N", fields?: {key: "detectedKey" | "detectedKey@href"}, paginate?: false (this page only)};`,
  "fields: only those columns, renamed; a link column reads the absolute URL, @href the raw href.",
  `Else {item: css, fields: {key: "css" | "css@attr" | "column:Header" | {kind: ${WEB_AUTOMATION_EXTRACT_FIELD_KINDS.join("|")}, selector?, attribute?, header?, required?: false}},`,
  `paginate?: {mode: "next", next: css, maxPages} ("loadMore": control, "numbered": pages) | {mode: "scroll", maxScrolls}, max ${WEB_AUTOMATION_EXTRACT_MAX_PAGES}}.`,
  `Keys A-Za-z0-9_-. Both take minItems (default 1; 0 allows none), maxItems (max ${WEB_AUTOMATION_EXTRACT_MAX_ITEMS}).`
].join(" ");
var WEB_AUTOMATION_EXTRACT_LIST_EXAMPLE = {
  item: "li.product",
  fields: { name: ".name", price: ".price", url: "a@href" },
  paginate: { mode: "next", next: "a.next", maxPages: 5 }
};

// src/extraction/dataset-id.ts
var COMBINING_MARKS = new RegExp("\\p{M}+", "gu");

// src/extraction/label-key.ts
var COMBINING_MARKS2 = new RegExp("\\p{M}+", "gu");

// src/output-nodes/extract-list/records-path.ts
var WEB_AUTOMATION_EXTRACT_LIST_RECORDS_PATH = "result.extracted";

// src/output-nodes/extract-list/dispatch.ts
import { parseAutomationStudioRecordOutput } from "fluxiq/automation-studio/nodes";

// src/output-nodes/extract-list/issues.ts
var PROBE_REQUEST = { item: "*", fields: { probe: "*" } };
function webAutomationExtractListIssues(value) {
  if (!isPlainObject(value)) return ["web.extract_list.not_object"];
  const keys = declaredKeys();
  const issues = /* @__PURE__ */ new Set();
  if (Object.keys(value).some((key) => !keys.request.has(key))) issues.add("web.extract_list.unknown_key");
  if (!readable({ item: value.item ?? null })) issues.add("web.extract_list.invalid_item");
  if (value.itemElement !== void 0 && !readable({ itemElement: value.itemElement })) issues.add("web.extract_list.invalid_item_element");
  addFieldIssues(value.fields, keys.fieldSpec, issues);
  addPaginateIssues(value.paginate, keys.paginate, issues);
  addItemBoundIssues(value, issues);
  if (issues.size === 0 && webAutomationExtractListRequestValue(value) === void 0) issues.add("web.extract_list.unreadable");
  return [...issues];
}
function addFieldIssues(fields, specKeys, issues) {
  if (!isPlainObject(fields)) {
    issues.add("web.extract_list.invalid_fields");
    return;
  }
  const entries = Object.entries(fields);
  if (entries.length === 0) {
    issues.add("web.extract_list.no_fields");
    return;
  }
  let fieldRefused = false;
  for (const [key, field] of entries) {
    if (isPlainObject(field) && Object.keys(field).some((specKey) => !specKeys.has(specKey))) issues.add("web.extract_list.unknown_field_key");
    if (!isWebAutomationExtractFieldKey(key)) {
      issues.add("web.extract_list.invalid_field_key");
      fieldRefused = true;
    } else if (!readable({ fields: { [key]: field, [key === "probe" ? "probe_2" : "probe"]: "*" } })) {
      issues.add("web.extract_list.invalid_field");
      fieldRefused = true;
    }
  }
  if (!fieldRefused && !readable({ fields })) issues.add("web.extract_list.all_fields_excluded");
}
function addPaginateIssues(paginate, paginateKeys, issues) {
  if (paginate === void 0) return;
  if (isPlainObject(paginate) && Object.keys(paginate).some((key) => !paginateKeys.has(key))) issues.add("web.extract_list.unknown_paginate_key");
  if (!readable({ paginate })) issues.add("web.extract_list.invalid_paginate");
}
function addItemBoundIssues(value, issues) {
  const { maxItems, minItems } = value;
  const maxItemsReadable = maxItems === void 0 || isPositiveInteger(maxItems);
  if (!maxItemsReadable) issues.add("web.extract_list.invalid_max_items");
  if (minItems === void 0) return;
  if (!isNonNegativeInteger(minItems)) {
    issues.add("web.extract_list.invalid_min_items");
    return;
  }
  if (!readable(maxItemsReadable && maxItems !== void 0 ? { minItems, maxItems } : { minItems })) issues.add("web.extract_list.min_items_exceed_max");
}
function readable(overrides) {
  return webAutomationExtractListRequestValue({ ...PROBE_REQUEST, ...overrides }) !== void 0;
}
var declared;
function declaredKeys() {
  if (declared) return declared;
  const schema = webAutomationExtractListSchema({});
  const properties = child(schema, "properties");
  declared = {
    request: propertyNames(schema),
    paginate: propertyNames(child(properties, "paginate")),
    fieldSpec: propertyNames(child(child(child(properties, "fields"), "metadata"), "fieldSpec"))
  };
  return declared;
}
function propertyNames(schema) {
  return new Set(Object.keys(child(schema, "properties") ?? {}));
}
function child(value, key) {
  const next = value?.[key];
  return isPlainObject(next) ? next : void 0;
}
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isPositiveInteger(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
function isNonNegativeInteger(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

// src/output-nodes/extract-list/parameter-contract.ts
function webAutomationExtractListParameterContract(input) {
  return input.parameterId === "extractList" ? webAutomationExtractListIssues(input.value) : [];
}

// src/output-nodes/extract-list/parameters.ts
function webAutomationExtractListParameters() {
  return [
    {
      id: "extractList",
      label: "List",
      description: WEB_AUTOMATION_EXTRACT_LIST_GRAMMAR,
      valueType: "object",
      example: structuredClone(WEB_AUTOMATION_EXTRACT_LIST_EXAMPLE),
      ui: { control: "value" }
    },
    {
      id: "timeoutMs",
      label: "Timeout",
      description: "Milliseconds for the whole read. Left at the default, it grows with the pages the list may read.",
      valueType: "number",
      defaultValue: WEB_AUTOMATION_EXTRACT_PAGE_TIMEOUT_MS
    },
    {
      id: "recordOutput",
      label: "Save extracted records",
      description: "The dataset the rows are saved into. Leave empty to save every field of the list under a dataset named after its fields.",
      valueType: "json",
      defaultValue: null,
      allowStateBinding: false,
      ui: { control: "record-output" }
    }
  ];
}

// src/output-nodes/definitions.ts
var controlInput = { id: "in", label: "In", valueType: "signal", role: "control" };
var outputPorts = [
  { id: "success", label: "Success", valueType: "any", role: "success" },
  { id: "failed", label: "Failed", valueType: "any", role: "failure" }
];
var recordsPort = { id: "records", label: "Records", valueType: "array", role: "data" };
var recordsPathByOutput = {
  "web.dom.extract_list": WEB_AUTOMATION_EXTRACT_LIST_RECORDS_PATH
};
var catalogTextByOutput = {
  "web.dom.extract_list": { description: WEB_AUTOMATION_EXTRACT_LIST_DESCRIPTION, tags: WEB_AUTOMATION_EXTRACT_LIST_TAGS }
};
var VERIFIES_STATE_METADATA_KEY = "verifiesState";
var stateVerifyingOutputs = /* @__PURE__ */ new Set([
  "web.dom.assert",
  "web.dom.wait_for_text",
  "web.dom.wait_for_selector"
]);
var expectedStateParameter = {
  id: "expectedState",
  label: "Expected State",
  description: "Post-conditions checked after this action, as web.dom.assert conditions: { conditions: [{ kind, selector, expected }], mode, timeoutMs }.",
  valueType: "object",
  ui: { control: "value" }
};
function webAutomationOutputNodeId(outputId) {
  return `web.output.${outputId.replace(/^web\./, "").replace(/\./g, "-")}`;
}
var webAutomationOutputNodeDefinitions = webAutomationActionDefinitions.map(
  (definition) => createWebAutomationOutputNodeDefinition(definition)
);
function createWebAutomationOutputNodeDefinition(definition) {
  const safeOutput = WEB_AUTOMATION_ACTION_SAFETY[definition.actionType] === "safe";
  const requiredParameters = new Set(
    Array.isArray(definition.parameterSchema.required) ? definition.parameterSchema.required.filter((value) => typeof value === "string") : []
  );
  const recordsPath = recordsPathByOutput[definition.actionType];
  const catalogText = catalogTextByOutput[definition.actionType];
  return {
    schemaVersion: "0.1",
    id: webAutomationOutputNodeId(definition.actionType),
    version: "1.0.0",
    label: definition.label,
    description: catalogText?.description ?? definition.description,
    category: "web",
    source: {
      kind: "importer",
      domainId: WEB_AUTOMATION_DOMAIN_ID,
      packageId: "@fluxiq-web-extension/domain",
      implementationKey: definition.actionType
    },
    availability: { kind: "domain", domainId: WEB_AUTOMATION_DOMAIN_ID },
    capabilities: { executable: true, stateAware: true, recordable: true },
    requiredRuntimeCapabilities: ["web.actions"],
    safety: {
      privileged: !safeOutput,
      requiresOperatorApproval: !safeOutput,
      requiredPermissions: ["web-automation.action"]
    },
    outputAction: { fixedOutputId: definition.actionType },
    inputs: [controlInput],
    outputs: recordsPath ? [...outputPorts, recordsPort] : outputPorts,
    // Every web parameter may be filled from state unless it says otherwise.
    // Only `recordOutput` does, for the reason Core gives its own: a binding
    // could replace the dataset schema, and with it the excluded fields.
    parameters: [...parametersForOutput(definition.actionType), expectedStateParameter].map((parameter) => ({
      ...parameter,
      ...requiredParameters.has(parameter.id) ? { required: true } : {},
      allowStateBinding: parameter.allowStateBinding ?? true
    })),
    icon: iconForOutput(definition.actionType),
    tags: ["web-automation", "output", ...catalogText?.tags ?? []],
    metadata: {
      domainId: WEB_AUTOMATION_DOMAIN_ID,
      outputId: definition.actionType,
      parameterSchema: definition.parameterSchema,
      // Core's element-target preparation (`runtime/io-policy.ts`) resolves the
      // recorded fingerprint against the runtime candidates, and applies its
      // confidence floor, only for an output that declares this. The flag is
      // derived from the action's own schema row rather than listed by hand, so
      // it cannot drift from it: an action that requires a selector cannot run
      // without an element, and an action that does not — a delta scroll, a
      // key press to the focused element, a URL assertion, a tab operation —
      // must not declare it, because Core fails an action outright when a
      // declared element target has no fingerprint to resolve.
      ...requiredParameters.has("selector") ? { elementTarget: true } : {},
      ...recordsPath ? { recordsPath } : {},
      ...stateVerifyingOutputs.has(definition.actionType) ? { [VERIFIES_STATE_METADATA_KEY]: true } : {}
    }
  };
}
function parametersForOutput(outputId) {
  const selectorParameters = [
    { id: "target", label: "Adapted Target", valueType: "object", ui: { control: "value" } },
    { id: "selector", label: "Selector", valueType: "string", ui: { control: "text", placeholder: "CSS selector" } },
    { id: "element", label: "Element", valueType: "object", ui: { control: "value" } },
    { id: "visualTarget", label: "Visual Target", valueType: "object", ui: { control: "value" } },
    { id: "timeoutMs", label: "Timeout", valueType: "number", defaultValue: 1e4 }
  ];
  const structured = (id, label) => ({ id, label, valueType: "object", ui: { control: "value" } });
  if (outputId === "web.browser.navigate") return [
    { id: "url", label: "URL", valueType: "string", required: true, ui: { control: "text", placeholder: "https://example.com" } },
    { id: "newTab", label: "New Tab", valueType: "boolean", defaultValue: false }
  ];
  if (outputId === "web.dom.type") return [...selectorParameters, { id: "text", label: "Text", valueType: "string", defaultValue: "", ui: { control: "textarea" } }];
  if (outputId === "web.dom.select") return [...selectorParameters, { id: "value", label: "Value", valueType: "string", defaultValue: "", ui: { control: "text" } }, structured("option", "Option")];
  if (outputId === "web.dom.keypress") return [...selectorParameters, { id: "key", label: "Key", valueType: "string", defaultValue: "", ui: { control: "text" } }, structured("modifiers", "Modifiers")];
  if (outputId === "web.dom.scroll") return [
    ...selectorParameters,
    { id: "x", label: "X", valueType: "number", defaultValue: 0 },
    { id: "y", label: "Y", valueType: "number", defaultValue: 0 },
    { id: "smooth", label: "Smooth", valueType: "boolean", defaultValue: false },
    structured("scroll", "Scroll Mode")
  ];
  if (outputId === "web.dom.extract") return [...selectorParameters, structured("extract", "Read")];
  if (outputId === "web.dom.wait_for_selector") return [...selectorParameters, structured("wait", "Condition")];
  if (outputId === "web.dom.wait_for_text") return [
    { id: "text", label: "Text", valueType: "string", required: true, ui: { control: "text" } },
    { id: "timeoutMs", label: "Timeout", valueType: "number", defaultValue: 1e4 },
    structured("wait", "Condition")
  ];
  if (outputId === "web.dom.capture_snapshot") return [];
  if (outputId === "web.dom.check") return [...selectorParameters, { id: "checked", label: "Checked", valueType: "boolean", defaultValue: true }];
  if (outputId === "web.dom.assert") return [...selectorParameters, structured("assert", "Assertion")];
  if (outputId === "web.dom.extract_list") return webAutomationExtractListParameters();
  if (outputId === "web.dom.upload") return [...selectorParameters, structured("upload", "Files")];
  if (outputId === "web.dom.dialog") return [structured("dialog", "Dialog")];
  if (outputId === "web.browser.tab") return [structured("tab", "Tab")];
  if (outputId === "web.browser.download") return [structured("download", "Download")];
  return selectorParameters;
}
function iconForOutput(outputId) {
  if (outputId === "web.browser.navigate") return "navigation";
  if (outputId === "web.dom.click") return "mouse-pointer-click";
  if (outputId === "web.dom.type") return "text-cursor-input";
  if (outputId === "web.dom.extract") return "scan-search";
  if (outputId === "web.dom.capture_snapshot") return "camera";
  if (outputId === "web.dom.check") return "square-check";
  if (outputId === "web.dom.assert") return "circle-check";
  if (outputId === "web.dom.extract_list") return "table";
  if (outputId === "web.dom.upload") return "upload";
  if (outputId === "web.dom.dialog") return "message-square";
  if (outputId === "web.browser.tab") return "app-window";
  if (outputId === "web.browser.download") return "download";
  return "square-dot";
}

// src/output-nodes/parameter-contracts.ts
var webAutomationOutputNodeParameterContracts = {
  [webAutomationOutputNodeId("web.dom.extract_list")]: webAutomationExtractListParameterContract
};

// src/runtime/llm-evidence/repairable-parameters.ts
var WEB_REPAIRABLE_ELEMENT_PARAMETER = "element";
var ELEMENT_PARAMETER_DESCRIPTION = "the target handle of the one element the failed action should act on instead";
var POLICY_ACTION_DEFINITION_ID = "builtin.policy.action";
var ELEMENT_ROLE_BY_DEFINITION_ID = {
  "web.output.dom-type": "fillable",
  "web.output.dom-clear": "fillable",
  "web.output.dom-select": "selectable",
  "web.output.dom-click": "clickable",
  "web.output.dom-keypress": "keyable",
  "web.output.dom-wait_for_selector": "observable",
  "web.output.dom-extract": "observable"
};
var OUTPUT_NODE_ID_BY_OUTPUT_ID = new Map(
  WEB_AUTOMATION_ACTION_TYPES.map((outputId) => [outputId, webAutomationOutputNodeId(outputId)])
);
function webRepairableParameters(definitionId) {
  const elementRole = Object.hasOwn(ELEMENT_ROLE_BY_DEFINITION_ID, definitionId) ? ELEMENT_ROLE_BY_DEFINITION_ID[definitionId] : void 0;
  return elementRole ? [elementParameter(elementRole)] : [];
}
function webRepairableParameterFor(definitionId, name) {
  return webRepairableParameters(definitionId).find((parameter) => parameter.name === name);
}
function webFailedActionDefinitionId(failedAction) {
  const outputId = failedAction.outputId;
  if (outputId === void 0) return failedAction.definitionId;
  const dispatched = OUTPUT_NODE_ID_BY_OUTPUT_ID.get(outputId);
  if (dispatched === void 0) return void 0;
  if (failedAction.definitionId !== POLICY_ACTION_DEFINITION_ID && failedAction.definitionId !== dispatched) return void 0;
  return dispatched;
}
function elementFillsRepairableParameter(element, role) {
  if (role === "fillable") return safeFillTag(element.tag, element.inputType);
  if (role === "selectable") return element.tag === "select";
  if (role === "clickable") return actionableEvidenceElement(element);
  if (role === "keyable") return safeFillTag(element.tag, element.inputType) || element.tag === "select" || actionableEvidenceElement(element);
  return true;
}
function elementParameter(role) {
  return { name: WEB_REPAIRABLE_ELEMENT_PARAMETER, role, required: true, description: ELEMENT_PARAMETER_DESCRIPTION };
}

// src/runtime/llm-evidence/structure/handles.ts
var WEB_LLM_EXTRACTION_HANDLE_PATTERN = "^extraction\\.[1-9][0-9]{0,8}$";
var HANDLE_PATTERN = new RegExp(WEB_LLM_EXTRACTION_HANDLE_PATTERN, "u");

// src/runtime/llm-evidence/plan-resolution/handle-tokens.ts
var EXTRACTION_HANDLE = new RegExp(WEB_LLM_EXTRACTION_HANDLE_PATTERN, "u");

// src/runtime/llm-evidence/plan-resolution/resolve-plan-node.ts
var SELECTOR_NODE_IDS = new Set(
  webAutomationActionDefinitions.filter((definition) => isJsonRecord(definition.parameterSchema.properties) && "selector" in definition.parameterSchema.properties).map((definition) => webAutomationOutputNodeId(definition.actionType))
);
var ELEMENT_NODE_IDS = new Set(
  webAutomationActionDefinitions.filter((definition) => isJsonRecord(definition.parameterSchema.properties) && "element" in definition.parameterSchema.properties).map((definition) => webAutomationOutputNodeId(definition.actionType))
);
var WEB_OUTPUT_IDS = new Set(webAutomationActionDefinitions.map((definition) => definition.actionType));
var EXTRACT_LIST_NODE_ID = webAutomationOutputNodeId("web.dom.extract_list");

// src/runtime/llm-evidence/target-override.ts
function validateWebRuntimeTargetOverrideEvidence(evidence, target2, failedAction, selectors) {
  const definitionId = webFailedActionDefinitionId(failedAction);
  const declared2 = definitionId === void 0 ? [] : webRepairableParameters(definitionId);
  if (definitionId === void 0 || declared2.length === 0) return { status: "absent", reason: "action_not_repairable" };
  const handles = proposedHandles(target2);
  if (!handles) return { status: "absent", reason: "target_malformed" };
  if (Object.keys(handles).some((name) => !webRepairableParameterFor(definitionId, name))) return { status: "absent", reason: "parameter_not_offered" };
  if (declared2.some((parameter) => parameter.required && handles[parameter.name] === void 0)) return { status: "absent", reason: "parameter_missing" };
  const resolved = /* @__PURE__ */ new Map();
  for (const [name, handle] of Object.entries(handles)) {
    const parameter = webRepairableParameterFor(definitionId, name);
    const candidates = evidence.elements.filter((element2) => elementFillsRepairableParameter(element2, parameter.role));
    const named = evidence.elements.filter((element2) => element2.target === handle);
    if (named.length > 1) return { status: "ambiguous", reason: "handle_ambiguous" };
    if (named.length === 1 && elementFillsRepairableParameter(named[0], parameter.role)) {
      resolved.set(name, { element: named[0], named: true });
      continue;
    }
    if (candidates.length === 0) return { status: "absent", reason: "no_compatible_element" };
    if (candidates.length > 1) return { status: "ambiguous", reason: named.length === 1 ? "handle_incompatible" : "handle_not_issued" };
    resolved.set(name, { element: candidates[0], named: false });
  }
  const element = resolved.get(WEB_REPAIRABLE_ELEMENT_PARAMETER);
  if (resolved.size !== 1 || !element) return { status: "absent", reason: "action_not_repairable" };
  return { status: "resolved", target: resolvedTarget(handles, element, selectors) };
}
function proposedHandles(target2) {
  const handles = target2?.handles;
  if (!handles || typeof handles !== "object" || Array.isArray(handles)) return void 0;
  const entries = Object.entries(handles);
  if (!entries.every(([name, handle]) => typeof handle === "string" && handle.length > 0 && name.length > 0)) return void 0;
  return Object.fromEntries(entries);
}
function resolvedTarget(handles, resolved, selectors) {
  const handleResolution = resolved.named ? "named" : "inferred";
  const fingerprint = elementFingerprint2(resolved.element, selectors);
  return present({
    handles: { [WEB_REPAIRABLE_ELEMENT_PARAMETER]: resolved.element.target },
    handleResolution,
    tagName: fingerprint.tagName,
    role: fingerprint.role,
    accessibleName: fingerprint.accessibleName,
    visibleText: fingerprint.visibleText,
    selector: fingerprint.selector,
    metadata: fingerprint.metadata,
    proposedHandles: handleResolution === "inferred" ? handles : void 0
  });
}
function elementFingerprint2(element, selectors) {
  const metadata = present({
    browserFrameId: element.frameId,
    inputType: element.inputType,
    controlType: element.controlType,
    formId: element.form,
    listIndex: element.item?.index,
    listTotal: element.item?.total
  });
  return present({
    tagName: element.tag,
    role: element.role,
    accessibleName: element.name,
    visibleText: element.text,
    // The hint, and only where the caller still holds the binding that issued
    // the handle. The packet has not carried a selector since `.v2`, so a repair
    // resolved from a packet alone is fingerprint-only -- which is weaker, not
    // wrong: the name, the role and the tag are what Core scores highest.
    selector: selectors?.get(element.target),
    metadata: Object.keys(metadata).length ? metadata : void 0
  });
}

// src/io/input-model.ts
var WEB_AUTOMATION_INPUT_IDS = {
  browserState: "web.browser.state",
  recordingEvidence: "web.recording.evidence",
  navigationRequested: "web.user.navigation_requested",
  elementClicked: "web.user.element_clicked",
  textEntered: "web.user.text_entered",
  fieldCleared: "web.user.field_cleared",
  optionSelected: "web.user.option_selected",
  checkboxToggled: "web.user.checkbox_toggled",
  keyPressed: "web.user.key_pressed",
  pageScrolled: "web.user.page_scrolled",
  filesChosen: "web.user.files_chosen",
  tabSwitched: "web.user.tab_switched",
  tabClosed: "web.user.tab_closed",
  // One input, for the one form of extraction the product can define: a list,
  // which saves a dataset.
  //
  // The single-value form had its own input -- an input maps to exactly one
  // output, and the two forms run different verbs -- and nothing could ever
  // produce it. The worker refuses to start a `value` pick and refuses one that
  // arrives anyway (`background/extraction/control.ts`), `confirm.ts` refuses a
  // `value` definition on the run path, and the picker's recorded event attaches
  // no element for one. A registered action input that no event can reach
  // advertises a trigger that never fires, which is the mirror of an unmapped
  // input becoming executable, so it is not registered.
  //
  // The domain still *reads* a value definition
  // (`actions/extraction/recorded-definition.ts`) and `web.dom.extract` remains
  // an output a Flow may author; a recorded one stays passive evidence. When the
  // picker can record a single value, this is one id and one row again.
  dataExtractionDefined: "web.user.data_extraction_defined"
};
var stateInputDefinitions = [
  { id: WEB_AUTOMATION_INPUT_IDS.browserState, title: "Browser state", description: "Current browser, tab, and compact DOM state available for policy conditions.", role: "state" },
  { id: WEB_AUTOMATION_INPUT_IDS.recordingEvidence, title: "Web recording evidence", description: "Passive browser observations that may inform recordings but never execute a policy.", role: "event" }
];
var actionInputDefinitions = [
  [WEB_AUTOMATION_INPUT_IDS.navigationRequested, "Navigation requested", "web.browser.navigate"],
  [WEB_AUTOMATION_INPUT_IDS.elementClicked, "Element clicked", "web.dom.click"],
  [WEB_AUTOMATION_INPUT_IDS.textEntered, "Text entered", "web.dom.type"],
  [WEB_AUTOMATION_INPUT_IDS.fieldCleared, "Field cleared", "web.dom.clear"],
  [WEB_AUTOMATION_INPUT_IDS.optionSelected, "Option selected", "web.dom.select"],
  [WEB_AUTOMATION_INPUT_IDS.checkboxToggled, "Checkbox toggled", "web.dom.check"],
  [WEB_AUTOMATION_INPUT_IDS.keyPressed, "Key pressed", "web.dom.keypress"],
  [WEB_AUTOMATION_INPUT_IDS.pageScrolled, "Page scrolled", "web.dom.scroll"],
  [WEB_AUTOMATION_INPUT_IDS.filesChosen, "Files chosen", "web.dom.upload"],
  [WEB_AUTOMATION_INPUT_IDS.tabSwitched, "Tab switched", "web.browser.tab"],
  [WEB_AUTOMATION_INPUT_IDS.tabClosed, "Tab closed", "web.browser.tab"],
  [WEB_AUTOMATION_INPUT_IDS.dataExtractionDefined, "Data extraction defined", "web.dom.extract_list"]
];
var OUTPUT_FOR_ACTION_INPUT = new Map(
  actionInputDefinitions.map(([inputId, , outputId]) => [inputId, outputId])
);

// src/runtime/capabilities.ts
var WEB_AUTOMATION_STRUCTURE_DETECTION_CAPABILITY_ID = "web.structure.detection";
var webAutomationRuntimeCapabilities = [
  {
    id: "web.actions",
    label: "Web actions",
    kind: "action",
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    actionTypes: WEB_AUTOMATION_ACTION_TYPES,
    outputIds: WEB_AUTOMATION_ACTION_TYPES
  },
  {
    id: "web.snapshots",
    label: "Web snapshots",
    kind: "snapshot",
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    inputIds: [WEB_AUTOMATION_INPUT_IDS.recordingEvidence]
  },
  {
    id: "web.state",
    label: "Web state",
    kind: "state",
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    inputIds: [WEB_AUTOMATION_INPUT_IDS.browserState, WEB_AUTOMATION_INPUT_IDS.recordingEvidence]
  },
  {
    id: "web.flow-runtime",
    label: "Web flow runtime",
    kind: "flow",
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    metadata: { executionHost: "fluxiq-core", actionTransport: "extension" }
  }
];
var webAutomationGatewayCapabilities = [
  {
    id: "web.context.state",
    label: "Web context state",
    kind: "state",
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    inputIds: [WEB_AUTOMATION_INPUT_IDS.browserState],
    metadata: { domainId: WEB_AUTOMATION_DOMAIN_ID, inputIds: [WEB_AUTOMATION_INPUT_IDS.browserState] }
  },
  {
    id: "web.structured.snapshot",
    label: "Structured web snapshots",
    kind: "snapshot",
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    inputIds: [WEB_AUTOMATION_INPUT_IDS.recordingEvidence],
    metadata: { domainId: WEB_AUTOMATION_DOMAIN_ID, inputIds: [WEB_AUTOMATION_INPUT_IDS.recordingEvidence] }
  },
  {
    // `web.dom.capture_snapshot` answers `detectStructure` with the repeating
    // structure it found (`extraction/structure-detection.ts`). A flag on an
    // existing observe-only action rather than an action of its own, so it
    // lists no action type: nothing new is executable. The authoring evidence
    // runtime refuses its detection tool for a client that does not declare it.
    id: WEB_AUTOMATION_STRUCTURE_DETECTION_CAPABILITY_ID,
    label: "Repeating-structure detection",
    kind: "snapshot",
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    metadata: { domainId: WEB_AUTOMATION_DOMAIN_ID, actionType: "web.dom.capture_snapshot", parameter: "detectStructure" }
  },
  {
    id: "web.recording.events",
    label: "Web recording events",
    kind: "recording",
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    metadata: { domainId: WEB_AUTOMATION_DOMAIN_ID }
  },
  {
    id: "web.actions",
    label: "Web actions",
    kind: "action",
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    actionTypes: WEB_AUTOMATION_ACTION_TYPES,
    outputIds: WEB_AUTOMATION_ACTION_TYPES,
    metadata: { domainId: WEB_AUTOMATION_DOMAIN_ID, outputIds: WEB_AUTOMATION_ACTION_TYPES }
  }
];

// src/runtime/llm-evidence/tests/target-override.test.ts
var target = (handles) => ({ handles });
var NOT_REPAIRABLE = { status: "absent", reason: "action_not_repairable" };
var formBinding = () => sanitizeWebLlmSnapshotWithBindings({
  url: "https://example.test/form",
  interactiveElements: [
    { tagName: "textarea", selector: "#name", name: "Name" },
    { tagName: "select", selector: "#plan", name: "Plan", options: [{ value: "team", label: "Team" }] },
    { tagName: "button", selector: "#unique", name: "Unique" }
  ]
});
test("resolves a repair from the opaque handle the model was shown, fingerprint first", () => {
  const { evidence, selectors } = formBinding();
  const typeAction = { nodeId: "name", definitionId: "web.output.dom-type" };
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, target({ element: "target.1" }), typeAction, selectors), {
    status: "resolved",
    target: {
      handles: { element: "target.1" },
      handleResolution: "named",
      tagName: "textarea",
      accessibleName: "Name",
      selector: "#name"
    }
  });
  const resolved = validateWebRuntimeTargetOverrideEvidence(evidence, target({ element: "target.3" }), { nodeId: "submit", definitionId: "web.output.dom-click" }, selectors);
  assert.equal(resolved.status, "resolved");
  assert.deepEqual(resolved.status === "resolved" ? resolved.target : void 0, {
    handles: { element: "target.3" },
    handleResolution: "named",
    tagName: "button",
    accessibleName: "Unique",
    selector: "#unique"
  });
});
test("falls back to the only compatible element when the handle is wrong, and says it did", () => {
  const { evidence, selectors } = formBinding();
  const typeAction = { nodeId: "name", definitionId: "web.output.dom-type" };
  const wrongKind = validateWebRuntimeTargetOverrideEvidence(evidence, target({ element: "target.2" }), typeAction, selectors);
  assert.deepEqual(wrongKind, {
    status: "resolved",
    target: {
      handles: { element: "target.1" },
      handleResolution: "inferred",
      tagName: "textarea",
      accessibleName: "Name",
      selector: "#name",
      proposedHandles: { element: "target.2" }
    }
  });
});
test("a string that is a valid CSS selector is just an unminted handle: it never addresses the page", () => {
  const { evidence, selectors } = sanitizeWebLlmSnapshotWithBindings({
    url: "https://example.test/form",
    interactiveElements: [
      { tagName: "button", selector: "#wanted", name: "Wanted" },
      { tagName: "p", selector: "p.decoy", name: "Decoy" },
      { tagName: "span", selector: "span", name: "Other" }
    ]
  });
  const clickAction = { nodeId: "submit", definitionId: "web.output.dom-click" };
  for (const invented of ["p.decoy", "span", "wanted", "button", "div.btn", "b2"]) {
    const validation = validateWebRuntimeTargetOverrideEvidence(evidence, target({ element: invented }), clickAction, selectors);
    assert.equal(validation.status, "resolved", invented);
    const resolvedTarget2 = validation.status === "resolved" ? validation.target : void 0;
    assert.deepEqual(resolvedTarget2?.handles, { element: "target.1" }, invented);
    assert.equal(resolvedTarget2?.handleResolution, "inferred", invented);
    assert.equal(resolvedTarget2?.selector, "#wanted", invented);
  }
});
test("refuses a parameter the action never declared, as not offered", () => {
  const { evidence, selectors } = formBinding();
  const clickAction = { nodeId: "submit", definitionId: "web.output.dom-click" };
  const notOffered = { status: "absent", reason: "parameter_not_offered" };
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, target({ item: "target.3" }), clickAction, selectors), notOffered);
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, target({ element: "target.3", extra: "target.1" }), clickAction, selectors), notOffered);
});
test("refuses a handle map that names no parameter, as a required one missing", () => {
  const { evidence, selectors } = formBinding();
  const clickAction = { nodeId: "submit", definitionId: "web.output.dom-click" };
  assert.deepEqual(
    validateWebRuntimeTargetOverrideEvidence(evidence, { handles: {} }, clickAction, selectors),
    { status: "absent", reason: "parameter_missing" }
  );
});
test("refuses a target that is not a map of parameters to handles, as malformed", () => {
  const { evidence, selectors } = formBinding();
  const clickAction = { nodeId: "submit", definitionId: "web.output.dom-click" };
  const malformed = { status: "absent", reason: "target_malformed" };
  const targets = [
    {},
    { handles: [] },
    { handles: "target.3" },
    { handles: { element: 3 } },
    { handles: { element: "" } },
    { selector: "#unique" }
  ];
  for (const candidate of targets) {
    assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, candidate, clickAction, selectors), malformed, JSON.stringify(candidate));
  }
});
test("refuses a handle the packet issued twice, as ambiguous", () => {
  const { evidence, selectors } = formBinding();
  const doubled = { ...evidence, elements: [...evidence.elements, { ...evidence.elements[2], name: "Other" }] };
  assert.deepEqual(
    validateWebRuntimeTargetOverrideEvidence(doubled, target({ element: "target.3" }), { nodeId: "submit", definitionId: "web.output.dom-click" }, selectors),
    { status: "ambiguous", reason: "handle_ambiguous" }
  );
});
test("refuses a handle naming something the verb cannot use, when no single other element could stand in", () => {
  const typeAction = { nodeId: "name", definitionId: "web.output.dom-type" };
  const page = sanitizeWebLlmSnapshot({
    url: "https://example.test/form",
    interactiveElements: [
      { tagName: "input", selector: "#first", name: "First" },
      { tagName: "textarea", selector: "#second", name: "Second" },
      { tagName: "button", selector: "#go", name: "Go" }
    ]
  });
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(page, target({ element: "target.3" }), typeAction), { status: "ambiguous", reason: "handle_incompatible" });
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(page, target({ element: "target.9" }), typeAction), { status: "ambiguous", reason: "handle_not_issued" });
});
test("an action with nothing to re-point says so in Core's word, whatever the target names", () => {
  const { evidence, selectors } = formBinding();
  const navigate = { nodeId: "n", definitionId: "web.output.browser-navigate" };
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, target({ element: "target.3" }), navigate, selectors), NOT_REPAIRABLE);
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, {}, navigate, selectors), NOT_REPAIRABLE);
});
test("a recorded action is repaired as the verb its output names", () => {
  const { evidence, selectors } = formBinding();
  const recordedClick = { nodeId: "save", definitionId: "builtin.policy.action", outputId: "web.dom.click" };
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, target({ element: "target.3" }), recordedClick, selectors), {
    status: "resolved",
    target: { handles: { element: "target.3" }, handleResolution: "named", tagName: "button", accessibleName: "Unique", selector: "#unique" }
  });
  const recordedType = { nodeId: "name", definitionId: "builtin.policy.action", outputId: "web.dom.type" };
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, target({ element: "target.3" }), recordedType, selectors), {
    status: "resolved",
    target: {
      handles: { element: "target.1" },
      handleResolution: "inferred",
      tagName: "textarea",
      accessibleName: "Name",
      selector: "#name",
      proposedHandles: { element: "target.3" }
    }
  });
  const createdClick = { nodeId: "submit", definitionId: "web.output.dom-click", outputId: "web.dom.click" };
  assert.equal(validateWebRuntimeTargetOverrideEvidence(evidence, target({ element: "target.3" }), createdClick, selectors).status, "resolved");
});
test("a failed action whose output names no repairable web verb, or contradicts its node, is refused", () => {
  const { evidence, selectors } = formBinding();
  const refusedIdentities = [
    // A recorded action Core could name no output for says nothing about its verb.
    { nodeId: "save", definitionId: "builtin.policy.action" },
    { nodeId: "save", definitionId: "builtin.policy.action", outputId: "vendor.output.press" },
    { nodeId: "save", definitionId: "builtin.policy.action", outputId: "web.browser.navigate" },
    // A node definition id is not an output id.
    { nodeId: "save", definitionId: "builtin.policy.action", outputId: "web.output.dom-click" },
    // A web output node whose output id names another verb.
    { nodeId: "submit", definitionId: "web.output.dom-click", outputId: "web.dom.type" },
    // A node that is neither a recorded action nor that output's own node.
    { nodeId: "ask", definitionId: "builtin.llm.prompt", outputId: "web.dom.click" }
  ];
  for (const failedAction of refusedIdentities) {
    assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, target({ element: "target.3" }), failedAction, selectors), NOT_REPAIRABLE, JSON.stringify(failedAction));
  }
});
test("without the binding the repair is fingerprint-only, which is weaker rather than wrong", () => {
  const { evidence } = formBinding();
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, target({ element: "target.1" }), { nodeId: "name", definitionId: "web.output.dom-type" }), {
    status: "resolved",
    target: { handles: { element: "target.1" }, handleResolution: "named", tagName: "textarea", accessibleName: "Name" }
  });
});
test("refuses a repair when nothing compatible was described, and refuses to guess between several", () => {
  const typeAction = { nodeId: "name", definitionId: "web.output.dom-type" };
  const noTypeable = sanitizeWebLlmSnapshot({ url: "https://example.test/form", interactiveElements: [{ tagName: "select", selector: "#plan" }] });
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(noTypeable, target({ element: "target.9" }), typeAction), { status: "absent", reason: "no_compatible_element" });
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(noTypeable, target({ element: "target.1" }), typeAction), { status: "absent", reason: "no_compatible_element" });
  const twoTypeable = sanitizeWebLlmSnapshot({ url: "https://example.test/form", interactiveElements: [{ tagName: "input", selector: "#first" }, { tagName: "textarea", selector: "#second" }] });
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(twoTypeable, target({ element: "target.9" }), typeAction), { status: "ambiguous", reason: "handle_not_issued" });
});
test("carries a child-frame element's frame beside the selector that works inside it", () => {
  const { evidence, selectors } = sanitizeWebLlmSnapshotWithBindings({
    url: "https://example.test/checkout",
    interactiveElements: [
      { tagName: "input", selector: "frame[3] >> #card-name", name: "Name on card", attributes: { "data-fluxiq-frame-id": "3" } }
    ]
  });
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, target({ element: "target.1" }), { nodeId: "card", definitionId: "web.output.dom-type" }, selectors), {
    status: "resolved",
    target: {
      handles: { element: "target.1" },
      handleResolution: "named",
      tagName: "input",
      accessibleName: "Name on card",
      selector: "#card-name",
      metadata: { browserFrameId: 3 }
    }
  });
});
var catalogueBinding = () => sanitizeWebLlmSnapshotWithBindings({
  url: "https://example.test/catalogue",
  interactiveElements: [
    { tagName: "a", selector: ".row:nth-child(1)", name: "Widget", context: { listPosition: { index: 1, total: 2 } } },
    { tagName: "span", selector: ".row:nth-child(1) .price", name: "10.00" }
  ]
});
test("a list extraction is refused as not repairable, whatever it names, before any handle is resolved", () => {
  const { evidence, selectors } = catalogueBinding();
  const extraction = { nodeId: "rows", definitionId: "web.output.dom-extract_list" };
  const proposals = [
    { item: "target.1", "field.price": "target.2" },
    { item: "target.1" },
    { item: "target.2" },
    { "field.price": "target.2" },
    { element: "target.1" }
  ];
  for (const handles of proposals) {
    assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, target(handles), extraction, selectors), NOT_REPAIRABLE, JSON.stringify(handles));
  }
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, {}, extraction, selectors), NOT_REPAIRABLE);
  const identities = [
    { nodeId: "rows", definitionId: "builtin.policy.action", outputId: "web.dom.extract_list" },
    { nodeId: "rows", definitionId: "web.output.dom-extract_list", outputId: "web.dom.extract_list" },
    // An extraction node whose output id claims a click is a contradiction, not a click.
    { nodeId: "rows", definitionId: "web.output.dom-extract_list", outputId: "web.dom.click" }
  ];
  for (const failedAction of identities) {
    for (const handles of [{ item: "target.1" }, { element: "target.1" }]) {
      assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, target(handles), failedAction, selectors), NOT_REPAIRABLE, `${JSON.stringify(failedAction)} ${JSON.stringify(handles)}`);
    }
  }
});
test("a click on a list row still resolves flat, with the row's position as metadata", () => {
  const { evidence, selectors } = catalogueBinding();
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, target({ element: "target.1" }), { nodeId: "open", definitionId: "web.output.dom-click" }, selectors), {
    status: "resolved",
    target: {
      handles: { element: "target.1" },
      handleResolution: "named",
      tagName: "a",
      accessibleName: "Widget",
      selector: ".row:nth-child(1)",
      metadata: { listIndex: 1, listTotal: 2 }
    }
  });
});
