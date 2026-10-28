// The press declares `ensureState` (t775-P). Core gives a toggle step the
// signature its explored press answered, then checks the plan again before the
// trial runs it, resolving any key a node does not declare to the nearest one
// it does. Undeclared, the photo-social like loop's signature reached the trial
// as the press's `expectedState`, the click had no `ensureState`, and the trial
// unliked the post exploration had liked. Here: through Core's own validation
// with this domain's nodes, the signature stays `ensureState`.

import assert from "node:assert/strict";
import test from "node:test";
import { validateAutomationStudioFlowBootstrapPlan, type AutomationStudioFlowBootstrapPlan } from "fluxiq/automation-studio";
import { AutomationStudioNodeRegistry } from "fluxiq/automation-studio/nodes";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_DOMAIN_ID } from "../../constants";
import { webAutomationOutputNodeDefinitions, webAutomationOutputNodeId } from "../definitions";
import { WEB_AUTOMATION_RUNTIME_CAPABILITIES, WEB_AUTOMATION_RUNTIME_PERMISSIONS } from "../native-runtime";
import { webAutomationOutputNodeParameterContracts } from "../parameter-contracts";

const CLICK = webAutomationOutputNodeId("web.dom.click");
const SIGNATURE = { via: "name", gains: ["unlike"], loses: ["like"] };
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
    router: { name: "Like", rules: [], fallback: { kind: "subflow", targetSubflowKey: "primary" } },
    subflows: [{ key: "primary", name: "Primary", role: "primary", nodes: [{ key: "like", definitionId: CLICK, definitionVersion: definition.version, parameters, outputActionId: "web.dom.click", consequences: ["modify_existing"] }], edges: [] }]
  };
}

test("a press's ensureState survives Core's check of the plan as ensureState, never as expectedState", () => {
  const result = validateAutomationStudioFlowBootstrapPlan({ plan: plan({ selector: "#like", ensureState: SIGNATURE }), registry: registry(), resolution });
  assert.equal(result.ok, true, JSON.stringify(result.issues));
  const parameters = result.validated!.plan.subflows[0]!.nodes[0]!.parameters!;
  assert.deepEqual(parameters.ensureState, SIGNATURE);
  assert.equal(parameters.expectedState, undefined);
  assert.equal(result.validated!.assumptions, undefined, "no name was resolved rather than written");
});

