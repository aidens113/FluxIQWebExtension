// A bound parameter (t252, D3): Core translates the model's `$row`, `$input`
// and `$step` forms into its executor's own `{"$state": {path, fallback?}}`
// leaf before a step reaches this domain. The leaf is a value only the Flow's
// run resolves, so plan-time resolution passes it untouched, and a check of a
// written step's parameters counts it as given (`../../node-run/written-step.ts`).

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { webAutomationOutputNodeId } from "../../../../output-nodes";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebAutomationLlmEvidenceRuntime } from "../..";
import { isWebPlanStateBinding } from "..";

const TYPE_NODE = webAutomationOutputNodeId("web.dom.type");
const NAVIGATE_NODE = webAutomationOutputNodeId("web.browser.navigate");
const FORM_URL = "https://example.test/form";
const NAME_SELECTOR = 'input[name="name"]';

function runtime(): WebAutomationLlmEvidenceRuntime {
  return createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      const snapshot: JsonObject = { url: FORM_URL, title: "Fixture", interactiveElements: [{ tagName: "input", selector: NAME_SELECTOR, inputType: "text", accessibleName: "Name" }] };
      return { status: "succeeded", payload: { snapshot } };
    }
  });
}

test("a $state leaf is exactly one key naming an object with a path", () => {
  assert.equal(isWebPlanStateBinding({ $state: { path: "item.name" } }), true);
  assert.equal(isWebPlanStateBinding({ $state: { path: "query", fallback: "kettle" } }), true);
  for (const value of [undefined, null, "item.name", ["$state"], { $state: "item.name" }, { $state: {} }, { $state: { path: "" } }, { $state: { path: "a" }, text: "b" }]) {
    assert.equal(isWebPlanStateBinding(value), false, JSON.stringify(value));
  }
});

test("plan-time resolution resolves the handle beside a bound value and leaves the value untouched", async () => {
  const shown = runtime();
  await shown.executeTool({ projectId: "project.one", flowId: "flow.one", callId: "call.one", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });
  const text = { $state: { path: "item.name", fallback: "Ada" } };
  const resolved = await shown.resolvePlanNodeParameters({ projectId: "project.one", flowId: "flow.one", nodeDefinitionId: TYPE_NODE, parameters: { target: { handle: "t1" }, text }, declaredConsequences: [] });
  assert.equal(resolved.status, "resolved", JSON.stringify(resolved));
  assert.deepEqual((resolved as { parameters: JsonObject }).parameters.text, text);
  assert.equal((resolved as { parameters: JsonObject }).parameters.selector, NAME_SELECTOR);
});

test("a node whose only unusual value is a bound one is unchanged, not refused", async () => {
  const url = { $state: { path: "site", fallback: FORM_URL } };
  const answered = await runtime().resolvePlanNodeParameters({ projectId: "project.one", flowId: "flow.one", nodeDefinitionId: NAVIGATE_NODE, parameters: { url }, declaredConsequences: [] });
  assert.deepEqual(answered, { status: "unchanged" });
});
