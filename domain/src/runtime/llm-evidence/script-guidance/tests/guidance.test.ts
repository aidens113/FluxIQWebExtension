import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { assertAutomationStudioFlowScriptGuidance, renderAutomationStudioFlowScriptFormat } from "fluxiq/automation-studio";
import type { WebLlmEvidenceGateway } from "../../capture";
import { createWebAutomationLlmEvidenceRuntime } from "../../tools";
import { WEB_FLOW_SCRIPT_EXAMPLES } from "../../script-examples";
import { WEB_FLOW_SCRIPT_CONTROL_OPERATIONS, WEB_FLOW_SCRIPT_GUIDANCE } from "../index";

test("web guidance preserves the three frozen original operation paragraphs in order", () => {
  assert.equal(WEB_FLOW_SCRIPT_GUIDANCE.version, "web-guidance-1");
  assert.deepEqual(Object.keys(WEB_FLOW_SCRIPT_GUIDANCE).sort(), ["act", "version"]);
  assert.deepEqual(Object.keys(WEB_FLOW_SCRIPT_GUIDANCE.act!), ["controlOperations"]);
  assert.equal(WEB_FLOW_SCRIPT_GUIDANCE.act!.controlOperations, WEB_FLOW_SCRIPT_CONTROL_OPERATIONS);
  assert.equal(WEB_FLOW_SCRIPT_CONTROL_OPERATIONS.length, 3);
  assert.equal(createHash("sha256").update(JSON.stringify(WEB_FLOW_SCRIPT_CONTROL_OPERATIONS), "utf8").digest("hex"), "a018e68d494074a7c9eb859ca9689c6d39d2b1e208e45800b743b0b5b21d65da");
  const accepted = assertAutomationStudioFlowScriptGuidance(WEB_FLOW_SCRIPT_GUIDANCE, "web-automation");
  assert.deepEqual(accepted, WEB_FLOW_SCRIPT_GUIDANCE);
  assert.notEqual(accepted, WEB_FLOW_SCRIPT_GUIDANCE);
});

test("the actual web runtime supplies guidance independently of examples without gateway calls", () => {
  let executions = 0;
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => [],
    executeAction: async () => {
      executions += 1;
      throw new Error("no gateway should execute");
    }
  };
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  assert.equal(runtime.flowScriptGuidance, WEB_FLOW_SCRIPT_GUIDANCE);
  assert.deepEqual(assertAutomationStudioFlowScriptGuidance(runtime.flowScriptGuidance, runtime.domainId), WEB_FLOW_SCRIPT_GUIDANCE);
  const first = renderAutomationStudioFlowScriptFormat(runtime.flowScriptExamples, runtime.flowScriptGuidance);
  const second = renderAutomationStudioFlowScriptFormat(undefined, runtime.flowScriptGuidance);
  for (const paragraph of WEB_FLOW_SCRIPT_CONTROL_OPERATIONS) {
    assert.ok(first.act.includes(paragraph));
    assert.ok(second.act.includes(paragraph));
    assert.equal(first.act.split(paragraph).length, 2);
  }
  assert.equal(executions, 0);
});

test("web examples alone never infer operation guidance", () => {
  const generic = renderAutomationStudioFlowScriptFormat();
  const examplesOnly = renderAutomationStudioFlowScriptFormat(WEB_FLOW_SCRIPT_EXAMPLES);
  for (const paragraph of WEB_FLOW_SCRIPT_CONTROL_OPERATIONS) {
    assert.ok(!generic.act.includes(paragraph));
    assert.ok(!examplesOnly.act.includes(paragraph));
  }
  for (const guidance of [
    { version: "empty-1" },
    { version: "empty-1", act: {} },
    { version: "empty-1", act: { controlOperations: [] } }
  ]) assert.deepEqual(renderAutomationStudioFlowScriptFormat(undefined, guidance), generic);
});
