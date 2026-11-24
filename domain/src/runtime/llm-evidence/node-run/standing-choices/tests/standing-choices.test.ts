// A press states the options that stood chosen on the page as it found it,
// out of view or not, through the real runtime (t1023).
//
// The recorded shape, synthetic: paid run `run-mwuxd2v9-33928ea3` opened a
// chooser that showed `"Pickup" marked`, set a store, which closed it, and
// pressed an add on the same page, where Pickup was no longer in view. Core was
// never told the option stood chosen when the add ran. Here a garden shop's
// branch chooser shows "Collection" drawn apart from "Delivery"; the add is
// pressed with the chooser closed.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "../../..";
import { shownPageLines } from "../../../page-view/tests/shown-page-lines";

const PROJECT = { projectId: "project.one", flowId: "flow.one" };
const CLICK = "web.output.dom-click";
const SNAPSHOT = "web.output.dom-capture_snapshot";
const HOME = "https://garden.test/";

type Mode = "collection" | "delivery";
type State = { open: boolean; mode: Mode; added: number; aisle: boolean };
type Runtime = ReturnType<typeof createWebAutomationLlmEvidenceRuntime>;

test("an add pressed with the chooser closed states the option the chooser showed chosen, and says it out of view", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(stub({ open: false, mode: "collection", added: 0, aisle: false }));
  const first = await look(runtime);
  // Nothing shows chosen yet, so an add here would state none.
  assert.equal(shownPageLines(first.evidence).some((line) => line.words === "Collection"), false);
  const opened = await press(runtime, control(first, "Collect or deliver? Eastgate"));
  const collection = control(opened, "Collection");
  assert.ok(shownPageLines(opened.evidence).find((line) => line.target === collection)!.line.endsWith("marked"));
  const branch = await press(runtime, control(opened, "Make this my branch"));
  assert.equal(shownPageLines(branch.evidence).some((line) => line.words === "Collection"), false);
  // The chooser stood open with Collection chosen when the branch was set: stated, and named as no longer in view.
  assert.deepEqual(branch.draft?.chosen, [{ key: collection, words: "Collection" }]);
  const added = await press(runtime, control(branch, "+ Add"));
  assert.deepEqual(added.draft?.chosen, [{ key: collection, words: "Collection" }]);
  assert.deepEqual((added.evidence as JsonObject).stoodChosen, [`${collection} "Collection"`]);
});

test("an option the page showed un-chosen since stands no longer, and the one chosen in its place does", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(stub({ open: false, mode: "collection", added: 0, aisle: false }));
  const opened = await press(runtime, control(await look(runtime), "Collect or deliver? Eastgate"));
  const collection = control(opened, "Collection");
  const delivery = control(opened, "Delivery");
  const switched = await press(runtime, delivery);
  // Found with Collection chosen, left with Delivery: the press states what it found.
  assert.deepEqual(switched.draft?.chosen, [{ key: collection, words: "Collection" }]);
  const closed = await press(runtime, control(switched, "×"));
  const added = await press(runtime, control(closed, "+ Add"));
  assert.deepEqual(added.draft?.chosen, [{ key: delivery, words: "Delivery" }]);
});

test("an option is never said standing on another page, nor from a line that only mentions it", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(stub({ open: false, mode: "collection", added: 0, aisle: false }));
  const opened = await press(runtime, control(await look(runtime), "Collect or deliver? Eastgate"));
  const branch = await press(runtime, control(opened, "Make this my branch"));
  // The aisle page shows "Collection today" as text and has no chooser: nothing stands chosen there.
  const aisle = await press(runtime, control(branch, "Seeds aisle"));
  const added = await press(runtime, control(aisle, "+ Add"));
  assert.equal("chosen" in (added.draft ?? {}), false);
  assert.equal("stoodChosen" in (added.evidence as JsonObject), false);
});

test("a look states nothing, and a press with nothing standing states nothing", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(stub({ open: false, mode: "collection", added: 0, aisle: false }));
  const first = await look(runtime);
  assert.equal("chosen" in (first.draft ?? {}), false);
  const added = await press(runtime, control(first, "+ Add"));
  assert.equal("chosen" in (added.draft ?? {}), false);
});

function control(looked: { evidence: unknown }, words: string): string {
  const line = shownPageLines(looked.evidence).find((each) => each.kind !== undefined && each.words === words);
  assert.ok(line, `no control "${words}" in ${JSON.stringify(shownPageLines(looked.evidence).map((each) => each.line))}`);
  return line.target;
}

async function look(runtime: Runtime) {
  return runtime.executeTool({ ...PROJECT, callId: `call.look.${Math.random()}`, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT, parameters: {}, consequences: [] } });
}

async function press(runtime: Runtime, handle: string) {
  return runtime.executeTool({ ...PROJECT, callId: `call.press.${handle}.${Math.random()}`, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: CLICK, parameters: { target: { handle } }, consequences: ["modify_existing"] } });
}

/** A garden shop's home page with a branch chooser, and a seeds aisle; each press moves the state on. */
function stub(initial: State): WebLlmEvidenceGateway {
  const state = { ...initial };
  return {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.capture_snapshot") return { status: "succeeded", payload: { snapshot: page(state) } };
      const selector = command.parameters.selector;
      if (selector === "#chip") state.open = true;
      if (selector === "#close" || selector === "#set-branch") state.open = false;
      if (selector === "#tab-collection") state.mode = "collection";
      if (selector === "#tab-delivery") state.mode = "delivery";
      if (selector === "#aisle") {
        state.aisle = true;
        state.open = false;
      }
      if (selector === "#add") state.added += 1;
      return { status: "succeeded", payload: { value: "ok" } };
    }
  };
}

function page(state: State): JsonObject {
  const elements: JsonObject[] = [
    { tagName: "button", selector: "#chip", visibleText: "Collect or deliver? Eastgate" },
    { tagName: "a", selector: "#aisle", visibleText: "Seeds aisle", attributes: [["href", "/aisle/seeds"]] }
  ];
  if (state.open && !state.aisle) {
    elements.push(
      { tagName: "div", selector: "#close", visibleText: "×", cursor: "pointer" },
      tab("#tab-collection", "Collection", state.mode === "collection"),
      tab("#tab-delivery", "Delivery", state.mode === "delivery"),
      { tagName: "button", selector: "#set-branch", visibleText: "Make this my branch" }
    );
  }
  if (state.aisle) elements.push({ tagName: "span", selector: "#note", visibleText: "Collection today" });
  elements.push(
    { tagName: "span", selector: "#item", visibleText: state.aisle ? "Sunflower seeds" : "Brass trowel" },
    { tagName: "button", selector: "#add", visibleText: "+ Add" },
    { tagName: "span", selector: "#basket", visibleText: `Basket (${state.added})` }
  );
  return { url: state.aisle ? `${HOME}aisle/seeds` : HOME, title: "Garden shop", viewport: { width: 1000, height: 1000, scrollX: 0, scrollY: 0 }, interactiveElements: elements };
}

function tab(selector: string, words: string, chosen: boolean): JsonObject {
  const element: JsonObject = { tagName: "div", selector, visibleText: words, cursor: "pointer" };
  if (chosen) element.setApart = true;
  return element;
}
