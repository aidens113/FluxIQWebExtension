// The scroll node's `scroll` is checked when a plan is validated, so an
// `untilStable` without `maxScrolls` is refused at submit, naming the key,
// rather than by the trial that runs it (social r4, `run-mvfq957o-40103539`).

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
import { webAutomationScrollParameterContract } from "../parameter-contract";

const SCROLL_NODE = webAutomationOutputNodeId("web.dom.scroll");
const ask = (parameterId: string, value: JsonValue) => webAutomationScrollParameterContract({ definitionId: SCROLL_NODE, parameterId, value });

test("untilStable without maxScrolls, or with one the dispatch cannot read, is refused by a code naming maxScrolls", () => {
  assert.deepEqual(ask("scroll", { mode: "untilStable" }), ["web.scroll.until_stable_missing_max_scrolls"]);
  assert.deepEqual(ask("scroll", { mode: "untilStable", y: 800 }), ["web.scroll.until_stable_missing_max_scrolls"]);
  for (const maxScrolls of [0, -3, 2.5, "12"]) {
    assert.deepEqual(ask("scroll", { mode: "untilStable", maxScrolls }), ["web.scroll.until_stable_invalid_max_scrolls"], JSON.stringify(maxScrolls));
  }
});

test("a valid untilStable, a bound maxScrolls, every other mode and every other parameter pass the contract", () => {
  for (const value of [
    { mode: "untilStable", maxScrolls: 12 },
    { mode: "untilStable", maxScrolls: 40, y: 900 },
    { mode: "untilStable", maxScrolls: { $state: { path: "run.maxScrolls" } } },
    { mode: "by", y: 640 },
    { mode: "toElement" }
  ] as JsonValue[]) assert.deepEqual(ask("scroll", value), [], JSON.stringify(value));
  // What the schema says it says itself, in Core's sentence naming the field.
  assert.deepEqual(ask("scroll", { until: "stopsGrowing" }), []);
  assert.deepEqual(ask("scroll", { mode: "down" }), []);
  assert.deepEqual(ask("y", 0), []);
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
  const definition = webAutomationOutputNodeDefinitions.find((candidate) => candidate.id === SCROLL_NODE);
  assert.ok(definition);
  return {
    schemaVersion: "0.1",
    router: { name: "Scroll", rules: [], fallback: { kind: "subflow", targetSubflowKey: "primary" } },
    subflows: [{
      key: "primary",
      name: "Primary",
      role: "primary",
      nodes: [{ key: "scroll", definitionId: SCROLL_NODE, definitionVersion: definition.version, parameters, outputActionId: "web.dom.scroll" }],
      edges: []
    }]
  };
}

const SCROLL_PATH = "plan.subflows.0.nodes.0.parameters.scroll";

function scrollIssues(scroll: JsonValue) {
  const plan = planWith({ x: 0, y: 0, smooth: false, scroll });
  const result = validateAutomationStudioFlowBootstrapPlan({ plan, registry: registry(), resolution });
  const issues = result.issues.filter((issue) => issue.path === SCROLL_PATH);
  return { issues, feedback: automationStudioFlowBootstrapIssueFeedback({ issues, plan, registry: registry(), resolution }) };
}

test("untilStable without maxScrolls is refused when the plan is validated, the code naming the missing key", () => {
  const { issues, feedback } = scrollIssues({ mode: "untilStable" });
  assert.deepEqual(issues.map((issue) => issue.code), ["web.scroll.until_stable_missing_max_scrolls"]);
  assert.equal(issues[0]?.severity, "error");
  assert.match(JSON.stringify(feedback), /max_scrolls/u);
  assert.deepEqual(scrollIssues({ mode: "untilStable", maxScrolls: 0 }).issues.map((issue) => issue.code), ["web.scroll.until_stable_invalid_max_scrolls"]);
});

test("a valid untilStable and the other modes pass validation at scroll, unchanged", () => {
  for (const value of [{ mode: "untilStable", maxScrolls: 12 }, { mode: "untilStable", maxScrolls: 12, y: 800 }, { mode: "by", y: 640 }, { mode: "toElement" }]) {
    assert.deepEqual(scrollIssues(value).issues, [], JSON.stringify(value));
  }
  // The schema still refuses what it did before, in its own sentence.
  assert.deepEqual(scrollIssues({ mode: "by", until: "stopsGrowing" }).issues.map((issue) => issue.code), ["bootstrap.parameter_schema_mismatch"]);
  assert.deepEqual(scrollIssues({ mode: "down" }).issues.map((issue) => issue.code), ["bootstrap.parameter_schema_mismatch"]);
});
