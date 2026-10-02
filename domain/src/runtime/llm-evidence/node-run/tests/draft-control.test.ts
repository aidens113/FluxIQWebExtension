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
