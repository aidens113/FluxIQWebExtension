import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../failure.js";
import { readFlowActionTypes, readFlowNodes } from "../flow-action-types.js";

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

/**
 * `g-runner-start-guard`: the lane places a run's start in the recording's order
 * through the candidate id approval writes onto each recorded node. It arrives
 * with the one read the lane already makes, and is never read out of a node id.
 */
test("each node carries the recorded candidate its metadata names, and a node with none, or a malformed one, carries none", async () => {
  const withMetadata = (id: string, metadata: unknown) => ({ ...recordedNode(id, "web.dom.click"), metadata });
  const client = control({
    "flow.parent": [],
    "flow.graph": [
      // The id says entry 10 and the metadata says entry 9: the metadata is what is read.
      withMetadata("recorded.candidate.entry.10.one", { recordingCandidateId: "candidate.entry.9.one", mapperId: "web-recording-actions" }),
      recordedNode("recorded.plain", "web.dom.click"),
      withMetadata("recorded.empty", { recordingCandidateId: "" }),
      withMetadata("recorded.number", { recordingCandidateId: 7 }),
      withMetadata("recorded.list", ["candidate.list"]),
    ],
  }, [{ subflowId: "subflow.primary", graphFlowId: "flow.graph" }]);
  const nodes = await readFlowNodes(client, { projectId: "project.web", flowId: "flow.parent" });
  assert.deepEqual(nodes.map((node) => node.recordingCandidateId), ["candidate.entry.9.one", undefined, undefined, undefined, undefined]);
  assert.deepEqual(nodes.filter((node) => Object.hasOwn(node, "recordingCandidateId")).map((node) => node.id), ["recorded.candidate.entry.10.one"]);
  assert.deepEqual(client.calls, ["get-flow:flow.parent", "list-flow-subflows:flow.parent", "get-flow:flow.graph"], "carried by the one read");
});
