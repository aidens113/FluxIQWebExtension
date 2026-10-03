// The draft statement names the control a step acted on, in the words the
// outcome already carries (t174/F33).
//
// Live run `run-muqiho5c-e830ce01` pressed "Not now" (t1082) and was told so on
// the outcome, while the core.flow_draft step it was shown said only
// `input: {target: {handle: "t1082"}}`. Six decisions later it added that step
// as its "put three in my cart" act, believing it was Add to cart, and
// completed with an empty cart. The draft is the one record always in front of
// the model, so the words go there too.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "../..";
import { shownPageLines } from "../../page-view/tests/shown-page-lines";

const PROJECT = { projectId: "project.one", flowId: "flow.one" };
const CLICK = "web.output.dom-click";
const SNAPSHOT = "web.output.dom-capture_snapshot";
const NAVIGATE = "web.output.browser-navigate";
const START = "https://example.test/start";
const TYPE = "web.output.dom-type";

test("a press's draft statement carries the words of the control it pressed, the outcome's own", async () => {
  const stubbed = stub();
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  const looked = await runtime.executeTool({ ...PROJECT, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT, parameters: {}, consequences: [] } });
  const notNow = shownPageLines(looked.evidence).find((line) => line.words?.includes("Not now"))!.target;

  stubbed.setTitle("Dismissed");
  const pressed = await runtime.executeTool({ ...PROJECT, callId: "call.press", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: CLICK, parameters: { target: { handle: notNow } }, consequences: [] } });
  assert.equal(pressed.resultCode, "web.action.succeeded");
  assert.equal(pressed.draft?.control, "Not now");
  // The same value the outcome carries, never a second reading of the page.
  assert.equal(pressed.draft?.control, (pressed.evidence as JsonObject).control);
  // Beside the argument, never inside it: the argument the model wrote is unchanged.
  assert.deepEqual(pressed.draft?.input, { node: CLICK, parameters: { target: { handle: notNow } }, consequences: [] });
  assert.equal("control" in ((pressed.draft?.ranWith?.parameters ?? {}) as JsonObject), false);
  // "Not now" here stands on the page itself, in no layer: it answered no interruption.
  assert.equal("interruption" in (pressed.draft ?? {}), false);
});

test("a press that closed the popup it stood in says so on its draft statement: the step answered an interruption", async () => {
  const popup = popupStub();
  const runtime = createWebAutomationLlmEvidenceRuntime(popup.gateway);
  const looked = await runtime.executeTool({ ...PROJECT, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT, parameters: {}, consequences: [] } });
  const noThanks = shownPageLines(looked.evidence).find((line) => line.words === "No thanks")!.target;
  const pressed = await runtime.executeTool({ ...PROJECT, callId: "call.close", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: CLICK, parameters: { target: { handle: noThanks } }, consequences: [] } });
  assert.equal(pressed.resultCode, "web.action.succeeded", JSON.stringify(pressed.evidence).slice(0, 400));
  assert.equal(pressed.draft?.interruption, true);
  // The page behind it, pressed next, answered none.
  const add = shownPageLines(pressed.evidence).find((line) => line.words === "Add to cart")!.target;
  const added = await runtime.executeTool({ ...PROJECT, callId: "call.add", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: CLICK, parameters: { target: { handle: add } }, consequences: [] } });
  assert.equal(added.resultCode, "web.action.succeeded");
  assert.equal("interruption" in (added.draft ?? {}), false);
});

test("a look's draft statement names no control", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(stub().gateway);
  const looked = await runtime.executeTool({ ...PROJECT, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT, parameters: {}, consequences: [] } });
  assert.equal(looked.draft !== undefined && "control" in looked.draft, false);
  assert.equal(looked.draft !== undefined && "interruption" in looked.draft, false);
});

test("a navigation's draft statement names no control: it acted on no control", async () => {
  const stubbed = stub();
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  await runtime.executeTool({ ...PROJECT, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT, parameters: {}, consequences: [] } });
  const went = await runtime.executeTool({ ...PROJECT, callId: "call.go", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: NAVIGATE, parameters: { url: START }, consequences: [] } });
  assert.equal(went.resultCode, "web.action.succeeded", JSON.stringify(went.evidence).slice(0, 400));
  assert.equal(went.draft !== undefined && "control" in went.draft, false);
  assert.equal(went.draft !== undefined && "interruption" in went.draft, false);
});

test("a refused press's draft statement names no control: no outcome said one", async () => {
  const stubbed = stub({ failClick: true });
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  const looked = await runtime.executeTool({ ...PROJECT, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT, parameters: {}, consequences: [] } });
  const add = shownPageLines(looked.evidence).find((line) => line.words?.includes("Add to cart"))!.target;
  const failed = await runtime.executeTool({ ...PROJECT, callId: "call.press", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: CLICK, parameters: { target: { handle: add } }, consequences: [] } });
  assert.equal(failed.effectApplied, false);
  assert.equal(failed.draft !== undefined && "control" in failed.draft, false);
  assert.equal(failed.draft !== undefined && "interruption" in failed.draft, false);
});

test("a field named only by its label is named by the words its view line prints, on the outcome, the draft and the node's identity", async () => {
  // run-murwd8le-79e735a8, steps 0023-0024: the view line read
  // `t965 field "Quantity" ="3"`, the type's result named no control, the
  // draft's step said nothing, and the stored node was `{tagName: "input"}`.
  // Two judges refuted the Flow over that bare input.
  const commands: Array<{ actionType: string; parameters: JsonObject }> = [];
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      commands.push({ actionType: command.actionType, parameters: command.parameters as JsonObject });
      if (command.actionType === "web.dom.capture_snapshot") return { status: "succeeded", payload: { snapshot: quantityPage() } };
      return { status: "succeeded", payload: { value: "ok" } };
    }
  };
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  const looked = await runtime.executeTool({ ...PROJECT, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT, parameters: {}, consequences: [] } });
  const field = shownPageLines(looked.evidence).find((line) => line.kind === "field")!;
  assert.equal(field.words, "Quantity", field.line);
  const typed = await runtime.executeTool({ ...PROJECT, callId: "call.type", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: TYPE, parameters: { target: { handle: field.target }, text: "3" }, consequences: [] } });
  assert.equal(typed.resultCode, "web.action.succeeded", JSON.stringify(typed.evidence).slice(0, 400));
  assert.equal((typed.evidence as JsonObject).control, "Quantity");
  assert.equal(typed.draft?.control, "Quantity");
  // The node the Flow keeps names the field by the signal the page scores a
  // label by: `label`, never `accessibleName`, which the page computes without
  // the nearby text and would then read as missing.
  const kept = (typed.draft?.ranWith?.parameters as JsonObject).element as JsonObject;
  assert.equal(kept.label, "Quantity");
  assert.equal("accessibleName" in kept, false);
  const sent = commands.find((command) => command.actionType === "web.dom.type")!;
  assert.equal((sent.parameters.element as JsonObject).label, "Quantity");
});

test("a control the page already names keeps its identity as it was: no label is added beside its name", async () => {
  const commands: Array<{ actionType: string; parameters: JsonObject }> = [];
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      commands.push({ actionType: command.actionType, parameters: command.parameters as JsonObject });
      if (command.actionType === "web.dom.capture_snapshot") return { status: "succeeded", payload: { snapshot: quantityPage("Units") } };
      return { status: "succeeded", payload: { value: "ok" } };
    }
  };
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  const looked = await runtime.executeTool({ ...PROJECT, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT, parameters: {}, consequences: [] } });
  const field = shownPageLines(looked.evidence).find((line) => line.kind === "field")!;
  const typed = await runtime.executeTool({ ...PROJECT, callId: "call.type", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: TYPE, parameters: { target: { handle: field.target }, text: "3" }, consequences: [] } });
  assert.equal(typed.draft?.control, "Units");
  const kept = (typed.draft?.ranWith?.parameters as JsonObject).element as JsonObject;
  assert.equal(kept.accessibleName, "Units");
  assert.equal("label" in kept, false);
});

function stub(options: { failClick?: boolean } = {}) {
  let title = "Fixture";
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.capture_snapshot") return { status: "succeeded", payload: { snapshot: page(title) } };
      if (command.actionType === "web.dom.click" && options.failClick) return { status: "failed", error: "the control is gone" };
      return { status: "succeeded", payload: { value: "ok" } };
    }
  };
  return { gateway, setTitle: (next: string) => { title = next; } };
}

function page(title: string): JsonObject {
  return {
    url: START,
    title,
    viewport: { width: 100, height: 100, scrollX: 0, scrollY: 0 },
    interactiveElements: [
      { tagName: "button", selector: "#add", visibleText: "Add to cart" },
      { tagName: "button", selector: "#dismiss", visibleText: "Not now" }
    ]
  };
}

/** A page with a promotion popup over it whose "No thanks" closes it. */
function popupStub() {
  let open = true;
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.capture_snapshot") return { status: "succeeded", payload: { snapshot: popupPage(open) } };
      if (command.actionType === "web.dom.click" && command.parameters.selector === "#promo > button") open = false;
      return { status: "succeeded", payload: { value: "ok" } };
    }
  };
  return { gateway };
}

function popupPage(open: boolean): JsonObject {
  const main: JsonObject[] = [{ tagName: "button", selector: "#add", visibleText: "Add to cart" }];
  if (!open) return { url: START, title: "Fixture", interactiveElements: main };
  return {
    url: START,
    title: "Fixture",
    // The button's `parent` is the popup's index among the captured elements, as the capture writes it.
    interactiveElements: [
      { tagName: "div", selector: "#promo", accessibleName: "Get $10 off" },
      { tagName: "button", selector: "#promo > button", visibleText: "No thanks", parent: 0 },
      ...main
    ],
    evidence: { overlays: { tested: 2, blockedCount: 1, blockers: [{ selector: "#promo", label: "Get $10 off", kind: "promotion", blocks: 1, blocked: ["#add"] }] } }
  };
}

/** A product page whose quantity field is named only by the label beside it, or also by an accessible name of its own. */
function quantityPage(accessibleName?: string): JsonObject {
  const field: JsonObject = { tagName: "input", selector: "#qty", label: "Quantity", value: "1" };
  if (accessibleName !== undefined) field.accessibleName = accessibleName;
  return {
    url: START,
    title: "Hub",
    viewport: { width: 100, height: 100, scrollX: 0, scrollY: 0 },
    interactiveElements: [field, { tagName: "button", selector: "#add", visibleText: "Add to cart" }]
  };
}
