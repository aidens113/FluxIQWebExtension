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
import { shownHandle, shownPageLines } from "../../page-view/tests/shown-page-lines";

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
  // "Not now" is chosen neither before nor after: the press flipped no choice.
  assert.equal("toggle" in (pressed.draft ?? {}), false);
});

// Live runs `run-murwd8le-79e735a8` and `run-musp8nz1-dbd3905a` pressed Space
// Grey, already marked, off and then on again, and shipped both presses. The
// draft statement now names the control a press flipped and which way, so Core
// can take such a pair out of the Flow (`AS/runtime/flow-draft/reversal.ts`).
test("a press that un-chose the marked option it pressed says so on its draft statement, under the handle the call named", async () => {
  let marked = true;
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.capture_snapshot") return { status: "succeeded", payload: { snapshot: swatchPage(marked) } };
      if (command.actionType === "web.dom.click") marked = !marked;
      return { status: "succeeded", payload: { value: "ok" } };
    }
  };
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  const looked = await runtime.executeTool({ ...PROJECT, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT, parameters: {}, consequences: [] } });
  const grey = shownPageLines(looked.evidence).find((line) => line.kind !== undefined && line.words === "Space Grey")!.target;
  const input = { node: CLICK, parameters: { target: { handle: grey } }, consequences: [] };
  const pressed = await runtime.executeTool({ ...PROJECT, callId: "call.grey.off", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: input });
  assert.equal(pressed.resultCode, "web.action.succeeded", JSON.stringify(pressed.evidence).slice(0, 400));
  assert.deepEqual(pressed.draft?.toggle, { key: grey, to: "off" });
  assert.equal(pressed.draft?.toggle?.key, input.parameters.target.handle);
  // Pressed again, it chose it: the other half of the pair.
  const again = await runtime.executeTool({ ...PROJECT, callId: "call.grey.on", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: input });
  assert.deepEqual(again.draft?.toggle, { key: grey, to: "on" });
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

/** A product page whose Space Grey swatch is drawn apart from its sibling while chosen. */
function swatchPage(marked: boolean): JsonObject {
  const grey: JsonObject = { tagName: "div", selector: "#swatch-grey", visibleText: "Space Grey", cursor: "pointer" };
  if (marked) grey.setApart = true;
  return {
    url: START,
    title: "Hub",
    viewport: { width: 1000, height: 1000, scrollX: 0, scrollY: 0 },
    interactiveElements: [
      { tagName: "span", selector: "#color-label", visibleText: "Color:" },
      grey,
      { tagName: "div", selector: "#swatch-silver", visibleText: "Silver", cursor: "pointer" },
      { tagName: "button", selector: "#add", visibleText: "Add to cart" }
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

// A layer the build's own press opened is a step of the Flow, not an
// interruption (t193, C17). `run-musp4h2f-72e8ed99`: the build pressed
// "Pickup or delivery? Carden Falls Supercenter", which opened the store
// chooser, then "Set as my store" on Millbrook inside it; the page reloaded at
// the same location with the chooser gone, and the store switch was drafted
// `interruption: true`, which Core makes optional. A consent wall or a chat
// card the build did not open is still an interruption.

test("a press inside the store chooser this build's own press opened is a step of the Flow, not an interruption", async () => {
  const store = storeStub();
  const runtime = createWebAutomationLlmEvidenceRuntime(store.gateway);
  const looked = await runtime.executeTool({ ...PROJECT, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT, parameters: {}, consequences: [] } });
  const opener = await press(runtime, "call.open", shownHandle(looked.evidence, "Pickup or delivery? Carden Falls Supercenter"));
  assert.equal(opener.resultCode, "web.action.succeeded", JSON.stringify(opener.evidence).slice(0, 400));
  assert.equal("interruption" in (opener.draft ?? {}), false);
  const setAt = shownHandle(opener.evidence, "Set as my store");
  const set = await press(runtime, "call.set", setAt);
  assert.equal(set.resultCode, "web.action.succeeded", JSON.stringify(set.evidence).slice(0, 400));
  assert.equal(store.chosen(), "Millbrook");
  // The chooser is gone after the press and the page is where it was: before
  // this memory, that read as an answered layer.
  assert.equal("interruption" in (set.draft ?? {}), false);
  // Handles survive the reload: the chooser opened again is numbered as it
  // was, so a memory keyed by handle still names it. The layer itself prints
  // no line, so its control -- numbered the same way, by location, selector
  // and record (`../../stable-handles.ts`) -- stands for it.
  const reopened = await press(runtime, "call.reopen", shownHandle(set.evidence, "Pickup or delivery? Millbrook Crossing Supercenter"));
  assert.equal(shownHandle(reopened.evidence, "Set as my store"), setAt);
});

test("a consent wall present from the first look, answered, is still an interruption", async () => {
  const store = storeStub({ consent: true });
  const runtime = createWebAutomationLlmEvidenceRuntime(store.gateway);
  const looked = await runtime.executeTool({ ...PROJECT, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT, parameters: {}, consequences: [] } });
  const rejected = await press(runtime, "call.reject", shownHandle(looked.evidence, "Reject all"));
  assert.equal(rejected.resultCode, "web.action.succeeded", JSON.stringify(rejected.evidence).slice(0, 400));
  assert.equal(rejected.draft?.interruption, true);
});

test("a chat card that appeared on its own, not after this build's press, is still an interruption", async () => {
  const store = storeStub();
  const runtime = createWebAutomationLlmEvidenceRuntime(store.gateway);
  const looked = await runtime.executeTool({ ...PROJECT, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT, parameters: {}, consequences: [] } });
  const added = await press(runtime, "call.add", shownHandle(looked.evidence, "Add to cart"));
  assert.equal(added.resultCode, "web.action.succeeded");
  // On a timer, after the look that followed the press.
  store.openChat();
  const again = await runtime.executeTool({ ...PROJECT, callId: "call.look2", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT, parameters: {}, consequences: [] } });
  const closed = await press(runtime, "call.close", shownHandle(again.evidence, "Close chat"));
  assert.equal(closed.resultCode, "web.action.succeeded", JSON.stringify(closed.evidence).slice(0, 400));
  assert.equal(closed.draft?.interruption, true);
});

function press(runtime: ReturnType<typeof createWebAutomationLlmEvidenceRuntime>, callId: string, handle: string) {
  return runtime.executeTool({ ...PROJECT, callId, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: CLICK, parameters: { target: { handle } }, consequences: [] } });
}

/** A store page whose store button opens a chooser; "Set as my store" picks Millbrook and reloads the page without it. */
function storeStub(options: { consent?: boolean } = {}) {
  const state = { chooser: false, store: "Carden Falls Supercenter", chat: false, consent: options.consent === true };
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.capture_snapshot") return { status: "succeeded", payload: { snapshot: storePage(state) } };
      if (command.actionType === "web.dom.click") {
        const selector = command.parameters.selector;
        if (selector === "#fulfillment") state.chooser = true;
        if (selector === "#chooser > button") { state.chooser = false; state.store = "Millbrook Crossing Supercenter"; }
        if (selector === "#chat > button") state.chat = false;
        if (selector === "#consent > button") state.consent = false;
      }
      return { status: "succeeded", payload: { value: "ok" } };
    }
  };
  return {
    gateway,
    chosen: () => state.store.split(" ")[0],
    openChat: () => { state.chat = true; }
  };
}

function storePage(state: { chooser: boolean; store: string; chat: boolean; consent: boolean }): JsonObject {
  const elements: JsonObject[] = [
    { tagName: "button", selector: "#fulfillment", visibleText: `Pickup or delivery? ${state.store}` },
    { tagName: "button", selector: "#add", visibleText: "Add to cart" }
  ];
  // A layer's controls name it by its place in the list, as the capture writes `parent`.
  const layer = (selector: string, words: string, button: string): void => {
    const at = elements.length;
    elements.push({ tagName: "div", selector, accessibleName: words, frontLayer: true }, { tagName: "button", selector: `${selector} > button`, visibleText: button, parent: at });
  };
  if (state.chooser) layer("#chooser", "Stores near Carden Falls", "Set as my store");
  if (state.chat) layer("#chat", "Chat with us", "Close chat");
  if (state.consent) layer("#consent", "We value your privacy", "Reject all");
  return { url: START, title: "Store", viewport: { width: 100, height: 100, scrollX: 0, scrollY: 0 }, interactiveElements: elements };
}
