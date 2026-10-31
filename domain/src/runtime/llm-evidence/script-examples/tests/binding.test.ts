import assert from "node:assert/strict";
import test from "node:test";
import { assertAutomationStudioFlowScriptExamples } from "fluxiq/automation-studio";
import type { WebLlmEvidenceGateway } from "../../capture";
import { createWebAutomationLlmEvidenceRuntime } from "../../tools";
import { WEB_FLOW_SCRIPT_EXAMPLES } from "../index";

test("web example metadata is complete, versioned and accepted independently of system instructions", () => {
  assert.equal(WEB_FLOW_SCRIPT_EXAMPLES.version, "web-examples-1");
  assert.deepEqual(Object.keys(WEB_FLOW_SCRIPT_EXAMPLES).sort(), ["act", "format", "loop", "state", "version"]);
  for (const section of ["format", "act", "loop", "state"] as const) {
    const lines = WEB_FLOW_SCRIPT_EXAMPLES[section];
    assert.ok(lines?.length);
    assert.match(lines[0]!, /^Example/u);
  }
  const accepted = assertAutomationStudioFlowScriptExamples(WEB_FLOW_SCRIPT_EXAMPLES, "web");
  assert.deepEqual(accepted, WEB_FLOW_SCRIPT_EXAMPLES);
  assert.notEqual(accepted, WEB_FLOW_SCRIPT_EXAMPLES);
});

test("the actual web runtime supplies the authored companion without making a gateway call", () => {
  const runtime = createWebAutomationLlmEvidenceRuntime({
    sendCommand: async () => { throw new Error("not called"); }
  } as unknown as WebLlmEvidenceGateway);
  assert.equal(runtime.flowScriptExamples, WEB_FLOW_SCRIPT_EXAMPLES);
  // Only the companion is passed to its validator: systemInstructions cannot
  // supply, change or suppress these independently authored examples.
  assert.deepEqual(assertAutomationStudioFlowScriptExamples(runtime.flowScriptExamples, runtime.domainId), WEB_FLOW_SCRIPT_EXAMPLES);
});
