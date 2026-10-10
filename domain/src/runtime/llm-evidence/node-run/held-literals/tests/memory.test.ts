// A rerun keeps what the Flow saved, which the model never wrote (t432).
//
// What the model writes in a call names an element only by a handle the page
// view printed, or the call is refused. A repair or re-author round reads the
// Flow back as its draft, and a rerun merges what the model changed over a
// step's saved parameters -- the saved selector, element and list item. Those
// are the host's, carried under `held` by the round's opening look, and are
// not judged; whatever else the model writes in that round still is.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "../../..";

const PROJECT = { projectId: "project.one", flowId: "flow.one" };
const PERMITTED = async () => ({ permitted: true as const });
const SNAPSHOT = "web.output.dom-capture_snapshot";
const CLICK = "web.output.dom-click";
const EXTRACT = "web.output.dom-extract_list";
const SAVED_ELEMENT: JsonObject = { tagName: "button", visibleText: "Renew", accessibleName: "Renew", testId: "renew" };
const SAVED_LIST: JsonObject = { item: "li.row", fields: { title: ".title" } };
/** The Flow the round continues: a press of Renew and a read of the rows, as saved. */
const HELD: JsonObject[] = [
  { node: CLICK, parameters: { selector: "#renew-saved", element: SAVED_ELEMENT }, consequences: [] },
  { node: EXTRACT, parameters: { extractList: SAVED_LIST }, consequences: [] }
];

function site() {
  const commands: Array<{ actionType: string; parameters: JsonObject }> = [];
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      commands.push({ actionType: command.actionType, parameters: command.parameters });
      if (command.actionType === "web.dom.capture_snapshot") {
        return { status: "succeeded", payload: { snapshot: { url: "https://example.test/tickets", title: "Tickets", interactiveElements: [{ tagName: "button", selector: "#renew", visibleText: "Renew", attributes: { "data-testid": "renew" } }] } } };
      }
      if (command.actionType === "web.dom.extract_list") {
        return { status: "succeeded", payload: { extracted: [{ title: "Row 1" }], extraction: { recordCount: 1, pagesRead: 1, itemsSeen: 1, truncated: false, fieldNames: ["title"], missingFields: [] } } };
      }
      return { status: "succeeded", payload: { value: "ok" } };
    }
  };
  return { runtime: createWebAutomationLlmEvidenceRuntime(gateway), commands };
}

type Site = ReturnType<typeof site>;

async function open(at: Site, held?: JsonObject[]) {
  const value: JsonObject = { node: SNAPSHOT, parameters: {}, consequences: [] };
  if (held) value.held = held;
  return await at.runtime.executeTool({ ...PROJECT, callId: `initial.${WEB_LLM_RUN_NODE_TOOL_ID}`, toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED, value });
}

async function call(at: Site, callId: string, node: string, parameters: JsonObject) {
  return await at.runtime.executeTool({ ...PROJECT, callId, toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED, value: { node, parameters, consequences: [] } });
}

test("a rerun in a round that continues a Flow keeps the step's saved address and identity beside the model's new handle", async () => {
  const at = site();
  await open(at, HELD);
  const pressed = await call(at, "rerun.1", CLICK, { selector: "#renew-saved", element: SAVED_ELEMENT, target: { handle: "t1" } });
  assert.equal(pressed.effectApplied, true, JSON.stringify(pressed.evidence).slice(0, 300));
  // The handle is the authority: the press goes to the control the page view printed.
  assert.equal(at.commands.find((command) => command.actionType === "web.dom.click")?.parameters.selector, "#renew");
});

test("a rerun of the saved list read with conditions the model rewrote still reads, because its item is the Flow's", async () => {
  const at = site();
  await open(at, HELD);
  const read = await call(at, "rerun.2", EXTRACT, { extractList: { ...SAVED_LIST, where: [{ field: "title", contains: ["renewal"] }] } });
  assert.equal(read.effectApplied, true, JSON.stringify(read.evidence).slice(0, 300));
});

test("what the model writes itself in such a round is still judged", async () => {
  const at = site();
  await open(at, HELD);
  const guessed = await call(at, "call.guess", CLICK, { selector: "#guessed", target: { handle: "t1" } });
  assert.equal(guessed.effectApplied, false);
  assert.equal(JSON.stringify(guessed.evidence).includes("web.handle.not_a_handle"), true);
  const newList = await call(at, "call.list", EXTRACT, { extractList: { item: "li.other", fields: { title: ".title" } } });
  assert.equal(newList.effectApplied, false);
  assert.equal(at.commands.some((command) => command.actionType === "web.dom.extract_list"), false);
});

test("a build that continues no Flow holds nothing, and a new build forgets what the last one held", async () => {
  const fresh = site();
  await open(fresh);
  const literal = await call(fresh, "call.one", CLICK, { selector: "#renew-saved", element: SAVED_ELEMENT, target: { handle: "t1" } });
  assert.equal(literal.effectApplied, false);
  assert.equal(JSON.stringify(literal.evidence).includes("web.handle.not_a_handle"), true);

  const again = site();
  await open(again, HELD);
  await open(again);
  const forgotten = await call(again, "call.two", CLICK, { selector: "#renew-saved", element: SAVED_ELEMENT, target: { handle: "t1" } });
  assert.equal(forgotten.effectApplied, false);
});
