// The DOM snapshot -> state snapshot projection end to end: the page's own
// values, one value per captured element, the element summary, and the two
// visual frames. Moved here from `recording/tests/web-state.test.ts` when
// `web-state.ts` became this directory, and extended with the summary and the
// repeated-control cases.

import assert from "node:assert/strict";
import test from "node:test";
import { validateStateSnapshot } from "fluxiq/automation-studio";
import { WEB_AUTOMATION_DOMAIN_ID } from "../../../constants";
import { createWebAutomationInitialState } from "../../state";
import { webAutomationActionVisualTargetFromElement } from "../action-target";
import { filterStateElements } from "../element";
import { createWebAutomationStateFromSnapshot } from "../snapshot";
import type { WebAutomationElementStateInput } from "../types";

const page: WebAutomationElementStateInput[] = [
  { tagName: "button", selector: "button.icon" },
  { tagName: "button", selector: "button.save", text: "Save", bounds: { x: 20, y: 30, width: 80, height: 32 } },
  { tagName: "a", selector: "a.home", href: "https://example.test/home", bounds: { x: 120, y: 30, width: 96, height: 24 } },
  { tagName: "input", selector: "input[name=search]", attributes: { name: "search" }, bounds: { x: 20, y: 80, width: 240, height: 36 } }
];
const captured = filterStateElements(page).elements.map((entry) => entry.element);

test("the initial state carries the web namespace the projection writes into", () => {
  assert.equal(createWebAutomationInitialState(1).namespaces.web?.schemaId, WEB_AUTOMATION_DOMAIN_ID);
});

test("a visual target points at the element's state path and layers", () => {
  const target = webAutomationActionVisualTargetFromElement(captured[0]!);
  assert.equal(target?.statePath, "web.elements.button.save");
  assert.equal(target?.documentLayerId, "document.element.button.save");
});

test("a caller holding a selection's key uses it rather than rebuilding one", () => {
  const target = webAutomationActionVisualTargetFromElement(captured[0]!, { stateId: "button.save.2" });
  assert.equal(target?.statePath, "web.elements.button.save.2");
  assert.equal(target?.layerId, "element.button.save.2");
});

test("the projection writes the page's values, the elements, and both frames", () => {
  const state = createWebAutomationStateFromSnapshot({
    url: "https://example.test/search",
    title: "Search",
    viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 25 },
    interactiveElements: captured
  }, {
    timestamp: 20,
    sourceId: "tab:1",
    projectId: "project.test",
    screenContentRef: "automation-object://project/project.test/0000000000000000000000000000000000000000000000000000000000000000"
  });
  const values = state.namespaces.web?.values ?? {};
  assert.equal(values["page.url"]?.value, "https://example.test/search");
  assert.equal(values["scroll.position"]?.type, "point");
  assert.equal(Object.keys(values).some((path) => path.includes("button.icon")), false);
  assert.equal(Object.keys(values).some((path) => path.endsWith(".selector")), false, "an element is one JSON value, not a path per field");
  assert.equal(state.presentation?.defaultFrameId, "screen");
  assert.equal(state.presentation?.visualFrames?.[0]?.rendererId, "web-automation.viewport");
  assert.equal(state.presentation?.visualFrames?.[0]?.layers[0]?.id, "screenshot");
  assert.equal(state.presentation?.visualFrames?.[0]?.layers.some((layer) => layer.kind === "region"), true);
  assert.equal(state.presentation?.visualFrames?.[0]?.metadata?.frameKind, "viewport-screenshot");
  assert.equal(state.presentation?.visualFrames?.[1]?.id, "document");
  assert.equal(state.presentation?.visualFrames?.[1]?.metadata?.frameKind, "document-map");
  assert.equal(values["elements.button.save"]?.type, "json");
  const savePayload = values["elements.button.save"]?.value as { selector?: string; isVisibleOnViewport?: boolean } | undefined;
  assert.equal(savePayload?.selector, "button.save");
  assert.equal(savePayload?.isVisibleOnViewport, true);
  assert.equal(values["elements.button.save"]?.presentation?.anchor?.type, "bounds");
  assert.equal(values["elements.button.save"]?.presentation?.metadata?.boundsKind, "document");
  const saveLayer = state.presentation?.visualFrames?.[0]?.layers.find((layer) => layer.id.includes("button.save"));
  assert.equal(saveLayer !== undefined && "statePath" in saveLayer ? saveLayer.statePath : undefined, "web.elements.button.save");
  assert.equal(saveLayer?.metadata?.boundsKind, "screenshot");
  assert.equal(validateStateSnapshot(state).ok, true);
});

test("the element summary reports the page's total, what was kept, and whether size cut anything", () => {
  const state = createWebAutomationStateFromSnapshot({
    url: "https://example.test/search",
    title: "Search",
    viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 0 },
    interactiveElements: page
  }, { timestamp: 21 });
  const values = state.namespaces.web?.values ?? {};
  assert.equal(values["elements.count"]?.value, 4, "the page offered four elements");
  assert.equal(values["elements.captured"]?.value, 3, "three are in state");
  assert.equal(values["elements.truncated"]?.value, false);
  assert.equal(values["elements.captureTruncated"]?.value, false);
  assert.equal(values["elements.stateTruncated"]?.value, false);
  assert.equal(validateStateSnapshot(state).ok, true);
});

test("a page past the element cap says so", () => {
  const noise = Array.from({ length: 1_600 }, (_, index) => ({
    tagName: "p",
    selector: `p.row-${index}`,
    text: `Row ${index}`,
    bounds: { x: 0, y: index * 20, width: 800, height: 18 }
  }));
  const state = createWebAutomationStateFromSnapshot({
    url: "https://example.test/long-list",
    title: "Long list",
    viewport: { width: 800, height: 600, scrollX: 0, scrollY: 0 },
    interactiveElements: noise
  }, { timestamp: 22 });
  const values = state.namespaces.web?.values ?? {};
  assert.equal(values["elements.count"]?.value, 1_600);
  assert.equal(values["elements.captured"]?.value, 1_500);
  // This projection's cap, and only it: the snapshot carried no evidence, so
  // the browser reported no cap of its own. Naming the limit is the point --
  // raising `MAX_STATE_ELEMENTS` fixes this one and would do nothing for a
  // capture that had already cut.
  assert.equal(values["elements.stateTruncated"]?.value, true);
  assert.equal(values["elements.captureTruncated"]?.value, false);
  assert.equal(values["elements.truncated"]?.value, true);
});

test("radio inputs sharing a name are separate elements", () => {
  const state = createWebAutomationStateFromSnapshot({
    url: "https://example.test/preferences",
    title: "Preferences",
    viewport: { width: 800, height: 600, scrollX: 0, scrollY: 0 },
    interactiveElements: [
      { tagName: "input", selector: "form > label:nth-of-type(1) > input", inputType: "radio", attributes: { name: "plan", type: "radio" }, bounds: { x: 10, y: 10, width: 16, height: 16 } },
      { tagName: "input", selector: "form > label:nth-of-type(2) > input", inputType: "radio", attributes: { name: "plan", type: "radio" }, bounds: { x: 10, y: 40, width: 16, height: 16 } }
    ]
  }, { timestamp: 18 });
  const values = state.namespaces.web?.values ?? {};
  assert.equal(values["elements.count"]?.value, 2);
  assert.equal(values["elements.captured"]?.value, 2);
});

test("rows sharing a data-testid each get a state value and a layer of their own", () => {
  const state = createWebAutomationStateFromSnapshot({
    url: "https://example.test/rows",
    title: "Rows",
    viewport: { width: 800, height: 600, scrollX: 0, scrollY: 0 },
    interactiveElements: [
      { tagName: "button", selector: "tr:nth-child(1) button", text: "Delete", attributes: { "data-testid": "row-action" }, bounds: { x: 10, y: 10, width: 60, height: 24 } },
      { tagName: "button", selector: "tr:nth-child(2) button", text: "Delete", attributes: { "data-testid": "row-action" }, bounds: { x: 10, y: 40, width: 60, height: 24 } }
    ]
  }, { timestamp: 23, screenContentRef: "automation-object://project/project.test/4444444444444444444444444444444444444444444444444444444444444444" });
  const values = state.namespaces.web?.values ?? {};
  assert.equal(values["elements.captured"]?.value, 2);
  assert.equal((values["elements.row.action"]?.value as { selector?: string } | undefined)?.selector, "tr:nth-child(1) button");
  assert.equal((values["elements.row.action.2"]?.value as { selector?: string } | undefined)?.selector, "tr:nth-child(2) button");
  const screenLayers = state.presentation?.visualFrames?.[0]?.layers.filter((layer) => layer.id.startsWith("element.row.action")) ?? [];
  assert.deepEqual(screenLayers.map((layer) => layer.id).sort(), ["element.row.action", "element.row.action.2"]);
  assert.equal(validateStateSnapshot(state).ok, true);
});

test("an element carrying the summary's own name does not overwrite the count", () => {
  const state = createWebAutomationStateFromSnapshot({
    url: "https://example.test/counter",
    title: "Counter",
    viewport: { width: 800, height: 600, scrollX: 0, scrollY: 0 },
    interactiveElements: [
      { tagName: "span", selector: "span.total", text: "12 items", attributes: { "data-testid": "count" }, bounds: { x: 10, y: 10, width: 60, height: 24 } }
    ]
  }, { timestamp: 24 });
  const values = state.namespaces.web?.values ?? {};
  assert.equal(values["elements.count"]?.value, 1, "still the element total, not a JSON blob");
  assert.equal((values["elements.count.2"]?.value as { selector?: string } | undefined)?.selector, "span.total");
});

test("a screenshot captured at a larger scale is mapped into its own pixel space", () => {
  const state = createWebAutomationStateFromSnapshot({
    url: "https://example.test/scaled",
    title: "Scaled",
    viewport: { width: 800, height: 600, scrollX: 0, scrollY: 0, documentWidth: 800, documentHeight: 900 },
    interactiveElements: [
      { tagName: "a", selector: "a.statement", text: "Statement", bounds: { x: 100, y: 50, width: 80, height: 20 }, documentBounds: { x: 100, y: 50, width: 80, height: 20 } }
    ]
  }, {
    timestamp: 25,
    screenContentRef: "automation-object://project/project.test/2222222222222222222222222222222222222222222222222222222222222222",
    screenImageSize: { width: 1600, height: 1200 }
  });
  const screenFrame = state.presentation?.visualFrames?.find((frame) => frame.id === "screen");
  const documentFrame = state.presentation?.visualFrames?.find((frame) => frame.id === "document");
  assert.equal(screenFrame?.coordinateSpace.width, 1600);
  assert.equal(screenFrame?.coordinateSpace.height, 1200);
  assert.equal(screenFrame?.layers.find((layer) => layer.id === "screenshot")?.bounds?.width, 1600);
  assert.equal(screenFrame?.layers.find((layer) => layer.id.includes("a.statement"))?.bounds?.x, 200);
  assert.equal(screenFrame?.layers.find((layer) => layer.id.includes("a.statement"))?.bounds?.width, 160);
  assert.equal(documentFrame?.coordinateSpace.width, 800);
  assert.equal(documentFrame?.layers.find((layer) => layer.id.includes("a.statement"))?.bounds?.x, 100);
  assert.equal(validateStateSnapshot(state).ok, true);
});

test("an element inside a child frame is offset into the top document's viewport", () => {
  const state = createWebAutomationStateFromSnapshot({
    url: "https://widget.example.test",
    title: "Widget",
    viewport: { width: 400, height: 300, scrollX: 0, scrollY: 0, documentWidth: 400, documentHeight: 300 },
    frame: { isTop: false, viewportOffset: { x: 900, y: 120, width: 400, height: 300 } },
    interactiveElements: [
      { tagName: "button", selector: "button.pay", text: "Pay", bounds: { x: 20, y: 30, width: 100, height: 40 }, documentBounds: { x: 20, y: 30, width: 100, height: 40 } }
    ]
  }, {
    timestamp: 26,
    screenContentRef: "automation-object://project/project.test/3333333333333333333333333333333333333333333333333333333333333333",
    screenImageSize: { width: 1534, height: 945 }
  });
  const screenFrame = state.presentation?.visualFrames?.find((frame) => frame.id === "screen");
  const documentFrame = state.presentation?.visualFrames?.find((frame) => frame.id === "document");
  assert.equal(screenFrame?.layers.find((layer) => layer.id.includes("button.pay"))?.bounds?.x, 3528.2);
  assert.equal(screenFrame?.layers.find((layer) => layer.id.includes("button.pay"))?.bounds?.y, 472.5);
  assert.equal(documentFrame?.layers.find((layer) => layer.id.includes("button.pay"))?.bounds?.x, 20);
  assert.equal((screenFrame?.metadata?.frameViewportOffset as { x?: number } | undefined)?.x, 900);
  assert.equal(validateStateSnapshot(state).ok, true);
});

test("content below the fold has a document layer and no screen layer", () => {
  const state = createWebAutomationStateFromSnapshot({
    url: "https://example.test/long",
    title: "Long page",
    viewport: { width: 800, height: 600, scrollX: 0, scrollY: 0, documentWidth: 800, documentHeight: 1400 },
    interactiveElements: [
      { tagName: "p", selector: "p.disclaimer", text: "Disclosures below the fold", documentBounds: { x: 20, y: 1200, width: 260, height: 24 }, isVisibleOnViewport: false }
    ]
  }, {
    timestamp: 30,
    screenContentRef: "automation-object://project/project.test/1111111111111111111111111111111111111111111111111111111111111111"
  });
  const [screenFrame, documentFrame] = state.presentation?.visualFrames ?? [];
  assert.equal(screenFrame?.coordinateSpace.height, 600);
  assert.equal(screenFrame?.layers.some((layer) => layer.id.includes("p.disclaimer")), false);
  assert.equal(documentFrame?.coordinateSpace.width, 800);
  assert.equal(documentFrame?.coordinateSpace.height, 1400);
  assert.equal(documentFrame?.metadata?.screenCoordinateSpace, "document-map");
  assert.equal(documentFrame?.metadata?.documentMapWidth, 800);
  assert.equal(documentFrame?.layers.find((layer) => layer.id.includes("p.disclaimer"))?.bounds?.y, 1200);
  assert.equal(documentFrame?.layers.find((layer) => layer.id.includes("p.disclaimer"))?.metadata?.renderKind, "direct-rendered");
  assert.equal(validateStateSnapshot(state).ok, true);
});
