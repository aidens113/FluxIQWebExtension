// A pass row's value read as whole lines, joined, which the page never draws
// as one string (job save r1, `run-mvectfld-c2f5d958`, Cause 1).
//
// A list extraction's `lines` field reads a container's child lines and joins
// them with the domain's line separator: a card drawing
// `<span>Ana</span><span>Lisbon</span>` gives "Ana · Lisbon". The pass row
// carries that value, and the row gate looked for it whole, so no card ever
// held it and every pass of every trial refused the right control as "in
// another record". A joined value is held when each of its parts is in the one
// record; a part missing, or the parts spread over two records, still refuses.
//
// The cards here are a made-up recipe list, not any site the Lab drives.

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { WEB_AUTOMATION_EXTRACT_LINE_SEPARATOR } from "@fluxiq-web-extension/domain/client";
import { el, installStubDocument, stubDocument } from "../../tests/stub-dom";
import { agreesWithRecordedRecord } from "../record";

type Card = { dish: string; cook: string; town: string };

const CARDS: readonly Card[] = [
  { dish: "Pear galette", cook: "Ana Reis", town: "Lisbon" },
  { dish: "Pear galette", cook: "Ana Reis", town: "Porto" },
  { dish: "Barley broth", cook: "Rui Mota", town: "Lisbon" }
];

const joined = (...parts: string[]): string => parts.join(WEB_AUTOMATION_EXTRACT_LINE_SEPARATOR);

/** One `li` card per entry, its cook and town as sibling spans, and an Open link: the links in order. */
function installCards(t: TestContext, cards: readonly Card[] = CARDS): Element[] {
  const document = stubDocument();
  const links: Element[] = [];
  const items = cards.map((card, index) => {
    const link = el("a", { href: `/recipes/${index}`, class: "open" }, "Open");
    links.push(link as unknown as Element);
    return el("li", { class: "card" }, el("h3", {}, card.dish), el("div", { class: "by" }, el("span", {}, card.cook), el("span", {}, card.town)), link);
  });
  document.append(el("html", {}, el("body", {}, el("ul", { class: "cards" }, ...items))));
  installStubDocument(t, document);
  return links;
}

const linkAt = (links: Element[], index: number): Element => links[index] as Element;

test("a joined value is held by the card that draws each of its parts", (t) => {
  const links = installCards(t);
  const row = { values: [CARDS[0]?.dish ?? "", joined("Ana Reis", "Lisbon")] };
  assert.equal(agreesWithRecordedRecord(row, linkAt(links, 0)), true);
});

test("a neighbour holding one part but not the other is refused, though it shares the title", (t) => {
  const links = installCards(t);
  const row = { values: [CARDS[0]?.dish ?? "", joined("Ana Reis", "Lisbon")] };
  assert.equal(agreesWithRecordedRecord(row, linkAt(links, 1)), false, "same cook, another town");
  assert.equal(agreesWithRecordedRecord(row, linkAt(links, 2)), false, "same town, another cook and dish");
});

test("parts found only in two different cards are held by neither", (t) => {
  // Ana Reis is on the Porto card, Lisbon on the broth card: no one record holds both.
  const links = installCards(t, [CARDS[1] as Card, CARDS[2] as Card]);
  const row = { values: [joined("Ana Reis", "Lisbon")] };
  assert.equal(agreesWithRecordedRecord(row, linkAt(links, 0)), false);
  assert.equal(agreesWithRecordedRecord(row, linkAt(links, 1)), false);
});

test("a part the card does not draw at all refuses, as any missing value does", (t) => {
  const links = installCards(t);
  assert.equal(agreesWithRecordedRecord({ values: [joined("Ana Reis", "Lisbon", "Vegan")] }, linkAt(links, 0)), false);
});

test("a value whose separator the page does draw is still found whole", (t) => {
  const document = stubDocument();
  const link = el("a", { href: "/recipes/9", class: "open" }, "Open");
  const other = el("a", { href: "/recipes/8", class: "open" }, "Open");
  const drawn = joined("Spring", "Summer");
  document.append(el("ul", {}, el("li", {}, el("p", {}, drawn), link), el("li", {}, el("p", {}, "Winter"), other)));
  installStubDocument(t, document);
  assert.equal(agreesWithRecordedRecord({ values: [drawn] }, link as unknown as Element), true);
  assert.equal(agreesWithRecordedRecord({ values: [drawn] }, other as unknown as Element), false);
});
