// A created node's identity keeps every stable fact the packet had about its
// element, so the page can find the element after its address changes (t422).
//
// R4a (`run-mv2pgqkj-f3552c70`): crossborder's quantity box has no accessible
// name, no text an input's identity keeps, and an id the page mints again on
// every load. The packet knew it by its label, "Quantity", and the identity
// dropped that, so the step was saved as `{ tagName: "input", selector:
// "#fb1l6ufkg" }`. Once the page set aside the id no element still carried
// (t419), nothing was left to find the box by, and both trials failed
// `web.target.not_found` with the box in plain view.
//
// A created node's identity is now the whole fingerprint a recorded node's is
// (user, 2026-10-10), built by the recorded path's own normalizer. What these
// rows prove, on the domain's side of the wire:
// - the box's identity carries its label, its implied role, its id and its
//   class tokens as signals of their own, and they reach the page's
//   `command.element` through Core's normalizer and the gateway mapping; the
//   extension's content spec `created-identity/tests/fingerprint-after-change.spec.ts`
//   shows the box found after its id, its class or its label changes, and not
//   found once all three have;
// - the identifying attributes ride (a `name`, a placeholder, an aria-label, a
//   test id), and nothing that is the element's state or contents: not its
//   value, its `type`, its `inputmode`, its `autocomplete`;
// - a control whose `autocomplete` says it holds a secret keeps no words at all;
// - a label two views of one handle disagree on is dropped, as a name is.

import assert from "node:assert/strict";
import test from "node:test";
import type { AutomationStudioActionConsequence } from "fluxiq/automation-studio";
import { normalizeAutomationStudioElementTarget } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { webAutomationActionFromGatewayCommand } from "../../../../client";
import { elementFingerprint, outputTargetFromPayload, webAutomationOutputNodeId } from "../../../../output-nodes";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebAutomationLlmEvidenceRuntime } from "../..";
import { sanitizeWebLlmSnapshotWithBindings } from "../../sanitize";
import { createWebLlmTargetPackets } from "..";

const TYPE_NODE = webAutomationOutputNodeId("web.dom.type");
const ITEM_URL = "http://127.0.0.1:4100/scenarios/crossborder-marketplace/item/1005008123450";
const NOTHING_LASTING: readonly AutomationStudioActionConsequence[] = [];

/**
 * The quantity box as `describe-element.ts` puts it in a snapshot: a per-load
 * id, a label inferred from the "Quantity" text before it (`label.ts`), no
 * accessible name, and the value the page set.
 */
const quantityBox = (id: string, label = "Quantity", classes = "q7k2-qty"): JsonObject => ({
  tagName: "input",
  selector: `#${id}`,
  inputType: "text",
  label,
  implicitRole: "textbox",
  id,
  classNames: classes.split(" "),
  value: "1",
  hasValue: true,
  attributes: { class: classes, id, type: "text", inputmode: "numeric", value: "1" }
});
const searchBox: JsonObject = {
  tagName: "input",
  selector: 'input[name="q"]',
  inputType: "search",
  accessibleName: "Search",
  implicitRole: "searchbox",
  attributes: { name: "q", type: "search", placeholder: "Search Farbazaar", "aria-label": "Search", autocomplete: "off", "data-testid": "search-box" }
};

function runtimeOver(elements: () => JsonObject[]): WebAutomationLlmEvidenceRuntime {
  return createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => command.actionType === "web.dom.capture_snapshot"
      ? { status: "succeeded", payload: { snapshot: { url: ITEM_URL, title: "Item", interactiveElements: elements() } } }
      : { status: "succeeded" }
  });
}

let calls = 0;
async function look(runtime: WebAutomationLlmEvidenceRuntime): Promise<void> {
  calls += 1;
  await runtime.executeTool({ projectId: "project.one", flowId: "flow.one", callId: `call.look.${calls}`, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: webAutomationOutputNodeId("web.dom.capture_snapshot"), parameters: {}, consequences: [] } });
}

async function typedElement(runtime: WebAutomationLlmEvidenceRuntime, handle: string): Promise<JsonObject> {
  const resolution = await runtime.resolvePlanNodeParameters({ projectId: "project.one", flowId: "flow.one", nodeDefinitionId: TYPE_NODE, parameters: { selector: { handle }, text: "3" }, declaredConsequences: NOTHING_LASTING });
  assert.equal(resolution.status, "resolved", JSON.stringify(resolution));
  return resolution.status === "resolved" ? resolution.parameters : {};
}

/** The element the page is handed, through Core's normalizer, the wire target and the gateway mapping. */
function dispatchedElement(parameters: JsonObject): JsonObject | undefined {
  const prepared: JsonObject = Object.assign({}, parameters);
  const target = normalizeAutomationStudioElementTarget(parameters, { source: "runtime" });
  if (target) prepared.target = target as unknown as JsonObject;
  const command = webAutomationActionFromGatewayCommand({ commandId: "command.one", actionType: "web.dom.type", parameters: prepared, target: outputTargetFromPayload(prepared) ?? {} });
  assert.equal("status" in command, false, "the command is dispatched");
  return (command as unknown as { element?: JsonObject }).element;
}

test("R4a rebuilt: the quantity box is saved by its whole fingerprint, not by its per-load address alone", async () => {
  const runtime = runtimeOver(() => [searchBox, quantityBox("fb1l6ufkg")]);
  await look(runtime);
  const parameters = await typedElement(runtime, "t2");
  assert.deepEqual(parameters.element, { tagName: "input", implicitRole: "textbox", label: "Quantity", selector: "#fb1l6ufkg", id: "fb1l6ufkg", classNames: ["q7k2-qty"] });
  // The recorded normalizer reads it back unchanged: the shape is a recorded node's.
  assert.deepEqual(elementFingerprint(parameters.element), parameters.element);

  const element = dispatchedElement(parameters);
  assert.equal(element?.label, "Quantity", "the label reaches the page");
  assert.equal(element?.implicitRole, "textbox");
  assert.equal(element?.id, "fb1l6ufkg", "the id is a signal of its own, which the page sets aside once nothing carries it");
  assert.deepEqual(element?.classNames, ["q7k2-qty"]);
  // Nothing that is the box's contents or how it behaves.
  const carried = JSON.stringify(element);
  assert.equal(carried.includes("\"1\""), false, "the value never rides");
  assert.equal(carried.includes("numeric"), false, "inputmode is behaviour, not identity");
});

test("the identifying attributes ride: a name, a placeholder, an aria-label and a test id, and nothing about how the control behaves", async () => {
  const runtime = runtimeOver(() => [searchBox]);
  await look(runtime);
  const parameters = await typedElement(runtime, "t1");
  assert.deepEqual(parameters.element, {
    tagName: "input",
    implicitRole: "searchbox",
    accessibleName: "Search",
    selector: 'input[name="q"]',
    inputType: "search",
    name: "q",
    testId: "search-box",
    attributes: { name: "q", placeholder: "Search Farbazaar", "aria-label": "Search", "data-testid": "search-box" }
  });
  const element = dispatchedElement(parameters);
  assert.equal(element?.name, "q");
  assert.equal(element?.testId, "search-box");
  assert.equal((element?.attributes as JsonObject | undefined)?.["data-testid"], "search-box", "where the page's first lookup reads a test id");
});

test("a control whose autocomplete says it holds a secret keeps the author's description of it and none of its words", () => {
  // The packet never describes such a control; this is the identity's own rule, should one ever reach it.
  // Since t425 it is the one rule every save path follows (`element-fingerprint/build.ts`), the
  // recording's included, where secret controls are recorded every day: a control's contents never
  // cross, and the author's description of it does -- its label, id, `name`, classes and identifying
  // attributes -- because withholding them would leave every login form's fields found by their
  // address alone, which the user's full-fingerprint rule (2026-10-10) forbids, while protecting nothing.
  const binding = sanitizeWebLlmSnapshotWithBindings({ url: ITEM_URL, interactiveElements: [] });
  binding.evidence.elements.push({
    target: "t1",
    tag: "input",
    label: "Card number",
    implicitRole: "textbox",
    attributes: [["id", "card"], ["class", "card-field"], ["name", "cardnumber"], ["placeholder", "1234 5678"], ["autocomplete", "cc-number"]]
  });
  binding.selectors.set("t1", "#card");
  const targets = createWebLlmTargetPackets();
  const scope = { projectId: "project.one", flowId: "flow.one" };
  targets.remember(scope, binding);
  const resolution = targets.resolve(scope, "t1", undefined);
  assert.deepEqual(resolution, {
    ok: true,
    selector: "#card",
    frameId: undefined,
    element: {
      tagName: "input",
      implicitRole: "textbox",
      label: "Card number",
      selector: "#card",
      id: "card",
      classNames: ["card-field"],
      name: "cardnumber",
      attributes: { name: "cardnumber", placeholder: "1234 5678" }
    }
  });
  assert.equal(JSON.stringify(resolution).includes("cc-number"), false, "a secret's kind of contents is not one of the identifying attributes");
});

test("a label a newer view of the same handle changed is dropped, and one both views show is kept", async () => {
  let label = "Quantity";
  const runtime = runtimeOver(() => [searchBox, quantityBox("fb1l6ufkg", label)]);
  await look(runtime);
  await look(runtime);
  assert.equal(((await typedElement(runtime, "t2")).element as JsonObject).label, "Quantity");
  label = "Quantity (max 5)";
  await look(runtime);
  assert.equal(((await typedElement(runtime, "t2")).element as JsonObject).label, undefined);
});

test("a class an act toggles is dropped across views, and the tokens both views carry are kept", async () => {
  let classes = "q7k2-qty";
  const runtime = runtimeOver(() => [searchBox, quantityBox("fb1l6ufkg", "Quantity", classes)]);
  await look(runtime);
  classes = "q7k2-qty is-focused";
  await look(runtime);
  assert.deepEqual(((await typedElement(runtime, "t2")).element as JsonObject).classNames, ["q7k2-qty"]);
});

test("the page view the model reads shows no fingerprint: no id, no class, no selector", async () => {
  const runtime = runtimeOver(() => [searchBox, quantityBox("fb1l6ufkg")]);
  const looked = await runtime.executeTool({ projectId: "project.one", flowId: "flow.view", callId: "call.view", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: webAutomationOutputNodeId("web.dom.capture_snapshot"), parameters: {}, consequences: [] } });
  const view = (looked.evidence as { page?: string }).page ?? "";
  assert.match(view, /field "Quantity"/u);
  for (const hidden of ["fb1l6ufkg", "q7k2-qty", "#fb1l6ufkg"]) assert.equal(view.includes(hidden), false, `${hidden} is not in the page view`);
});
