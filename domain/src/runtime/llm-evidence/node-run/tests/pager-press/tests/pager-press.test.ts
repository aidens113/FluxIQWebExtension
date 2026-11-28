// A press on the control a detected list names as its Next is a page turn (t1096): its lost answer is judged off
// the page as a Next page step's is (`../../../retries/page-effect.ts`), and a turn the page showed had landed moves
// the list, so a read of it on a site that pages by its path (`/catalog/page/2`) stands there
// (`../../../list-pages/`) instead of being refused as a list not on its page (t1022).
//
// The recorded shape (the manual run of 2026-11-27, steps 0046-0049): a click on the pager's "Next page" whose answer
// timed out while the document reloaded onto the next page. The pages are synthetic -- a shelf of cards with a pager --
// and the list is a captured detection's; none of that run's page text is here.

import assert from "node:assert/strict";
import test from "node:test";
import { runWithAutomationStudioEvidenceBuildScope } from "fluxiq/automation";
import type { JsonObject, JsonValue } from "fluxiq/core";
import { webAutomationOutputNodeId } from "../../../../../../output-nodes";
import { shownHandle } from "../../../../page-view/tests/shown-page-lines";
import type { WebLlmRepeatingStructure } from "../../../../structure";
import { CAPTURED_DETECTIONS } from "../../../../structure/tests/captured-detections";
import { createWebAutomationLlmEvidenceRuntime } from "../../../../tools";
import type { WebLlmEvidenceGateway } from "../../../..";
import type { WebNodeDispatchResult } from "../../../retries";
import { WEB_LLM_DETECT_STRUCTURE_TOOL_ID, WEB_LLM_RUN_NODE_TOOL_ID } from "../../../../vocabulary";

const SCOPE = { projectId: "project.one", flowId: "flow.one" } as const;
const CAPTURE = CAPTURED_DETECTIONS["product-catalog-largest"];
/** The Next control the captured detection names as the list's way on. */
const NEXT_SELECTOR = "[data-testid=\"pagination-next\"]";
const EXTRACT_NODE = webAutomationOutputNodeId("web.dom.extract_list");
const NEXT_PAGE_NODE = webAutomationOutputNodeId("web.dom.next_page");
const PRESS_NODE = "web.output.dom-click";
const LOOK_NODE = "web.output.dom-capture_snapshot";
const FIELDS = { name: "product-name", price: "product-price" };
const PERMITTED = async () => ({ permitted: true as const });
const LOST: WebNodeDispatchResult = { status: "timed_out" };

/** Where page `n` of the shelf is: the first on its own path, the next under `/page/2`, another family of pages (t1022). */
const address = (page: 1 | 2): string => (page === 1 ? "https://shelf.test/catalog" : "https://shelf.test/catalog/page/2");

/** One page of a four-card shelf with its pager, marking its page current; a Sort control beside it that turns nothing. */
function shelfPage(page: 1 | 2): JsonObject {
  const cards = page === 1 ? ["a1", "a2", "a3", "a4"] : ["b1", "b2", "b3", "b4"];
  return {
    url: address(page),
    title: "Shelf",
    viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 0 },
    interactiveElements: [
      { tagName: "button", selector: "#sort", visibleText: "Sort by price" },
      ...cards.map((key, index) => ({ tagName: "a", selector: `[data-testid="product-card"]:nth-of-type(${index + 1}) > a`, visibleText: `Card ${key}`, context: { record: { keyAttribute: "href", key: `/item/${key}` } } })),
      { tagName: "button", selector: "nav > button:nth-of-type(1)", visibleText: "1", attributes: page === 1 ? { "aria-current": "page" } : {} },
      { tagName: "button", selector: "nav > button:nth-of-type(2)", visibleText: "2", attributes: page === 2 ? { "aria-current": "page" } : {} },
      { tagName: "button", selector: NEXT_SELECTOR, visibleText: "Next page", attributes: { "aria-label": "Next page" } }
    ]
  };
}

type Runtime = ReturnType<typeof createWebAutomationLlmEvidenceRuntime>;

/**
 * The shelf: every look answers the page it is on with the captured detection, every read the page it ran on, and
 * each act its answer in `acts` (else success). A turn of the list -- a press on its Next, or a Next page step --
 * moves the shelf to page 2 once `landsOn` of them were sent.
 */
function shelf(options: { acts?: readonly WebNodeDispatchResult[]; landsOn?: number } = {}): { runtime: Runtime; sent: string[] } {
  let page: 1 | 2 = 1;
  let turns = 0;
  const sent: string[] = [];
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.one"],
    structureDetectionSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.capture_snapshot") {
        return { status: "succeeded", payload: { snapshot: shelfPage(page), structure: structuredClone(CAPTURE.structure) as JsonValue } };
      }
      if (command.actionType === "web.dom.extract_list") {
        return { status: "succeeded", payload: { url: address(page), extracted: [{ name: `Card on page ${page}`, price: "$4.00" }], extraction: { recordCount: 1, pagesRead: 1, itemsSeen: 1, truncated: false, fieldNames: ["name", "price"], missingFields: [] } } };
      }
      sent.push(command.actionType === "web.dom.click" ? `click ${String(command.parameters.selector)}` : command.actionType);
      if (command.actionType === "web.dom.next_page" || command.parameters.selector === NEXT_SELECTOR) {
        turns += 1;
        if (turns >= (options.landsOn ?? 1)) page = 2;
      }
      return options.acts?.[sent.length - 1] ?? { status: "succeeded", payload: {} };
    }
  };
  return { runtime: createWebAutomationLlmEvidenceRuntime(gateway), sent };
}

function inBuild<T>(run: () => T, opening?: "fresh"): T {
  return runWithAutomationStudioEvidenceBuildScope(opening ? { ...SCOPE, buildId: "build.one", opening } : { ...SCOPE, buildId: "build.one" }, run);
}

const call = (runtime: Runtime, callId: string, value: JsonObject) => inBuild(() => runtime.executeTool({ ...SCOPE, callId, toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: PERMITTED, value }));

/** Look, detect the shelf's list and read it on page 1 by its handle: the handle, and the look's page with its handles. */
async function readFirstPage(runtime: Runtime): Promise<{ handle: string; looked: unknown }> {
  const looked = await inBuild(() => runtime.executeTool({ ...SCOPE, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: LOOK_NODE, parameters: {}, consequences: [] } }), "fresh");
  const detected = await inBuild(() => runtime.executeTool({ ...SCOPE, callId: "call.detect", toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: {} }));
  const handle = (detected.evidence as WebLlmRepeatingStructure).extraction;
  const read = await call(runtime, "call.read.1", { node: EXTRACT_NODE, parameters: { extractList: { handle, fields: FIELDS, minItems: 0 } }, consequences: [] });
  assert.equal(read.resultCode, "web.inspect.succeeded", JSON.stringify(read.evidence).slice(0, 300));
  return { handle, looked: looked.evidence };
}

/** Read the list again on the page the shelf is on now. */
async function readAgain(runtime: Runtime, handle: string) {
  await call(runtime, "call.look.2", { node: LOOK_NODE, parameters: {}, consequences: [] });
  return await call(runtime, "call.read.2", { node: EXTRACT_NODE, parameters: { extractList: { handle, fields: FIELDS, minItems: 0 } }, consequences: [] });
}

test("a press on the list's Next whose answer was lost and whose page turned is pressed once, and the list then reads on /page/2", async () => {
  const { runtime, sent } = shelf({ acts: [LOST], landsOn: 1 });
  const { handle, looked } = await readFirstPage(runtime);
  const pressed = await call(runtime, "call.next", { node: PRESS_NODE, parameters: { target: { handle: shownHandle(looked, "Next page") } }, consequences: [] });
  assert.equal(pressed.effectApplied, true, JSON.stringify(pressed.evidence).slice(0, 300));
  assert.deepEqual(sent, [`click ${NEXT_SELECTOR}`], "a turn that landed is never pressed again");
  const read = await readAgain(runtime, handle);
  assert.equal(read.resultCode, "web.inspect.succeeded", JSON.stringify(read.evidence).slice(0, 400));
  assert.match(JSON.stringify(read.evidence), /Card on page 2/u);
});

test("a press on the list's Next whose answer was lost on a page that did not move did not land, so it is pressed again", async () => {
  const { runtime, sent } = shelf({ acts: [LOST], landsOn: 2 });
  const { handle, looked } = await readFirstPage(runtime);
  const pressed = await call(runtime, "call.next", { node: PRESS_NODE, parameters: { target: { handle: shownHandle(looked, "Next page") } }, consequences: [] });
  assert.equal(pressed.effectApplied, true, JSON.stringify(pressed.evidence).slice(0, 300));
  assert.deepEqual(sent, [`click ${NEXT_SELECTOR}`, `click ${NEXT_SELECTOR}`], "the unchanged list said the first press did not land");
  const read = await readAgain(runtime, handle);
  assert.equal(read.resultCode, "web.inspect.succeeded", JSON.stringify(read.evidence).slice(0, 400));
});

test("a lost press on any other control whose page did not move stays uncertain and is not pressed again", async () => {
  const { runtime, sent } = shelf({ acts: [LOST] });
  const { looked } = await readFirstPage(runtime);
  const pressed = await call(runtime, "call.sort", { node: PRESS_NODE, parameters: { target: { handle: shownHandle(looked, "Sort by price") } }, consequences: [] });
  assert.equal(pressed.effectApplied, false);
  assert.deepEqual(sent, ["click #sort"]);
});

test("a Next page step whose answer was lost and whose page turned moves the list too, so it reads on /page/2", async () => {
  const { runtime, sent } = shelf({ acts: [LOST], landsOn: 1 });
  const { handle } = await readFirstPage(runtime);
  const moved = await call(runtime, "call.next", { node: NEXT_PAGE_NODE, parameters: { nextPage: { list: handle } }, consequences: [] });
  assert.equal(moved.effectApplied, true, JSON.stringify(moved.evidence).slice(0, 300));
  assert.deepEqual(sent, ["web.dom.next_page"]);
  const read = await readAgain(runtime, handle);
  assert.equal(read.resultCode, "web.inspect.succeeded", JSON.stringify(read.evidence).slice(0, 400));
});

test("control: the list read on /page/2 reached by no turn of its own is still refused as not on its page", async () => {
  const { runtime } = shelf({ landsOn: 1 });
  const { handle, looked } = await readFirstPage(runtime);
  // The Sort press turns nothing; the shelf is moved by a turn the build did not make (a Next page step answered with no move).
  await call(runtime, "call.sort", { node: PRESS_NODE, parameters: { target: { handle: shownHandle(looked, "Sort by price") } }, consequences: [] });
  await call(runtime, "call.next", { node: NEXT_PAGE_NODE, parameters: { nextPage: { list: handle } }, consequences: [] });
  const read = await readAgain(runtime, handle);
  assert.equal((read.evidence as JsonObject & { detail?: JsonObject }).detail?.reason, "list_not_on_page", JSON.stringify(read.evidence).slice(0, 400));
});
