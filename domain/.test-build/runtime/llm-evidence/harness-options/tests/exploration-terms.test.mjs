// src/runtime/llm-evidence/harness-options/tests/exploration-terms.test.ts
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

// src/runtime/llm-evidence/harness-options/execute.ts
import { automationStudioExplorationScopeAllows } from "fluxiq/automation-studio";

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

// src/extraction/dataset-id.ts
var COMBINING_MARKS = new RegExp("\\p{M}+", "gu");

// src/actions/extraction/read-request.ts
var REFUSED = Symbol("refused");

// src/extraction/label-key.ts
var COMBINING_MARKS2 = new RegExp("\\p{M}+", "gu");

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

// src/runtime/llm-evidence/structure/handles.ts
var WEB_LLM_EXTRACTION_HANDLE_PATTERN = "^extraction\\.[1-9][0-9]{0,8}$";
var HANDLE_PATTERN = new RegExp(WEB_LLM_EXTRACTION_HANDLE_PATTERN, "u");

// src/runtime/llm-evidence/harness-options/exploration-terms.ts
function webAutomationExplorationRefusalClassifier(resultCode) {
  if (resultCode === webLlmToolRejectionResultCode("target_unsafe")) return "destructive_action_refused";
  if (resultCode === webLlmToolRejectionResultCode("out_of_scope") || resultCode === webLlmToolRejectionResultCode("cross_origin")) return "out_of_scope_refused";
  return void 0;
}
function webAutomationExplorationScope(location) {
  return new URL(location).origin;
}

// src/runtime/llm-evidence/harness-options/vocabulary.ts
var WEB_RECOVERY_HARNESS_OPTION_IDS = [
  "web.recovery.inspect",
  "web.recovery.reveal",
  "web.recovery.act_safe",
  "web.recovery.wait_for_change",
  "web.recovery.navigate_in_scope",
  "web.recovery.detect_repeating_structure"
];
var WEB_RECOVERY_INSPECT_OPTION_ID = WEB_RECOVERY_HARNESS_OPTION_IDS[0];
var WEB_RECOVERY_REVEAL_OPTION_ID = WEB_RECOVERY_HARNESS_OPTION_IDS[1];
var WEB_RECOVERY_ACT_OPTION_ID = WEB_RECOVERY_HARNESS_OPTION_IDS[2];
var WEB_RECOVERY_WAIT_OPTION_ID = WEB_RECOVERY_HARNESS_OPTION_IDS[3];
var WEB_RECOVERY_NAVIGATE_OPTION_ID = WEB_RECOVERY_HARNESS_OPTION_IDS[4];
var WEB_RECOVERY_DETECT_OPTION_ID = WEB_RECOVERY_HARNESS_OPTION_IDS[5];

// src/runtime/llm-evidence/harness-options/execute.ts
var WEB_RECOVERY_WAIT_BOUNDS = Object.freeze({ minMs: 100, maxMs: 5e3, defaultMs: 1e3 });

// src/runtime/llm-evidence/harness-options/tests/exploration-terms.test.ts
test("translates only the terminal refusals into Core's stop reasons", () => {
  assert.equal(webAutomationExplorationRefusalClassifier("web.action.rejected.target_unsafe"), "destructive_action_refused");
  assert.equal(webAutomationExplorationRefusalClassifier("web.action.rejected.out_of_scope"), "out_of_scope_refused");
  assert.equal(webAutomationExplorationRefusalClassifier("web.action.rejected.cross_origin"), "out_of_scope_refused");
  for (const code of ["web.action.rejected.invalid_input", "web.action.rejected.no_progress", "web.action.rejected.target_unobserved", "web.action.rejected.sensitive_value", "web.action.rejected.no_repeating_structure", "web.inspect.succeeded", "web.action.succeeded", "web.structure.detected"]) {
    assert.equal(webAutomationExplorationRefusalClassifier(code), void 0, code);
  }
});
test("tells Core where it is in Core's own terms, which are opaque strings", () => {
  assert.equal(webAutomationExplorationScope("https://example.test/a/b?c=d"), "https://example.test");
});
