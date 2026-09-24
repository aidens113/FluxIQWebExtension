import assert from "node:assert/strict";
import test from "node:test";
import { WEB_LLM_DENIED_EVIDENCE_KEYS } from "@fluxiq-web-extension/domain/node";
import { validateAuthoredFlowNodes } from "@fluxiq-web-extension/test-contracts";
import type { FlowNodeRecord } from "../../flow-action-types.js";
import { createdFlowActionTypes } from "../flow-shape.js";
import { createdFlowAuthoredNodes } from "../authored-nodes.js";

/**
 * A Flow shaped like the ones that failed: go to the catalog, then extract it.
 * The extraction node is authored to walk three pages, which is the fact six
 * live runs reported `expectedRecords 8, observedRecords 23` without ever
 * stating -- 8 a page across 3 pages is exactly 24, and 23 is what the Flow
 * came back with.
 */
const NODES: readonly FlowNodeRecord[] = [
  { id: "node.start", definitionId: "builtin.control.start", parameterValues: undefined },
  { id: "node.open", definitionId: "web.output.browser-navigate", parameterValues: { url: "http://127.0.0.1:4100/scenarios/product-catalog/" }, outputActionId: "web.browser.navigate" },
  { id: "node.extract", definitionId: "web.output.dom-extract_list", parameterValues: { selector: "[data-testid=\"card\"]", fields: { name: "[data-testid=\"name\"]" }, pagination: { mode: "next", maxPages: 3 } }, outputActionId: "web.dom.extract_list" },
];

const authored = (nodes: readonly FlowNodeRecord[]) => createdFlowAuthoredNodes(nodes, createdFlowActionTypes(nodes, "flow.created"));

test("every action node is recorded with its definition, its output and what it was told to do", () => {
  assert.deepEqual(authored(NODES), [
    { nodeId: "node.open", definitionId: "web.output.browser-navigate", outputId: "web.browser.navigate", parameters: { url: "http://127.0.0.1:4100" }, parametersWithheld: [] },
    {
      nodeId: "node.extract",
      definitionId: "web.output.dom-extract_list",
      outputId: "web.dom.extract_list",
      // The answer the six runs needed, in one line: the extraction was
      // authored to follow the next-page control up to three times, for an
      // instruction that asked for the first page.
      parameters: { fields: { name: null }, pagination: { mode: "next", maxPages: 3 } },
      parametersWithheld: ["selector", "fields.name"],
    },
  ]);
});

test("a node that dispatches nothing is not an action node and contributes no entry", () => {
  const list = authored(NODES);
  assert.equal(list.some((entry) => entry.nodeId === "node.start"), false);
  assert.equal(list.length, createdFlowActionTypes(NODES, "flow.created").size, "the list and the shape read the same map, so they cannot disagree about which nodes acted");
});

test("an output name that is not shaped like one is recorded as unrecognized, the same word the shape counts it under", () => {
  const nodes = [{ id: "node.odd", definitionId: "builtin.policy.action", parameterValues: { outputId: "Click <b>here</b>" } }];
  assert.deepEqual(authored(nodes), [{ nodeId: "node.odd", definitionId: "builtin.policy.action", outputId: "(unrecognized)", parameters: { outputId: null }, parametersWithheld: ["outputId"] }]);
});

test("a definition id Core did not state reads as null rather than as an absent node", () => {
  const nodes = [{ id: "node.open", parameterValues: { outputId: "web.browser.navigate" } }];
  assert.deepEqual(authored(nodes)[0]?.definitionId, null);
});

test("what the builder produces is a record the contract accepts", () => {
  const list = authored(NODES);
  assert.deepEqual(validateAuthoredFlowNodes(list, WEB_LLM_DENIED_EVIDENCE_KEYS), { valid: true, value: list });
});
