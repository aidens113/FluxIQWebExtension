import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../../../failure.js";
import type { FlowNodeRecord } from "../../../flow-action-types.js";
import { assertNoDetourCopied } from "../detour-copy-fact.js";

const detours = [{ stepIds: ["a"], why: "extra filter", acts: [{ operation: "click" as const, target: "Brightaisle Plus" }] }];
const graph = (nodes: FlowNodeRecord[]) => ({ nodes, edges: [] });

test("holds for a Flow with no node that does what the detour did", () => {
  assert.doesNotThrow(() => assertNoDetourCopied(graph([{ id: "n1", definitionId: "web.output.dom-extract_list", parameterValues: {} }]), detours));
});

test("fails as the named fact detour.copied when a node does what the detour did", () => {
  const copying = { id: "n7", definitionId: "web.output.dom-click", parameterValues: { target: { element: { visibleText: "Brightaisle Plus" } } } };
  try { assertNoDetourCopied(graph([copying]), detours); }
  catch (error) {
    if (!(error instanceof RunnerFailure) || error.details?.fact !== "detour.copied") throw error;
    assert.match(error.message, /^detour\.copied:/u);
    return;
  }
  assert.fail("a Flow that clicks the detour's control should fail detour.copied");
});
