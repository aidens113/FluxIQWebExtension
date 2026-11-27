// A label some items carry in the same words is a mark of its own, never glued
// into another column (t1077, `run-mwyt3s48-b943f344`), and a field's text
// reads its pieces the way the page draws them.
//
// The page here is a news list, not the auction results the defect came from:
// each story's headline is a link holding a heading, and a story still
// developing carries a styled "Breaking" label in its own span before the
// headline, spaced off by its margin. The counter-cases keep what was right
// before: a label only one story carries, a link with words of its own, a
// label whose words vary, a label every story carries, and an amount.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebAutomationExtractField } from "@fluxiq-web-extension/domain/client";
import { readField } from "../field-reader";
import { normalizeExtractField } from "../field-spec";
import { inferFields } from "../infer-fields";
import { fakeShadowDom } from "./fake-shadow-dom";

const dom = fakeShadowDom({ layout: true });

/** The label's own style: a small upper-case kicker spaced off the headline, as a news site draws it. */
const LABEL_STYLE = "margin-right: 6px; font-size: 12px; font-weight: 700; text-transform: uppercase";

const HEADLINES = [
  "Harbour bridge reopens after repairs",
  "City council approves new cycle lanes",
  "Storm warning issued for the coast",
  "Local library extends weekend hours",
  "Rail strike talks resume on Monday",
  "School meals scheme widened",
  "Museum unveils restored mosaic",
  "Market traders protest rent rise"
];

type Story = { headline: string; label?: string; kicker?: string; section?: string };

/** One story card: a link holding a heading, the label (if any) and the headline in sibling spans, then a meta line. */
function story({ headline, label, kicker, section = "News" }: Story, index: number): Element {
  const heading = dom.el("div", { role: "heading" },
    ...(label === undefined ? [] : [dom.el("span", { class: "flag", style: LABEL_STYLE }, label)]),
    ...(kicker === undefined ? [] : [dom.el("span", { class: "kicker", style: LABEL_STYLE }, kicker)]),
    dom.el("span", {}, headline));
  return dom.el("li", { class: "story" },
    dom.el("a", { class: "headline", href: `/story/${index + 1}` }, heading),
    dom.el("div", { class: "meta" }, dom.el("span", { class: "section" }, section), " · ", dom.el("span", { class: "read" }, `${index + 3} min read`)));
}

function run(stories: readonly Story[]): Element[] {
  return stories.map(story);
}

/** Reads a proposed field off an item, as a list read does. */
function read(item: Element, field: { key: string; spec: Exclude<WebAutomationExtractField, string> }): string | null | undefined {
  const reader = normalizeExtractField(field.key, { ...field.spec, required: false });
  return reader === undefined ? undefined : readField(item, field.key, reader);
}

/** The proposed text fields that read exactly `values` off `items`, item for item. */
function holding(fields: ReturnType<typeof inferFields>, items: readonly Element[], values: ReadonlyArray<string | null>): ReturnType<typeof inferFields> {
  return fields.filter((field) => field.spec.kind === "text" && items.every((item, index) => read(item, field) === values[index]));
}

function shown(fields: ReturnType<typeof inferFields>): string {
  return JSON.stringify(fields.map((field) => [field.key, field.spec.kind, field.spec.selector, field.coverage, field.spec.mark]));
}

const BREAKING_AT = new Set([2, 5]);
const BREAKING: Story[] = HEADLINES.map((headline, index) => (BREAKING_AT.has(index) ? { headline, label: "Breaking" } : { headline }));

test("a label two stories carry in the same words is one badge column, and the headline link offers only its URL", () => {
  const items = run(BREAKING);
  const fields = inferFields(items[0]!, items);
  // No column reads the label glued, or spaced, onto a headline.
  for (const field of fields) {
    for (const [index, item] of items.entries()) {
      const value = read(item, field);
      if (typeof value === "string" && value.startsWith("Breaking")) assert.equal(value, "Breaking", `${field.key} on story ${index}: ${value}`);
    }
  }
  // The headline is one column, on every story, labelled by its path.
  const headline = holding(fields, items, HEADLINES);
  assert.equal(headline.length, 1, shown(fields));
  assert.equal(headline[0]!.coverage, 1);
  assert.equal(headline[0]!.spec.mark, undefined);
  // The label is its own partial column, a badge mark, read only where a story carries it.
  const label = holding(fields, items, HEADLINES.map((_, index) => (BREAKING_AT.has(index) ? "Breaking" : null)));
  assert.equal(label.length, 1, shown(fields));
  assert.equal(label[0]!.spec.mark, "badge");
  assert.equal(label[0]!.coverage, 0.25);
  assert.equal(label[0]!.spec.required, false);
  // The label is page structure, never the words (D3).
  assert.doesNotMatch(label[0]!.label, /Breaking/u);
  // The link's words are not a column; its address still is.
  const link = fields.filter((field) => /a\.headline$/u.test(field.spec.selector ?? ""));
  assert.deepEqual(link.map((field) => field.spec.kind), ["link"], shown(fields));
  assert.equal(link[0]!.coverage, 1);
});

test("a label only one story carries is not yet a mark: the link's words stay a column, read with the label spaced off", () => {
  const stories: Story[] = HEADLINES.map((headline, index) => (index === 3 ? { headline, label: "Breaking" } : { headline }));
  const items = run(stories);
  const fields = inferFields(items[0]!, items);
  assert.equal(fields.some((field) => field.spec.mark === "badge"), false, shown(fields));
  const linkWords = fields.find((field) => field.spec.kind === "text" && /a\.headline$/u.test(field.spec.selector ?? ""));
  assert.ok(linkWords, shown(fields));
  assert.equal(read(items[3]!, linkWords), `Breaking ${HEADLINES[3]}`);
  assert.equal(read(items[0]!, linkWords), HEADLINES[0]);
  assert.equal(holding(fields, items, HEADLINES).length, 1, "the headline span stays a column");
});

test("a link with words of its own keeps its words column beside the label's", () => {
  // The headline is the link's own text, with a highlighted word, and no span holds it whole.
  const card = (headline: string, labelled: boolean, index: number) => dom.el("li", { class: "story" },
    dom.el("a", { class: "headline", href: `/story/${index + 1}` },
      ...(labelled ? [dom.el("span", { class: "flag", style: LABEL_STYLE }, "Breaking")] : []),
      `${headline} `, dom.el("mark", {}, "today")),
    dom.el("div", { class: "meta" }, dom.el("span", { class: "section" }, "News")));
  const items = HEADLINES.map((headline, index) => card(headline, BREAKING_AT.has(index), index));
  const fields = inferFields(items[0]!, items);
  const linkWords = fields.find((field) => field.spec.kind === "text" && /a\.headline$/u.test(field.spec.selector ?? ""));
  assert.ok(linkWords, shown(fields));
  assert.equal(read(items[0]!, linkWords), `${HEADLINES[0]} today`);
  assert.equal(read(items[2]!, linkWords), `Breaking ${HEADLINES[2]} today`);
  assert.ok(fields.some((field) => field.spec.mark === "badge" && read(items[2]!, field) === "Breaking"), shown(fields));
});

test("a label whose words vary from story to story is data, and the link's words stay a column", () => {
  const kickers = ["World", "Sport", "Politics"];
  const stories: Story[] = HEADLINES.map((headline, index) => (index < 3 ? { headline, kicker: kickers[index]! } : { headline }));
  const items = run(stories);
  const fields = inferFields(items[0]!, items);
  assert.equal(fields.some((field) => field.spec.mark === "badge"), false, shown(fields));
  const kicker = holding(fields, items, HEADLINES.map((_, index) => kickers[index] ?? null));
  assert.equal(kicker.length, 1, shown(fields));
  const linkWords = fields.find((field) => field.spec.kind === "text" && /a\.headline$/u.test(field.spec.selector ?? ""));
  assert.ok(linkWords, shown(fields));
  assert.equal(read(items[1]!, linkWords), `Sport ${HEADLINES[1]}`);
});

test("a label every story carries, and a constant amount, are columns but not marks", () => {
  const items = run(HEADLINES.map((headline) => ({ headline, section: "Local" })));
  const fields = inferFields(items[0]!, items);
  const section = holding(fields, items, HEADLINES.map(() => "Local"));
  assert.equal(section.length, 1, shown(fields));
  assert.equal(section[0]!.spec.mark, undefined);

  const priced = HEADLINES.map((headline, index) => dom.el("li", { class: "story" },
    dom.el("a", { class: "headline", href: `/story/${index + 1}` }, dom.el("span", {}, headline)),
    ...(index < 3 ? [dom.el("span", { class: "fee" }, "£2")] : [])));
  const pricedFields = inferFields(priced[0]!, priced);
  const fee = holding(pricedFields, priced, HEADLINES.map((_, index) => (index < 3 ? "£2" : null)));
  assert.equal(fee.length, 1, shown(pricedFields));
  assert.equal(fee[0]!.spec.mark, undefined);
});

test("a label drawn one letter per span is no mark letter by letter, while a label in words beside it is", () => {
  // A promoted story spells its tag one letter per span, which no column should read as several marks.
  const spelled = () => dom.el("span", { class: "promo" }, ...[..."Promoted"].map((letter) => dom.el("span", {}, letter)));
  const items = HEADLINES.map((headline, index) => dom.el("li", { class: "story" },
    dom.el("a", { class: "headline", href: `/story/${index + 1}` }, dom.el("span", {}, headline)),
    ...(BREAKING_AT.has(index) ? [spelled(), dom.el("span", { class: "flag" }, "Breaking")] : [])));
  const fields = inferFields(items[0]!, items);
  const marked = fields.filter((field) => field.spec.mark === "badge");
  assert.deepEqual(marked.map((field) => read(items[2]!, field)), ["Breaking"], shown(fields));
});

// The field reader joins a field's pieces the way the page draws them
// (`sensitive-text.ts`, "readable"): a space between pieces the page draws
// apart, nothing between pieces it draws flush, and the value it always had
// where the page already spaced them.

/** Reads `element`'s words as a text field reads them. */
function words(element: Element): string | null | undefined {
  return readField(dom.el("li", {}, element), "words", { kind: "text", selector: ":scope > div", required: false });
}

test("a label spaced off the words beside it by its margin, or a pill by its padding, reads apart from them", () => {
  assert.equal(words(dom.el("div", {}, dom.el("span", { style: LABEL_STYLE }, "Breaking"), dom.el("span", {}, "Harbour bridge reopens"))),
    "Breaking Harbour bridge reopens");
  assert.equal(words(dom.el("div", {}, "Harbour bridge reopens", dom.el("span", { style: "padding-left: 4px; padding-right: 4px; font-size: 11px; border-radius: 8px" }, "Live"))),
    "Harbour bridge reopens Live");
  // In right-to-left text the edge facing the next words is the left one, and the right one faces the words before.
  assert.equal(words(dom.el("div", {}, dom.el("span", { style: "margin-left: 6px; direction: rtl" }, "عاجل"), "عنوان")), "عاجل عنوان");
  assert.equal(words(dom.el("div", {}, dom.el("span", { style: "margin-right: 6px; direction: rtl" }, "عاجل"), "عنوان")), "عاجلعنوان");
  // Stacked blocks read apart, as before.
  assert.equal(words(dom.el("div", {}, dom.el("div", {}, "Pickup today"), dom.el("div", {}, "Delivery tomorrow"))), "Pickup today Delivery tomorrow");
});

test("pieces the page draws flush stay one word, and a hairline gap is not a word break", () => {
  assert.equal(words(dom.el("div", {}, "Ultra", dom.el("b", {}, "Strong"))), "UltraStrong");
  assert.equal(words(dom.el("div", {}, "$10", dom.el("sup", {}, "47"))), "$1047");
  assert.equal(words(dom.el("div", {}, dom.el("span", { style: "margin-right: 2px" }, "$"), dom.el("span", {}, "16"))), "$16");
});

test("where the page already spaced its pieces, a field reads exactly what it read before", () => {
  const spaced = [
    dom.el("div", {}, dom.el("span", { style: LABEL_STYLE }, "Breaking"), " ", dom.el("span", {}, "Harbour bridge reopens")),
    dom.el("div", { class: "meta" }, dom.el("span", {}, "News"), " · ", dom.el("span", {}, "4 min read")),
    dom.el("div", {}, "\n  ", dom.el("div", {}, "Pickup today"), "\n  ", dom.el("div", {}, "Delivery tomorrow"), "\n")
  ];
  for (const element of spaced) assert.equal(words(element), element.textContent!.replace(/\s+/gu, " ").trim());
});
