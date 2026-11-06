// A press in no list says the words of the control's own card as `actedOnCard`, for the
// person's line of the act (`../acted-on-card.ts`): a tile's own words, or the heading of
// an item's own page (its first main heading), and never a section heading or a heading from another part of the page. Lane B,
// run-mw44rtn1-37dee092: an add from a cart page's suggestion tiles was named after the
// page's title. Through the real runtime.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "../../..";
import { shownPageLines } from "../../../page-view/tests/shown-page-lines";

const PROJECT = { projectId: "project.one", flowId: "flow.one" };
const CLICK = "web.output.dom-click";
const SNAPSHOT = "web.output.dom-capture_snapshot";

test("an add on a suggestion tile in no list names that tile, and is never an item of a list", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(gatewayOf(tilesPage()));
  const adds = shownPageLines((await look(runtime)).evidence).filter((line) => line.words === "Add to cart").map((line) => line.target);
  assert.equal(adds.length, 2);
  const second = (await press(runtime, adds[1]!)).evidence as JsonObject;
  assert.equal(second.ok, true);
  assert.match(String(second.actedOnCard), /^Copper Kettle Cleaner, 4 Pack/u);
  assert.equal("actedOnItem" in second, false, "a tile's words never tie the press to a row");
  assert.equal("actedOn" in second, false);
});

test("a press on an item's own page names the item by the page's main heading, not the section it sits under", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(gatewayOf(itemPage()));
  const save = shownPageLines((await look(runtime)).evidence).find((line) => line.words === "Save")!.target;
  const pressed = (await press(runtime, save)).evidence as JsonObject;
  assert.equal(pressed.actedOnCard, "Walnut writing desk, 120cm");
});

test("a control in another part of the page than its main heading names nothing, so the line keeps the control's own words", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(gatewayOf(apartPage()));
  const subscribe = shownPageLines((await look(runtime)).evidence).find((line) => line.words === "Subscribe")!.target;
  const pressed = (await press(runtime, subscribe)).evidence as JsonObject;
  assert.equal(pressed.ok, true);
  assert.equal("actedOnCard" in pressed, false);
});

// Lane A's run-mw4907db-c3992394: the 500 Count was chosen and added, and the line said "100 Count", from the page's title,
// which the page never changed. The card is read from the look the press was made on, after the choice.
test("an add after choosing an option that changes the item's heading names the chosen item, never the page's unchanged title", async () => {
  let chosen = "100 Count";
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.capture_snapshot") return { status: "succeeded", payload: { snapshot: optionPage(chosen) } };
      if (command.actionType === "web.dom.click" && JSON.stringify(command).includes("#size-500")) chosen = "500 Count";
      return { status: "succeeded", payload: { value: "ok" } };
    }
  };
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  const size = shownPageLines((await look(runtime)).evidence).find((line) => line.words === "500 Count")!.target;
  await press(runtime, size);
  const add = shownPageLines((await look(runtime)).evidence).find((line) => line.words === "Add to cart")!.target;
  const added = (await press(runtime, add)).evidence as JsonObject;
  assert.equal(added.actedOnCard, "Table napkins, 500 Count");
});

test("a lone card's add, with no look-alike to publish its words, is named by its card", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(gatewayOf(loneCardPage("Copper Kettle Cleaner, 4 Pack $7.50")));
  const add = shownPageLines((await look(runtime)).evidence).find((line) => line.words === "Add to cart")!.target;
  const pressed = (await press(runtime, add)).evidence as JsonObject;
  assert.equal(pressed.actedOnCard, "Copper Kettle Cleaner, 4 Pack $7.50");
});

test("a lone card's words never reach the page view: the evidence and its lines are byte-identical whatever they are", async () => {
  const seen = async (words: string) => {
    const looked = await look(createWebAutomationLlmEvidenceRuntime(gatewayOf(loneCardPage(words))));
    return { evidence: JSON.stringify(looked.evidence), lines: JSON.stringify(shownPageLines(looked.evidence)) };
  };
  const one = await seen("Copper Kettle Cleaner, 4 Pack $7.50");
  const other = await seen("A different card altogether $1.00");
  assert.equal(one.evidence, other.evidence);
  assert.equal(one.lines, other.lines);
  assert.equal(one.evidence.includes("Copper Kettle Cleaner"), false);
});

test("a tile with no card words on a page whose main heading names the page never takes that heading", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(gatewayOf(bareTilesPage()));
  const adds = shownPageLines((await look(runtime)).evidence).filter((line) => line.words === "Add to cart").map((line) => line.target);
  assert.equal(adds.length, 2);
  const pressed = (await press(runtime, adds[0]!)).evidence as JsonObject;
  assert.equal(pressed.ok, true);
  assert.equal("actedOnCard" in pressed, false);
});

test("a press inside a list keeps saying its item, and no card", async () => {
  const runtime = createWebAutomationLlmEvidenceRuntime(gatewayOf(listPage()));
  const remove = shownPageLines((await look(runtime)).evidence).find((line) => line.words === "Remove")!.target;
  const pressed = (await press(runtime, remove)).evidence as JsonObject;
  assert.match(String(pressed.actedOnItem), /^item 1\/2 /u);
  assert.equal("actedOnCard" in pressed, false);
});

async function look(runtime: ReturnType<typeof createWebAutomationLlmEvidenceRuntime>) {
  return runtime.executeTool({ ...PROJECT, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT, parameters: {}, consequences: [] } });
}

async function press(runtime: ReturnType<typeof createWebAutomationLlmEvidenceRuntime>, handle: string) {
  return runtime.executeTool({ ...PROJECT, callId: `call.press.${handle}`, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: CLICK, parameters: { target: { handle } }, consequences: [] } });
}

function gatewayOf(page: JsonObject): WebLlmEvidenceGateway {
  return {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) =>
      command.actionType === "web.dom.capture_snapshot" ? { status: "succeeded", payload: { snapshot: page } } : { status: "succeeded", payload: { value: "ok" } }
  };
}

function snapshot(title: string, elements: JsonObject[]): JsonObject {
  return { url: "https://shop.test/page", title, viewport: { width: 1000, height: 1000, scrollX: 0, scrollY: 0 }, interactiveElements: elements };
}

/** A basket page whose suggestion tiles each carry a product link and an add, in no repeating list. */
function tilesPage(): JsonObject {
  const main = { landmark: "main" };
  const tile = (n: number, name: string, price: string): JsonObject[] => [
    { tagName: "a", selector: `#tile${n} a`, visibleText: name, attributes: { href: `/p/${n}` }, context: { ...main, heading: "You may also like", record: { text: `${name} ${price}` } } },
    { tagName: "button", selector: `#tile${n} button`, visibleText: "Add to cart", context: { ...main, heading: "You may also like", record: { text: `${name} ${price}` } } }
  ];
  return snapshot("Your basket", [
    { tagName: "h1", selector: "h1", visibleText: "Your basket", context: main },
    { tagName: "h2", selector: "h2", visibleText: "You may also like", context: { ...main, heading: "Your basket" } },
    ...tile(1, "Linen Tea Towels, Set of 3", "$12.00"),
    ...tile(2, "Copper Kettle Cleaner, 4 Pack", "$7.50")
  ]);
}

/** A basket page whose two suggestion tiles say nothing of themselves: two alike adds under the page's own heading. */
function bareTilesPage(): JsonObject {
  const main = { landmark: "main" };
  return snapshot("Your basket", [
    { tagName: "h1", selector: "h1", visibleText: "Your basket", context: main },
    { tagName: "button", selector: "#tile1 button", visibleText: "Add to cart", context: { ...main, heading: "Your basket" } },
    { tagName: "button", selector: "#tile2 button", visibleText: "Add to cart", context: { ...main, heading: "Your basket" } }
  ]);
}

/** A results page with a single card: its add carries the card's words in the capture's record, and nothing on the page view repeats them. */
function loneCardPage(cardWords: string): JsonObject {
  const main = { landmark: "main" };
  return snapshot("Search results", [
    { tagName: "h1", selector: "h1", visibleText: "Results", context: main },
    { tagName: "button", selector: "#card button", visibleText: "Add to cart", context: { ...main, heading: "Results", record: { text: cardWords } } }
  ]);
}

/** An item's own page whose heading names the size chosen, while its title keeps the first size. */
function optionPage(chosen: string): JsonObject {
  const main = { landmark: "main" };
  return snapshot("Table napkins, 100 Count | Store", [
    { tagName: "h1", selector: "h1", visibleText: `Table napkins, ${chosen}`, context: main },
    { tagName: "button", selector: "#size-100", visibleText: "100 Count", context: { ...main, heading: `Table napkins, ${chosen}` } },
    { tagName: "button", selector: "#size-500", visibleText: "500 Count", context: { ...main, heading: `Table napkins, ${chosen}` } },
    { tagName: "button", selector: "#add", visibleText: "Add to cart", context: { ...main, heading: `Table napkins, ${chosen}` } }
  ]);
}

/** An item's own page: its title, then its Save. */
function itemPage(): JsonObject {
  const main = { landmark: "main" };
  return snapshot("Walnut writing desk, 120cm | Market", [
    { tagName: "a", selector: "nav a", visibleText: "Home", attributes: { href: "/" }, context: { landmark: "navigation" } },
    { tagName: "h1", selector: "h1", visibleText: "Walnut writing desk, 120cm", context: main },
    { tagName: "span", selector: "#price", visibleText: "£80", context: { ...main, heading: "Walnut writing desk, 120cm" } },
    { tagName: "h2", selector: "#about", visibleText: "About this item", context: { ...main, heading: "Walnut writing desk, 120cm" } },
    { tagName: "button", selector: "#save", visibleText: "Save", context: { ...main, heading: "About this item" } }
  ]);
}

/** A page whose main heading is in its main region, and a control in its footer under a side region's heading. */
function apartPage(): JsonObject {
  return snapshot("News", [
    { tagName: "h1", selector: "main h1", visibleText: "Morning headlines", context: { landmark: "main" } },
    { tagName: "h2", selector: "aside h2", visibleText: "Trending topics", context: { landmark: "complementary" } },
    { tagName: "button", selector: "footer button", visibleText: "Subscribe", context: { landmark: "contentinfo", heading: "Trending topics" } }
  ]);
}

/** Two rows of a list, each with its own Remove. */
function listPage(): JsonObject {
  const elements: JsonObject[] = [];
  const container = elements.push({ tagName: "ul", selector: "#rows" }) - 1;
  ["Blue mug", "Green mug"].forEach((name, index) => {
    const listPosition = { index: index + 1, total: 2 };
    const row = elements.push({ tagName: "li", selector: `#rows > li:nth-of-type(${index + 1})`, parent: container, context: { listPosition } }) - 1;
    elements.push({ tagName: "span", selector: `#rows > li:nth-of-type(${index + 1}) > span`, visibleText: name, parent: row, context: { listPosition } });
    elements.push({ tagName: "button", selector: `#rows > li:nth-of-type(${index + 1}) > button`, visibleText: "Remove", parent: row, context: { listPosition } });
  });
  return snapshot("Cart", elements);
}
