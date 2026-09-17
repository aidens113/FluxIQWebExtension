import assert from "node:assert/strict";
import test from "node:test";
import { createdFlowActionTypes, createdFlowShape } from "../flow-shape.js";

/** A created Flow is described by Core's output names and counts, and a name that is not one is counted as unrecognized rather than copied. */
test("a created Flow's shape counts its action nodes by output, from either place a bootstrap node names it", () => {
  const nodes = [
    { id: "start", parameterValues: undefined },
    { id: "chosen", parameterValues: { outputId: "web.dom.click", parameters: { selector: "#go" } } },
    { id: "fixed", parameterValues: { selector: "#rows" }, outputActionId: "web.dom.extract_list" },
    { id: "both", parameterValues: { outputId: "web.browser.navigate" }, outputActionId: "web.dom.click" },
    { id: "odd", parameterValues: { outputId: "Click <b>here</b>" } },
  ];
  const actionTypes = createdFlowActionTypes(nodes, "flow.created");
  assert.deepEqual([...actionTypes], [["chosen", "web.dom.click"], ["fixed", "web.dom.extract_list"], ["both", "web.browser.navigate"], ["odd", "(unrecognized)"]]);
  assert.deepEqual(createdFlowShape(nodes, actionTypes), {
    nodeCount: 5,
    actionNodeCount: 4,
    actionTypes: { "(unrecognized)": 1, "web.browser.navigate": 1, "web.dom.click": 1, "web.dom.extract_list": 1 },
    extractNodes: 1,
    navigationNodes: 1,
  });
  assert.throws(() => createdFlowActionTypes([{ id: "start", parameterValues: undefined }], "flow.created"), /no node that dispatches a web action/u);
});
