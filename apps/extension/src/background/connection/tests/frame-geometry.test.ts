// T1 coverage of frame-geometry.ts: an iframe's elements placed in the top
// frame's viewport and document coordinates for a merged tab snapshot.

import assert from "node:assert/strict";
import { test } from "node:test";
import { translateFrameElements } from "../frame-geometry";

type Snapshot = Parameters<typeof translateFrameElements>[0];
type FrameElement = Snapshot["interactiveElements"][number];

function snapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    url: "https://example.test/",
    title: "Page",
    viewport: { width: 1_280, height: 800, scrollX: 0, scrollY: 0 },
    interactiveElements: [],
    ...overrides
  };
}

const framePosition = { x: 100, y: 50, width: 400, height: 300 };
const top = snapshot({ viewport: { width: 1_280, height: 800, scrollX: 5, scrollY: 300 } });

test("a frame with no viewport offset is returned as it is", () => {
  const elements: FrameElement[] = [{ tagName: "button", selector: "#pay", bounds: { x: 1, y: 2, width: 3, height: 4 } }];
  const frame = snapshot({ url: "https://pay.example.test/", frame: { isTop: false }, interactiveElements: elements });
  assert.equal(translateFrameElements(frame, top, 3), elements);
});

test("an element's bounds are offset by the frame's place in the top viewport, then by the top frame's scroll", () => {
  const frame = snapshot({
    url: "https://pay.example.test/checkout",
    frame: { isTop: false, viewportOffset: framePosition },
    interactiveElements: [{ tagName: "button", selector: "#pay", attributes: { type: "submit" }, bounds: { x: 10, y: 20, width: 30.333, height: 40 } }]
  });
  assert.deepEqual(translateFrameElements(frame, top, 3), [{
    tagName: "button",
    selector: "frame[3] >> #pay",
    bounds: { x: 110, y: 70, width: 30.33, height: 40 },
    documentBounds: { x: 115, y: 370, width: 30.33, height: 40 },
    isVisibleOnViewport: true,
    attributes: { type: "submit", "data-fluxiq-frame-id": "3", "data-fluxiq-frame-url": "https://pay.example.test/checkout" }
  }]);
});

test("an element known only by its frame-document bounds is placed through the frame's own scroll", () => {
  const frame = snapshot({
    url: "https://pay.example.test/",
    viewport: { width: 400, height: 300, scrollX: 0, scrollY: 200 },
    frame: { isTop: false, viewportOffset: framePosition },
    interactiveElements: [{ tagName: "a", selector: "#terms", documentBounds: { x: 10, y: 260, width: 50, height: 10 } }]
  });
  const [placed] = translateFrameElements(frame, top, 3);
  assert.deepEqual(placed?.bounds, { x: 110, y: 110, width: 50, height: 10 });
  assert.deepEqual(placed?.documentBounds, { x: 115, y: 410, width: 50, height: 10 });
});

test("an element with no geometry gets none and is not on the viewport", () => {
  const frame = snapshot({
    frame: { isTop: false, viewportOffset: framePosition },
    interactiveElements: [{ tagName: "input", selector: "#card" }]
  });
  const [placed] = translateFrameElements(frame, top, 3);
  assert.ok(placed);
  assert.equal(placed.selector, "frame[3] >> #card");
  assert.equal("bounds" in placed, false);
  assert.equal("documentBounds" in placed, false);
  assert.equal(placed.isVisibleOnViewport, false);
});
