// A loop over a list whose per-row control is the row's whole link, in a plain box of
// its own (t869, `run-mw2txff1-2546a76f`, `run-mw2udxzh-d8d29f9e`).
//
// The saved click carries a positional selector and `{ landmark }`, nothing of rows.
// The link sits in a `<div>` (no record), each link is named by its row (no twin) and
// it is its box's only child (no run), so the rows-aside answer, the first row's link,
// read as page-level: every pass opened the first row and pressed its Save again.
//
// All three roads that repeat reach the page through this one resolver with this one
// wire form: a forward run and a build's test (`domain/.../node-run/replay.ts`), a saved
// Flow's For Each and a part's (`domain/src/output-nodes/native-runtime.ts`), each
// through `webAutomationScopedToRow`.
//
// The list is a made-up recipe site, not any site the Lab drives.

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { el, installStubDocument, stubDocument, type StubElement } from "../../../tests/stub-dom";
import type { BrowserActionCommand } from "../../../types";
import { resolveTarget, TargetResolutionError } from "../../resolve-target";

type Dish = { id: string; title: string; price: string };

const DISHES: readonly Dish[] = [
  { id: "1003", title: "Pear galette", price: "£4" },
  { id: "1054", title: "Barley broth", price: "£6" },
  { id: "1077", title: "Quince jelly", price: "£9" }
];
const ORIGIN = "https://recipes.test";
const addressOf = (dish: Dish): string => `${ORIGIN}/shop/dish/${dish.id}/`;

const dish = (index: number): Dish => DISHES[index] as Dish;

/** The whole card is the link, alone in its box, as the Flow's first row recorded it. */
function wholeCard(item: Dish): StubElement {
  return el("div", { class: "wrap" }, el("a", { class: "card", href: addressOf(item) }, el("img", { class: "pic", alt: item.title, src: "/p.jpg" }), el("div", {}, el("span", {}, item.price)), el("div", {}, el("span", {}, item.title))));
}

/** A card holding a title link beside other things, none of it a record. */
function titledCard(item: Dish): StubElement {
  return el("div", { class: "card" }, el("img", { class: "pic", alt: item.title, src: "/p.jpg" }), el("a", { class: "name", href: addressOf(item) }, item.title), el("span", {}, item.price));
}

function atAddress(t: TestContext, address: string): void {
  const globals = globalThis as unknown as Record<string, unknown>;
  const before = globals.location;
  Object.defineProperty(globals, "location", { value: { href: address }, configurable: true, writable: true });
  t.after(() => Object.defineProperty(globals, "location", { value: before, configurable: true, writable: true }));
}

function install(t: TestContext, cards: StubElement[], aside: StubElement[] = [], address = `${ORIGIN}/shop/search/?q=dish`): void {
  const document = stubDocument();
  document.append(el("html", {}, el("body", {}, el("main", {}, el("section", { "aria-label": "Items" }, el("div", { class: "grid" }, ...cards))), el("aside", {}, ...aside))));
  installStubDocument(t, document);
  atAddress(t, address);
}

const linkIn = (card: StubElement): Element => card.querySelector("a") as unknown as Element;

/** The row as a pass carries it: what the list's read read, and what it leaves out when it read no link. */
const rowOf = (item: Dish, withLink = true): string[] => [item.title, item.price, ...(withLink ? [addressOf(item)] : [])];

/** The first row's saved click, as a pass dispatches it. */
function clickOn(selector: string, identity: Record<string, unknown>, values: string[] | undefined): BrowserActionCommand {
  return {
    commandId: "c", actionType: "web.dom.click", selector,
    element: { selector, ...identity, context: { ...(values ? { record: { values } } : {}) } }
  } as unknown as BrowserActionCommand;
}

const CARD_SELECTOR = "main > section > div > div:nth-of-type(1) > a";
const cardClick = (values: string[] | undefined) => clickOn(CARD_SELECTOR, { tagName: "a", implicitRole: "link", accessibleName: `${dish(0).price}${dish(0).title}`, classNames: ["card"] }, values);

for (const withLink of [true, false]) {
  test(`each pass presses its own row's whole-card link, ${withLink ? "by the row's link" : "by the row's words, a read that kept no link"}`, (t) => {
    const cards = DISHES.map(wholeCard);
    install(t, cards);
    for (const index of [0, 1, 2]) {
      assert.equal(resolveTarget(cardClick(rowOf(dish(index), withLink))).element, linkIn(cards[index] as StubElement), `pass for ${dish(index).title}`);
    }
  });
}

test("the row's link finds its card wherever the list moved it", (t) => {
  const cards = [dish(2), dish(0), dish(1)].map(wholeCard);
  install(t, cards);
  assert.equal(resolveTarget(cardClick(rowOf(dish(1)))).element, linkIn(cards[2] as StubElement));
});

test("a row not drawn presses nothing, and says the match was another row's: never the first card", (t) => {
  install(t, [wholeCard(dish(0)), wholeCard(dish(2))]);
  for (const withLink of [true, false]) {
    assert.throws(() => resolveTarget(cardClick(rowOf(dish(1), withLink))), (error: unknown) => {
      assert.ok(error instanceof TargetResolutionError);
      assert.equal(error.resolution.refusedBecause, "other-record");
      return true;
    }, `a read ${withLink ? "with" : "without"} a link`);
  }
});

test("with no pass, the saved click resolves as it always did", (t) => {
  const cards = DISHES.map(wholeCard);
  install(t, cards);
  assert.equal(resolveTarget(cardClick(undefined)).element, linkIn(cards[0] as StubElement));
});

test("a title link beside other things in a plain card is re-aimed the same way", (t) => {
  const cards = DISHES.map(titledCard);
  install(t, cards);
  const selector = "main > section > div > div:nth-of-type(1) > a";
  const click = (values: string[]) => clickOn(selector, { tagName: "a", implicitRole: "link", accessibleName: dish(0).title, classNames: ["name"] }, values);
  for (const withLink of [true, false]) {
    for (const index of [0, 1, 2]) {
      assert.equal(resolveTarget(click(rowOf(dish(index), withLink))).element, linkIn(cards[index] as StubElement), `pass for ${dish(index).title}, link ${withLink}`);
    }
  }
});

test("a title link with a read that kept no link and its row not drawn goes as page-level, and says the row is left behind; the row placed says its own", (t) => {
  const cards = [titledCard(dish(0)), titledCard(dish(2))];
  install(t, cards);
  const selector = "main > section > div > div:nth-of-type(1) > a";
  const click = (values: string[]) => clickOn(selector, { tagName: "a", implicitRole: "link", accessibleName: dish(0).title, classNames: ["name"] }, values);
  const missing = resolveTarget(click(rowOf(dish(1), false)));
  assert.equal(missing.element, linkIn(cards[0] as StubElement));
  assert.equal(missing.resolution.passRow, "page-level-link");
  assert.equal(resolveTarget(click(rowOf(dish(2), false))).resolution.passRow, "own");
  assert.equal(resolveTarget(click(rowOf(dish(0), false))).resolution.passRow, "own");
});

test("a plain navigation link in a pass may go, and says the row is left behind; a button that stays on the page says nothing", (t) => {
  const home = el("a", { class: "nav", href: "/shop/" }, "Home");
  const close = el("button", { class: "shut" }, "Close");
  install(t, DISHES.map(wholeCard), [home, close]);
  const nav = resolveTarget(clickOn("aside > a", { tagName: "a", implicitRole: "link", accessibleName: "Home", classNames: ["nav"] }, rowOf(dish(1))));
  assert.equal(nav.element, home as unknown as Element);
  assert.equal(nav.resolution.passRow, "page-level-link");
  const button = resolveTarget(clickOn("aside > button", { tagName: "button", implicitRole: "button", accessibleName: "Close", classNames: ["shut"] }, rowOf(dish(1))));
  assert.equal(button.element, close as unknown as Element);
  assert.equal(button.resolution.passRow, undefined);
});

test("a row's own link, or its copy, says its own", (t) => {
  const cards = DISHES.map(wholeCard);
  install(t, cards);
  assert.equal(resolveTarget(cardClick(rowOf(dish(0)))).resolution.passRow, "own");
  assert.equal(resolveTarget(cardClick(rowOf(dish(1)))).resolution.passRow, "own");
  assert.equal(resolveTarget(cardClick(rowOf(dish(1), false))).resolution.passRow, "own");
});

test("a toolbar in boxes of one shape stays page-level: no part of it holds a row's values, and its button is no card", (t) => {
  const tool = (label: string, count: string): StubElement => el("div", { class: "tool" }, el("button", { class: "act" }, label), el("span", {}, count));
  const keep = tool("Keep", "3");
  install(t, DISHES.map(wholeCard), [el("div", { class: "bar" }, keep, tool("Share", "1"), tool("Report", "0"))]);
  const selector = "aside > div > div:nth-of-type(1) > button";
  const press = clickOn(selector, { tagName: "button", implicitRole: "button", accessibleName: "Keep", classNames: ["act"] }, rowOf(dish(1)));
  assert.equal(resolveTarget(press).element, keep.querySelector("button") as unknown as Element);
});

test("a column of plain links stays page-level", (t) => {
  const link = (words: string, href: string): StubElement => el("a", { class: "foot", href }, words);
  const jobs = link("Jobs", "/jobs");
  const column = (...links: StubElement[]): StubElement => el("div", { class: "col" }, el("h4", {}, "More"), ...links);
  install(t, DISHES.map(wholeCard), [column(jobs, link("Team", "/team")), column(link("Help", "/help"), link("Terms", "/terms"))]);
  const press = clickOn("aside > div:nth-of-type(1) > a:nth-of-type(1)", { tagName: "a", implicitRole: "link", accessibleName: "Jobs", classNames: ["foot"] }, rowOf(dish(1)));
  assert.equal(resolveTarget(press).element, jobs as unknown as Element);
});

const saveClick = (values: string[]) => clickOn('[data-testid="save"]', { tagName: "div", role: "button", accessibleName: "Save", testId: "save", attributes: { "data-testid": "save" } }, values);

function installItemPage(t: TestContext, shown: Dish, address = addressOf(shown)): Element {
  const save = el("div", { role: "button", "data-testid": "save" }, "Save");
  const document = stubDocument();
  document.append(el("html", {}, el("body", {}, el("aside", {}, el("h1", {}, "Marketplace")), el("main", {}, el("h1", {}, shown.title), save))));
  installStubDocument(t, document);
  atAddress(t, address);
  return save as unknown as Element;
}

test("on its own row's page a pass's Save is pressed", (t) => {
  const save = installItemPage(t, dish(1));
  assert.equal(resolveTarget(saveClick(rowOf(dish(1)))).element, save);
});

test("on another row's page a pass's Save is refused, saying it is another row's: the second wall", (t) => {
  installItemPage(t, dish(0));
  assert.throws(() => resolveTarget(saveClick(rowOf(dish(1)))), (error: unknown) => {
    assert.ok(error instanceof TargetResolutionError);
    assert.equal(error.resolution.refusedBecause, "other-record");
    return true;
  });
});

test("the row's page at a fuller address is still the row's, by its address or by what it is called", (t) => {
  const fuller = installItemPage(t, dish(1), `${ORIGIN}/shop/dish/1054-barley-broth/`);
  assert.equal(resolveTarget(saveClick(rowOf(dish(1)))).element, fuller);
  const moved = installItemPage(t, dish(1), `${ORIGIN}/shop/dish/99/`);
  assert.equal(resolveTarget(saveClick(rowOf(dish(1)))).element, moved);
});

test("the wall reads no page that is not of the row's link's shape: the list, the saved items, a page of a row with no link", (t) => {
  const save = installItemPage(t, dish(0), `${ORIGIN}/shop/saved/`);
  assert.equal(resolveTarget(saveClick(rowOf(dish(1)))).element, save);
  const noLink = installItemPage(t, dish(0));
  assert.equal(resolveTarget(saveClick(rowOf(dish(1), false))).element, noLink);
});
