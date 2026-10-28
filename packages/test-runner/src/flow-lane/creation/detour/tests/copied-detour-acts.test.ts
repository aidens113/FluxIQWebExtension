import assert from "node:assert/strict";
import test from "node:test";
import type { ScenarioDemonstration } from "@fluxiq-web-extension/test-contracts";
import type { FlowNodeRecord } from "../../../flow-action-types.js";
import { copiedDetourActs } from "../copied-detour-acts.js";

const detours: ScenarioDemonstration["detours"] = [
  { stepIds: ["d1"], why: "an extra tab", acts: [{ operation: "click", target: "Orders" }] },
  { stepIds: ["d2"], why: "a wrong sort", acts: [{ operation: "select", target: "Sort by", value: "Relevance" }] },
];
const node = (id: string, definitionId: string, element: Record<string, unknown> | undefined, extra: Record<string, unknown> = {}): FlowNodeRecord =>
  ({ id, definitionId, parameterValues: { ...(element ? { element } : {}), ...extra } });
const graph = (nodes: FlowNodeRecord[]) => ({ nodes, edges: [] });

test("a clean Flow copies nothing", () => {
  const clean = graph([node("main.s1", "web.output.dom-click", { visibleText: "Add to cart" }), node("main.s2", "web.output.dom-extract_list", { visibleText: "Results" })]);
  assert.deepEqual(copiedDetourActs(clean, detours), []);
});

test("a click on the detour's label is one hit, however it is cased or spaced", () => {
  const hit = copiedDetourActs(graph([node("main.s1", "web.output.dom-click", { accessibleName: "  ORDERS " })]), detours);
  assert.deepEqual(hit, [{ nodeId: "main.s1", act: detours[0]!.acts[0], matchedOn: ["operation", "target"] }]);
});

test("the same label under another operation is not a copy", () => {
  assert.deepEqual(copiedDetourActs(graph([node("main.s1", "web.output.dom-type", { label: "Orders" }, { text: "x" })]), detours), []);
});

test("a node in a Subflow graph is read like any other", () => {
  const nodes = [node("main.s1", "web.output.dom-click", { visibleText: "Add to cart" }), node("sub.a.s3", "web.output.dom-click", { label: "Orders" })];
  assert.deepEqual(copiedDetourActs(graph(nodes), detours).map((copied) => copied.nodeId), ["sub.a.s3"]);
});

test("an act that names a value needs the node's value to equal it", () => {
  const select = (option: unknown) => graph([node("main.s4", "web.output.dom-select", { label: "Sort by" }, { option })]);
  assert.deepEqual(copiedDetourActs(select({ by: "label", label: "Price: low to high" }), detours), []);
  const hit = copiedDetourActs(select({ by: "label", label: "relevance" }), detours);
  assert.deepEqual(hit.map((copied) => [copied.nodeId, copied.matchedOn]), [["main.s4", ["operation", "target", "value"]]]);
});

test("a read node that says Orders, and a node with no readable target, never match", () => {
  const nodes = [
    node("main.s1", "web.output.dom-extract_list", { visibleText: "Orders" }),
    node("main.s2", "web.output.dom-capture_snapshot", { text: "Orders" }),
    node("main.s3", "web.output.dom-click", undefined, { selector: "#orders" }),
  ];
  assert.deepEqual(copiedDetourActs(graph(nodes), detours), []);
});
