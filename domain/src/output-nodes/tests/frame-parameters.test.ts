// A step that ran inside a child frame keeps that frame on its node (t1062).
//
// Plan resolution writes `browserFrameUrlPath` and `browserFrameId` onto a node
// whose handle named an element in a child frame (`runtime/llm-evidence/
// plan-resolution/resolve-plan-node.ts`), the recorder writes them the same way
// (`../payloads.ts`), and the gateway lifts them onto the command
// (`client/gateway-action-parameters.ts`). Until t1062 no node definition
// declared them, so Core's check of the plan refused every such node as
// `bootstrap.unknown_parameter` and a Flow with a step in a booking widget's
// iframe could never be saved (run `run-mwxdk1el-9dcfa4be`, step 0037).

import assert from "node:assert/strict";
import test from "node:test";
import { validateAutomationStudioFlowBootstrapPlan, type AutomationStudioFlowBootstrapPlan } from "fluxiq/automation";
import { AutomationStudioNodeRegistry } from "fluxiq/components/automation";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_DOMAIN_ID } from "../../constants";
import { webAutomationActionDefinitions } from "../../actions/schemas";
import type { WebAutomationActionType } from "../../actions/types";
import { WEB_AUTOMATION_FRAME_PARAMETERS } from "../frame-parameters";
import { webAutomationOutputNodeDefinitions, webAutomationOutputNodeId } from "../definitions";
import { WEB_AUTOMATION_RUNTIME_CAPABILITIES, WEB_AUTOMATION_RUNTIME_PERMISSIONS } from "../native-runtime";
import { webAutomationOutputNodeParameterContracts } from "../parameter-contracts";

const resolution = { scope: { kind: "domain" as const, domainId: WEB_AUTOMATION_DOMAIN_ID }, runtimeCapabilities: WEB_AUTOMATION_RUNTIME_CAPABILITIES, permissions: WEB_AUTOMATION_RUNTIME_PERMISSIONS };
const FRAME_IDS: readonly string[] = WEB_AUTOMATION_FRAME_PARAMETERS.map((parameter) => parameter.id);
const FRAME = { browserFrameId: 4, browserFrameUrlPath: "/scenarios/company-website/widget/slotwise" };

function registry(): AutomationStudioNodeRegistry {
  const value = new AutomationStudioNodeRegistry();
  for (const definition of webAutomationOutputNodeDefinitions) value.register(definition);
  for (const [nodeId, contract] of Object.entries(webAutomationOutputNodeParameterContracts)) value.bindParameterContract(nodeId, contract);
  return value;
}

function plan(nodes: Array<{ key: string; action: WebAutomationActionType; parameters: JsonObject; consequences?: string[] }>): AutomationStudioFlowBootstrapPlan {
  const node = (each: (typeof nodes)[number]) => {
    const definition = webAutomationOutputNodeDefinitions.find((candidate) => candidate.id === webAutomationOutputNodeId(each.action))!;
    return { key: each.key, definitionId: definition.id, definitionVersion: definition.version, parameters: each.parameters, outputActionId: each.action, ...(each.consequences ? { consequences: each.consequences } : {}) };
  };
  return {
    schemaVersion: "0.1",
    router: { name: "Book", rules: [], fallback: { kind: "subflow", targetSubflowKey: "primary" } },
    subflows: [{
      key: "primary", name: "Primary", role: "primary",
      nodes: nodes.map(node),
      edges: nodes.slice(1).map((each, index) => ({ key: `e${index}`, source: { nodeKey: nodes[index]!.key, portId: "success" }, target: { nodeKey: each.key, portId: "in" } }))
    }]
  };
}

test("every DOM step declares the frame it ran in, typed, optional and never shown to a model", () => {
  for (const action of webAutomationActionDefinitions.map((definition) => definition.actionType)) {
    const node = webAutomationOutputNodeDefinitions.find((candidate) => candidate.id === webAutomationOutputNodeId(action))!;
    const declared = node.parameters.filter((parameter) => FRAME_IDS.includes(parameter.id));
    if (!action.startsWith("web.dom.")) {
      // A navigation, a tab operation and a download act on the tab, never inside a frame.
      assert.deepEqual(declared, [], action);
      continue;
    }
    assert.deepEqual(declared.map((parameter) => [parameter.id, parameter.valueType]), [["browserFrameUrlPath", "string"], ["browserFrameId", "number"]], action);
    for (const parameter of declared) {
      assert.equal(parameter.required, undefined, `${action}.${parameter.id} is optional: a top-frame step carries neither`);
      assert.equal(parameter.shownToModel, false, `${action}.${parameter.id} is written by the domain, never by a model`);
      assert.equal(parameter.allowStateBinding, false, `${action}.${parameter.id} is an address, never a value from state`);
    }
  }
});

test("a Flow whose steps ran inside an iframe passes Core's check of the plan with its frame kept", () => {
  const steps = plan([
    { key: "branch", action: "web.dom.click", parameters: { selector: "#branch-wrenfield", element: { tagName: "button", text: "Wrenfield" }, ...FRAME }, consequences: [] },
    { key: "postcode", action: "web.dom.type", parameters: { selector: "#postcode", element: { tagName: "input", name: "postcode" }, text: "CP12", ...FRAME }, consequences: [] },
    { key: "next", action: "web.dom.click", parameters: { selector: "#later", element: { tagName: "button", text: "Later" }, ...FRAME }, consequences: [] }
  ]);
  const result = validateAutomationStudioFlowBootstrapPlan({ plan: steps, registry: registry(), resolution });
  assert.equal(result.ok, true, JSON.stringify(result.issues));
  for (const node of result.validated!.plan.subflows[0]!.nodes) {
    assert.equal(node.parameters!.browserFrameUrlPath, FRAME.browserFrameUrlPath, node.key);
    assert.equal(node.parameters!.browserFrameId, FRAME.browserFrameId, node.key);
  }
});

test("a frame address of the wrong type is refused, so a malformed one never reaches dispatch", () => {
  const result = validateAutomationStudioFlowBootstrapPlan({
    plan: plan([{ key: "press", action: "web.dom.click", parameters: { selector: "#later", browserFrameId: "4", browserFrameUrlPath: 7 }, consequences: [] }]),
    registry: registry(),
    resolution
  });
  assert.equal(result.ok, false);
  const paths = (result.issues ?? []).map((issue) => issue.path ?? "");
  assert.ok(paths.some((path) => path.endsWith("parameters.browserFrameId")), JSON.stringify(result.issues));
  assert.ok(paths.some((path) => path.endsWith("parameters.browserFrameUrlPath")), JSON.stringify(result.issues));
  assert.equal((result.issues ?? []).some((issue) => issue.code === "bootstrap.unknown_parameter"), false, JSON.stringify(result.issues));
});
