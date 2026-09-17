// The identity a created node carries for the element its handle names.
//
// What these rows are really proving:
// - a resolved node carries `parameters.element`, built from the element the
//   model was shown, in the shape a recorded node carries it -- the recorded
//   normalizer reads it back unchanged;
// - that identity is what stops Core reading a type node's `text` as the
//   element's visible text. Without it, the live `instruction-only-form` run
//   dispatched the typed words as the input's identity, and the page's veto
//   refused the right input for not showing them (`run-mu4t20d1-93b60760`);
// - no value reaches the identity: not a text control's contents, not a
//   select's options, not a name or text the packet had to cut, and nothing at
//   all from a control whose signature says it holds a secret;
// - pages that give a bare handle the same selector but describe it
//   differently carry only what they agree on, rather than a guess at one;
// - the handle decides the identity: an `element` the model wrote beside a
//   handle is replaced, one beside a literal selector is left alone, and a
//   handle written as the element names it like any other slot.
//
// Whether the page's own resolver then accepts the right element and refuses
// a wrong one is the extension's to prove (`content/identity/`); the domain may
// not import it.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { normalizeAutomationStudioElementTarget } from "fluxiq/automation-studio";
import { webAutomationActionFromGatewayCommand } from "../../../../client";
import { elementFingerprint, outputTargetFromPayload, webAutomationOutputNodeId } from "../../../../output-nodes";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_EVIDENCE_BOUNDS, WEB_LLM_INSPECT_TOOL_ID, type WebAutomationLlmEvidenceRuntime } from "../..";
import { sanitizeWebLlmSnapshotWithBindings } from "../../sanitize";
import { createWebLlmTargetPackets } from "..";

const TYPE_NODE = webAutomationOutputNodeId("web.dom.type");
const CLICK_NODE = webAutomationOutputNodeId("web.dom.click");
const SELECT_NODE = webAutomationOutputNodeId("web.dom.select");

const FORM_URL = "https://example.test/form";
const NAME_SELECTOR = '[data-testid="instruction-name"]';

/** The `instruction-only-form` name input, as the extension describes it: its accessible name comes from the wrapping label. */
const nameInput: JsonObject = {
  tagName: "input",
  selector: NAME_SELECTOR,
  inputType: "text",
  name: "name",
  accessibleName: "Name",
  implicitRole: "textbox",
  testId: "instruction-name",
  attributes: { name: "name", "data-testid": "instruction-name", autocomplete: "off" },
  context: { formId: "signup", landmark: "main" }
};
const submit: JsonObject = { tagName: "button", selector: '[data-testid="instruction-submit"]', visibleText: "Submit", accessibleName: "Submit", implicitRole: "button" };

type Page = { url: string; elements: JsonObject[] };

function runtimeOver(page: () => Page): WebAutomationLlmEvidenceRuntime {
  return createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded" };
      const current = page();
      return { status: "succeeded", payload: { snapshot: { url: current.url, title: "Fixture", interactiveElements: current.elements } } };
    },
  });
}

let calls = 0;
async function inspect(runtime: WebAutomationLlmEvidenceRuntime): Promise<void> {
  calls += 1;
  await runtime.executeTool({ projectId: "project.one", flowId: "flow.one", callId: `call.inspect.${calls}`, toolId: WEB_LLM_INSPECT_TOOL_ID, value: {} });
}

function resolvedParameters(runtime: WebAutomationLlmEvidenceRuntime, nodeDefinitionId: string, parameters: JsonObject): JsonObject {
  const resolution = runtime.resolvePlanNodeParameters({ projectId: "project.one", flowId: "flow.one", nodeDefinitionId, parameters });
  assert.equal(resolution.status, "resolved", JSON.stringify(resolution));
  return resolution.status === "resolved" ? resolution.parameters : {};
}

/**
 * The element the page is handed for these node parameters, through the
 * dispatch chain a Flow node really takes: Core's `prepareElementTargetAction`
 * (`runtime/io-policy.ts`) writes its normalized target back as
 * `parameters.target`, `outputTargetFromPayload` builds the wire target, and
 * the gateway mapping puts the identity on `command.element`.
 */
function dispatchedElement(actionType: string, parameters: JsonObject): JsonObject | undefined {
  const prepared: JsonObject = Object.assign({}, parameters);
  const target = normalizeAutomationStudioElementTarget(parameters, { source: "runtime" });
  if (target) prepared.target = target as unknown as JsonObject;
  const command = webAutomationActionFromGatewayCommand({ commandId: "command.one", actionType, parameters: prepared, target: outputTargetFromPayload(prepared) ?? {} });
  assert.equal("status" in command, false, "the command is dispatched");
  return (command as unknown as { element?: JsonObject }).element;
}

test("a resolved type and click node carry the identity of the element the model was shown, in the recorded shape", async () => {
  const runtime = runtimeOver(() => ({ url: FORM_URL, elements: [nameInput, submit] }));
  await inspect(runtime);

  const typed = resolvedParameters(runtime, TYPE_NODE, { selector: { handle: "target.1" }, text: "Ada Lovelace" });
  assert.deepEqual(typed, {
    selector: NAME_SELECTOR,
    text: "Ada Lovelace",
    element: { tagName: "input", accessibleName: "Name", selector: NAME_SELECTOR, context: { formId: "signup" } }
  });
  const clicked = resolvedParameters(runtime, CLICK_NODE, { selector: { handle: "target.2" } });
  assert.deepEqual(clicked, {
    selector: submit.selector,
    element: { tagName: "button", accessibleName: "Submit", selector: submit.selector }
  });

  // The shape is the recorded one: the normalizer a recorded node's element
  // goes through (`output-nodes/targets`) returns it unchanged.
  for (const parameters of [typed, clicked]) assert.deepEqual(elementFingerprint(parameters.element), parameters.element);
});

test("the identity stops Core reading the typed text as the element's visible text", async () => {
  // The live defect, unchanged: a created type node with a selector and no
  // element reaches the page claiming the words it types as its identity.
  const literal = dispatchedElement("web.dom.type", { selector: NAME_SELECTOR, text: "Ada Lovelace" });
  assert.equal(literal?.visibleText, "Ada Lovelace");

  const runtime = runtimeOver(() => ({ url: FORM_URL, elements: [nameInput, submit] }));
  await inspect(runtime);
  const element = dispatchedElement("web.dom.type", resolvedParameters(runtime, TYPE_NODE, { selector: { handle: "target.1" }, text: "Ada Lovelace" }));
  // Read signal by signal: which of the recorded and the re-derived copies of
  // this identity the dispatch prefers is not this row's subject, and both
  // carry these.
  assert.equal(element?.tagName, "input");
  assert.equal(element?.accessibleName, "Name");
  assert.equal(element?.selector, NAME_SELECTOR);
  assert.equal(element?.visibleText, undefined);
  assert.equal(JSON.stringify(element).includes("Ada"), false, "no typed word reaches the identity");
});

test("no value reaches the identity: not a control's contents, not a cut name, nothing from a secret control", async () => {
  const notes: JsonObject = { tagName: "textarea", selector: "#notes", visibleText: "Prefilled private note", accessibleName: "Notes" };
  const plan: JsonObject = {
    tagName: "select",
    selector: "#plan",
    visibleText: "Starter Team Enterprise",
    accessibleName: "Plan",
    selectedValue: "team",
    options: [{ value: "starter", label: "Starter" }, { value: "team", label: "Team" }]
  };
  const long = "L".repeat(WEB_LLM_EVIDENCE_BOUNDS.text + 40);
  const card: JsonObject = { tagName: "a", selector: "#card", accessibleName: long, visibleText: `${long} more`, href: "/p/card" };
  const password: JsonObject = { tagName: "input", selector: "#password", inputType: "password", accessibleName: "Password" };
  const runtime = runtimeOver(() => ({ url: FORM_URL, elements: [notes, plan, card, password] }));
  await inspect(runtime);

  assert.deepEqual(resolvedParameters(runtime, TYPE_NODE, { selector: { handle: "target.1" }, text: "x" }).element, { tagName: "textarea", accessibleName: "Notes", selector: "#notes" });
  assert.deepEqual(resolvedParameters(runtime, SELECT_NODE, { selector: { handle: "target.2" }, value: "team" }).element, { tagName: "select", accessibleName: "Plan", selector: "#plan" });
  assert.deepEqual(resolvedParameters(runtime, CLICK_NODE, { selector: { handle: "target.3" } }).element, { tagName: "a", selector: "#card" });
  // The sanitizer never describes the password field, so no handle names it.
  assert.deepEqual(
    runtime.resolvePlanNodeParameters({ projectId: "project.one", flowId: "flow.one", nodeDefinitionId: TYPE_NODE, parameters: { selector: { handle: "target.4" } } }),
    { status: "refused", issueCodes: ["web.handle.unknown"] }
  );

  // And were one ever remembered, its identity would carry no name or text.
  const binding = sanitizeWebLlmSnapshotWithBindings({ url: FORM_URL, interactiveElements: [] });
  binding.evidence.elements.push({ target: "target.1", tag: "input", inputType: "password", name: "Password", text: "hunter2" });
  binding.selectors.set("target.1", "#password");
  const targets = createWebLlmTargetPackets();
  const scope = { projectId: "project.one", flowId: "flow.one" };
  targets.remember(scope, binding);
  const resolution = targets.resolve(scope, "target.1", undefined);
  assert.deepEqual(resolution, { ok: true, selector: "#password", frameId: undefined, element: { tagName: "input", selector: "#password", inputType: "password" } });
});

test("a list item and a child frame's element keep their place in the identity", async () => {
  const framed: JsonObject = {
    tagName: "a",
    selector: 'frame[4] >> [data-testid="product-link"]',
    accessibleName: "Lamp",
    attributes: { "data-testid": "product-link", "data-fluxiq-frame-id": "4" },
    context: { listPosition: { index: 2, total: 9 } }
  };
  const runtime = runtimeOver(() => ({ url: FORM_URL, elements: [framed] }));
  await inspect(runtime);
  assert.deepEqual(resolvedParameters(runtime, CLICK_NODE, { selector: { handle: "target.1" } }), {
    selector: '[data-testid="product-link"]',
    element: { tagName: "a", accessibleName: "Lamp", selector: '[data-testid="product-link"]', context: { listPosition: { index: 2, total: 9 } } },
    browserFrameId: 4
  });
});

test("pages that agree on a bare handle's selector but not its description carry only what they agree on", async () => {
  let page: Page = { url: "https://example.test/step-1", elements: [{ tagName: "button", selector: "#next", accessibleName: "Next" }] };
  const runtime = runtimeOver(() => page);
  await inspect(runtime);
  page = { url: "https://example.test/step-2", elements: [{ tagName: "button", selector: "#next", accessibleName: "Finish" }] };
  await inspect(runtime);
  assert.deepEqual(resolvedParameters(runtime, CLICK_NODE, { selector: { handle: "target.1" } }).element, { tagName: "button", selector: "#next" });
  assert.deepEqual(
    resolvedParameters(runtime, CLICK_NODE, { selector: { handle: "target.1", location: "https://example.test/step-2" } }).element,
    { tagName: "button", accessibleName: "Finish", selector: "#next" }
  );
  // A third page that agrees with neither on the tag leaves the family out too.
  page = { url: "https://example.test/step-3", elements: [{ tagName: "a", selector: "#next", accessibleName: "Finish" }] };
  await inspect(runtime);
  assert.deepEqual(resolvedParameters(runtime, CLICK_NODE, { selector: { handle: "target.1" } }).element, { selector: "#next" });
});

test("the handle decides the identity: a model-written element beside it is replaced, beside a literal selector it is left alone", async () => {
  const runtime = runtimeOver(() => ({ url: FORM_URL, elements: [nameInput, submit] }));
  await inspect(runtime);
  const claimed: JsonObject = { accessibleName: "Delete account", testId: "danger" };
  assert.deepEqual(resolvedParameters(runtime, CLICK_NODE, { selector: { handle: "target.2" }, element: claimed }).element, {
    tagName: "button",
    accessibleName: "Submit",
    selector: submit.selector
  });
  assert.deepEqual(
    runtime.resolvePlanNodeParameters({ projectId: "project.one", flowId: "flow.one", nodeDefinitionId: CLICK_NODE, parameters: { selector: "#literal", element: claimed } }),
    { status: "unchanged" }
  );
  // A handle written into the element names the element, never an identity to
  // keep: the identity is still the handle's, and it must be the element the
  // selector's handle names.
  assert.deepEqual(resolvedParameters(runtime, CLICK_NODE, { selector: { handle: "target.2" }, element: { handle: "target.2" } }).element, {
    tagName: "button",
    accessibleName: "Submit",
    selector: submit.selector
  });
  assert.deepEqual(
    runtime.resolvePlanNodeParameters({ projectId: "project.one", flowId: "flow.one", nodeDefinitionId: CLICK_NODE, parameters: { selector: { handle: "target.2" }, element: { handle: "target.1" } } }),
    { status: "refused", issueCodes: ["web.handle.ambiguous"] }
  );
  // A resolved identity is the caller's own copy: changing it changes nothing the store holds.
  const first = resolvedParameters(runtime, CLICK_NODE, { selector: { handle: "target.2" } });
  (first.element as JsonObject).accessibleName = "tampered";
  assert.equal((resolvedParameters(runtime, CLICK_NODE, { selector: { handle: "target.2" } }).element as JsonObject).accessibleName, "Submit");
});
