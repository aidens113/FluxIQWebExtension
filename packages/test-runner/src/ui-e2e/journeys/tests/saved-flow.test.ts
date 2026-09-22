// Whether a saved Flow is the same Flow, unchanged, after the restart.

import assert from "node:assert/strict";
import test from "node:test";
import { changedIdentityFields } from "../saved-flow.js";

const identity = {
  projectId: "project.one", flowId: "flow.one", subflowId: "subflow.one", graphFlowId: "flow.one.graph", routerId: "router.one",
  parentContentHash: "hash.parent", graphContentHash: "hash.graph",
};

test("identical readings differ in nothing; an edited graph or a replaced Subflow is named", () => {
  assert.deepEqual(changedIdentityFields(identity, { ...identity }), []);
  assert.deepEqual(changedIdentityFields(identity, { ...identity, graphContentHash: "hash.edited" }), ["graphContentHash"]);
  assert.deepEqual(changedIdentityFields(identity, { ...identity, subflowId: "subflow.two", graphFlowId: "flow.one.graph.two" }), ["subflowId", "graphFlowId"]);
});
