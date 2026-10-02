// A press's result says what it changed on the page, through the real runtime
// (t174/F37).
//
// Live run `run-muqk4u32-0b36e58f`: the model pressed the colour already
// chosen, `t941 clickable "Space Grey" marked`, which un-chose it -- the
// `"Space Grey"` text beside "Color:" went and the swatch lost `marked` -- and
// the result said only ok, pageChanged and "Space Grey". Its Add to cart then
// left `"Please select a Color."` on the page, the result said ok, and the
// model completed with an empty cart.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "../../..";
import { shownHandle, shownPageLines } from "../../../page-view/tests/shown-page-lines";

const PROJECT = { projectId: "project.one", flowId: "flow.one" };
const CLICK = "web.output.dom-click";
const SNAPSHOT = "web.output.dom-capture_snapshot";
const NAVIGATE = "web.output.browser-navigate";
const ITEM = "https://shop.test/item/1005008123450";

type Item = { chosen: boolean; warning?: string };

test("pressing the chosen colour says the choice was undone: its mark and the chosen text went", async () => {
  const stubbed = stub({ chosen: true }, () => ({ chosen: false }));
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  const looked = await look(runtime);
  const swatch = shownPageLines(looked.evidence).find((line) => line.kind === "clickable" && line.words === "Space Grey")!;
  const chosenText = shownPageLines(looked.evidence).find((line) => line.kind === undefined && line.words === "Space Grey")!;
  assert.match(swatch.line, / marked$/u);

  const pressed = await press(runtime, swatch.target);
  assert.equal(pressed.resultCode, "web.action.succeeded");
  assert.deepEqual((pressed.evidence as JsonObject).changed, [
    `${chosenText.target} "Space Grey" gone`,
    `${swatch.target} "Space Grey" no longer marked`
  ]);
});

test("Add to cart that the page answered with a warning says the warning appeared", async () => {
  const stubbed = stub({ chosen: false }, (item) => ({ ...item, warning: "Please select a Color." }));
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  const looked = await look(runtime);
  const pressed = await press(runtime, shownHandle(looked.evidence, "Add to cart"));
  assert.equal(pressed.resultCode, "web.action.succeeded");
  const warning = shownHandle(pressed.evidence, "Please select a Color.");
  assert.deepEqual((pressed.evidence as JsonObject).changed, [`${warning} "Please select a Color." appeared`]);
});

test("a page's words shaped like a secret stay withheld in what changed", async () => {
  const stubbed = stub({ chosen: false }, (item) => ({ ...item, warning: "Card 4111 1111 1111 1111 saved" }));
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  const looked = await look(runtime);
  const pressed = await press(runtime, shownHandle(looked.evidence, "Add to cart"));
  const changed = (pressed.evidence as JsonObject).changed as string[];
  assert.equal(changed.length, 1);
  assert.match(changed[0]!, /withheld/u);
  assert.doesNotMatch(changed[0]!, /4111/u);
});

test("a press that changed nothing, a look and a navigation say no changes", async () => {
  const stubbed = stub({ chosen: false }, (item) => item);
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  const looked = await look(runtime);
  assert.equal("changed" in (looked.evidence as JsonObject), false);
  const pressed = await press(runtime, shownHandle(looked.evidence, "Add to cart"));
  assert.equal((pressed.evidence as JsonObject).pageChanged, false);
  assert.equal("changed" in (pressed.evidence as JsonObject), false);
  stubbed.set({ chosen: true });
  const went = await runtime.executeTool({ ...PROJECT, callId: "call.go", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: NAVIGATE, parameters: { url: ITEM }, consequences: [] } });
  assert.equal(went.resultCode, "web.action.succeeded", JSON.stringify(went.evidence).slice(0, 400));
  assert.equal("changed" in (went.evidence as JsonObject), false);
});

async function look(runtime: ReturnType<typeof createWebAutomationLlmEvidenceRuntime>) {
  return runtime.executeTool({ ...PROJECT, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT, parameters: {}, consequences: [] } });
}

async function press(runtime: ReturnType<typeof createWebAutomationLlmEvidenceRuntime>, handle: string) {
  return runtime.executeTool({ ...PROJECT, callId: `call.press.${handle}`, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: CLICK, parameters: { target: { handle } }, consequences: [] } });
}

/** A product page whose state a press moves on, once, by `onPress`. */
function stub(initial: Item, onPress: (item: Item) => Item) {
  let item = initial;
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.capture_snapshot") return { status: "succeeded", payload: { snapshot: page(item) } };
      if (command.actionType === "web.dom.click") item = onPress(item);
      return { status: "succeeded", payload: { value: "ok" } };
    }
  };
  return { gateway, set: (next: Item) => { item = next; } };
}

function page(item: Item): JsonObject {
  return {
    url: ITEM,
    title: "Hub",
    viewport: { width: 1000, height: 1000, scrollX: 0, scrollY: 0 },
    interactiveElements: [
      { tagName: "span", selector: "#color-label", visibleText: "Color:" },
      ...(item.chosen ? [{ tagName: "span", selector: "#color-chosen", visibleText: "Space Grey" }] : []),
      item.chosen
        ? { tagName: "div", selector: "#swatch-grey", visibleText: "Space Grey", cursor: "pointer", setApart: true }
        : { tagName: "div", selector: "#swatch-grey", visibleText: "Space Grey", cursor: "pointer" },
      { tagName: "div", selector: "#swatch-silver", visibleText: "Silver", cursor: "pointer" },
      { tagName: "button", selector: "#add", visibleText: "Add to cart" },
      ...(item.warning === undefined ? [] : [{ tagName: "span", selector: "#warning", visibleText: item.warning }]),
      { tagName: "span", selector: "#ships", visibleText: "Ships from Spain" }
    ]
  };
}
