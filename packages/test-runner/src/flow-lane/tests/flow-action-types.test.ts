import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../failure.js";
import { readFlowActionTypes } from "../flow-action-types.js";

const recordedNode = (id: string, outputId: string) => ({ id, definitionId: "builtin.policy.action", parameterValues: { outputId, parameters: {} } });

function control(flows: Record<string, unknown[]>, subflows: unknown[]) {
  const calls: string[] = [];
  return {
    calls,
    automationStudioCall: async (endpoint: string, payload: Record<string, unknown> = {}) => {
      calls.push(`${endpoint}:${String(payload.flowId ?? "")}`);
      if (endpoint === "list-flow-subflows") return { subflows };
      if (endpoint === "get-flow") return { flow: { flowId: payload.flowId, nodes: flows[String(payload.flowId)] ?? [] } };
      throw new Error(`unexpected endpoint ${endpoint}`);
    },
  };
}

test("the recorded nodes live on the primary Subflow's graph Flow, not the parent", async () => {
  const client = control(
    { "flow.parent": [], "flow.graph": [recordedNode("recorded.one", "web.dom.type"), recordedNode("recorded.two", "web.dom.click")] },
    [{ subflowId: "subflow.primary", graphFlowId: "flow.graph" }],
  );
  const types = await readFlowActionTypes(client, { projectId: "project.web", flowId: "flow.parent" });
  assert.deepEqual([...types], [["recorded.one", "web.dom.type"], ["recorded.two", "web.dom.click"]]);
  assert.deepEqual(client.calls, ["get-flow:flow.parent", "list-flow-subflows:flow.parent", "get-flow:flow.graph"]);
});

test("nodes on the parent Flow are read too, and a subflow pointing back at it is not read twice", async () => {
  const client = control({ "flow.parent": [recordedNode("recorded.one", "web.dom.select")] }, [{ subflowId: "s", graphFlowId: "flow.parent" }]);
  const types = await readFlowActionTypes(client, { projectId: "project.web", flowId: "flow.parent" });
  assert.deepEqual([...types], [["recorded.one", "web.dom.select"]]);
  assert.equal(client.calls.filter(call => call === "get-flow:flow.parent").length, 1);
});

test("a paged subflow listing is read, and a node with no outputId is not an action", async () => {
  const paged = {
    automationStudioCall: async (endpoint: string, payload: Record<string, unknown> = {}) => {
      if (endpoint === "list-flow-subflows") return { page: { subflows: [{ graphFlowId: "flow.graph" }] } };
      return { flow: { flowId: payload.flowId, nodes: payload.flowId === "flow.graph" ? [{ id: "note", definitionId: "builtin.note", parameterValues: {} }, recordedNode("recorded.one", "web.dom.click")] : [] } };
    },
  };
  const types = await readFlowActionTypes(paged, { projectId: "project.web", flowId: "flow.parent" });
  assert.deepEqual([...types], [["recorded.one", "web.dom.click"]]);
});

test("a Flow that dispatches no output is refused, since its run could never be identified", async () => {
  const client = control({ "flow.parent": [] }, []);
  await assert.rejects(
    () => readFlowActionTypes(client, { projectId: "project.web", flowId: "flow.parent" }),
    (error: unknown) => error instanceof RunnerFailure && error.category === "recording.contract",
  );
});
