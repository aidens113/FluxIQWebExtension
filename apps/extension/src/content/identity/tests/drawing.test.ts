// What a wordless control draws, as one digest (lane 4, `run-mvcwqwec-0aa4f98b`).
//
// The rows hold the three properties the save-time floor and the page's
// finder rely on: two copies of one icon give one digest, two different icons
// give two, and a state that only repaints an icon -- a class, a fill, a style
// -- keeps its digest. And the two refusals: an element with words, or with
// nothing pictorial in it, has no drawing at all.

import assert from "node:assert/strict";
import test from "node:test";
import { el, installStubDocument, stubDocument, type StubElement } from "../../tests/stub-dom";
import { elementDrawing } from "../drawing";

const HEART = "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z";
const SHARE = "M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z";

/** A wordless pressable span holding an svg with one path, as the job board draws its row icons. */
function icon(d: string, spanAttributes: Record<string, string> = {}, pathAttributes: Record<string, string> = {}): StubElement {
  return el("span", { class: "q8f2", style: "cursor:pointer", ...spanAttributes },
    el("svg", { viewBox: "0 0 24 24", focusable: "false" }, el("path", { d, ...pathAttributes })));
}

function drawingOf(element: StubElement): string | undefined {
  return elementDrawing(element as unknown as Element);
}

test("two copies of one icon draw the same, and two different icons do not", (t) => {
  installStubDocument(t, stubDocument());
  const first = drawingOf(icon(HEART));
  assert.match(first ?? "", /^d1\.[0-9a-z]+$/u);
  assert.equal(drawingOf(icon(HEART)), first);
  assert.notEqual(drawingOf(icon(SHARE)), first);
  // The same shape in another frame of reference is another picture.
  assert.notEqual(drawingOf(el("span", {}, el("svg", { viewBox: "0 0 48 48" }, el("path", { d: HEART })))), first);
});

test("a state that only repaints the icon -- its class, fill, stroke or style -- keeps its drawing", (t) => {
  installStubDocument(t, stubDocument());
  const unfilled = drawingOf(icon(HEART, {}, { fill: "none", stroke: "currentColor" }));
  const filled = drawingOf(icon(HEART, { class: "q8f2 is-on", style: "cursor:pointer;color:#d00" }, { fill: "#d00", class: "on" }));
  assert.notEqual(unfilled, undefined);
  assert.equal(filled, unfilled);
});

test("one shape written two ways is one drawing: separators and number spelling do not count", (t) => {
  installStubDocument(t, stubDocument());
  const tidy = drawingOf(el("span", {}, el("svg", { viewBox: "0 0 24 24" }, el("path", { d: "M12 2 L22 12.50 Z" }), el("circle", { cx: "12", cy: "12", r: "3.0" }))));
  const loose = drawingOf(el("span", {}, el("svg", { viewBox: "0,0,24,24" }, el("path", { d: "M12,2L22,12.5Z" }), el("circle", { cx: "12", cy: "12.0", r: "3" }))));
  assert.equal(loose, tidy);
});

test("a symbol it uses and an image it shows are its drawing, without a query or fragment a cache adds", (t) => {
  installStubDocument(t, stubDocument());
  const used = drawingOf(el("button", {}, el("svg", {}, el("use", { href: "#icon-bookmark" }))));
  assert.notEqual(used, undefined);
  assert.equal(drawingOf(el("button", { class: "active" }, el("svg", {}, el("use", { href: "#icon-bookmark" })))), used);
  assert.notEqual(drawingOf(el("button", {}, el("svg", {}, el("use", { href: "#icon-share" })))), used);

  const image = drawingOf(el("a", {}, el("img", { src: "https://cdn1.example.test/icons/star.svg?v=12#x", alt: "" })));
  assert.equal(drawingOf(el("a", {}, el("img", { src: "https://cdn2.example.test/icons/star.svg?v=13", alt: "" }))), image);
  assert.notEqual(drawingOf(el("a", {}, el("img", { src: "https://cdn1.example.test/icons/moon.svg" }))), image);
});

test("an element with words, or with nothing pictorial in it, has no drawing", (t) => {
  installStubDocument(t, stubDocument());
  assert.equal(drawingOf(el("button", {}, el("svg", { viewBox: "0 0 24 24" }, el("path", { d: HEART })), "Save")), undefined);
  assert.equal(drawingOf(el("span", { class: "q8f2" })), undefined);
  assert.equal(drawingOf(el("div", {}, el("span", {}), " ")), undefined);
  // An svg's own title names it to a reader; it is not visible text, and the shapes are still its drawing.
  assert.equal(drawingOf(el("span", {}, el("svg", { viewBox: "0 0 24 24" }, el("title", {}, "Save"), el("path", { d: HEART })))), drawingOf(icon(HEART)));
});

test("a region of many pictures is not one control's drawing", (t) => {
  installStubDocument(t, stubDocument());
  const gallery = el("div", {}, ...Array.from({ length: 80 }, (_, index) => el("img", { src: `/photos/${index}.jpg` })));
  assert.equal(drawingOf(gallery), undefined);
});
