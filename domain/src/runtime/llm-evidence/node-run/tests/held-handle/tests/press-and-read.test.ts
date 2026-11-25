// A node run's press and read bind a handle the page as it is now still gives to an element, and refuse only a handle
// the page now gives to no element (page-diff D2; t1036, t1042).
//
// A node run captures the page before it acts, numbers it with the run's stable handles and hands it to the packet
// store before it resolves the call (`../../../run.ts`), so a handle that capture prints resolves on the page as it is now,
// whichever view printed it: here, one printed before a sort loaded the results anew under another address, which keeps
// the element's handle (`../../../../stable-handles.ts`, tier 2b). One the page now gives to nothing -- the browser has gone
// to an item page without it -- is refused `page_moved_since_packet` with the page as it is, and nothing is sent. The
// pages are written by hand (a hardware shop), never a recorded site.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "../../../..";
import { shownHandle } from "../../../../page-view/tests/shown-page-lines";

const PROJECT = { projectId: "project.one", flowId: "flow.one" };
const SNAPSHOT = "web.output.dom-capture_snapshot";
const CLICK = "web.output.dom-click";
const READ = "web.output.dom-extract_list";
const READ_PERMITTED = async () => ({ permitted: true as const });
const RESULTS = "https://hardware.test/search?q=hinges";
const SORTED = "https://hardware.test/search?q=hinges&sort=price";
const ITEM = "https://hardware.test/item/brass-hinge";

/** The header's basket link. */
const BASKET: JsonObject = { tagName: "a", selector: "header > a.basket", visibleText: "Basket (2)", attributes: { href: "/basket" } };

type Shop = { runtime: ReturnType<typeof createWebAutomationLlmEvidenceRuntime>; commands: string[]; go(url: string, document: number, basket: boolean): void };

function shop(): Shop {
  let at = { url: RESULTS, document: 1, basket: true };
  const commands: string[] = [];
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      commands.push(command.actionType);
      if (command.actionType !== "web.dom.capture_snapshot") return { status: "succeeded", payload: { extracted: [{ text: "Basket (2)" }], extraction: { recordCount: 1, pagesRead: 1, itemsSeen: 1, truncated: false, fieldNames: ["text"], missingFields: [] } } };
      const own: JsonObject[] = at.url === ITEM
        ? [{ tagName: "button", selector: "main > button.add", visibleText: "Add to basket" }]
        : [{ tagName: "a", selector: "main > a.card", visibleText: "Brass hinge" }];
      return { status: "succeeded", payload: { snapshot: { url: at.url, title: "Hardware", interactiveElements: [...(at.basket ? [BASKET] : []), ...own], evidence: { navigation: { timeOrigin: at.document } } } } };
    }
  };
  return { runtime: createWebAutomationLlmEvidenceRuntime(gateway), commands, go: (url, document, basket) => { at = { url, document, basket }; } };
}

/** The basket link's handle as the results page printed it, with the browser then on the sorted results (still showing it) or the item page (not). */
async function basketSeenThenMoved(stillThere: boolean): Promise<Shop & { basket: string }> {
  const opened = shop();
  const looked = await opened.runtime.executeTool({ ...PROJECT, callId: "call.look.results", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: SNAPSHOT, parameters: {}, consequences: [] } });
  const basket = shownHandle(looked.evidence, "Basket (2)");
  opened.go(stillThere ? SORTED : ITEM, 2, stillThere);
  opened.commands.length = 0;
  return { ...opened, basket };
}

const sent = (commands: string[]) => commands.filter((command) => command !== "web.dom.capture_snapshot");
type Answer = { resultCode?: string; resultReason?: string; effectApplied?: boolean; evidence: unknown };

test("a press binds a handle another address's view printed when the page as it is now still gives it to that element", async () => {
  const { runtime, commands, basket } = await basketSeenThenMoved(true);
  const pressed = await runtime.executeTool({ ...PROJECT, callId: "call.press", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: CLICK, parameters: { target: { handle: basket } }, consequences: [] } }) as Answer;
  assert.notEqual(pressed.resultReason, "page_moved_since_packet", JSON.stringify(pressed.evidence).slice(0, 600));
  assert.equal(pressed.effectApplied, true, JSON.stringify(pressed.evidence).slice(0, 600));
  assert.equal(sent(commands).includes("web.dom.click"), true, "the press was sent to the page");
});

test("a press of a handle the page as it is now gives to no element is refused stale, and nothing is sent", async () => {
  const { runtime, commands, basket } = await basketSeenThenMoved(false);
  const pressed = await runtime.executeTool({ ...PROJECT, callId: "call.press", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: CLICK, parameters: { target: { handle: basket } }, consequences: [] } }) as Answer;
  assert.equal(pressed.effectApplied, false);
  assert.equal((pressed.evidence as { detail?: { reason?: string } }).detail?.reason, "page_moved_since_packet");
  assert.deepEqual(sent(commands), [], "nothing but the look before acting was sent");
});

test("a read binds a handle another address's view printed when the page as it is now still gives it to that element", async () => {
  const { runtime, commands, basket } = await basketSeenThenMoved(true);
  const read = await runtime.executeTool({ ...PROJECT, callId: "call.read", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: READ_PERMITTED, value: { node: READ, parameters: { extractList: { handle: basket, fields: ["text"] } }, consequences: [] } }) as Answer;
  assert.notEqual(read.resultCode, "web.action.rejected.target_unobserved", JSON.stringify(read.evidence).slice(0, 600));
  assert.equal(sent(commands).length > 0, true, "the read was sent to the page");
});

test("a read of a handle the page as it is now gives to no element is refused stale, and nothing is sent", async () => {
  const { runtime, commands, basket } = await basketSeenThenMoved(false);
  const read = await runtime.executeTool({ ...PROJECT, callId: "call.read", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: READ_PERMITTED, value: { node: READ, parameters: { extractList: { handle: basket, fields: ["text"] } }, consequences: [] } }) as Answer;
  assert.equal(read.resultCode, "web.action.rejected.target_unobserved");
  assert.equal((read.evidence as { detail?: { reason?: string } }).detail?.reason, "page_moved_since_packet");
  assert.deepEqual(sent(commands), [], "nothing but the look before acting was sent");
});
