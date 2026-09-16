// src/runtime/llm-evidence/tests/renamed-save-override.test.ts
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

// src/runtime/llm-evidence/sanitize.ts
var WEB_LLM_EVIDENCE_SCHEMA_VERSION = "web-llm-evidence.v2";
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

// src/runtime/llm-evidence/tool-rejection.ts
var WEB_LLM_TOOL_REJECTION_CODES = [
  "invalid_input",
  "cross_origin",
  "out_of_scope",
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

// src/runtime/llm-evidence/repairable-parameters.ts
var WEB_REPAIRABLE_ELEMENT_PARAMETER = "element";
var WEB_REPAIRABLE_ITEM_PARAMETER = "item";
var WEB_REPAIRABLE_FIELD_PARAMETER_PREFIX = "field.";
var ELEMENT_ROLE_BY_DEFINITION_ID = {
  "web.output.dom-type": "fillable",
  "web.output.dom-clear": "fillable",
  "web.output.dom-select": "selectable",
  "web.output.dom-click": "clickable",
  "web.output.dom-keypress": "keyable",
  "web.output.dom-wait_for_selector": "observable",
  "web.output.dom-extract": "observable"
};
var LIST_EXTRACTION_DEFINITION_ID = "web.output.dom-extract_list";
function webRepairableParameters(definitionId) {
  const elementRole = ELEMENT_ROLE_BY_DEFINITION_ID[definitionId];
  if (elementRole) return [{ name: WEB_REPAIRABLE_ELEMENT_PARAMETER, role: elementRole, required: true }];
  if (definitionId === LIST_EXTRACTION_DEFINITION_ID) return [{ name: WEB_REPAIRABLE_ITEM_PARAMETER, role: "list_item", required: true }];
  return [];
}
function webRepairableParameterFor(definitionId, name) {
  const declared = webRepairableParameters(definitionId).find((parameter) => parameter.name === name);
  if (declared) return declared;
  if (definitionId !== LIST_EXTRACTION_DEFINITION_ID || !isFieldParameterName(name)) return void 0;
  return { name, role: "observable", required: false };
}
function elementFillsRepairableParameter(element, role) {
  if (role === "fillable") return safeFillTag(element.tag, element.inputType);
  if (role === "selectable") return element.tag === "select";
  if (role === "clickable") return actionableEvidenceElement(element);
  if (role === "keyable") return safeFillTag(element.tag, element.inputType) || element.tag === "select" || actionableEvidenceElement(element);
  if (role === "list_item") return element.item !== void 0;
  return true;
}
function isFieldParameterName(name) {
  if (!name.startsWith(WEB_REPAIRABLE_FIELD_PARAMETER_PREFIX)) return false;
  const key = name.slice(WEB_REPAIRABLE_FIELD_PARAMETER_PREFIX.length);
  return key.length > 0 && key.length <= 40 && /^[A-Za-z0-9](?:[A-Za-z0-9_.:-]*[A-Za-z0-9])?$/u.test(key);
}

// src/runtime/llm-evidence/target-override.ts
function validateWebRuntimeTargetOverrideEvidence(evidence, target, failedAction, selectors) {
  const declared = webRepairableParameters(failedAction.definitionId);
  if (declared.length === 0) return { status: "absent" };
  const handles = proposedHandles(target);
  if (!handles) return { status: "absent" };
  if (Object.keys(handles).some((name) => !webRepairableParameterFor(failedAction.definitionId, name))) return { status: "absent" };
  if (declared.some((parameter) => parameter.required && handles[parameter.name] === void 0)) return { status: "absent" };
  const resolved = /* @__PURE__ */ new Map();
  for (const [name, handle] of Object.entries(handles)) {
    const parameter = webRepairableParameterFor(failedAction.definitionId, name);
    const candidates = evidence.elements.filter((element) => elementFillsRepairableParameter(element, parameter.role));
    const named = evidence.elements.filter((element) => element.target === handle);
    if (named.length > 1) return { status: "ambiguous" };
    if (named.length === 1 && elementFillsRepairableParameter(named[0], parameter.role)) {
      resolved.set(name, { element: named[0], named: true });
      continue;
    }
    if (candidates.length === 0) return { status: "absent" };
    if (candidates.length > 1) return { status: "ambiguous" };
    resolved.set(name, { element: candidates[0], named: false });
  }
  return { status: "resolved", target: resolvedTarget(handles, resolved, selectors) };
}
function proposedHandles(target) {
  const handles = target?.handles;
  if (!handles || typeof handles !== "object" || Array.isArray(handles)) return void 0;
  const entries = Object.entries(handles);
  if (entries.length === 0) return void 0;
  if (!entries.every(([name, handle]) => typeof handle === "string" && handle.length > 0 && name.length > 0)) return void 0;
  return Object.fromEntries(entries);
}
function resolvedTarget(handles, resolved, selectors) {
  const handleResolution = [...resolved.values()].every((entry) => entry.named) ? "named" : "inferred";
  const single = resolved.size === 1 ? resolved.get(WEB_REPAIRABLE_ELEMENT_PARAMETER)?.element : void 0;
  const flat = single ? elementFingerprint(single, selectors) : void 0;
  return present({
    handles: Object.fromEntries([...resolved].map(([name, entry]) => [name, entry.element.target])),
    handleResolution,
    tagName: flat?.tagName,
    role: flat?.role,
    accessibleName: flat?.accessibleName,
    visibleText: flat?.visibleText,
    selector: flat?.selector,
    metadata: flat?.metadata,
    targets: flat ? void 0 : Object.fromEntries([...resolved].map(([name, entry]) => [name, elementFingerprint(entry.element, selectors)])),
    proposedHandles: handleResolution === "inferred" ? handles : void 0
  });
}
function elementFingerprint(element, selectors) {
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

// src/runtime/llm-evidence/tests/renamed-save-override.test.ts
var FORM_SECTION = { formId: "settings-form", landmark: "region", landmarkName: "General", heading: "General" };
var ADVANCED_SECTION = { formId: "settings-form", landmark: "region", landmarkName: "Advanced", heading: "Advanced" };
var RENAMED_SAVE_SELECTOR = "main > form > section:nth-of-type(1) > div > button:nth-of-type(1)";
var DEFINITION_LIST = [["Data region", "EU (Frankfurt)"], ["Message retention", "365 days"], ["Audit log", "Enabled for all members"], ["API access", "Workspace owners only"]];
var listCell = (tag, index, text) => ({
  tagName: tag,
  selector: `main > form > section:nth-of-type(2) > dl > ${tag}:nth-of-type(${index + 1})`,
  text,
  visibleText: text,
  accessibleName: text,
  context: ADVANCED_SECTION
});
var capturedRenamedRedesign = {
  url: "http://127.0.0.1:4173/scenarios/identity-drift/",
  title: "Workspace settings",
  viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 0, documentWidth: 1280, documentHeight: 1277, devicePixelRatio: 1 },
  frame: { isTop: true, viewportOffset: { x: 0, y: 0, width: 1280, height: 720 } },
  interactiveElements: [
    {
      tagName: "button",
      selector: "#discard-settings",
      text: "Discard changes",
      visibleText: "Discard changes",
      id: "discard-settings",
      testId: "discard-changes",
      accessibleName: "Discard changes",
      implicitRole: "button",
      context: FORM_SECTION,
      attributes: { id: "discard-settings", class: "btn btn-secondary", type: "reset", "data-testid": "discard-changes" }
    },
    {
      tagName: "button",
      selector: RENAMED_SAVE_SELECTOR,
      text: "Apply changes",
      visibleText: "Apply changes",
      accessibleName: "Apply changes",
      implicitRole: "button",
      context: FORM_SECTION,
      attributes: { class: "ui-button ui-button--accent", type: "submit" }
    },
    {
      tagName: "input",
      selector: "#display-name",
      id: "display-name",
      value: "Workspace 121",
      inputType: "text",
      hasValue: true,
      testId: "display-name",
      accessibleName: "Workspace name",
      label: "Workspace name",
      implicitRole: "textbox",
      context: FORM_SECTION,
      attributes: { id: "display-name", name: "displayName", type: "text", autocomplete: "organization", "aria-describedby": "display-name-hint", "data-testid": "display-name" }
    },
    { tagName: "label", selector: "body > main > form > section:nth-of-type(1) > label", text: "Workspace name", visibleText: "Workspace name", accessibleName: "Workspace name", context: FORM_SECTION, attributes: { for: "display-name" } },
    { tagName: "h2", selector: "#general-heading", text: "General", visibleText: "General", id: "general-heading", accessibleName: "General", implicitRole: "heading", context: { ...FORM_SECTION, heading: "Workspace settings" }, attributes: { id: "general-heading" } },
    { tagName: "h2", selector: "#advanced-heading", text: "Advanced", visibleText: "Advanced", id: "advanced-heading", accessibleName: "Advanced", implicitRole: "heading", context: { ...ADVANCED_SECTION, heading: "General" }, attributes: { id: "advanced-heading" } },
    { tagName: "p", selector: "#display-name-hint", text: "Shown in the sidebar and on invitations.", visibleText: "Shown in the sidebar and on invitations.", id: "display-name-hint", implicitRole: "paragraph", context: FORM_SECTION, attributes: { id: "display-name-hint" } },
    { tagName: "h1", selector: "body > main > header > h1", text: "Workspace settings", visibleText: "Workspace settings", accessibleName: "Workspace settings", implicitRole: "heading", context: { landmark: "banner" } },
    { tagName: "p", selector: "body > main > header > p", text: "Changes apply to everyone in this workspace.", visibleText: "Changes apply to everyone in this workspace.", implicitRole: "paragraph", context: { landmark: "banner", heading: "Workspace settings" } },
    { tagName: "p", selector: "body > main > form > section:nth-of-type(2) > p", text: "Your organization manages these settings; they are read-only here.", visibleText: "Your organization manages these settings; they are read-only here.", implicitRole: "paragraph", context: ADVANCED_SECTION },
    ...DEFINITION_LIST.map(([term], index) => listCell("dt", index, term)),
    ...DEFINITION_LIST.map(([, detail], index) => listCell("dd", index, detail)),
    { tagName: "p", selector: "body > main > form > footer > p", text: "Need something else? Ask a workspace owner.", visibleText: "Need something else? Ask a workspace owner.", implicitRole: "paragraph", context: { formId: "settings-form", landmark: "form", landmarkName: "Workspace settings", heading: "Advanced" } },
    {
      tagName: "form",
      selector: "#settings-form",
      id: "settings-form",
      name: "Workspace settings",
      testId: "settings-form",
      accessibleName: "Workspace settings",
      implicitRole: "form",
      context: { formId: "settings-form", landmark: "form", landmarkName: "Workspace settings", heading: "Workspace settings" },
      attributes: { id: "settings-form", "aria-label": "Workspace settings", "data-testid": "settings-form" }
    },
    {
      tagName: "div",
      selector: '[data-testid="primary-actions"]',
      role: "group",
      name: "General actions",
      testId: "primary-actions",
      accessibleName: "General actions",
      context: FORM_SECTION,
      attributes: { class: "form-actions", "aria-label": "General actions", "data-testid": "primary-actions" }
    },
    {
      tagName: "footer",
      selector: '[data-testid="footer-actions"]',
      role: "group",
      name: "Footer actions",
      testId: "footer-actions",
      accessibleName: "Footer actions",
      implicitRole: "contentinfo",
      context: { formId: "settings-form", landmark: "form", landmarkName: "Workspace settings", heading: "Advanced" },
      attributes: { class: "form-footer", "aria-label": "Footer actions", "data-testid": "footer-actions" }
    },
    { tagName: "main", selector: "body > main", implicitRole: "main", context: { landmark: "main" } },
    { tagName: "header", selector: "body > main > header", implicitRole: "banner", context: { landmark: "banner" } },
    { tagName: "section", selector: "body > main > form > section:nth-of-type(1)", accessibleName: "General", implicitRole: "region", context: { ...FORM_SECTION, heading: "Workspace settings" }, attributes: { "aria-labelledby": "general-heading" } },
    { tagName: "section", selector: "body > main > form > section:nth-of-type(2)", accessibleName: "Advanced", implicitRole: "region", context: { ...ADVANCED_SECTION, heading: "General" }, attributes: { class: "advanced", "aria-labelledby": "advanced-heading" } },
    { tagName: "dl", selector: "body > main > form > section:nth-of-type(2) > dl", context: ADVANCED_SECTION }
  ],
  evidence: {
    elements: { scanned: 37, candidates: 35, matched: 27, returned: 27, truncated: false, changed: 0, recentlyInteracted: 0 },
    loading: { documentState: "complete", busy: false, busyRegions: [], indicators: [], pendingNavigation: false },
    navigation: { url: "http://127.0.0.1:4173/scenarios/identity-drift/", origin: "http://127.0.0.1:4173", path: "/scenarios/identity-drift/", type: "navigate", historyLength: 2, visibility: "visible" },
    regions: [
      { role: "main", selector: "body > main", bounds: { x: 256, y: 32, width: 768, height: 1213.16 } },
      { role: "banner", selector: "body > main > header", bounds: { x: 256, y: 32, width: 768, height: 93.44 } },
      { role: "form", selector: "#settings-form", label: "Workspace settings", bounds: { x: 256, y: 145.34, width: 768, height: 1059.81 } },
      { role: "region", selector: "body > main > form > section:nth-of-type(1)", label: "General", bounds: { x: 256, y: 145.34, width: 768, height: 207.91 } },
      { role: "region", selector: "body > main > form > section:nth-of-type(2)", label: "Advanced", bounds: { x: 256, y: 373.16, width: 768, height: 792 } }
    ],
    forms: [{
      selector: "#settings-form",
      label: "Workspace settings",
      controlCount: 3,
      controls: [
        { selector: "#display-name", controlType: "text", name: "displayName", label: "Workspace name", required: true, hasValue: true, autocomplete: "organization" },
        { selector: RENAMED_SAVE_SELECTOR, controlType: "submit", label: "Apply changes" },
        { selector: "#discard-settings", controlType: "reset", label: "Discard changes" }
      ],
      submit: RENAMED_SAVE_SELECTOR
    }]
  },
  focusedElement: { tagName: "body", selector: "body" }
};
var failurePacket = () => sanitizeWebLlmSnapshotWithBindings(capturedRenamedRedesign, { budget: "failure", failedAction: {} });
var clickAction = { nodeId: "save-changes", definitionId: "web.output.dom-click" };
var override = (handle) => ({ handles: { element: handle } });
test("the failure packet shows the renamed Save as the page's one submit control, by its accessible name and never by selector", () => {
  const { evidence, selectors } = failurePacket();
  assert.equal(evidence.failedTargetUnknown, true);
  const submits = evidence.elements.filter((element) => element.controlType === "submit");
  assert.deepEqual(submits, [{ target: "target.2", tag: "button", name: "Apply changes", controlType: "submit", form: "settings-form", landmark: "region", heading: "General" }]);
  assert.deepEqual(evidence.elements.filter((element) => element.tag === "button").map((element) => [element.name, element.controlType]), [["Discard changes", "reset"], ["Apply changes", "submit"]]);
  assert.doesNotMatch(JSON.stringify(evidence), /Save changes/);
  assert.equal(selectors.get("target.2"), RENAMED_SAVE_SELECTOR);
  assert.doesNotMatch(JSON.stringify(evidence), /main > form|#display-name|Workspace 121/);
});
test("accepts an override naming the renamed Save, and resolves it fingerprint first", () => {
  const { evidence, selectors } = failurePacket();
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, override("target.2"), clickAction, selectors), {
    status: "resolved",
    target: {
      handles: { element: "target.2" },
      handleResolution: "named",
      tagName: "button",
      // The accessible name, which Core's matcher weighs above visible text. The
      // packet omits visible text that repeats the name, so the fingerprint does too.
      accessibleName: "Apply changes",
      selector: RENAMED_SAVE_SELECTOR,
      metadata: { controlType: "submit", formId: "settings-form" }
    }
  });
});
test("refuses an override naming a handle it was never shown, or anything on the page a click cannot use", () => {
  const { evidence, selectors } = failurePacket();
  const clickable = evidence.elements.filter((element) => elementFillsRepairableParameter(element, "clickable")).map((element) => element.target);
  assert.deepEqual(clickable, ["target.1", "target.2", "target.3"]);
  const unpressable = evidence.elements.filter((element) => !clickable.includes(element.target)).map((element) => element.target);
  assert.ok(unpressable.length > 0, "the packet described nothing a click cannot use");
  for (const handle of ["save-changes", "#save-settings", "Save changes", "target.0", "target.99", ...unpressable]) {
    assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, override(handle), clickAction, selectors), { status: "ambiguous" }, handle);
  }
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, { handles: { element: "target.2", button: "target.2" } }, clickAction, selectors), { status: "absent" });
});
test("does not tell a pressable wrong control from Save: Discard, named by its own handle, is accepted as Discard", () => {
  const { evidence, selectors } = failurePacket();
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, override("target.1"), clickAction, selectors), {
    status: "resolved",
    target: {
      handles: { element: "target.1" },
      handleResolution: "named",
      tagName: "button",
      accessibleName: "Discard changes",
      selector: "#discard-settings",
      metadata: { controlType: "reset", formId: "settings-form" }
    }
  });
  const textField = validateWebRuntimeTargetOverrideEvidence(evidence, override("target.3"), clickAction, selectors);
  assert.equal(textField.status, "resolved");
  assert.deepEqual(textField.status === "resolved" ? [textField.target.tagName, textField.target.selector] : void 0, ["input", "#display-name"]);
});
