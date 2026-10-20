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
import { createWebLlmStableTargetHandles } from "../../stable-handles";
import { createWebLlmExtractionHandles } from "../../structure";
import { createWebLlmTargetPackets, resolveWebPlanNodeParameters, type WebPlanNodeResolutionInput } from "..";

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

// A read's target keeps its words, marked as the value the step reads (`../read-identity.ts`, t743 D2b).
//
// Office rerun round 4 (`run-mvgvyaip-d856e135`, 0052-0071): a step read a paragraph whose words an earlier step of
// the same Flow changed, its identity carried the words it was captured with, and the page refused it four times.
// D2 saved a read's target without its words, and the save-time guard then refused a bare paragraph read. Held here
// on an invoice page whose total a discount changes between two views:
// - an extract step on the total keeps its words and is marked `readsWords`, in text, value and html mode, and so is
//   a text assertion; an attribute read, an existence assertion and a press are not marked;
// - a name shown beside different words, and a name that arrives alone, are both kept: which of them are the value
//   read is the page's rule (`apps/extension/src/content/identity/read-words.ts`);
// - the same handle submitted again after a newer capture resolves from the newer view, and only the words differ;
// - a bare `<span>` read target with only its tag, selector and words saves: the guard counts the words.
// (Moved here from its own file: the tests folder is at its 25-file limit; its constants are scoped to this block.)
{
  const SCOPE = { projectId: "project.read", flowId: "flow.read" };
  const URL_ = "https://invoices.test/invoice/42";
  const EXTRACT = webAutomationOutputNodeId("web.dom.extract");
  const ASSERT = webAutomationOutputNodeId("web.dom.assert");
  const CLICK = webAutomationOutputNodeId("web.dom.click");
  const TOTAL = "#summary > p:nth-of-type(2)";
  const APPLY = "#summary > button";
  const BARE = "#summary > span";

  const total = (words: string): JsonObject => ({ tagName: "p", selector: TOTAL, visibleText: words, classNames: ["summary-line", "total"], attributes: { class: "summary-line total" } });
  const apply = (words: string): JsonObject => ({ tagName: "button", selector: APPLY, visibleText: words, accessibleName: words, implicitRole: "button", classNames: ["btn", "discount"], attributes: { class: "btn discount" } });
  const bare = (words: string): JsonObject => ({ tagName: "span", selector: BARE, visibleText: words });

  /** The invoice page's handle store, one capture per element list, numbered for the whole Flow as the authoring tools number them. */
  function invoice() {
    const targets = createWebLlmTargetPackets();
    const handles = createWebLlmStableTargetHandles();
    const stores = { targets, extractions: createWebLlmExtractionHandles() };
    const capture = (elements: JsonObject[]): Map<string, string> => {
      const binding = handles.restamp(SCOPE, sanitizeWebLlmSnapshotWithBindings({ url: URL_, interactiveElements: elements }));
      targets.remember(SCOPE, binding);
      return new Map([...binding.selectors].map(([handle, selector]) => [selector, handle]));
    };
    return { stores, capture };
  }

  function candidate(nodeDefinitionId: string, parameters: JsonObject): WebPlanNodeResolutionInput {
    return { ...SCOPE, nodeDefinitionId, parameters, declaredConsequences: [], permission: async () => ({ permitted: true as const }), handleReach: "view_history" };
  }

  async function resolvedElement(stores: ReturnType<typeof invoice>["stores"], nodeDefinitionId: string, parameters: JsonObject) {
    const answer = await resolveWebPlanNodeParameters(candidate(nodeDefinitionId, parameters), stores);
    assert.equal(answer.status, "resolved", JSON.stringify(answer));
    if (answer.status !== "resolved") throw new Error("unresolved");
    return { element: answer.parameters.element as JsonObject, parameters: answer.parameters, views: answer.handleViews ?? [] };
  }

  test("an extract step on a total whose words differ between two views keeps its words, marked as the value it reads", async () => {
    const { stores, capture } = invoice();
    const handle = capture([total("Total 40.00"), apply("Apply discount")]).get(TOTAL)!;
    capture([total("Total 36.00"), apply("Discount applied")]);
    for (const mode of ["text", "value", "html"]) {
      const { element, parameters } = await resolvedElement(stores, EXTRACT, { target: { handle }, extract: { mode } });
      assert.equal(parameters.selector, TOTAL);
      assert.equal(element.readsWords, true, `${mode}: ${JSON.stringify(element)}`);
      assert.equal(typeof element.visibleText, "string", `${mode}: the words are a true description, and are kept`);
      assert.equal(element.tagName, "p");
      assert.equal(element.selector, TOTAL);
      assert.deepEqual(element.classNames, ["summary-line", "total"]);
    }
    // The legacy read mode is the same read.
    const legacy = await resolvedElement(stores, EXTRACT, { target: { handle }, options: { mode: "text" } });
    assert.equal(legacy.element.readsWords, true);
    const asserted = await resolvedElement(stores, ASSERT, { target: { handle }, assert: { kind: "text", expected: "Total" } });
    assert.equal(asserted.element.readsWords, true, "a text assertion reads the words too");
  });

  test("an attribute read, an existence assertion and a press keep the element's words unmarked", async () => {
    const { stores, capture } = invoice();
    const handles = capture([total("Total 40.00"), apply("Apply discount")]);
    const attribute = await resolvedElement(stores, EXTRACT, { target: { handle: handles.get(TOTAL)! }, extract: { mode: "attribute", attribute: "data-amount" } });
    assert.equal(attribute.element.visibleText, "Total 40.00");
    assert.equal(attribute.element.readsWords, undefined);
    const exists = await resolvedElement(stores, ASSERT, { target: { handle: handles.get(TOTAL)! }, assert: { kind: "exists" } });
    assert.equal(exists.element.visibleText, "Total 40.00");
    assert.equal(exists.element.readsWords, undefined);
    const press = await resolvedElement(stores, CLICK, { target: { handle: handles.get(APPLY)! } });
    // The packet keeps a button's words once, as its name (`../../elements.ts`).
    assert.equal(press.element.accessibleName, "Apply discount");
    assert.equal(press.element.readsWords, undefined);
  });

  test("a read's names are kept beside its words, whether they differ from them or arrive alone", async () => {
    const { stores, capture } = invoice();
    const labelled = Object.assign(total("Total 40.00"), { accessibleName: "Amount due" });
    const handle = capture([labelled, apply("Apply discount")]).get(TOTAL)!;
    const { element } = await resolvedElement(stores, EXTRACT, { target: { handle }, extract: { mode: "text" } });
    assert.equal(element.visibleText, "Total 40.00");
    assert.equal(element.accessibleName, "Amount due");
    assert.equal(element.readsWords, true);
    // The packet drops a text equal to the name, so only the name reaches the identity; the page treats it as the words.
    const second = invoice();
    const named = Object.assign(total("Total 40.00"), { accessibleName: "Total 40.00" });
    const alone = second.capture([named, apply("Apply discount")]).get(TOTAL)!;
    const read = await resolvedElement(second.stores, EXTRACT, { target: { handle: alone }, extract: { mode: "text" } });
    assert.equal(read.element.readsWords, true);
    assert.ok(JSON.stringify(read.element).includes("Total 40.00"), JSON.stringify(read.element));
  });

  test("a handle submitted again after a newer capture resolves from the newer view, and only the words read differ", async () => {
    const { stores, capture } = invoice();
    const handle = capture([total("Total 40.00"), apply("Apply discount")]).get(TOTAL)!;
    const first = await resolvedElement(stores, EXTRACT, { target: { handle }, extract: { mode: "text" } });
    assert.deepEqual(first.views.map((view) => view.view), [1]);
    capture([total("Total 36.00"), apply("Discount applied")]);
    const again = await resolvedElement(stores, EXTRACT, { target: { handle }, extract: { mode: "text" } });
    assert.deepEqual(again.views.map((view) => view.view), [2], "the newest view that shows the handle");
    const { visibleText: _firstWords, accessibleName: _firstName, ...firstRest } = first.element;
    const { visibleText: _againWords, accessibleName: _againName, ...againRest } = again.element;
    assert.deepEqual(againRest, firstRest, "everything but the value read is the same whichever view the model named it from");
  });

  test("a bare read target with only its tag, selector and words saves, its words marked", async () => {
    const { stores, capture } = invoice();
    const handle = capture([bare("Total 40.00"), apply("Apply discount")]).get(BARE)!;
    const { element, parameters } = await resolvedElement(stores, EXTRACT, { target: { handle }, extract: { mode: "text" } });
    assert.equal(parameters.selector, BARE);
    assert.equal(element.tagName, "span");
    assert.equal(element.visibleText, "Total 40.00");
    assert.equal(element.readsWords, true);
  });
}
