// A state snapshot's summary carries the page's option groups and its result
// count as data beside the view (t655), so Core can say what a narrowing step
// chose and left out without reading a line of the view. A library catalogue.

import assert from "node:assert/strict";
import test from "node:test";
import type { OutputDispatchResult } from "fluxiq";
import type { JsonObject } from "fluxiq/core";
import { webAutomationOutputNodeId } from "../../output-nodes";
import { createWebAutomationHostRuntime, type WebAutomationHostRuntimeGateway } from "../host-runtime";

const CLICK_NODE_ID = webAutomationOutputNodeId("web.dom.click");

function raw(tagName: string, selector: string, row: number, fields: JsonObject = {}, context: JsonObject = {}): JsonObject {
  const bounds = { x: 20, y: 100 + row * 24, width: 220, height: 20 };
  return { tagName, selector, documentBounds: bounds, bounds, isVisibleOnViewport: true, context, ...fields };
}

function snapshot(elements: JsonObject[]): JsonObject {
  return {
    url: "https://library.test/search?q=river",
    title: "Catalogue search",
    viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 0, documentWidth: 1280, documentHeight: 720, devicePixelRatio: 1 },
    interactiveElements: elements
  };
}

function seam(page: JsonObject): WebAutomationHostRuntimeGateway {
  return {
    dispatch: async (request) => ({ outputId: request.outputId, ok: true, status: "succeeded", payload: { status: "succeeded", result: { snapshot: page } } }) as OutputDispatchResult<JsonObject>
  };
}

const format = { landmark: "complementary", fieldsetLegend: "Format" };
const LIBRARY: JsonObject[] = [
  /* 0 */ raw("fieldset", "#format", 0, {}, { landmark: "complementary" }),
  /* 1 */ raw("legend", "#format > legend", 0, { accessibleName: "Format", visibleText: "Format", parent: 0 }, format),
  /* 2 */ raw("input", "#hardcover", 1, { inputType: "checkbox", accessibleName: "Hardcover (40)", checked: true, parent: 0 }, format),
  /* 3 */ raw("input", "#paperback", 2, { inputType: "checkbox", accessibleName: "Paperback (12)", checked: false, parent: 0 }, format),
  /* 4 */ raw("p", "#count", 3, { accessibleName: "40 results", visibleText: "40 results" }, { landmark: "main" })
];

test("a snapshot's summary carries each option group and the page's result count beside the view", async () => {
  const ref = await createWebAutomationHostRuntime(seam(snapshot(LIBRARY))).captureStateSnapshot!({ node: { id: "node.1", definitionId: CLICK_NODE_ID, parameterValues: {} }, attemptId: "a.1", inputs: {}, point: "after_action" });
  assert.deepEqual(ref.summary?.groups, [{ name: "Format", options: [{ words: "Hardcover", count: 40, chosen: true }, { words: "Paperback", count: 12, chosen: false }] }]);
  assert.equal(ref.summary?.resultCount, 40);
  assert.equal(typeof ref.summary?.page, "string");
});

test("a page that shows no group and states no count adds neither key", async () => {
  const plain = [raw("a", "#home", 0, { accessibleName: "Home", visibleText: "Home", href: "https://library.test/" }, { landmark: "main" })];
  const ref = await createWebAutomationHostRuntime(seam(snapshot(plain))).captureStateSnapshot!({ node: { id: "node.1", definitionId: CLICK_NODE_ID, parameterValues: {} }, attemptId: "a.1", inputs: {}, point: "after_action" });
  assert.equal(Object.hasOwn(ref.summary ?? {}, "groups"), false);
  assert.equal(Object.hasOwn(ref.summary ?? {}, "resultCount"), false);
});
