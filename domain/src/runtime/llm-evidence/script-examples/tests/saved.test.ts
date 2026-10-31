import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { acceptAutomationStudioFlowBootstrapResult } from "fluxiq/automation-studio";
import { exampleSupport } from "./support";
import { savedFlowValidation } from "./saved-flow";
import { exampleEvidenceManifests } from "./evidence-manifests";
import { resolveExampleEvidence } from "./resolve-evidence";
const { registry, resolution: EXAMPLE_RESOLUTION, blocks: exampleBlocks } = exampleSupport;
const AUTOMATION_STUDIO_FLOW_SCRIPT_FORMAT = exampleSupport.sections.format;
const AUTOMATION_STUDIO_FLOW_SCRIPT_ACT_EXAMPLE = exampleSupport.sections.act;
const AUTOMATION_STUDIO_FLOW_SCRIPT_LOOP_FORMAT = exampleSupport.sections.loop;
const AUTOMATION_STUDIO_FLOW_SCRIPT_STATE_FORMAT = exampleSupport.sections.state;

describe("every example in the Flow script format, saved as a Flow", () => {
  const blocks = [AUTOMATION_STUDIO_FLOW_SCRIPT_FORMAT, AUTOMATION_STUDIO_FLOW_SCRIPT_ACT_EXAMPLE, AUTOMATION_STUDIO_FLOW_SCRIPT_LOOP_FORMAT, AUTOMATION_STUDIO_FLOW_SCRIPT_STATE_FORMAT].flatMap(exampleBlocks);

  for (const [name, script] of blocks) it(`${name} passes the plan validator and Flow validator on every graph`, async () => {
    const accepted = acceptAutomationStudioFlowBootstrapResult({ result: { flow: script }, registry, resolution: EXAMPLE_RESOLUTION });
    if (!accepted.ok) throw new Error(JSON.stringify(accepted.issues));
    const saved = await savedFlowValidation(accepted.plan, name);
    assert.deepEqual(saved.errors, []);
    assert.notEqual(saved.topology, undefined);
  });

  it("writes the second known way's parts, handler and requirements to the saved graphs, by the ids it minted", async () => {
    const script = new Map(exampleBlocks(AUTOMATION_STUDIO_FLOW_SCRIPT_STATE_FORMAT)).get("Example, a second known way, checked the same:")!;
    const accepted = acceptAutomationStudioFlowBootstrapResult({ result: { flow: script }, registry, resolution: EXAMPLE_RESOLUTION });
    if (!accepted.ok) throw new Error(JSON.stringify(accepted.issues));
    const saved = await savedFlowValidation(accepted.plan, "Example, a second known way, checked the same:");
    assert.deepEqual(saved.errors, []);
    const topology = saved.topology!;
    const byKey = new Map(topology.subflows.map((entry) => [entry.subflow.metadata?.bootstrapSymbolicKey, entry]));
    const main = byKey.get("main")!.graphFlow;
    const calls = main.nodes.filter((node) => node.definitionId === "builtin.control.call-subflow").map((node) => node.parameterValues?.subflowId);
    assert.deepEqual([...calls].sort(), [byKey.get("calendar")!.subflow.subflowId, byKey.get("floorplan")!.subflow.subflowId].sort());
    const handler = main.nodes.find((node) => node.definitionId === "builtin.control.handler")!;
    const booking = main.nodes.find((node) => node.metadata?.bootstrapSymbolicKey === "s2")!;
    assert.deepEqual(handler.parameterValues?.scope, { kind: "nodes", nodeIds: [booking.id] });
    const calendar = byKey.get("calendar")!.graphFlow;
    assert.deepEqual(calendar.interface.outputs.map((port) => [port.id, port.metadata?.binding]), [["reference", { $state: { path: "$node.s2.value" } }]]);
    assert.deepEqual(calendar.metadata?.["fluxiq.successCheck"], [{ fact: "text", op: "contains", value: "Booked", target: exampleEvidenceManifests.factTarget("Example, a second known way, checked the same:", 11) }]);
    assert.deepEqual(calendar.metadata?.requires, ["web.facts@1"]);
    assert.deepEqual(main.metadata?.requires, ["flow.handlers@1", "flow.subflow-calls@1"]);
    assert.deepEqual(topology.requires, ["flow.handlers@1", "flow.subflow-calls@1", "web.facts@1"]);
    assert.deepEqual(topology.router.rules, []);
    assert.deepEqual(topology.router.fallback, { kind: "subflow", subflowId: byKey.get("main")!.subflow.subflowId });
  });

  it("writes an entry to the saved node, and an everywhere handler to the recovery graph", async () => {
    const examples = new Map(exampleBlocks(AUTOMATION_STUDIO_FLOW_SCRIPT_STATE_FORMAT));
    const entry = acceptAutomationStudioFlowBootstrapResult({ result: { flow: examples.get("Example, starting where the page already is:")! }, registry, resolution: EXAMPLE_RESOLUTION });
    if (!entry.ok) throw new Error(JSON.stringify(entry.issues));
    const entrySaved = await savedFlowValidation(entry.plan, "Example, starting where the page already is:");
    assert.deepEqual(entrySaved.errors, []);
    const renew = entrySaved.topology!.subflows[0]!.graphFlow.nodes.find((node) => node.metadata?.["fluxiq.entry"]);
    assert.deepEqual(renew?.metadata?.["fluxiq.entry"], { id: "renew", order: 1, when: [{ fact: "exists", op: "exists", target: exampleEvidenceManifests.factTarget("Example, starting where the page already is:", 6) }], requires: [] });
    const anywhere = acceptAutomationStudioFlowBootstrapResult({ result: { flow: examples.get("Example, an interruption that can come at any pass:")! }, registry, resolution: EXAMPLE_RESOLUTION });
    if (!anywhere.ok) throw new Error(JSON.stringify(anywhere.issues));
    const anywhereSaved = await savedFlowValidation(anywhere.plan, "Example, an interruption that can come at any pass:");
    assert.deepEqual(anywhereSaved.errors, []);
    const recovery = anywhereSaved.topology!.subflows.find((saved) => saved.subflow.role === "recovery")!;
    assert.deepEqual(recovery.graphFlow.nodes.map((node) => node.definitionId), ["builtin.control.handler", "web.output.dom-click", "builtin.control.handler-end"]);
    assert.deepEqual(recovery.graphFlow.metadata?.requires, ["flow.handlers@1", "web.facts@1"]);
  });
});


for (const name of ["Example:", "Example, reading every page of a list:", "Example, starting where the page already is:"]) {
  it(`${name} refuses missing capture/detection sources before saving`, async () => {
    const script = new Map(Object.values(exampleSupport.sections).flatMap(exampleBlocks)).get(name)!;
    const accepted = acceptAutomationStudioFlowBootstrapResult({ result: { flow: script }, registry, resolution: EXAMPLE_RESOLUTION });
    if (!accepted.ok) throw new Error(JSON.stringify(accepted.issues));
    assert.equal(accepted.ok, true);
    const resolved = await resolveExampleEvidence(accepted.plan, name, true);
    assert.equal(resolved.ok, false, "unissued authored tokens must never become saved parameters");
    if (resolved.ok) throw new Error("Missing-source resolution unexpectedly succeeded");
    assert.ok(resolved.issues.some((issue) => issue.severity === "error" && issue.code === "web.handle.unknown"), JSON.stringify(resolved.issues));
  });
}
