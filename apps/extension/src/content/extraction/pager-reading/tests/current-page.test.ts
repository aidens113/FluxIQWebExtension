// Coverage of the one rule for a pager's current page (`../current-page.ts`)
// as its three readers apply it: `readPager` from beside a Next,
// `currentPageNumber` and `followingPageControl` from a numbered way's own
// controls. Each pager here is read by all three, so they cannot disagree.

import assert from "node:assert/strict";
import test from "node:test";
import { currentPageNumber, followingPageControl, readPager } from "..";
import { FakeElement } from "../../tests/store-pager";

const ORIGIN = "http://shop.test";

type Drawn = { text: string; tag?: string; attributes?: Record<string, string> };

/** A pager of `numbers` and a script Next, standing as the document at `address` while `body` runs. */
function onPager<T>(address: string, numbers: readonly Drawn[], body: (next: HTMLElement, controls: Element[]) => T): T {
  const globals = globalThis as Record<string, unknown>;
  const saved = { document: globals.document, element: globals.HTMLElement };
  const controls = numbers.map(({ text, tag, attributes }) => new FakeElement(tag ?? "a", attributes ?? { href: `/find?page=${text}` }, text));
  const next = new FakeElement("div", { class: "pg" }, "Next ›");
  new FakeElement("div", {}, "", [...controls, next]);
  globals.HTMLElement = FakeElement;
  globals.document = { URL: `${ORIGIN}${address}` };
  try {
    return body(next as unknown as HTMLElement, controls as unknown as Element[]);
  } finally {
    globals.document = saved.document;
    globals.HTMLElement = saved.element;
  }
}

const linked = (page: number, className: string): Drawn => ({ text: String(page), attributes: { class: className, href: `/find?page=${page}` } });

/** What all three readers say of a pager: the current page and the number of the control after it. */
function readings(next: HTMLElement, controls: Element[]): { pager: number | undefined; following: string | undefined; number: number | undefined; numbered: string | undefined } {
  return {
    pager: readPager(next)?.current,
    following: readPager(next)?.following?.textContent ?? undefined,
    number: currentPageNumber(controls),
    numbered: followingPageControl(controls, 99)?.textContent ?? undefined
  };
}

test("aria-current decides first, as before, even where a number is styled apart", () => {
  const numbers = [linked(1, "pg"), { text: "2", tag: "span", attributes: { "aria-current": "page" } }, linked(3, "pg pg-hot"), linked(4, "pg"), linked(5, "pg")];
  onPager("/find?page=4", numbers, (next, controls) => {
    assert.deepEqual(readings(next, controls), { pager: 2, following: "3", number: 2, numbered: "3" });
  });
});

test("a numbered link to the page already showing is current where nothing is marked", () => {
  onPager("/find?page=2", [linked(1, "pg"), linked(2, "pg"), linked(3, "pg")], (next, controls) => {
    assert.deepEqual(readings(next, controls), { pager: 2, following: "3", number: 2, numbered: "3" });
  });
});

test("the one number that is not a control is current, read by all three alike", () => {
  const numbers = [linked(1, "pg"), { text: "2", tag: "b", attributes: {} }, linked(3, "pg")];
  onPager("/elsewhere", numbers, (next, controls) => {
    assert.deepEqual(readings(next, controls), { pager: 2, following: "3", number: 2, numbered: "3" });
  });
});

test("the one numbered link styled apart from the others' shared class list is current", () => {
  onPager("/elsewhere", [linked(1, "pg"), linked(2, "pg-on pg"), linked(3, "pg"), linked(4, "pg")], (next, controls) => {
    assert.deepEqual(readings(next, controls), { pager: 2, following: "3", number: 2, numbered: "3" });
  });
});

test("the same classes in another order are one class list, not a page styled apart", () => {
  onPager("/elsewhere", [linked(1, "a b"), linked(2, "b a"), linked(3, "a b")], (next, controls) => {
    assert.equal(readPager(next), undefined);
    assert.equal(currentPageNumber(controls), undefined);
  });
});

for (const [named, numbers] of [
  ["only one other number to differ from", [linked(1, "pg pg-on"), linked(2, "pg")]],
  ["two numbers styled apart", [linked(1, "pg pg-on"), linked(2, "pg pg-hot"), linked(3, "pg"), linked(4, "pg")]],
  ["no two numbers alike", [linked(1, "a"), linked(2, "b"), linked(3, "c")]]
] as const) {
  test(`no page is current where the styling does not single one out: ${named}`, () => {
    onPager("/elsewhere", numbers, (next, controls) => {
      assert.equal(readPager(next), undefined);
      assert.equal(currentPageNumber(controls), undefined);
      assert.equal(followingPageControl(controls, 1)?.textContent, "2", "a numbered way with no current page counts the pages it read, as before");
    });
  });
}
