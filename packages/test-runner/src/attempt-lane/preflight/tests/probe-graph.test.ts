import assert from "node:assert/strict";
import test from "node:test";
import { offlinePreflightProbeGraph } from "../index.js";

test("the generic confirmation probe has exactly one read and no lasting action on either route", () => {
  const graph = offlinePreflightProbeGraph();
  const outputs = graph.nodes.flatMap((node) => "outputId" in node.parameterValues ? [node.parameterValues.outputId] : []);
  assert.deepEqual(outputs, ["web.dom.capture_snapshot"]);
  assert.equal(graph.edges.find((edge) => edge.sourceNodeId === "confirm-read" && edge.sourcePortId === "rejected")?.targetNodeId, "done");
  assert.equal(graph.edges.find((edge) => edge.sourceNodeId === "confirm-read" && edge.sourcePortId === "approved")?.targetNodeId, "read-page");
});
