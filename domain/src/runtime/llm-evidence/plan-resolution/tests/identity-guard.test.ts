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
//
// The second control is lane 4's wordless icon (`run-mvcwqwec-0aa4f98b`): a
// list row's `<span>` with a pointer of its own, one hashed class and an
// unlabelled `<svg>`. The capture sends what it draws as `drawing`
// (`apps/extension/src/content/identity/drawing.ts`); the binding keeps it
// beside the selector, the saved step carries it, and the page receives it.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { normalizeAutomationStudioElementTarget } from "fluxiq/automation-studio";
import { webAutomationActionFromGatewayCommand } from "../../../../client";
import { outputTargetFromPayload, webAutomationOutputNodeId } from "../../../../output-nodes";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebAutomationLlmEvidenceRuntime } from "../..";
import { sanitizeWebLlmSnapshotWithBindings } from "../../sanitize";

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

const DRAWING = "d1.1x9kq3";
const titleLink: JsonObject = { tagName: "a", selector: "li:nth-of-type(2) h3 > a", visibleText: "Line Cook", accessibleName: "Line Cook", href: "https://jobs.test/line-cook" };
/** The row's icon control: no words, no id, one hashed class, a pointer of its own -- and, when the capture read one, a drawing. */
function rowIcon(drawing: string | undefined): JsonObject {
  const icon: JsonObject = { tagName: "span", selector: "li:nth-of-type(2) > div > span:nth-of-type(1)", classNames: ["q8f2"], attributes: { class: "q8f2" }, cursor: "pointer" };
  if (drawing !== undefined) icon.drawing = drawing;
  return icon;
}

/** The element the page is handed, through Core's target normalizer and the gateway mapping, as a Flow node's dispatch takes it. */
function dispatchedElement(parameters: JsonObject): JsonObject | undefined {
  const prepared: JsonObject = Object.assign({}, parameters);
  const target = normalizeAutomationStudioElementTarget(parameters, { source: "runtime" });
  if (target) prepared.target = target as unknown as JsonObject;
  const command = webAutomationActionFromGatewayCommand({ commandId: "command.one", actionType: "web.dom.click", parameters: prepared, target: outputTargetFromPayload(prepared) ?? {} });
  assert.equal("status" in command, false, "the command is dispatched");
  return (command as unknown as { element?: JsonObject }).element;
}

test("a wordless icon known by its tag and one class is refused; with what it draws it is saved, and the page receives the drawing", async () => {
  const bare = runtimeOver([titleLink, rowIcon(undefined)]);
  await look(bare);
  const refused = await bare.resolvePlanNodeParameters({ ...SCOPE, nodeDefinitionId: CLICK_NODE, parameters: { selector: { handle: "t2" } }, declaredConsequences: [] });
  assert.equal(refused.status, "refused", JSON.stringify(refused));
  if (refused.status === "refused") assert.equal(refused.issueCodes[0], "web.handle.unidentifiable");

  const drawn = runtimeOver([titleLink, rowIcon(DRAWING)]);
  await look(drawn);
  const saved = await drawn.resolvePlanNodeParameters({ ...SCOPE, nodeDefinitionId: CLICK_NODE, parameters: { selector: { handle: "t2" } }, declaredConsequences: [] });
  assert.equal(saved.status, "resolved", JSON.stringify(saved));
  if (saved.status !== "resolved") return;
  assert.equal((saved.parameters.element as JsonObject).drawing, DRAWING);
  assert.deepEqual((saved.parameters.element as JsonObject).classNames, ["q8f2"]);
  assert.equal(dispatchedElement(saved.parameters)?.drawing, DRAWING, "the drawing survives Core's normalizer and the gateway mapping");
});

test("the packet the model reads never carries a drawing; the binding keeps it beside the selector, and drops what is not one", () => {
  const binding = sanitizeWebLlmSnapshotWithBindings({ url: "https://jobs.test/results", interactiveElements: [titleLink, rowIcon(DRAWING), rowIcon("Save this job")] });
  assert.equal(JSON.stringify(binding.evidence).includes(DRAWING), false);
  assert.equal(binding.drawings?.get("t2"), DRAWING);
  assert.equal(binding.drawings?.has("t1"), false);
  assert.equal(binding.drawings?.has("t3"), false, "page text in the drawing's place is not a drawing");
});
