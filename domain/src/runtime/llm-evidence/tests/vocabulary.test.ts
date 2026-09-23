// The drift guard. `packages/test-runner` filters its sanitized diagnostic by
// these two sets, and while they were hand-maintained on the consumer's side
// both had drifted: `web.reveal_safe` (now `web.press_control`) was missing from the tool allowlist, so
// every reveal step was silently dropped, and
// `web.action.rejected.no_progress` was missing from the result codes. These
// rows compare each published set against what the runtime actually offers and
// emits, so the next such drift fails a test instead of losing evidence.

import assert from "node:assert/strict";
import test from "node:test";
import {
  createWebAutomationLlmEvidenceRuntime,
  webLlmToolRejectionResultCode,
  WEB_LLM_ACTION_RESULT_CODE,
  WEB_LLM_DETECT_STRUCTURE_TOOL_ID,
  WEB_LLM_ENTER_FIELD_TOOL_ID,
  WEB_LLM_EVIDENCE_RESULT_CODES,
  WEB_LLM_EVIDENCE_TOOL_IDS,
  WEB_LLM_INSPECT_RESULT_CODE,
  WEB_LLM_RUN_NODE_TOOL_ID,
  WEB_LLM_INSPECT_TOOL_ID,
  WEB_LLM_NAVIGATE_TOOL_ID,
  WEB_LLM_PRESS_TOOL_ID,
  WEB_LLM_STRUCTURE_RESULT_CODE,
  WEB_LLM_TOOL_REJECTION_CODES,
  type WebLlmEvidenceGateway
} from "..";

const page = (url: string) => ({ url, title: "Fixture", interactiveElements: [{ tagName: "button", selector: "#go", visibleText: "Go" }] });

const gatewayFor = (url: string): WebLlmEvidenceGateway => ({
  eligibleSessionIds: () => ["session.one"],
  structureDetectionSessionIds: () => ["session.one"],
  executeAction: async (_sessionId, command) => command.actionType === "web.dom.capture_snapshot"
    ? { status: "succeeded", payload: command.parameters.detectStructure === undefined ? { snapshot: page(url) } : { snapshot: page(url), structure: { ok: false, refused: "no_repeating_run" } } }
    : { status: "succeeded" },
});

// The published list was "exactly the tools the runtime offers, in order"
// until 2026-09-22, when four of those tools were replaced by the library's own
// nodes. It is now every id this domain has ever put on the wire, because a run
// recorded before that change still names the four, and the consumer that reads
// this list uses it to decide which recorded steps it may show: dropping them
// would blank those steps silently, which is the defect the list was made
// exhaustive to prevent.
test("the published tool ids cover what the runtime offers and what a recorded run may still name", () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(gatewayFor("https://example.test/start"));
  const offered = runtime.tools.map((tool) => tool.toolId);
  assert.deepEqual(offered, [WEB_LLM_DETECT_STRUCTURE_TOOL_ID]);
  // The library verb is Core's option, not one of this runtime's own tools, and
  // is published here because this domain is what carries out its calls.
  assert.equal(WEB_LLM_EVIDENCE_TOOL_IDS.includes(WEB_LLM_RUN_NODE_TOOL_ID), true);
  for (const id of offered) assert.equal(WEB_LLM_EVIDENCE_TOOL_IDS.includes(id as typeof WEB_LLM_EVIDENCE_TOOL_IDS[number]), true);
  for (const retired of [WEB_LLM_INSPECT_TOOL_ID, WEB_LLM_NAVIGATE_TOOL_ID, WEB_LLM_PRESS_TOOL_ID, WEB_LLM_ENTER_FIELD_TOOL_ID]) {
    assert.equal(WEB_LLM_EVIDENCE_TOOL_IDS.includes(retired), true);
  }
  assert.equal(new Set(WEB_LLM_EVIDENCE_TOOL_IDS).size, WEB_LLM_EVIDENCE_TOOL_IDS.length);
});

test("the published result codes cover every success and every rejection, with none left over", () => {
  assert.deepEqual([...WEB_LLM_EVIDENCE_RESULT_CODES], [
    WEB_LLM_INSPECT_RESULT_CODE,
    WEB_LLM_ACTION_RESULT_CODE,
    WEB_LLM_STRUCTURE_RESULT_CODE,
    ...WEB_LLM_TOOL_REJECTION_CODES.map((code) => `web.action.rejected.${code}`),
  ]);
  assert.equal(WEB_LLM_EVIDENCE_RESULT_CODES.length, WEB_LLM_TOOL_REJECTION_CODES.length + 3);
  assert.equal(WEB_LLM_EVIDENCE_RESULT_CODES.includes("web.action.rejected.no_repeating_structure"), true);
  assert.equal(WEB_LLM_EVIDENCE_RESULT_CODES.includes("web.action.succeeded"), true);
  for (const code of WEB_LLM_TOOL_REJECTION_CODES) {
    assert.equal(WEB_LLM_EVIDENCE_RESULT_CODES.includes(webLlmToolRejectionResultCode(code)), true, code);
  }
});

test("every result code the runtime actually emits is one the published set contains", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(gatewayFor("https://example.test/start"));
  const base = { projectId: "project.one", flowId: "flow.one" } as const;
  const emitted = [
    (await runtime.executeTool({ ...base, callId: "call.one", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } })).resultCode,
    (await runtime.executeTool({ ...base, callId: "call.two", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.browser-navigate", parameters: { url: "https://example.test/start" }, consequences: [] } })).resultCode,
    (await runtime.executeTool({ ...base, callId: "call.three", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.browser-navigate", parameters: { url: "https://outside.test/" }, consequences: [] } })).resultCode,
    (await runtime.executeTool({ ...base, callId: "call.four", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [], extra: 1 } })).resultCode,
    (await runtime.executeTool({ ...base, callId: "call.five", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-click", parameters: { target: { handle: "target.9" } }, consequences: [] } })).resultCode,
    (await runtime.executeTool({ ...base, callId: "call.six", toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: {} })).resultCode,
  ];
  assert.deepEqual(emitted, [
    "web.inspect.succeeded",
    "web.action.succeeded",
    "web.action.rejected.cross_origin",
    "web.action.rejected.invalid_input",
    "web.action.rejected.target_unobserved",
    "web.action.rejected.no_repeating_structure",
  ]);
  for (const code of emitted) assert.equal(WEB_LLM_EVIDENCE_RESULT_CODES.includes(code as never), true, code);
});
