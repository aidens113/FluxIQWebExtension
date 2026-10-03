// A press that un-chose the very control it pressed says so in one sentence,
// ahead of the change list, through the real runtime (t174-w82, cause 1 of
// `run-murwd8le-79e735a8`).
//
// Step 0013 of that run pressed `t941 clickable "Space Grey" marked`. Step
// 0014's result listed `t941 "Space Grey" no longer marked` among three other
// change lines, and at 0026 the model claimed the colour was chosen. Nothing
// stops the press -- a person may press a chosen option -- but its result now
// says plainly what it did to the choice.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "../../..";
import { shownHandle, shownPageLines } from "../../../page-view/tests/shown-page-lines";

const PROJECT = { projectId: "project.one", flowId: "flow.one" };
const CLICK = "web.output.dom-click";
const SNAPSHOT = "web.output.dom-capture_snapshot";
const ITEM = "https://shop.test/item/1005008123450";

type Swatches = { grey: Mark; silver: Mark; terms: boolean };
type Mark = "marked" | "selected" | undefined;

test("pressing the marked colour says it un-chose it, ahead of the change list", async () => {
  const stubbed = stub({ grey: "marked", silver: undefined, terms: false }, (state) => ({ ...state, grey: undefined }));
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  const grey = swatch(await look(runtime), "Space Grey");
  const pressed = (await press(runtime, grey)).evidence as JsonObject;
  assert.equal(pressed.choice, "This press un-chose \"Space Grey\": it was chosen before.");
  const keys = Object.keys(pressed);
  assert.ok(keys.indexOf("choice") < keys.indexOf("changed"), keys.join(","));
  // Not a refusal: the press ran and the change list still says it.
  assert.equal(pressed.ok, true);
  assert.ok((pressed.changed as string[]).includes(`${grey} "Space Grey" no longer marked`));
});

test("pressing a selected option off, or a checked box off, says it un-chose it too", async () => {
  const selected = stub({ grey: "selected", silver: undefined, terms: false }, (state) => ({ ...state, grey: undefined }));
  const one = createWebAutomationLlmEvidenceRuntime(selected.gateway);
  const pressed = (await press(one, swatch(await look(one), "Space Grey"))).evidence as JsonObject;
  assert.equal(pressed.choice, "This press un-chose \"Space Grey\": it was chosen before.");

  const checked = stub({ grey: undefined, silver: undefined, terms: true }, (state) => ({ ...state, terms: false }));
  const two = createWebAutomationLlmEvidenceRuntime(checked.gateway);
  const box = shownHandle((await look(two)).evidence, "I accept the terms");
  const unticked = (await press(two, box)).evidence as JsonObject;
  assert.equal(unticked.choice, "This press un-chose \"I accept the terms\": it was chosen before.");
});

test("pressing an option that was not chosen says it chose it", async () => {
  const stubbed = stub({ grey: "marked", silver: undefined, terms: false }, () => ({ grey: undefined, silver: "marked", terms: false }));
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  const silver = swatch(await look(runtime), "Silver");
  const pressed = (await press(runtime, silver)).evidence as JsonObject;
  assert.equal(pressed.choice, "This press chose \"Silver\": it was not chosen before.");
});

test("a press that left the pressed control's choice as it was says nothing about a choice", async () => {
  const stubbed = stub({ grey: "marked", silver: undefined, terms: false }, (state) => state);
  const runtime = createWebAutomationLlmEvidenceRuntime(stubbed.gateway);
  const looked = await look(runtime);
  const add = shownHandle(looked.evidence, "Add to cart");
  const pressed = (await press(runtime, add)).evidence as JsonObject;
  assert.equal("choice" in pressed, false);
  const grey = (await press(runtime, swatch(looked, "Space Grey"))).evidence as JsonObject;
  assert.equal("choice" in grey, false);
});

function swatch(looked: { evidence: unknown }, words: string): string {
  // A control's line, never the plain text line that repeats its words.
  return shownPageLines(looked.evidence).find((line) => line.kind !== undefined && line.words === words)!.target;
}

async function look(runtime: ReturnType<typeof createWebAutomationLlmEvidenceRuntime>) {
  return runtime.executeTool({ ...PROJECT, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT, parameters: {}, consequences: [] } });
}

async function press(runtime: ReturnType<typeof createWebAutomationLlmEvidenceRuntime>, handle: string) {
  return runtime.executeTool({ ...PROJECT, callId: `call.press.${handle}.${Math.random()}`, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: CLICK, parameters: { target: { handle } }, consequences: [] } });
}

/** A product page whose state a press moves on, by `onPress`. */
function stub(initial: Swatches, onPress: (state: Swatches) => Swatches) {
  let state = initial;
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.capture_snapshot") return { status: "succeeded", payload: { snapshot: page(state) } };
      if (command.actionType === "web.dom.click") state = onPress(state);
      return { status: "succeeded", payload: { value: "ok" } };
    }
  };
  return { gateway };
}

function page(state: Swatches): JsonObject {
  return {
    url: ITEM,
    title: "Hub",
    viewport: { width: 1000, height: 1000, scrollX: 0, scrollY: 0 },
    interactiveElements: [
      { tagName: "span", selector: "#color-label", visibleText: "Color:" },
      option("#swatch-grey", "Space Grey", state.grey),
      option("#swatch-silver", "Silver", state.silver),
      { tagName: "input", selector: "#terms", inputType: "checkbox", accessibleName: "I accept the terms", checked: state.terms },
      { tagName: "button", selector: "#add", visibleText: "Add to cart" }
    ]
  };
}

function option(selector: string, words: string, mark: Mark): JsonObject {
  const element: JsonObject = { tagName: "div", selector, visibleText: words, cursor: "pointer" };
  if (mark === "marked") element.setApart = true;
  if (mark === "selected") {
    element.role = "option";
    element.attributes = [["aria-selected", "true"]];
  }
  return element;
}
