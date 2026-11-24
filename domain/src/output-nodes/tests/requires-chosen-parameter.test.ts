// A saved act's node takes `requiresChosen` (t1030): the options Core writes
// onto it from the build's evidence, which the page checks before the act. The
// press, the typing and the key press declare it, hidden from the model, and it
// survives Core's check of the plan unchanged: renamed or dropped there, the
// act would press on with whatever option the page arrived with.

import assert from "node:assert/strict";
import test from "node:test";
import { validateAutomationStudioFlowBootstrapPlan, type AutomationStudioFlowBootstrapPlan } from "fluxiq/automation";
import { AutomationStudioNodeRegistry } from "fluxiq/components/automation";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_DOMAIN_ID } from "../../constants";
import { webAutomationOutputNodeDefinitions, webAutomationOutputNodeId } from "../definitions";
import { WEB_AUTOMATION_RUNTIME_CAPABILITIES, WEB_AUTOMATION_RUNTIME_PERMISSIONS } from "../native-runtime";
import { webAutomationOutputNodeParameterContracts } from "../parameter-contracts";

const CLICK = webAutomationOutputNodeId("web.dom.click");
const REQUIRED = [{ at: { selector: "#branch-collection", element: { tagName: "button", text: "Collection" } }, words: "Collection" }];
const resolution = { scope: { kind: "domain" as const, domainId: WEB_AUTOMATION_DOMAIN_ID }, runtimeCapabilities: WEB_AUTOMATION_RUNTIME_CAPABILITIES, permissions: WEB_AUTOMATION_RUNTIME_PERMISSIONS };

function registry(): AutomationStudioNodeRegistry {
  const value = new AutomationStudioNodeRegistry();
  for (const definition of webAutomationOutputNodeDefinitions) value.register(definition);
  for (const [nodeId, contract] of Object.entries(webAutomationOutputNodeParameterContracts)) value.bindParameterContract(nodeId, contract);
  return value;
}

function plan(parameters: JsonObject): AutomationStudioFlowBootstrapPlan {
  const definition = webAutomationOutputNodeDefinitions.find((candidate) => candidate.id === CLICK)!;
  return {
    schemaVersion: "0.1",
    router: { name: "Add", rules: [], fallback: { kind: "subflow", targetSubflowKey: "primary" } },
    subflows: [{ key: "primary", name: "Primary", role: "primary", nodes: [{ key: "add", definitionId: CLICK, definitionVersion: definition.version, parameters, outputActionId: "web.dom.click", consequences: ["create_new"] }], edges: [] }]
  };
}

test("the press, the typing and the key press take requiresChosen, which the model is never shown", () => {
  for (const action of ["web.dom.click", "web.dom.type", "web.dom.keypress"] as const) {
    const parameter = webAutomationOutputNodeDefinitions.find((candidate) => candidate.id === webAutomationOutputNodeId(action))?.parameters.find((each) => each.id === "requiresChosen");
    assert.equal(parameter?.valueType, "array", action);
    assert.equal(parameter?.shownToModel, false, action);
  }
  const read = webAutomationOutputNodeDefinitions.find((candidate) => candidate.id === webAutomationOutputNodeId("web.dom.extract_list"));
  assert.equal(read?.parameters.some((each) => each.id === "requiresChosen"), false);
});

test("a press's requiresChosen survives Core's check of the plan as it was written", () => {
  const result = validateAutomationStudioFlowBootstrapPlan({ plan: plan({ selector: "#add", requiresChosen: REQUIRED }), registry: registry(), resolution });
  assert.equal(result.ok, true, JSON.stringify(result.issues));
  assert.deepEqual(result.validated!.plan.subflows[0]!.nodes[0]!.parameters!.requiresChosen, REQUIRED);
});
