// A candidate submission may name a control from any view exploration took
// (`../target-packets.ts`, `../resolve-plan-node.ts`, t358).
//
// Lane A round 4 (`run-muyrpbnk-fef374e7`): the start page's view after 0004
// showed the welcome popup's "×" (`t478`) and "No thanks" (`t488`); the model
// closed the popup, the next view of the same page no longer carried them, and
// twelve submissions naming them were refused `web.handle.unknown` (0037-0068).
// A Flow's first steps act on that start page, which exploration always leaves.
//
// Held here: under `view_history` such a handle resolves to its control's
// durable locator and says which view it came from; without it -- exploration's
// node runs, a legacy completion -- nothing changes; a handle no view carried
// is refused by name.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { webAutomationOutputNodeId } from "../../../../output-nodes";
import { sanitizeWebLlmSnapshotWithBindings } from "../../sanitize";
import { createWebLlmStableTargetHandles } from "../../stable-handles";
import { createWebLlmExtractionHandles } from "../../structure";
import { createWebLlmTargetPackets, resolveWebPlanNode, resolveWebPlanNodeParameters, type WebPlanNodeResolutionInput } from "..";

const SCOPE = { projectId: "project.one", flowId: "flow.one" };
const START = "https://farbazaar.test/";
const ITEM = "https://farbazaar.test/item/1005008123450";
const CLICK = webAutomationOutputNodeId("web.dom.click");

const SEARCH: JsonObject = { tagName: "input", selector: "#search", inputType: "search", accessibleName: "Search" };
const CLOSE: JsonObject = { tagName: "button", selector: "#welcome > button.close", visibleText: "×", accessibleName: "Close" };
const NO_THANKS: JsonObject = { tagName: "button", selector: "#welcome > button.decline", visibleText: "No thanks" };
const COUPON = (label: string): JsonObject => ({ tagName: "button", selector: "#store-coupon", visibleText: label });
const ADD: JsonObject = { tagName: "button", selector: "#add-to-cart", visibleText: "Add to cart" };

/** A build's exploration as round 4's went: the popup shown, closed, then the item page, its coupon pressed. */
function explored() {
  const targets = createWebLlmTargetPackets();
  const handles = createWebLlmStableTargetHandles();
  const capture = (url: string, elements: JsonObject[]) => handles.restamp(SCOPE, sanitizeWebLlmSnapshotWithBindings({ url, interactiveElements: elements }));
  const withPopup = capture(START, [SEARCH, CLOSE, NO_THANKS]);
  const handleOf = (selector: string): string => {
    const found = withPopup.evidence.elements.find((element) => withPopup.selectors.get(element.target) === selector);
    if (found === undefined) throw new Error(`no handle for ${selector}`);
    return found.target;
  };
  const close = handleOf("#welcome > button.close");
  const noThanks = handleOf("#welcome > button.decline");
  const start = withPopup.evidence.location;
  targets.remember(SCOPE, withPopup);
  // The popup closed: the next view of the same page carries neither control.
  targets.remember(SCOPE, capture(START, [SEARCH]));
  const itemView = capture(ITEM, [COUPON("Get coupons"), ADD]);
  const item = itemView.evidence.location;
  targets.remember(SCOPE, itemView);
  // The look after the press: the page relabelled the coupon.
  targets.rememberLook(SCOPE, capture(ITEM, [COUPON("Collected"), ADD]));
  return { targets, capture, close, noThanks, start, item };
}

function input(parameters: JsonObject, extra: Partial<WebPlanNodeResolutionInput> = {}): WebPlanNodeResolutionInput {
  return { ...SCOPE, nodeDefinitionId: CLICK, parameters, declaredConsequences: [], permission: async () => ({ permitted: true as const }), ...extra };
}

test("a candidate naming a start-page popup handle after exploration moved on resolves it to that control's durable locator, from the view that showed it", async () => {
  const { targets, close, noThanks, start } = explored();
  const stores = { targets, extractions: createWebLlmExtractionHandles() };

  const store = targets.resolve(SCOPE, close, undefined, "view_history");
  assert.equal(store.ok, true, JSON.stringify(store));
  if (!store.ok) return;
  assert.equal(store.selector, "#welcome > button.close");
  assert.deepEqual(store.shownIn, { view: 1, location: start });

  const answer = await resolveWebPlanNodeParameters(input({ target: { handle: close } }, { handleReach: "view_history" }), stores);
  assert.equal(answer.status, "resolved", JSON.stringify(answer));
  if (answer.status !== "resolved") return;
  assert.equal(answer.parameters.selector, "#welcome > button.close");
  const element = answer.parameters.element as JsonObject;
  assert.equal(element.tagName, "button");
  assert.equal(element.selector, "#welcome > button.close");
  assert.equal(element.accessibleName ?? element.visibleText, "Close");
  assert.equal(Object.hasOwn(answer.parameters, "target"), false, "the handle is gone from what the node runs with");
  assert.deepEqual(answer.handleViews, [{ handle: close, view: 1, location: start }]);

  // Named with the page that showed it, it resolves; with a page that never showed it, it does not.
  const there = await resolveWebPlanNodeParameters(input({ target: { handle: noThanks, location: start } }, { handleReach: "view_history" }), stores);
  assert.equal(there.status, "resolved", JSON.stringify(there));
  const elsewhere = await resolveWebPlanNodeParameters(input({ target: { handle: noThanks, location: ITEM } }, { handleReach: "view_history" }), stores);
  assert.equal(elsewhere.status === "refused" && elsewhere.issueCodes.includes("web.handle.unknown"), true, JSON.stringify(elsewhere));
});

test("exploration's node run on a handle from a view it has left is still refused, and a legacy completion is unchanged", async () => {
  const { targets, close } = explored();
  const stores = { targets, extractions: createWebLlmExtractionHandles() };
  assert.deepEqual(targets.resolve(SCOPE, close, undefined), { ok: false, code: "unknown" }, "the current pages do not carry it");

  // `node-run/run.ts` resolves a node this way, gated by itself and never with the view history.
  const run = await resolveWebPlanNode({ ...SCOPE, nodeDefinitionId: CLICK, parameters: { target: { handle: close } }, gatedByCaller: true }, stores);
  assert.equal(run.resolution.status, "refused");
  assert.equal(run.resolution.status === "refused" && run.resolution.issueCodes.includes("web.handle.unknown"), true, JSON.stringify(run.resolution));

  // A legacy completion asks without `handleReach`: the same refusal as before.
  const legacy = await resolveWebPlanNodeParameters(input({ target: { handle: close } }), stores);
  assert.equal(legacy.status === "refused" && legacy.issueCodes.includes("web.handle.unknown"), true, JSON.stringify(legacy));

  // And a handle on the current page resolves to exactly `status` and `parameters`, as Core requires of it.
  const add = targets.resolve(SCOPE, "t5", undefined);
  assert.equal(add.ok && add.selector, "#add-to-cart");
  const current = await resolveWebPlanNodeParameters(input({ target: { handle: "t5" } }), stores);
  assert.deepEqual(Object.keys(current).sort(), ["parameters", "status"]);
});

test("a handle no view ever showed is refused by name under the view history, and one the current page shows records its view", async () => {
  const { targets, item } = explored();
  const stores = { targets, extractions: createWebLlmExtractionHandles() };
  const never = await resolveWebPlanNodeParameters(input({ target: { handle: "t999" } }, { handleReach: "view_history" }), stores);
  assert.equal(never.status, "refused");
  if (never.status !== "refused") return;
  assert.equal(never.issueCodes.includes("web.handle.unknown"), true, JSON.stringify(never.issueCodes));
  assert.equal(never.issueCodes.includes("web.handle.unknown:target"), true, "the refusal says where the unknown handle was written");

  const add = await resolveWebPlanNodeParameters(input({ target: { handle: "t5" } }, { handleReach: "view_history" }), stores);
  assert.equal(add.status, "resolved", JSON.stringify(add));
  // The look after the press carried it last: the fourth capture.
  if (add.status === "resolved") assert.deepEqual(add.handleViews, [{ handle: "t5", view: 4, location: item }]);
});

test("a control that left the page after its own act keeps only what its views agreed on, never the label the act gave it", () => {
  const { targets, capture } = explored();
  // The item page again, the coupon gone from it.
  targets.remember(SCOPE, capture(ITEM, [ADD]));
  assert.equal(targets.resolve(SCOPE, "t4", undefined).ok, false, "the current pages no longer carry the coupon");
  const coupon = targets.resolve(SCOPE, "t4", undefined, "view_history");
  assert.equal(coupon.ok, true, JSON.stringify(coupon));
  if (!coupon.ok) return;
  assert.equal(coupon.selector, "#store-coupon");
  assert.equal(coupon.element.visibleText, undefined, "neither \"Get coupons\" nor \"Collected\"");
  assert.equal(coupon.element.tagName, "button");
});

test("under the view history a handle a reload renumbered keeps its refusal, and a page the store let go resolves from the history", () => {
  const PAGE = "https://shop.example/item/1";
  const targets = createWebLlmTargetPackets();
  const reloaded = (elements: JsonObject[], type?: string) => {
    const snapshot: JsonObject = { url: PAGE, interactiveElements: elements };
    if (type !== undefined) snapshot.evidence = { navigation: { url: PAGE, origin: "https://shop.example", path: "/item/1", type, historyLength: 2, visibility: "visible" } };
    return sanitizeWebLlmSnapshotWithBindings(snapshot);
  };
  const chip = (name: string, selector: string): JsonObject => ({ tagName: "div", selector, visibleText: name, hasClickHandler: true });
  targets.remember(SCOPE, reloaded([chip("4-in-1", "#a > div:nth-of-type(1)"), chip("10-in-1", "#a > div:nth-of-type(3)"), chip("7-in-1", "#a > div:nth-of-type(2)")]));
  targets.rememberLook(SCOPE, reloaded([chip("4-in-1", "#fb1 > div:nth-of-type(1)"), chip("7-in-1", "#fb1 > div:nth-of-type(2)")], "reload"));
  assert.deepEqual(targets.resolve(SCOPE, "t3", PAGE, "view_history"), { ok: false, code: "unknown", renumberedByReload: true });

  // Nine more pages let the first go: its handle is stale to the current pages, and the history still has it.
  const other = { projectId: "project.one", flowId: "flow.many" };
  targets.remember(other, sanitizeWebLlmSnapshotWithBindings({ url: "https://shop.example/p0", interactiveElements: [{ tagName: "button", selector: "#first", visibleText: "First" }] }));
  for (let page = 1; page <= 9; page += 1) targets.remember(other, sanitizeWebLlmSnapshotWithBindings({ url: `https://shop.example/p${page}`, interactiveElements: [] }));
  assert.equal(targets.resolve(other, "t1", undefined).ok, false);
  const first = targets.resolve(other, "t1", undefined, "view_history");
  assert.equal(first.ok && first.selector, "#first", JSON.stringify(first));
});
