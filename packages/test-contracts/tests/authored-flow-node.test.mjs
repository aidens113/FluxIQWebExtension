import assert from "node:assert/strict";
import test from "node:test";
// A namespace import, so a member this build does not export fails its own tests rather than the whole file.
import * as contracts from "../dist/index.js";

const { validateAuthoredFlowNodes, assertAuthoredFlowNodes, AUTHORED_FLOW_NODE_BOUNDS, AUTHORED_FLOW_NODE_UNRECOGNIZED_OUTPUT } = contracts;

// The domain's declaration, as `domain/src/runtime/llm-evidence/denied-keys.ts`
// states it. Passed as declared, for the reason Core's parameter screen
// requires it: an absent declaration means nobody said what this medium's raw
// payload is called, never "deny nothing".
const DENIED = ["html", "innerHtml", "outerHtml", "pageSource", "cookies", "headers", "selector"];

/**
 * The record that would have ended six undiagnosable runs. Each
 * `product-catalog` extract run reported `expectedRecords 8, observedRecords
 * 23`, and no artifact said whether the extraction had been authored to walk
 * the fixture's other two pages. `pagination` is that answer, and it is two
 * closed words and a number.
 */
const extractNode = (overrides = {}) => ({
  nodeId: "node.extract",
  definitionId: "web.output.dom-extract_list",
  outputId: "web.dom.extract_list",
  parameters: { pagination: { mode: "next", maxPages: 3 }, fields: { name: null }, url: "http://127.0.0.1:4100" },
  parametersWithheld: ["selector", "fields.name"],
  ...overrides,
});

const issuesOf = (nodes) => {
  const checked = validateAuthoredFlowNodes(nodes, DENIED);
  return checked.valid ? [] : checked.issues.map((issue) => `${issue.path} ${issue.message}`);
};

test("a screened action node validates, with its origin, its closed words and its withheld paths", () => {
  const nodes = [extractNode()];
  assert.deepEqual(validateAuthoredFlowNodes(nodes, DENIED), { valid: true, value: nodes });
  assert.doesNotThrow(() => assertAuthoredFlowNodes(nodes, DENIED));
  assert.deepEqual(issuesOf([extractNode({ definitionId: null, outputId: AUTHORED_FLOW_NODE_UNRECOGNIZED_OUTPUT })]), [], "an unstated definition and an unrecognized output are both recorded outcomes");
  assert.deepEqual(issuesOf([extractNode({ parameters: {}, parametersWithheld: [] })]), [], "a node that authored no parameters is a record, not an omission");
});

/**
 * The one failure this contract exists to catch. A denied key is the medium's
 * own word for its raw payload, so its value is the page itself: a screen that
 * let one through would be writing a page into a run bundle, and it must fail a
 * check rather than pass unnoticed.
 */
test("a key the domain denies is refused at any depth", () => {
  assert.deepEqual(issuesOf([extractNode({ parameters: { selector: "#rows" } })]), ["$[0].parameters.selector must not carry a key the domain denies"]);
  assert.deepEqual(issuesOf([extractNode({ parameters: { where: { "page-source": "..." } } })]), ["$[0].parameters.where.page-source must not carry a key the domain denies"], "the comparison is Core's spelling rule: `_` and `-` removed, lowercased");
  assert.deepEqual(issuesOf([extractNode({ parameters: { rows: [{ innerHTML: "x" }] } })]), ["$[0].parameters.rows[0].innerHTML must not carry a key the domain denies"]);
});

test("a string is an origin or it is short, so a paragraph of page text cannot ride an innocent key", () => {
  assert.deepEqual(issuesOf([extractNode({ parameters: { label: "x".repeat(AUTHORED_FLOW_NODE_BOUNDS.textLength + 1) } })]), [`$[0].parameters.label must be an http(s) origin or at most ${AUTHORED_FLOW_NODE_BOUNDS.textLength} characters`]);
  assert.deepEqual(issuesOf([extractNode({ parameters: { url: `https://example.com/${"a".repeat(200)}` } })]), ["$[0].parameters.url must be an http(s) origin or at most 80 characters"], "an origin with a path is not an origin");
  assert.deepEqual(issuesOf([extractNode({ parameters: { url: "https://example.com:8443" } })]), []);
});

test("a withheld entry is a path, never the value that was withheld", () => {
  assert.deepEqual(issuesOf([extractNode({ parametersWithheld: ["Buy the blue lamp now"] })]), ["$[0].parametersWithheld[0] must be a dotted parameter path, never the value that was withheld"]);
  assert.deepEqual(issuesOf([extractNode({ parametersWithheld: ["selector", "selector"] })]), ["$[0].parametersWithheld withheld paths must be unique"]);
  assert.deepEqual(issuesOf([extractNode({ parametersWithheld: Array.from({ length: AUTHORED_FLOW_NODE_BOUNDS.withheldPaths + 1 }, (_, index) => `field.${index}`) })]), [`$[0].parametersWithheld must hold at most ${AUTHORED_FLOW_NODE_BOUNDS.withheldPaths} paths`]);
  assert.deepEqual(issuesOf([extractNode({ parametersWithheld: ["where[2].field"] })]), [], "an array index is part of a path");
});

test("the containers stay bounded, so a screen that stopped bounding its walk fails here", () => {
  const wide = Object.fromEntries(Array.from({ length: AUTHORED_FLOW_NODE_BOUNDS.keysPerObject + 1 }, (_, index) => [`k${index}`, index]));
  assert.deepEqual(issuesOf([extractNode({ parameters: wide })]), [`$[0].parameters must hold at most ${AUTHORED_FLOW_NODE_BOUNDS.keysPerObject} keys`]);
  const long = { items: Array.from({ length: AUTHORED_FLOW_NODE_BOUNDS.itemsPerArray + 1 }, (_, index) => index) };
  assert.deepEqual(issuesOf([extractNode({ parameters: long })]), [`$[0].parameters.items must hold at most ${AUTHORED_FLOW_NODE_BOUNDS.itemsPerArray} items`]);
  let deep = 1;
  for (let level = 0; level < AUTHORED_FLOW_NODE_BOUNDS.depth + 4; level += 1) deep = { nested: deep };
  assert.deepEqual(issuesOf([extractNode({ parameters: deep })]), [`$[0].parameters${".nested".repeat(AUTHORED_FLOW_NODE_BOUNDS.depth + 1)} must not nest past ${AUTHORED_FLOW_NODE_BOUNDS.depth} levels`]);
});

test("the identity fields are identifiers, unique across the list, and nothing else", () => {
  assert.deepEqual(issuesOf([extractNode({ nodeId: "the extract step" })]), ["$[0].nodeId must be a Core identifier"]);
  assert.deepEqual(issuesOf([extractNode({ definitionId: "extract list node" })]), ["$[0].definitionId must be a Core identifier or null"]);
  assert.deepEqual(issuesOf([extractNode({ outputId: "Click here" })]), [`$[0].outputId must be a domain output name of at most 64 characters, or ${AUTHORED_FLOW_NODE_UNRECOGNIZED_OUTPUT}`]);
  assert.deepEqual(issuesOf([extractNode(), extractNode()]), ["$ node ids must be unique"]);
  assert.deepEqual(issuesOf([{ ...extractNode(), label: "Extract the catalog" }]), ["$[0].label unknown property"]);
});
