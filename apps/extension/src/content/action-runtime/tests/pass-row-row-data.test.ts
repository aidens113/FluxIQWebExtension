// A loop pass pressing its own row's copy of a control whose name, id and link
// are that row's data (job save r1 follow-up, F2 note 1).
//
// A list's title links each carry the row's own title as their name, a
// per-row id (`title-<code>`) and a per-row link. The pass row's values gate
// every candidate to the pass's card, but the gated resolution then weighed the
// card's own link against the recorded one: another name, another id still
// carried elsewhere on the page, another link. Nothing distinguishing agreed,
// so every pass but the one on the build's own card failed as not found.
//
// Under a pass row, signals that are row data -- a name that is a row value, an
// id and a link of the same pattern as the recorded ones -- no longer refuse a
// control in the recorded control's slot of the pass's row: the same path from
// the row's root, the same tag, role and classes. A control in another slot, a
// control outside the pass row, and the same control with no pass at all are
// refused as before.
//
// The cards are a made-up recipe list, not any site the Lab drives.

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { el, installStubDocument, stubDocument, type StubElement } from "../../tests/stub-dom";
import type { BrowserActionCommand } from "../../types";
import { resolveTarget } from "../resolve-target";

type Card = { code: string; dish: string; cook: string };

const CARDS: readonly Card[] = [
  { code: "k3x9", dish: "Pear galette", cook: "Ana Reis" },
  { code: "q7m2", dish: "Barley broth", cook: "Rui Mota" },
  { code: "z1p4", dish: "Quince jelly", cook: "Lia Cruz" }
];

/** A card's title link, as the list draws it: the row's title, id and link. */
function titleLink(card: Card): StubElement {
  return el("a", { class: "title", id: `title-${card.code}`, href: `/recipes/view?id=${card.code}` }, card.dish);
}

type Shape = "linked" | "unlinked" | "cook-linked";

/** One card: a head holding the title, a byline, and a Save button. */
function card(item: Card, shape: Shape = "linked"): StubElement {
  const head = shape === "linked"
    ? el("div", { class: "head" }, el("h2", {}, titleLink(item)))
    : el("div", { class: "head" }, el("h2", {}, shape === "cook-linked" ? el("a", { class: "title", href: `/cooks/${item.code}` }, item.cook) : el("span", {}, item.dish)));
  return el("li", {}, el("article", {}, head, el("div", { class: "by" }, el("span", {}, item.cook)), el("button", { class: "save" }, "Save")));
}

function install(t: TestContext, items: StubElement[], aside: StubElement[] = []): void {
  const document = stubDocument();
  document.append(el("html", {}, el("body", {}, el("main", {}, el("ol", { class: "results" }, ...items)), el("aside", {}, ...aside))));
  installStubDocument(t, document);
}

const linkIn = (item: StubElement): Element => item.querySelector("a") as unknown as Element;

/** The open press saved on the first card's title, as a pass dispatches it, with or without a pass row. */
function openTitle(row: Card | undefined, context: Record<string, unknown> = { listPosition: { index: 1, total: 3 } }): BrowserActionCommand {
  const first = CARDS[0] as Card;
  const selector = "main > ol > li:nth-of-type(1) > article > div > h2 > a";
  return {
    commandId: "cmd-open",
    actionType: "web.dom.click",
    selector,
    element: {
      tagName: "a", accessibleName: first.dish, visibleText: first.dish, id: `title-${first.code}`, classNames: ["title"],
      attributes: { href: `/recipes/view?id=${first.code}`, id: `title-${first.code}` }, selector,
      context: { landmark: "main", ...context, ...(row ? { record: { values: [row.dish, row.cook] } } : {}) }
    }
  } as unknown as BrowserActionCommand;
}

const code = (error: unknown): string | undefined => (error as { failure?: { code?: string } }).failure?.code;

test("each pass opens its own card's title, though its name, id and link are its row's", (t) => {
  const items = CARDS.map((item) => card(item));
  install(t, items);
  for (const [index, item] of CARDS.entries()) {
    assert.equal(resolveTarget(openTitle(item)).element, linkIn(items[index] as StubElement), `pass for ${item.dish}`);
  }
});

test("a row the build saw with no list position is placed the same way, through its nested records", (t) => {
  const items = CARDS.map((item) => card(item));
  install(t, items);
  assert.equal(resolveTarget(openTitle(CARDS[2], { })).element, linkIn(items[2] as StubElement));
});

test("a pass row whose card draws another control in that slot is refused, not opened there", (t) => {
  const items = [card(CARDS[0] as Card), card(CARDS[1] as Card, "cook-linked"), card(CARDS[2] as Card, "unlinked")];
  install(t, items);
  for (const index of [1, 2]) {
    assert.throws(() => resolveTarget(openTitle(CARDS[index])), (error: unknown) => code(error) === "web.target.not_found", `pass for ${CARDS[index]?.dish}`);
  }
});

test("a title outside the pass row is never opened for it", (t) => {
  // The pass's card draws no title link; a side list links the same dish.
  const aside = el("div", {}, el("h2", {}, titleLink(CARDS[1] as Card)));
  install(t, [card(CARDS[0] as Card), card(CARDS[1] as Card, "unlinked")], [aside]);
  assert.throws(() => resolveTarget(openTitle(CARDS[1])), (error: unknown) => code(error) === "web.target.not_found");
});

test("with no pass row, another card's title is never taken for the recorded one", (t) => {
  // The recorded card has left the list; nothing says which row is meant.
  install(t, [card(CARDS[1] as Card), card(CARDS[2] as Card)]);
  assert.throws(() => resolveTarget(openTitle(undefined)), (error: unknown) => code(error) === "web.target.not_found" || code(error) === "web.target.ambiguous");
});

test("a pass on a row that has left the page is not found, and opens no other card", (t) => {
  install(t, [card(CARDS[0] as Card), card(CARDS[1] as Card)]);
  assert.throws(() => resolveTarget(openTitle(CARDS[2])), (error: unknown) => code(error) === "web.target.not_found");
});
