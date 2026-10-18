// A library call's declaration says where its control sits (Core t475): the
// opaque token of the record -- here, a request's row -- so Core can refuse an
// undo aimed at another row's Confirm before anything is pressed. Lane D round
// 10 (`run-mv5tusge-1400ddf7`) aimed an undo at Tom Becker's Confirm, a row the
// build never touched.

import assert from "node:assert/strict";
import test from "node:test";
import type { AutomationStudioActionDeclaration } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "../..";
import { webControlSpotToken } from "..";
import { shownPageLines } from "../../page-view/tests/shown-page-lines";

const PROJECT = { projectId: "project.one", flowId: "flow.one" };
const SEP = String.fromCharCode(31);

/** Two request rows, each with its own Confirm button. */
/** Two request rows; each confirm that lands counts on a status line, as a real page answers it, so none is taken for a press that changed nothing (t511). */
function requests(confirmed = 0): JsonObject {
  const row = (name: string, y: number) => [
    { tagName: "a", selector: `#name-${name}`, visibleText: name, bounds: { x: 0, y, width: 100, height: 20 }, context: { record: { text: name } } },
    { tagName: "button", selector: `#confirm-${name}`, visibleText: "Confirm", bounds: { x: 200, y, width: 80, height: 20 }, context: { record: { text: name } } }
  ];
  return { url: "https://example.test/requests", title: "Requests", viewport: { width: 400, height: 400, scrollX: 0, scrollY: 0 }, interactiveElements: [...row("Tom Becker", 0), ...row("Amara Osei", 40), { tagName: "span", selector: "#status", visibleText: `${confirmed} confirmed`, bounds: { x: 0, y: 80, width: 100, height: 20 } }] };
}

test("a press declares the opaque token of the row its control sits in: each row its own, and none of its words", async () => {
  let confirmed = 0;
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_session, command) => {
      if (command.actionType === "web.dom.capture_snapshot") return { status: "succeeded", payload: { snapshot: requests(confirmed) } };
      if (command.actionType === "web.dom.click") confirmed += 1;
      return { status: "succeeded", payload: { value: "ok" } };
    }
  };
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  const looked = await runtime.executeTool({ ...PROJECT, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });
  const confirms = shownPageLines(looked.evidence).filter((line) => line.words === "Confirm");
  assert.equal(confirms.length, 2);
  const declared: AutomationStudioActionDeclaration[] = [];
  for (const [n, line] of confirms.entries()) {
    await runtime.executeTool({
      ...PROJECT, callId: `call.press.${n}`, toolId: WEB_LLM_RUN_NODE_TOOL_ID,
      value: { node: "web.output.dom-click", parameters: { target: { handle: line.target } }, consequences: ["modify_existing"] },
      permission: async (declaration) => {
        declared.push(declaration);
        return { permitted: true };
      }
    });
  }
  const items = declared.map((declaration) => declaration.control.item);
  assert.deepEqual(new Set(items), new Set([webControlSpotToken("item", `text${SEP}Tom Becker`), webControlSpotToken("item", `text${SEP}Amara Osei`)]));
  assert.ok(!JSON.stringify(declared.map((declaration) => declaration.control.item)).includes("Amara"));
});

// Core t719: an add pressed on a detail page sits in no row, and its line
// appears on the basket page, so the item token alone can tie no undo there to
// it. The declaration also says what the control and its page are about: the
// add's page token is the kettle line's subject token, and never the wraps'.
const KETTLE = "Copper Pour-Over Kettle 1 L", WRAPS = "Beeswax Wraps, Set of 3";
/** A detail page: its main heading, a heading in an open offer dialog, and an add in no row, titled nearest by a seller link. */
function detailPage(): JsonObject {
  return { url: "https://shop.test/kettle", title: "Shop", viewport: { width: 400, height: 400, scrollX: 0, scrollY: 0 }, interactiveElements: [
    { tagName: "h1", selector: "#offer-title", visibleText: "Join and save", bounds: { x: 0, y: 0, width: 200, height: 20 }, context: { subject: "Join and save", dialog: "Join and save" } },
    { tagName: "h1", selector: "#title", visibleText: KETTLE, bounds: { x: 0, y: 30, width: 200, height: 20 }, context: { subject: KETTLE } },
    { tagName: "button", selector: "#add", visibleText: "Add to basket", bounds: { x: 0, y: 60, width: 120, height: 20 }, context: { subject: "Sold by Fernhill Goods" } }
  ] };
}
/** The basket: two lines, each titled by its item, with its own Remove. */
function basketPage(): JsonObject {
  const line = (name: string, y: number) => ({ tagName: "button", selector: `#remove-${y}`, visibleText: "Remove", bounds: { x: 200, y, width: 80, height: 20 }, context: { record: { text: name }, subject: name } });
  return { url: "https://shop.test/basket", title: "Basket", viewport: { width: 400, height: 400, scrollX: 0, scrollY: 0 }, interactiveElements: [
    { tagName: "h1", selector: "#basket", visibleText: "Your basket", bounds: { x: 0, y: 0, width: 200, height: 20 }, context: { subject: "Your basket" } },
    line(KETTLE, 40), line(WRAPS, 80)
  ] };
}

test("a press declares what its control and its page are about, so an add on a detail page and the basket line it made share a token (Core t719)", async () => {
  let page = detailPage();
  // Each press that lands counts on a status line, as a real page answers it (t511).
  let pressed = 0;
  const shown = (): JsonObject => ({ ...page, interactiveElements: [...(page.interactiveElements as JsonObject[]), { tagName: "span", selector: "#status", visibleText: `${pressed} done`, bounds: { x: 0, y: 200, width: 100, height: 20 } }] });
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_session, command) => {
      if (command.actionType === "web.dom.capture_snapshot") return { status: "succeeded", payload: { snapshot: shown() } };
      if (command.actionType === "web.dom.click") pressed += 1;
      return { status: "succeeded", payload: { value: "ok" } };
    }
  };
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  const declared: AutomationStudioActionDeclaration[] = [];
  const pressShown = async (callId: string, words: string, nth = 0) => {
    const looked = await runtime.executeTool({ ...PROJECT, callId: `${callId}.look`, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });
    const line = shownPageLines(looked.evidence).filter((shown) => shown.words === words)[nth];
    assert.ok(line, `no shown line "${words}"`);
    await runtime.executeTool({
      ...PROJECT, callId, toolId: WEB_LLM_RUN_NODE_TOOL_ID,
      value: { node: "web.output.dom-click", parameters: { target: { handle: line.target } }, consequences: ["create_new"] },
      permission: async (declaration) => {
        declared.push(declaration);
        return { permitted: true };
      }
    });
  };
  await pressShown("call.add", "Add to basket");
  page = basketPage();
  await pressShown("call.remove.kettle", "Remove", 0);
  await pressShown("call.remove.wraps", "Remove", 1);

  const [add, kettle, wraps] = declared.map((declaration) => declaration.control);
  // The page is about the kettle: its main heading outside the offer dialog.
  assert.deepEqual({ subject: add?.subject, page: add?.page, item: add?.item }, { subject: webControlSpotToken("subject", "Sold by Fernhill Goods"), page: webControlSpotToken("subject", KETTLE), item: undefined });
  assert.equal(kettle?.subject, add?.page);
  assert.notEqual(wraps?.subject, add?.page);
  assert.equal(kettle?.page, webControlSpotToken("subject", "Your basket"));
  assert.ok(!JSON.stringify(declared.map((declaration) => [declaration.control.subject, declaration.control.page])).match(/Kettle|Wraps|basket/u));
});
