// A control drawn only as an icon gets a line the model can act on (lane 4,
// `run-mvcwf9u2-28bb44fd`): a pressable result card whose title is a link
// holds, right after its heading, a `<span>` the page styled with a pointer
// of its own and filled with an unlabelled `<svg>`. The capture now reports
// the span's pointer as its own (`apps/extension/src/content/evidence/
// declared-cursor.ts`), and the view prints it as a control that says it is an
// icon, with the class tokens the page gave it -- or with the best words the
// page offers, when it offers any: a name, a tooltip, an `<svg>`'s `<title>`.
//
// The first fragment is shaped like that run's capture, raw as the extension
// sends it, through the sanitizer into the published page.

import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeWebLlmSnapshotWithBindings } from "../../sanitize";
import { webLlmLineFacts } from "../line";
import { publishedWebLlmPage } from "../published-page";
import { bodyLines, type FixtureElement } from "./packet-fixture";

const ORIGIN = "http://127.0.0.1:58800";
type Raw = Record<string, unknown>;

function raw(tagName: string, selector: string, box: [number, number, number, number], fields: Raw = {}, context: Raw = {}): Raw {
  const bounds = { x: box[0], y: box[1], width: box[2], height: box[3] };
  return { tagName, selector, documentBounds: bounds, bounds, isVisibleOnViewport: true, context, ...fields };
}

const item = { landmark: "main", listPosition: { index: 2, total: 7 } };

/** One result card: the card and its title link, the icon-only control after the heading, and the card's words. */
const snapshot = {
  url: `${ORIGIN}/listing?q=pumps`,
  title: "Pumps",
  viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 0, documentWidth: 1280, documentHeight: 1400, devicePixelRatio: 1 },
  interactiveElements: [
    /* 0 */ raw("main", "main", [0, 60, 1280, 1300], {}, { landmark: "main" }),
    /* 1 */ raw("li", "li.r1", [20, 100, 600, 160], { visibleText: "Rotary Pump R2 Brookhaven Supply", ownText: "", parent: 0 }, item),
    /* 2 */ raw("article", "article.r1", [20, 100, 600, 160], { cursor: "pointer", attributes: { class: "k3x card" }, parent: 1 }, item),
    /* 3 */ raw("div", "article.r1 .head", [36, 114, 568, 32], { attributes: { class: "k3x head" }, parent: 2 }, item),
    /* 4 */ raw("h2", "article.r1 h2", [36, 114, 400, 24], { visibleText: "Rotary Pump R2", accessibleName: "Rotary Pump R2", ownText: "", parent: 3 }, item),
    /* 5 */ raw("a", "article.r1 h2 > a", [36, 114, 400, 24], { visibleText: "Rotary Pump R2", accessibleName: "Rotary Pump R2", href: `${ORIGIN}/item?id=r2`, parent: 4 }, item),
    /* 6 */ raw("span", "article.r1 .fav", [572, 114, 32, 32], { cursor: "pointer", attributes: { class: "k3x fav" }, parent: 3 }, item),
    /* 7 */ raw("svg", "article.r1 .fav > svg", [578, 120, 20, 20], { attributes: { viewBox: "0 0 24 24", focusable: "false" }, parent: 6 }, item),
    /* 8 */ raw("path", "article.r1 .fav path", [578, 121, 20, 18], { attributes: { d: "M12 21s-7.5-4.6-9.6-9.2z" }, parent: 7 }, item),
    /* 9 */ raw("div", "article.r1 .company", [36, 150, 300, 20], { visibleText: "Brookhaven Supply", parent: 2 }, item)
  ]
};

function viewBody(page: string): string[] {
  return page.slice(page.indexOf("\n\n") + 2).split("\n");
}

test("an unlabelled pressable span holding an svg, after a card's title link, gets a clickable icon line", () => {
  const evidence = sanitizeWebLlmSnapshotWithBindings(snapshot).evidence;
  const page = publishedWebLlmPage(evidence).page;
  const icon = evidence.elements.find((element) => element.tag === "span")!;
  assert.deepEqual(viewBody(page), [
    "[main]",
    "- 2/7",
    "t6 h2 link \"Rotary Pump R2\" ~/item?id=r2",
    `${icon.target} clickable icon class="k3x fav"`,
    "t10 \"Brookhaven Supply\""
  ]);
  const fact = webLlmLineFacts(evidence).find((line) => line.handle === icon.target);
  assert.deepEqual(fact, { handle: icon.target, kind: "clickable", tokens: ["icon", "class=\"k3x fav\""] });
});

test("without its own cursor the same span has no line, which is what the capture used to send", () => {
  const before = { ...snapshot, interactiveElements: snapshot.interactiveElements.map((element, index) => (index === 6 ? { ...element, cursor: undefined } : element)) };
  const evidence = sanitizeWebLlmSnapshotWithBindings(before).evidence;
  const icon = evidence.elements.find((element) => element.tag === "span")!;
  assert.ok(!viewBody(publishedWebLlmPage(evidence).page).some((line) => line.startsWith(`${icon.target} `)));
});

test("an icon control is described by the best words the page offers before any class", () => {
  const icon = (fields: Partial<FixtureElement>, svg: Partial<FixtureElement> = {}) => bodyLines([
    { tag: "span", cursor: "pointer", attributes: [["class", "ic"]], ...fields },
    { tag: "svg", parent: "t1", ...svg },
    { tag: "path", parent: "t2" }
  ]);
  assert.deepEqual(icon({ name: "Remove item" }), ["t1 clickable \"Remove item\""]);
  assert.deepEqual(icon({ attributes: [["class", "ic"], ["title", "Share"]] }), ["t1 clickable \"Share\""]);
  assert.deepEqual(icon({ attributes: [["class", "ic"], ["data-tooltip", "Add to list"]] }), ["t1 clickable \"Add to list\""]);
  assert.deepEqual(icon({}, { name: "Close panel" }), ["t1 clickable \"Close panel\""]);
  assert.deepEqual(icon({}), ["t1 clickable icon class=\"ic\""]);
});

test("an icon's hints gather the classes and symbols of what it holds, and a button or a link is an icon too", () => {
  assert.deepEqual(bodyLines([
    { tag: "button", attributes: [["class", "btn"]] },
    { tag: "i", parent: "t1", attributes: [["class", "glyph glyph-bin"]] },
    { tag: "a", href: "/basket", attributes: [["class", "nav-icon"]] },
    { tag: "svg", parent: "t3" },
    { tag: "use", parent: "t4", attributes: [["href", "/sprite.svg#bag"]] }
  ] satisfies FixtureElement[]), [
    "t1 button icon class=\"btn glyph glyph-bin\"",
    "t3 link icon class=\"nav-icon\" use=\"#bag\" /basket"
  ]);
});

test("a wordless control with words under it, or a wordless field, gets no hints; one holding no picture is not called an icon", () => {
  assert.deepEqual(bodyLines([
    { tag: "div", cursor: "pointer", ownText: "", text: "Large", attributes: [["class", "chip"]] },
    { tag: "span", parent: "t1", text: "Large" },
    { tag: "input", inputType: "text", attributes: [["class", "box"]] },
    { tag: "a", href: "/item", attributes: [["class", "cover"]] },
    { tag: "div", cursor: "pointer" }
  ] satisfies FixtureElement[]), [
    "t1 clickable",
    "t2 \"Large\"",
    "t3 field",
    "t4 link class=\"cover\" /item",
    "t5 clickable"
  ]);
});

test("a control drawn by a like cursor inside a pressable element leaves that element a control; an unlike cursor still makes it a delegate", () => {
  assert.deepEqual(bodyLines([
    { tag: "div", hasClickHandler: true, cursor: "pointer", ownText: "", text: "× Ask me anything" },
    { tag: "div", parent: "t1", cursor: "pointer", text: "×" },
    { tag: "p", parent: "t1", text: "Ask me anything" },
    { tag: "div", cursor: "pointer", ownText: "", text: "S M" },
    { tag: "span", parent: "t4", cursor: "not-allowed", text: "S" },
    { tag: "span", parent: "t4", text: "M" }
  ] satisfies FixtureElement[]), ["t1 clickable", "t2 clickable \"×\"", "t3 \"Ask me anything\"", "t5 clickable \"S\" disabled", "t6 \"M\""]);
});
