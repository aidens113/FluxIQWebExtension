// A loop pass whose row carries a value read as joined lines, pressing the
// row's own link (job save r1, `run-mvectfld-c2f5d958`, Cause 1).
//
// The list read a card's byline as a `lines` field -- the cook and the town,
// two sibling spans, joined by the domain's line separator -- and the pass row
// carried that joined value. No card draws the separator, so every candidate
// was refused as "in another record" and every pass failed. The card holding
// each part is the pass's row; a card holding only one part is not. Two cards
// share a title here, so only the joined byline tells them apart.
//
// The cards are a made-up recipe list, not any site the Lab drives.

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { WEB_AUTOMATION_EXTRACT_LINE_SEPARATOR } from "@fluxiq-web-extension/domain/client";
import { el, installStubDocument, stubDocument } from "../../tests/stub-dom";
import type { BrowserActionCommand } from "../../types";
import { resolveTarget } from "../resolve-target";

type Card = { dish: string; cook: string; town: string };

const CARDS: readonly Card[] = [
  { dish: "Pear galette", cook: "Ana Reis", town: "Lisbon" },
  { dish: "Barley broth", cook: "Rui Mota", town: "Porto" },
  { dish: "Pear galette", cook: "Ana Reis", town: "Porto" }
];

/** What the list read from a card: its title, and its byline as joined lines. */
const rowOf = (card: Card): { values: string[] } => ({ values: [card.dish, [card.cook, card.town].join(WEB_AUTOMATION_EXTRACT_LINE_SEPARATOR)] });

function installCards(t: TestContext, cards: readonly Card[]): Element[] {
  const document = stubDocument();
  const links: Element[] = [];
  const items = cards.map((card, index) => {
    const link = el("a", { href: `/recipes/${index}`, class: "title" }, card.dish);
    links.push(link as unknown as Element);
    return el("li", {}, el("article", {}, el("h2", {}, link), el("div", { class: "by" }, el("span", {}, card.cook), el("span", {}, card.town))));
  });
  document.append(el("html", {}, el("body", {}, el("main", {}, el("ol", {}, ...items)))));
  installStubDocument(t, document);
  return links;
}

/** The open press as a pass dispatches it: the first card's title link, saved with its position, and the pass's row. */
function openOnRow(card: Card): BrowserActionCommand {
  const selector = "main > ol > li:nth-of-type(1) > article > h2 > a";
  return {
    commandId: "cmd-open",
    actionType: "web.dom.click",
    selector,
    element: {
      tagName: "a", accessibleName: "Pear galette", classNames: ["title"],
      attributes: { href: "/recipes/0" }, selector,
      context: { landmark: "main", listPosition: { index: 1, total: 3 }, record: rowOf(card) }
    }
  } as unknown as BrowserActionCommand;
}

test("a pass opens the title of the card its joined byline names, among cards titled alike", (t) => {
  const links = installCards(t, CARDS);
  assert.equal(resolveTarget(openOnRow(CARDS[0] as Card)).element, links[0], "the card the build looked at");
  assert.equal(resolveTarget(openOnRow(CARDS[2] as Card)).element, links[2], "the same title, another town");
});

test("a card holding only part of the byline is not the pass's row", (t) => {
  // The pass is on a galette by Ana Reis in Faro; the page holds her galettes
  // in Lisbon and Porto, and nothing in Faro, so no card holds both parts.
  installCards(t, CARDS);
  assert.throws(() => resolveTarget(openOnRow({ dish: "Pear galette", cook: "Ana Reis", town: "Faro" })), (error: unknown) => {
    assert.equal((error as { failure?: { code?: string } }).failure?.code, "web.target.not_found");
    return true;
  });
});
