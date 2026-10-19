// Which differences between the build's control and a row's copy are that
// row's data. The links are a made-up recipe list.

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { el, installStubDocument, stubDocument, type StubElement } from "../../../tests/stub-dom";
import { differsOnlyByRowData } from "../row-data";

const BUILT = { class: "title", id: "title-k3x9", href: "/recipes/view?id=k3x9" };
const ROW = ["Barley broth", "Rui Mota"];

/** Both links on one page, so each answers as a drawn element would. */
function pair(t: TestContext, copy: Record<string, string>, words = "Barley broth"): { built: Element; copy: Element } {
  const built = el("a", BUILT, "Pear galette");
  const other = el("a", copy, words);
  const document = stubDocument();
  document.append(el("html", {}, el("body", {}, built, other)));
  installStubDocument(t, document);
  return { built: built as unknown as Element, copy: other as unknown as Element };
}

const check = (link: { built: Element; copy: Element }): boolean => differsOnlyByRowData(link.built, link.copy, ROW);

test("a copy whose title, id and link are its row's is the same control", (t) => {
  assert.equal(check(pair(t, { class: "title", id: "title-q7m2", href: "/recipes/view?id=q7m2" })), true);
});

test("a name that is not the row's data is another control", (t) => {
  assert.equal(check(pair(t, { class: "title", id: "title-q7m2", href: "/recipes/view?id=q7m2" }, "Print recipe")), false);
});

test("an id of another stem, or none, is another control", (t) => {
  assert.equal(check(pair(t, { class: "title", id: "promo-q7m2", href: "/recipes/view?id=q7m2" })), false);
  assert.equal(check(pair(t, { class: "title", href: "/recipes/view?id=q7m2" })), false);
});

test("a link of another shape is another control", (t) => {
  assert.equal(check(pair(t, { class: "title", id: "title-q7m2", href: "/cooks/q7m2" })), false, "another path");
  assert.equal(check(pair(t, { class: "title", id: "title-q7m2", href: "/recipes/view?cook=q7m2" })), false, "another query key");
});

test("a template signal that differs is another control: the class set, the test id", (t) => {
  assert.equal(check(pair(t, { class: "title promo", id: "title-q7m2", href: "/recipes/view?id=q7m2" })), false);
  assert.equal(check(pair(t, { class: "title", id: "title-q7m2", href: "/recipes/view?id=q7m2", "data-testid": "promo" })), false);
});

test("a tile named by its own counts differs only by row data", (t) => {
  const tile = (slug: string, saves: string): StubElement => el("a", { class: "tile", href: `/r/${slug}/` }, el("img", { alt: slug }), el("span", {}, saves));
  const built = tile("lemon-tart", "1.2K");
  const copy = tile("pea-soup", "880");
  const document = stubDocument();
  document.append(el("div", {}, built, copy));
  installStubDocument(t, document);
  assert.equal(differsOnlyByRowData(built as unknown as Element, copy as unknown as Element, ["pea-soup", "880"]), true);
  assert.equal(differsOnlyByRowData(built as unknown as Element, copy as unknown as Element, ["fig-bread", "2.4K"]), false);
});
