// The save-time identity guard on a build's step (t425, the user's rule of
// 2026-10-10): a step whose control would be found by one attribute alone is
// refused at its script line, through the refusal every other handle mistake
// takes, so the model resubmits -- and is told nothing about fingerprints.
//
// The control is R4a's quantity box at its thinnest: an input known only by an
// id the page mints again on every load, which its selector is addressed
// through (`reports/r4a-debug-run-mv2pgqkj.md`). However many fields the
// model-built identity carries, that id is the selector said twice, so the box
// stays one signal short until the page offers it a label, a class or a name.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { webAutomationOutputNodeId } from "../../../../output-nodes";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebAutomationLlmEvidenceRuntime } from "../..";

const TYPE_NODE = webAutomationOutputNodeId("web.dom.type");
const CLICK_NODE = webAutomationOutputNodeId("web.dom.click");
const SCOPE = { projectId: "project.identity-guard", flowId: "flow.identity-guard" };

const quantity: JsonObject = { tagName: "input", selector: "#fb1l6ufkg", inputType: "text", attributes: { id: "fb1l6ufkg", type: "text", inputmode: "numeric" } };
const addToCart: JsonObject = { tagName: "button", selector: "#add", visibleText: "Add to cart" };

function runtimeOver(elements: JsonObject[]): WebAutomationLlmEvidenceRuntime {
  return createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => command.actionType === "web.dom.capture_snapshot"
      ? { status: "succeeded", payload: { snapshot: { url: "https://shop.test/item", title: "Item", interactiveElements: elements } } }
      : { status: "succeeded" }
  });
}

async function look(runtime: WebAutomationLlmEvidenceRuntime): Promise<void> {
  await runtime.executeTool({ ...SCOPE, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });
}

test("a step naming a control found by one attribute alone is refused at its line, in a closed code", async () => {
  const runtime = runtimeOver([quantity, addToCart]);
  await look(runtime);
  const answer = await runtime.resolvePlanNodeParameters({ ...SCOPE, nodeDefinitionId: TYPE_NODE, parameters: { selector: { handle: "t1" }, text: "3" }, declaredConsequences: [] });
  assert.deepEqual(answer, { status: "refused", issueCodes: ["web.handle.unidentifiable", "web.handle.unidentifiable:selector"] });
  // What the model is told names the step and the code, never a selector, an id or a signal.
  assert.equal(JSON.stringify(answer).includes("fb1l6ufkg"), false);
});

test("a step naming a control the page describes in more ways is resolved as before", async () => {
  const runtime = runtimeOver([quantity, addToCart]);
  await look(runtime);
  const answer = await runtime.resolvePlanNodeParameters({ ...SCOPE, nodeDefinitionId: CLICK_NODE, parameters: { selector: { handle: "t2" } }, declaredConsequences: [] });
  assert.equal(answer.status, "resolved", JSON.stringify(answer));
});

test("exploration's own act, which saves no step, is not judged", async () => {
  const runtime = runtimeOver([quantity, addToCart]);
  await look(runtime);
  const answer = await runtime.resolvePlanNodeParameters({ ...SCOPE, nodeDefinitionId: TYPE_NODE, parameters: { selector: { handle: "t1" }, text: "3" }, declaredConsequences: [], gatedByCaller: true });
  assert.equal(answer.status, "resolved", JSON.stringify(answer));
});

test("a step that names no handle is one the Flow already holds, or a person wrote, and is never re-judged", async () => {
  const runtime = runtimeOver([quantity, addToCart]);
  await look(runtime);
  const answer = await runtime.resolvePlanNodeParameters({ ...SCOPE, nodeDefinitionId: TYPE_NODE, parameters: { selector: "#fb1l6ufkg", element: { tagName: "input", selector: "#fb1l6ufkg" }, text: "3" }, declaredConsequences: [] });
  assert.deepEqual(answer, { status: "unchanged" });
});
