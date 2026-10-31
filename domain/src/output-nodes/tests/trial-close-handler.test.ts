// A layer a trial closed becomes Core's handler at the next submission (P6, CC7,
// t799): the handler presses this domain's click with the `controlRef` the
// client reported for the way out. Core lowers it and then checks the whole
// plan against this domain's nodes and their parameter contracts; a plan that
// fails that check loses that handler (named in the submission's advice). Here, through Core's own lowering and
// check with this domain's nodes: the click run with the `controlRef` itself as
// its parameters (`{ selector, element }`, as the domain resolved them) is a
// valid step, and the handler is in the plan. The form `{ target: controlRef }`
// lacks the `selector` only resolution fills and was refused (t799 headed proof).

import assert from "node:assert/strict";
import test from "node:test";
import { automationStudioCandidateExploredLayerHandlers, validateAutomationStudioFlowBootstrapPlan, type AutomationStudioFlowBootstrapPlan } from "fluxiq/automation-studio";
import { AutomationStudioNodeRegistry } from "fluxiq/automation-studio/nodes";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_DOMAIN_ID } from "../../constants";
import { webAutomationOutputNodeDefinitions, webAutomationOutputNodeId } from "../definitions";
import { WEB_AUTOMATION_RUNTIME_CAPABILITIES, WEB_AUTOMATION_RUNTIME_PERMISSIONS } from "../native-runtime";
import { webAutomationOutputNodeParameterContracts } from "../parameter-contracts";

const CLICK = webAutomationOutputNodeId("web.dom.click");
const resolution = { scope: { kind: "domain" as const, domainId: WEB_AUTOMATION_DOMAIN_ID }, runtimeCapabilities: WEB_AUTOMATION_RUNTIME_CAPABILITIES, permissions: WEB_AUTOMATION_RUNTIME_PERMISSIONS };
const NAME = "Join the reading club";
/** The client's durable target for the offer's close control (`interference/obstruction/`), as the cleared layer carries it. */
const CONTROL_REF: JsonObject = {
  selector: "div[role=\"dialog\"] button.close",
  element: { tagName: "button", selector: "div[role=\"dialog\"] button.close", accessibleName: "Close", role: "button", context: { dialog: NAME } }
};

function registry(): AutomationStudioNodeRegistry {
  const value = new AutomationStudioNodeRegistry();
  for (const definition of webAutomationOutputNodeDefinitions) value.register(definition);
  for (const [nodeId, contract] of Object.entries(webAutomationOutputNodeParameterContracts)) value.bindParameterContract(nodeId, contract);
  return value;
}

function plan(nodes: AutomationStudioFlowBootstrapPlan["subflows"][number]["nodes"]): AutomationStudioFlowBootstrapPlan {
  return { schemaVersion: "0.1", router: { name: "Borrow", rules: [], fallback: { kind: "subflow", targetSubflowKey: "primary" } }, subflows: [{ key: "primary", name: "Primary", role: "primary", nodes, edges: [] }] };
}

const version = webAutomationOutputNodeDefinitions.find((candidate) => candidate.id === CLICK)!.version;

test("a click run with the reported controlRef as its parameters passes Core's check of the plan", () => {
  const result = validateAutomationStudioFlowBootstrapPlan({ plan: plan([{ key: "close", definitionId: CLICK, definitionVersion: version, parameters: CONTROL_REF, outputActionId: "web.dom.click", consequences: [] }]), registry: registry(), resolution });
  assert.equal(result.ok, true, JSON.stringify(result.issues));
});

test("a layer a trial closed is lowered into a handler pressing the click with those parameters", () => {
  const nodes = registry();
  const validated = validateAutomationStudioFlowBootstrapPlan({ plan: plan([{ key: "borrow", definitionId: CLICK, definitionVersion: version, parameters: { selector: "#borrow" }, outputActionId: "web.dom.click", consequences: [] }]), registry: nodes, resolution });
  assert.ok(validated.ok && validated.validated, JSON.stringify(validated.issues));
  const buildPlan = { plan: validated.validated.plan, risk: validated.validated.risk, subflows: validated.validated.subflows };
  const lowered = automationStudioCandidateExploredLayerHandlers({
    buildPlan,
    explored: [{ kind: "trial_close", id: "layer:0a1b2c3d", name: NAME, wayOutDefinitionId: CLICK, controlRef: CONTROL_REF }],
    registry: nodes,
    resolution
  });
  const handler = lowered.plan.subflows[0]!.nodes.find((node) => node.definitionId === "builtin.control.handler");
  assert.ok(handler, "the lowered plan holds no handler");
  assert.deepEqual(handler.parameters?.when, [{ fact: "obstruction", op: "visible", value: NAME }]);
  const press = lowered.plan.subflows[0]!.nodes[lowered.plan.subflows[0]!.nodes.indexOf(handler) + 1]!;
  assert.equal(press.definitionId, CLICK);
  assert.deepEqual(press.parameters, CONTROL_REF);
});
