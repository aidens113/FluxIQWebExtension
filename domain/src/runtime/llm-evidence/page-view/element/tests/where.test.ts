// Where an element is relative to the screen.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebLlmEvidenceElement } from "../../../elements";
import { webLlmElementWhere } from "../where";

const VIEWPORT = { width: 1280, height: 720, scrollX: 0, scrollY: 1000 };
function at(y: number, height = 20, x = 10, onViewport?: boolean): WebLlmEvidenceElement {
  const element: WebLlmEvidenceElement = { target: "t1", tag: "a", box: { x, y, width: 100, height } };
  if (onViewport !== undefined) element.onViewport = onViewport;
  return element;
}

test("with a viewport: on screen, below, above and off to one side", () => {
  assert.equal(webLlmElementWhere(at(1100), VIEWPORT), "on screen");
  assert.equal(webLlmElementWhere(at(1720), VIEWPORT), "below");
  assert.equal(webLlmElementWhere(at(960, 40), VIEWPORT), "above", "ends at the scroll position");
  assert.equal(webLlmElementWhere(at(1100, 20, 1400), VIEWPORT), "off screen");
  assert.equal(webLlmElementWhere(at(1720, 20, 10, true), VIEWPORT), "on screen", "the capture's own onViewport decides where it said");
  assert.equal(webLlmElementWhere(at(1100, 20, 10, false), VIEWPORT), "off screen", "said not on screen, though inside the window's rows");
});

test("without a viewport, every element the capture said is not on screen reads as below", () => {
  assert.equal(webLlmElementWhere(at(10, 20, 10, false), undefined), "below");
  assert.equal(webLlmElementWhere(at(5000), undefined), "on screen");
});

test("off the page, and not rendered", () => {
  assert.equal(webLlmElementWhere({ target: "t1", tag: "input", box: { x: -9768, y: 10, width: 9, height: 7 } }, VIEWPORT), "off-page");
  assert.equal(webLlmElementWhere({ target: "t1", tag: "input" }, VIEWPORT), "not rendered");
  const hidden = at(1100);
  hidden.hidden = true;
  assert.equal(webLlmElementWhere(hidden, VIEWPORT), "not rendered");
});
