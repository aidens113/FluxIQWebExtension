// Which row of several like it a control sits in, through nested records (F2
// note 2): a card's `article` alone in its `li` is not the repeated row, the
// `li` beside the other `li`s is. The markup is a made-up recipe list.

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { el, installStubDocument, stubDocument, type StubElement } from "../../tests/stub-dom";
import { repeatedRowOf, sitsInRepeatedRow } from "../record";

function install(t: TestContext, ...children: StubElement[]): void {
  const document = stubDocument();
  document.append(el("html", {}, el("body", {}, ...children)));
  installStubDocument(t, document);
}

const asElement = (element: StubElement): Element => element as unknown as Element;

test("a link in an article alone in its list item sits in the list item's row", (t) => {
  const links = ["Pear galette", "Barley broth"].map((dish) => el("a", { href: `/r/${dish.length}` }, dish));
  const items = links.map((link) => el("li", {}, el("article", {}, el("div", {}, el("h2", {}, link)))));
  install(t, el("ol", {}, ...items));
  assert.equal(repeatedRowOf(asElement(links[1] as StubElement)), items[1]);
  assert.equal(sitsInRepeatedRow(asElement(links[0] as StubElement)), true);
});

test("a feed's wrapped articles: the wrapper beside its twins is no record, so the row is the article's own control kind", (t) => {
  // `[role=article]` cards each alone in a plain wrapper `div`, each with a Hide button alike to the others'.
  const hides = [0, 1].map(() => el("button", { class: "hide", "aria-label": "Hide post" }));
  const wrappers = hides.map((hide, index) => el("div", { class: "wrap" }, el("div", { role: "article" }, el("p", {}, `Post ${index}`), hide)));
  install(t, el("div", { role: "feed" }, ...wrappers));
  assert.equal(sitsInRepeatedRow(asElement(hides[0] as StubElement)), true);
});

test("a record with no sibling of its tag anywhere above the control is no row", (t) => {
  const save = el("button", { class: "save" }, "Save");
  install(t, el("main", {}, el("article", {}, el("h1", {}, "Pear galette"), save)), el("ul", {}, el("li", {}, "Home"), el("li", {}, "Saved")));
  assert.equal(repeatedRowOf(asElement(save)), undefined);
  assert.equal(sitsInRepeatedRow(asElement(save)), false);
});
