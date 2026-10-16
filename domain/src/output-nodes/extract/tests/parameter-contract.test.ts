// The single-value read's `extract` is checked when a plan is validated, so a
// wrong read is refused with what is allowed before anything runs (t675).

import assert from "node:assert/strict";
import test from "node:test";
import {
  automationStudioFlowBootstrapIssueFeedback,
  validateAutomationStudioFlowBootstrapPlan,
  type AutomationStudioFlowBootstrapPlan
} from "fluxiq/automation-studio";
import { AutomationStudioNodeRegistry } from "fluxiq/automation-studio/nodes";
import type { JsonObject, JsonValue } from "fluxiq/core";
import { WEB_AUTOMATION_DOMAIN_ID } from "../../../constants";
import { webAutomationOutputNodeDefinitions, webAutomationOutputNodeId } from "../../definitions";
import { WEB_AUTOMATION_RUNTIME_CAPABILITIES, WEB_AUTOMATION_RUNTIME_PERMISSIONS } from "../../native-runtime";
import { webAutomationOutputNodeParameterContracts } from "../../parameter-contracts";
import { WEB_AUTOMATION_EXTRACT_READ_GRAMMAR } from "../catalog-text";
import { webAutomationExtractParameterContract } from "../parameter-contract";
import { webAutomationExtractReadIssues } from "../read-issues";

const EXTRACT_NODE = webAutomationOutputNodeId("web.dom.extract");
const ask = (parameterId: string, value: JsonValue) => webAutomationExtractParameterContract({ definitionId: EXTRACT_NODE, parameterId, value });

const WRONG: Array<[string, JsonValue, string[]]> = [
  ["an unknown mode", { mode: "href" }, ["web.extract.unknown_mode"]],
  ["a mode that is not a string", { mode: 1 }, ["web.extract.unknown_mode"]],
  ["no mode", { attribute: "href" }, ["web.extract.missing_mode"]],
  ["attribute mode without an attribute", { mode: "attribute" }, ["web.extract.missing_attribute"]],
  ["attribute mode with an empty attribute", { mode: "attribute", attribute: "" }, ["web.extract.missing_attribute"]],
  ["attribute mode with a blank attribute", { mode: "attribute", attribute: "  " }, ["web.extract.missing_attribute"]],
  ["attribute mode with a non-string attribute", { mode: "attribute", attribute: 3 }, ["web.extract.missing_attribute"]],
  ["an attribute with the text mode", { mode: "text", attribute: "href" }, ["web.extract.attribute_without_attribute_mode"]],
  ["an attribute with the html mode", { mode: "html", attribute: "href" }, ["web.extract.attribute_without_attribute_mode"]],
  ["an undeclared key", { mode: "attribute", attr: "href" }, ["web.extract.unknown_key", "web.extract.missing_attribute"]],
  ["a bound mode", { mode: { $state: { path: "run.mode" } } }, ["web.extract.unknown_mode"]],
  ["a bare string", "text", ["web.extract.not_object"]],
  ["a list", [{ mode: "text" }], ["web.extract.not_object"]],
  ["null", null, ["web.extract.not_object"]]
];

const RIGHT: JsonValue[] = [
  { mode: "text" },
  { mode: "value" },
  { mode: "html" },
  { mode: "attribute", attribute: "href" },
  { mode: "attribute", attribute: { $state: { path: "run.attribute" } } }
];

test("each wrong extract is refused with the code that names what is wrong", () => {
  for (const [name, value, codes] of WRONG) assert.deepEqual([...ask("extract", value)].sort(), [...codes].sort(), name);
});

test("each right extract passes", () => {
  for (const value of RIGHT) assert.deepEqual(ask("extract", value), [], JSON.stringify(value));
});

test("only extract is checked; the legacy options bag and the target are not", () => {
  assert.deepEqual(ask("options", { mode: "bogus" }), []);
  assert.deepEqual(ask("selector", "not checked here"), []);
});

test("every code has the form Core keeps", () => {
  const seen = new Set(WRONG.flatMap(([, value]) => webAutomationExtractReadIssues(value)));
  for (const code of seen) {
    assert.match(code, /^[a-z0-9_]+(\.[a-z0-9_]+)+$/u);
    assert.equal(code.length <= 120, true);
    assert.equal(code.startsWith("web.extract."), true);
  }
});

// Through Core's own validation and refusal feedback, with the domain's nodes and contracts bound.
const resolution = {
  scope: { kind: "domain" as const, domainId: WEB_AUTOMATION_DOMAIN_ID },
  runtimeCapabilities: WEB_AUTOMATION_RUNTIME_CAPABILITIES,
  permissions: WEB_AUTOMATION_RUNTIME_PERMISSIONS
};

function registry(): AutomationStudioNodeRegistry {
  const value = new AutomationStudioNodeRegistry();
  for (const definition of webAutomationOutputNodeDefinitions) value.register(definition);
  for (const [nodeId, contract] of Object.entries(webAutomationOutputNodeParameterContracts)) value.bindParameterContract(nodeId, contract);
  return value;
}

function planWith(parameters: JsonObject): AutomationStudioFlowBootstrapPlan {
  const definition = webAutomationOutputNodeDefinitions.find((candidate) => candidate.id === EXTRACT_NODE);
  assert.ok(definition);
  return {
    schemaVersion: "0.1",
    router: { name: "Read", rules: [], fallback: { kind: "subflow", targetSubflowKey: "primary" } },
    subflows: [{
      key: "primary",
      name: "Primary",
      role: "primary",
      nodes: [{ key: "read", definitionId: EXTRACT_NODE, definitionVersion: definition.version, parameters, outputActionId: "web.dom.extract" }],
      edges: []
    }]
  };
}

const EXTRACT_PATH = "plan.subflows.0.nodes.0.parameters.extract";

function extractIssues(parameters: JsonObject) {
  const plan = planWith({ selector: "#price", ...parameters });
  const result = validateAutomationStudioFlowBootstrapPlan({ plan, registry: registry(), resolution });
  const issues = result.issues.filter((issue) => issue.path === EXTRACT_PATH);
  return { issues, feedback: automationStudioFlowBootstrapIssueFeedback({ issues, plan, registry: registry(), resolution }) };
}

test("a wrong extract is refused when the plan is validated, with the modes it allows beside the code", () => {
  for (const [name, value, codes] of WRONG) {
    const { issues, feedback } = extractIssues({ extract: value });
    // Core refuses a value that is not an object by the parameter's declared type, before the contract is asked.
    const expected = value === null || typeof value !== "object" || Array.isArray(value) ? ["bootstrap.invalid_parameter_value"] : codes;
    assert.deepEqual(issues.map((issue) => issue.code).sort(), [...expected].sort(), name);
    const accepted = feedback.find((entry) => (entry as JsonObject).accepted !== undefined) as JsonObject | undefined;
    assert.ok(accepted, `${name}: the refusal carries the accepted shape`);
    const shape = accepted.accepted as JsonObject;
    assert.equal(shape.parameter, "extract", name);
    assert.equal(shape.description, WEB_AUTOMATION_EXTRACT_READ_GRAMMAR, name);
    assert.deepEqual(shape.example, { mode: "text" }, name);
  }
});

test("a right extract, and a read with no extract (the legacy options.mode form), pass validation at extract", () => {
  for (const value of RIGHT) assert.deepEqual(extractIssues({ extract: value }).issues, [], JSON.stringify(value));
  assert.deepEqual(extractIssues({}).issues, []);
});
