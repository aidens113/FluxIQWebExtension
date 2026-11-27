// t1067: an add on a card of a results grid whose cards are `div`s keyed one by one (`data-item-id`) named nothing --
// no `actedOn`, no `actedOnItem`, no `actedOnCard` -- because the view marks no list around them and a keyed record carries
// no words of its own (run-mwy3btww-31d32e0d, 0020). It now names the card by its keyed record: its place among the cards
// keyed the same way and the words the view printed for it. Through the real runtime, on a plain grid.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "../../..";
import { shownPageLines } from "../../../page-view/tests/shown-page-lines";

const PROJECT = { projectId: "project.one", flowId: "flow.one" };
const CLICK = "web.output.dom-click";
const SNAPSHOT = "web.output.dom-capture_snapshot";

type Card = { id: string; name: string; price: string; lines: readonly string[] };

/** A hardware shop's grid: three cards, each a keyed `div` with a link, its words and an Add button. */
const TOOLS: readonly Card[] = [
  { id: "7701", name: "Claw Hammer, 16 oz", price: "$9.48", lines: ["4.4", "In stock today"] },
  { id: "7702", name: "Tape Measure, 25 ft", price: "$6.97", lines: ["4.8", "Ships tomorrow"] },
  { id: "7703", name: "Utility Knife, Retractable", price: "$4.28", lines: ["4.6", "In stock today"] }
];

/** The first two cards of the recorded grid, words as the page view showed them at 0018. */
const RECORDED: readonly Card[] = [
  { id: "418830166", name: "ValueRidge Essentials Paper Towels, 1 Roll", price: "$1.28", lines: ["$1.28/roll", "4.5", "4.5 out of 5 Stars. 938 reviews", "(938)", "Pickup today", "Delivery tomorrow"] },
  { id: "402917571", name: "Loftwell Select-A-Size Paper Towels, 12 Double Rolls", price: "$19.94", lines: ["1.3 ¢/sheet", "4.7", "4.7 out of 5 Stars. 6,480 reviews", "(6,480)", "Pickup today", "Delivery tomorrow"] }
];

test("an add on a keyed card names the card by its place and words", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(grid(TOOLS).gateway);
  const adds = await addHandles(runtime);
  const pressed = (await press(runtime, adds[2]!)).evidence as JsonObject;
  assert.equal(pressed.ok, true);
  assert.equal(pressed.actedOn, "This acted on item 3/3 (Utility Knife, Retractable, $4.28) only, through its \"+ Add\"; no other item was acted on.");
  assert.equal(pressed.actedOnItem, "item 3/3 (Utility Knife, Retractable, $4.28, 4.6, In stock today)");
  // An item, never a card in no list: the card line is for a press in no list.
  assert.equal("actedOnCard" in pressed, false);
});

test("the recorded grid's add names the single roll it added", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(grid(RECORDED).gateway);
  const adds = await addHandles(runtime);
  const pressed = (await press(runtime, adds[0]!)).evidence as JsonObject;
  assert.match(String(pressed.actedOn), /^This acted on item 1\/2 \(ValueRidge Essentials Paper Towels, 1 Roll, \$1\.28\) only/u);
  assert.match(String(pressed.actedOnItem), /^item 1\/2 \(ValueRidge Essentials Paper Towels, 1 Roll, \$1\.28, \$1\.28\/roll, 4\.5, 4\.5 out of 5 Stars\. 938 reviews, \(938\), Pickup today, Delivery tomorrow\)$/u);
});

test("a lone keyed card is no item, as a one-item list is none", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(grid(TOOLS.slice(0, 1)).gateway);
  const adds = await addHandles(runtime);
  const pressed = (await press(runtime, adds[0]!)).evidence as JsonObject;
  assert.equal(pressed.ok, true);
  assert.equal("actedOn" in pressed, false);
  assert.equal("actedOnItem" in pressed, false);
});

async function addHandles(runtime: ReturnType<typeof createWebAutomationLlmEvidenceRuntime>): Promise<string[]> {
  const looked = await runtime.executeTool({ ...PROJECT, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT, parameters: {}, consequences: [] } });
  return shownPageLines(looked.evidence).filter((line) => line.words === "+ Add").map((line) => line.target);
}

async function press(runtime: ReturnType<typeof createWebAutomationLlmEvidenceRuntime>, handle: string) {
  return runtime.executeTool({ ...PROJECT, callId: `call.press.${handle}`, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: CLICK, parameters: { target: { handle } }, consequences: ["modify_existing"] } });
}

/** A grid whose Add presses count up a basket. */
function grid(cards: readonly Card[]) {
  let added = 0;
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.capture_snapshot") return { status: "succeeded", payload: { snapshot: page(cards, added) } };
      if (command.actionType === "web.dom.click") added += 1;
      return { status: "succeeded", payload: { value: "ok" } };
    }
  };
  return { gateway };
}

function page(cards: readonly Card[], added: number): JsonObject {
  const elements: JsonObject[] = [
    { tagName: "h1", selector: "#results", visibleText: "Results" },
    { tagName: "span", selector: "#basket", visibleText: `Basket (${added})` }
  ];
  const container = elements.push({ tagName: "div", selector: "#grid", attributes: { id: "grid" } }) - 1;
  cards.forEach((card, index) => {
    const tile = `#grid > div:nth-of-type(${index + 1})`;
    const context = { record: { keyAttribute: "data-item-id", key: card.id } };
    const row = elements.push({ tagName: "div", selector: tile, parent: container, context }) - 1;
    elements.push({ tagName: "a", selector: `${tile} > a`, visibleText: card.name, attributes: { href: `/p/${card.id}` }, parent: row, context });
    elements.push({ tagName: "span", selector: `${tile} > span.price`, visibleText: card.price, parent: row, context });
    card.lines.forEach((line, at) => elements.push({ tagName: "span", selector: `${tile} > span.line-${at}`, visibleText: line, parent: row, context }));
    elements.push({ tagName: "button", selector: `${tile} > button`, visibleText: "+ Add", parent: row, context });
  });
  return { url: "https://tools.test/search?q=hand+tools", title: "Hand tools", viewport: { width: 1000, height: 1000, scrollX: 0, scrollY: 0 }, interactiveElements: elements };
}
