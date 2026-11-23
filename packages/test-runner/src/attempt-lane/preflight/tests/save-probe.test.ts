import assert from "node:assert/strict";
import test from "node:test";
import { saveOfflinePreflightProbe } from "../save-probe.js";

type Call = { endpoint: string; payload: Record<string, unknown> };

/** A stand-in for Core's routes, answering each the way its public handler does. */
function routes(instructionStatus: string) {
  const calls: Call[] = [];
  const answers: Record<string, unknown> = {
    "create-flow": { flow: { flowId: "flow.probe" } },
    "save-flow-generation-instruction": { instruction: { instructionId: "instruction.probe", status: instructionStatus, updatedAt: 1 } },
    "create-flow-subflow": { subflow: { graphFlowId: "flow.probe.graph", subflowId: "subflow.primary" } },
    "get-flow": { flow: { flowId: "flow.probe.graph", nodes: [], edges: [] } },
    "save-flow": { flow: { flowId: "flow.probe.graph" } },
    "save-flow-map-fallback": {},
  };
  const automationStudioCall = async (endpoint: string, payload: Record<string, unknown> = {}) => {
    calls.push({ endpoint, payload });
    return answers[endpoint];
  };
  return { calls, control: { automationStudioCall } };
}

test("the probe Flow gets an active written task instruction before it can be run", async () => {
  const { calls, control } = routes("active");
  const probe = await saveOfflinePreflightProbe(control, { projectId: "project.fixture", authorizationPin: "0000" });
  assert.equal(probe.flowId, "flow.probe");
  const written = calls.find((call) => call.endpoint === "save-flow-generation-instruction");
  assert.ok(written);
  assert.deepEqual(Object.keys(written.payload).sort(), ["flowId", "instruction", "projectId"]);
  assert.equal(written.payload.flowId, "flow.probe");
  assert.match(String(written.payload.instruction), /read this isolated fixture page/u);
  assert.ok(calls.findIndex((call) => call.endpoint === "save-flow-generation-instruction") < calls.findIndex((call) => call.endpoint === "save-flow"));
});

test("an instruction Core did not keep active refuses the probe instead of running a Flow it would refuse", async () => {
  const { control } = routes("draft");
  await assert.rejects(() => saveOfflinePreflightProbe(control, { projectId: "project.fixture", authorizationPin: "0000" }), /preflight_probe_instruction_inactive/u);
});
