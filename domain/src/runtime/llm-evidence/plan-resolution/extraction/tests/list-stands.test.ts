// A saved read reads only the list its handle was made for, on a page where that list stands (t1022,
// `../list-stands.ts`): read anywhere else, it is refused naming the list and the page it was made on, and none of the
// rows its selector matched there is kept -- whether run fresh, run again while exploring, or replayed.
//
// The recorded shape (`run-mwuxd2v9-33928ea3`), in synthetic pages: a shop's home page and its cart, which draw cards
// from one template, so a list detected on the home page has an item selector the cart's own cards also match. The
// pages are a garden shop's, never the recorded retailer's; the list is a captured detection's.

import assert from "node:assert/strict";
import test from "node:test";
import { runWithAutomationStudioEvidenceBuildScope } from "fluxiq/automation";
import type { JsonObject, JsonValue } from "fluxiq/core";
import { webAutomationOutputNodeId } from "../../../../../output-nodes";
import type { WebLlmRepeatingStructure } from "../../../structure";
import { CAPTURED_DETECTIONS } from "../../../structure/tests/captured-detections";
import { createWebAutomationLlmEvidenceRuntime } from "../../../tools";
import { WEB_LLM_DETECT_STRUCTURE_TOOL_ID, WEB_LLM_RUN_NODE_TOOL_ID } from "../../../vocabulary";
import { webPlanListPageFamily } from "../list-family";
import { webPlanListReadElsewhere } from "../list-stands";

const SCOPE = { projectId: "project.one", flowId: "flow.one" } as const;
const CAPTURE = CAPTURED_DETECTIONS["product-catalog-largest"];
const EXTRACT_NODE = webAutomationOutputNodeId("web.dom.extract_list");
const NEXT_PAGE_NODE = webAutomationOutputNodeId("web.dom.next_page");
const FIELDS = { name: "product-name", price: "product-price" };
const HOME = "https://garden.test/";
const CART = "https://garden.test/basket";

test("a page's family is its origin and its path's shape: query, hash and the parts that name one item are not another page", () => {
  assert.equal(webPlanListPageFamily("https://garden.test/search?q=seeds&page=1"), webPlanListPageFamily("https://garden.test/search?q=bulbs&page=5#top"));
  assert.equal(webPlanListPageFamily("https://garden.test/item/rose-bush-12/4410"), webPlanListPageFamily("https://garden.test/item/tulip-mix-30/5520"));
  assert.equal(webPlanListPageFamily("https://garden.test/"), webPlanListPageFamily("https://garden.test"));
  assert.notEqual(webPlanListPageFamily(HOME), webPlanListPageFamily(CART));
  assert.notEqual(webPlanListPageFamily("https://garden.test/search"), webPlanListPageFamily("https://other.test/search"));
  assert.equal(webPlanListPageFamily("about:blank"), undefined);
  assert.equal(webPlanListPageFamily("not an address"), undefined);
});

test("a saved list stands on its own page's family and where its own pager took it, and nowhere else", () => {
  const parameters: JsonObject = { extractList: { handle: "extraction.4", fields: FIELDS, extractionBinding: { location: HOME, itemCount: 2, extractList: { item: "main > section.shelf", fields: {} } } } };
  assert.equal(webPlanListReadElsewhere(parameters, "https://garden.test/?store=2", () => false), undefined);
  assert.deepEqual(webPlanListReadElsewhere(parameters, CART, () => false), { handle: "extraction.4", madeAt: HOME, readAt: CART });
  assert.equal(webPlanListReadElsewhere(parameters, CART, (item) => item === "main > section.shelf"), undefined, "a list its own Next page moved stands where it went");
  assert.equal(webPlanListReadElsewhere({ extractList: { item: ".card", fields: { name: { selector: ".name" } } } }, CART, () => false), undefined, "a read naming no saved list is not judged here");
  assert.equal(webPlanListReadElsewhere(parameters, undefined, () => false), undefined, "nor one whose page is not known");
});

type Runtime = ReturnType<typeof createWebAutomationLlmEvidenceRuntime>;

/** A shop whose page can be moved: the captured list on every page, and each read answering the page it ran on. */
function shop(): { runtime: Runtime; reads: number; at: (location: string) => void; pager: (answer: JsonObject) => void } {
  let location = HOME;
  let pagerAnswer: JsonObject = { nextPage: { outcome: "moved", by: "next", page: 2 } };
  const state = {
    reads: 0,
    at: (next: string) => { location = next; },
    pager: (answer: JsonObject) => { pagerAnswer = answer; },
    runtime: undefined as unknown as Runtime
  };
  state.runtime = createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => ["session.one"],
    structureDetectionSessionIds: () => ["session.one"],
    executeAction: async (_sessionId, command) => {
      if (command.actionType === "web.dom.capture_snapshot") {
        const snapshot: JsonObject = { url: location, title: location === CART ? "Basket" : "Garden shop", interactiveElements: [] };
        return { status: "succeeded", payload: { snapshot, structure: structuredClone(CAPTURE.structure) as JsonValue } };
      }
      if (command.actionType === "web.dom.next_page") return { status: "succeeded", payload: { url: location, ...pagerAnswer } };
      state.reads += 1;
      const name = location === CART ? "Copper watering can" : "Seed tray";
      return { status: "succeeded", payload: { url: location, extracted: [{ name, price: "$4.00" }], extraction: { recordCount: 1, pagesRead: 1, itemsSeen: 1, truncated: false, fieldNames: ["name", "price"], missingFields: [] } } };
    }
  });
  return state;
}

function inBuild<T>(run: () => T, opening?: "fresh"): T {
  return runWithAutomationStudioEvidenceBuildScope(opening ? { ...SCOPE, buildId: "build.one", opening } : { ...SCOPE, buildId: "build.one" }, run);
}

const look = (runtime: Runtime) => inBuild(() => runtime.executeTool({ ...SCOPE, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } }));

/** Detect the home page's list and read it there by its handle: the handle and what the read saved. */
async function readOnHome(runtime: Runtime): Promise<{ handle: string; ranWith: { node: string; parameters: JsonObject; consequences?: JsonValue } }> {
  await inBuild(() => runtime.executeTool({ ...SCOPE, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } }), "fresh");
  const detected = await inBuild(() => runtime.executeTool({ ...SCOPE, callId: "call.detect", toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: {} }));
  const handle = (detected.evidence as WebLlmRepeatingStructure).extraction;
  const read = await inBuild(() => runtime.executeTool({ ...SCOPE, callId: "call.read", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: EXTRACT_NODE, parameters: { extractList: { handle, fields: FIELDS, minItems: 0 } }, consequences: [] } }));
  assert.equal(read.resultCode, "web.inspect.succeeded", JSON.stringify(read.evidence).slice(0, 300));
  assert.match(JSON.stringify(read.evidence), /Seed tray/u);
  return { handle, ranWith: JSON.parse(JSON.stringify(read.draft?.ranWith)) };
}

test("read again on another page, the list is refused naming it and the page it was made on, and the other page's rows are not kept", async () => {
  const garden = shop();
  const { handle } = await readOnHome(garden.runtime);
  garden.at(CART);
  await look(garden.runtime);
  const again = await inBuild(() => garden.runtime.executeTool({ ...SCOPE, callId: "call.read.cart", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: EXTRACT_NODE, parameters: { extractList: { handle, fields: FIELDS, minItems: 0 } }, consequences: [] } }));
  assert.equal(again.effectApplied, false);
  assert.equal(again.resultCode, "web.action.rejected.target_not_found");
  const evidence = again.evidence as JsonObject;
  const detail = evidence.detail as JsonObject;
  assert.equal(detail.reason, "list_not_on_page");
  assert.equal(detail.target, handle);
  assert.deepEqual(detail.instead, ["web.list.made_on:/"]);
  assert.match(String(detail.next), new RegExp(`Nothing was kept: the list ${handle.replace(".", "\\.")} is not on this page.*the page it was detected on \\(/\\)`, "u"));
  assert.doesNotMatch(JSON.stringify(evidence), /Copper watering can/u, "none of the basket's cards is shown as the list's rows");
  assert.equal(again.draft?.ranWith, undefined, "and the refused read is no step");
});

test("replayed on another page, the saved read fails as a list not on the page, answering no rows; on its own page it replays", async () => {
  const garden = shop();
  const { ranWith } = await readOnHome(garden.runtime);
  garden.at(CART);
  await look(garden.runtime);
  const elsewhere = await inBuild(() => garden.runtime.executeTool({ ...SCOPE, callId: "replay.cart", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { ...ranWith, replay: "step" } }));
  assert.equal(elsewhere.resultCode, "core.replay.failed");
  assert.equal(elsewhere.resultReason, "list_not_on_page");
  assert.match(JSON.stringify(elsewhere.evidence), /is not on this page: it was detected on \//u);
  assert.doesNotMatch(JSON.stringify(elsewhere.evidence), /Copper watering can/u);
  garden.at(HOME);
  await look(garden.runtime);
  const home = await inBuild(() => garden.runtime.executeTool({ ...SCOPE, callId: "replay.home", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { ...ranWith, replay: "step" } }));
  assert.equal(home.resultCode, "core.replay.replayed", JSON.stringify(home.evidence).slice(0, 300));
});

test("a list its own Next page moved to a page of another path stands there", async () => {
  const garden = shop();
  const { handle } = await readOnHome(garden.runtime);
  const moved = await inBuild(() => garden.runtime.executeTool({ ...SCOPE, callId: "call.next", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: NEXT_PAGE_NODE, parameters: { nextPage: { list: handle } }, consequences: [] } }));
  assert.equal(moved.effectApplied, true, JSON.stringify(moved.evidence).slice(0, 300));
  garden.at("https://garden.test/shelf/page/2");
  await look(garden.runtime);
  const read = await inBuild(() => garden.runtime.executeTool({ ...SCOPE, callId: "call.read.2", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: EXTRACT_NODE, parameters: { extractList: { handle, fields: FIELDS, minItems: 0 } }, consequences: [] } }));
  assert.equal(read.resultCode, "web.inspect.succeeded", JSON.stringify(read.evidence).slice(0, 300));
});
