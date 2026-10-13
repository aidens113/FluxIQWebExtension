// t504, lane D round 17 (`run-mv6lgt3s-c3aa6fac`): a press on one row's
// control of a list -- meant for "the rows that qualify" -- acted on the first
// row, and the answer said only which lines changed. A press on a control
// inside an item of a repeating list now says, right after acting, which item
// it acted on: its place as the page view marks it and the item's words.
// Through the real runtime, on a plain inbox.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "../../..";
import { shownHandle, shownPageLines } from "../../../page-view/tests/shown-page-lines";

const PROJECT = { projectId: "project.one", flowId: "flow.one" };
const CLICK = "web.output.dom-click";
const SNAPSHOT = "web.output.dom-capture_snapshot";

const MESSAGES = [
  { from: "Ana Ruiz", subject: "Invoice for March" },
  { from: "Ben Okafor", subject: "Team lunch" },
  { from: "Cleo Park", subject: "Quarterly report" }
];

test("a press on a row's control says which item it acted on, by place and words", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(inbox().gateway);
  const looked = await look(runtime);
  const archives = shownPageLines(looked.evidence).filter((line) => line.words === "Archive").map((line) => line.target);
  const first = (await press(runtime, archives[0]!)).evidence as JsonObject;
  assert.equal(first.ok, true);
  assert.equal(first.actedOn, "This acted on item 1/3 (Ana Ruiz, Invoice for March) only, through its \"Archive\"; no other item was acted on.");
  // Said ahead of what changed, where it is read first.
  const keys = Object.keys(first);
  assert.ok(keys.indexOf("actedOn") < keys.indexOf("changed"), keys.join(","));
});

test("each row's own control names its own item", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(inbox().gateway);
  const looked = await look(runtime);
  const archives = shownPageLines(looked.evidence).filter((line) => line.words === "Archive").map((line) => line.target);
  const third = (await press(runtime, archives[2]!)).evidence as JsonObject;
  assert.match(String(third.actedOn), /^This acted on item 3\/3 \(Cleo Park, Quarterly report\) only/u);
});

test("a press outside any list says nothing of an item", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(inbox().gateway);
  const compose = shownHandle((await look(runtime)).evidence, "Compose");
  const pressed = (await press(runtime, compose)).evidence as JsonObject;
  assert.equal(pressed.ok, true);
  assert.equal("actedOn" in pressed, false);
});

test("a step only written acts on nothing, so it says nothing of an item", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(inbox().gateway);
  const looked = await look(runtime);
  const archive = shownPageLines(looked.evidence).find((line) => line.words === "Archive")!.target;
  const written = await runtime.executeTool({ ...PROJECT, callId: "call.write", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: CLICK, parameters: { target: { handle: archive } }, consequences: [], write: true } });
  assert.equal("actedOn" in (written.evidence as JsonObject), false);
});

async function look(runtime: ReturnType<typeof createWebAutomationLlmEvidenceRuntime>) {
  return runtime.executeTool({ ...PROJECT, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT, parameters: {}, consequences: [] } });
}

async function press(runtime: ReturnType<typeof createWebAutomationLlmEvidenceRuntime>, handle: string) {
  return runtime.executeTool({ ...PROJECT, callId: `call.press.${handle}`, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: CLICK, parameters: { target: { handle } }, consequences: [] } });
}

/** An inbox whose rows an Archive press removes. */
function inbox() {
  let archived = 0;
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.capture_snapshot") return { status: "succeeded", payload: { snapshot: page(archived) } };
      if (command.actionType === "web.dom.click") archived += 1;
      return { status: "succeeded", payload: { value: "ok" } };
    }
  };
  return { gateway };
}

function page(archived: number): JsonObject {
  const elements: JsonObject[] = [
    { tagName: "button", selector: "#compose", visibleText: "Compose" },
    { tagName: "span", selector: "#archived", visibleText: `${archived} archived` }
  ];
  const container = elements.push({ tagName: "ul", selector: "#inbox", attributes: { id: "inbox" } }) - 1;
  MESSAGES.forEach((message, index) => {
    const item = `#inbox > li:nth-of-type(${index + 1})`;
    const listPosition = { index: index + 1, total: MESSAGES.length };
    const row = elements.push({ tagName: "li", selector: item, parent: container, context: { listPosition } }) - 1;
    elements.push({ tagName: "span", selector: `${item} > span.from`, visibleText: message.from, parent: row, context: { listPosition } });
    elements.push({ tagName: "span", selector: `${item} > span.subject`, visibleText: message.subject, parent: row, context: { listPosition } });
    elements.push({ tagName: "button", selector: `${item} > button`, visibleText: "Archive", parent: row, context: { listPosition } });
  });
  return { url: "https://mail.test/inbox", title: "Inbox", viewport: { width: 1000, height: 1000, scrollX: 0, scrollY: 0 }, interactiveElements: elements };
}
