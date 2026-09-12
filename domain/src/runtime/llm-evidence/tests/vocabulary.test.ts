// The drift guard. `packages/test-runner` filters its sanitized diagnostic by
// these two sets, and while they were hand-maintained on the consumer's side
// both had drifted: `web.reveal_safe` was missing from the tool allowlist, so
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
  WEB_LLM_EVIDENCE_RESULT_CODES,
  WEB_LLM_EVIDENCE_TOOL_IDS,
  WEB_LLM_INSPECT_RESULT_CODE,
  WEB_LLM_INSPECT_TOOL_ID,
  WEB_LLM_NAVIGATE_TOOL_ID,
  WEB_LLM_REVEAL_TOOL_ID,
  WEB_LLM_TOOL_REJECTION_CODES,
  type WebLlmEvidenceGateway
} from "..";

const page = (url: string) => ({ url, title: "Fixture", interactiveElements: [{ tagName: "button", selector: "#go", visibleText: "Go" }] });

const gatewayFor = (url: string): WebLlmEvidenceGateway => ({
  eligibleSessionIds: () => ["session.one"],
  executeAction: async (_sessionId, command) => command.actionType === "web.dom.capture_snapshot"
    ? { status: "succeeded", payload: { snapshot: page(url) } }
    : { status: "succeeded" },
});

test("the published tool ids are exactly the tools the runtime offers, in order", () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(gatewayFor("https://example.test/start"));
  assert.deepEqual(runtime.tools.map((tool) => tool.toolId), [...WEB_LLM_EVIDENCE_TOOL_IDS]);
  assert.deepEqual([...WEB_LLM_EVIDENCE_TOOL_IDS], [WEB_LLM_INSPECT_TOOL_ID, WEB_LLM_NAVIGATE_TOOL_ID, WEB_LLM_REVEAL_TOOL_ID]);
  assert.equal(WEB_LLM_EVIDENCE_TOOL_IDS.includes("web.reveal_safe"), true);
  assert.equal(new Set(WEB_LLM_EVIDENCE_TOOL_IDS).size, WEB_LLM_EVIDENCE_TOOL_IDS.length);
});

test("the published result codes cover both successes and every rejection, with none left over", () => {
  assert.deepEqual([...WEB_LLM_EVIDENCE_RESULT_CODES], [
    WEB_LLM_INSPECT_RESULT_CODE,
    WEB_LLM_ACTION_RESULT_CODE,
    ...WEB_LLM_TOOL_REJECTION_CODES.map((code) => `web.action.rejected.${code}`),
  ]);
  assert.equal(WEB_LLM_EVIDENCE_RESULT_CODES.length, WEB_LLM_TOOL_REJECTION_CODES.length + 2);
  assert.equal(WEB_LLM_EVIDENCE_RESULT_CODES.includes("web.action.rejected.no_progress"), true);
  for (const code of WEB_LLM_TOOL_REJECTION_CODES) {
    assert.equal(WEB_LLM_EVIDENCE_RESULT_CODES.includes(webLlmToolRejectionResultCode(code)), true, code);
  }
});

test("every result code the runtime actually emits is one the published set contains", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(gatewayFor("https://example.test/start"));
  const base = { projectId: "project.one", flowId: "flow.one" } as const;
  const emitted = [
    (await runtime.executeTool({ ...base, callId: "call.one", toolId: WEB_LLM_INSPECT_TOOL_ID, value: {} })).resultCode,
    (await runtime.executeTool({ ...base, callId: "call.two", toolId: WEB_LLM_NAVIGATE_TOOL_ID, value: { url: "https://example.test/start" } })).resultCode,
    (await runtime.executeTool({ ...base, callId: "call.three", toolId: WEB_LLM_NAVIGATE_TOOL_ID, value: { url: "https://outside.test/" } })).resultCode,
    (await runtime.executeTool({ ...base, callId: "call.four", toolId: WEB_LLM_INSPECT_TOOL_ID, value: { extra: 1 } })).resultCode,
    (await runtime.executeTool({ ...base, callId: "call.five", toolId: WEB_LLM_REVEAL_TOOL_ID, value: { target: "target.9" } })).resultCode,
  ];
  assert.deepEqual(emitted, [
    "web.inspect.succeeded",
    "web.action.rejected.no_progress",
    "web.action.rejected.cross_origin",
    "web.action.rejected.invalid_input",
    "web.action.rejected.target_unobserved",
  ]);
  for (const code of emitted) assert.equal(WEB_LLM_EVIDENCE_RESULT_CODES.includes(code as never), true, code);
});
