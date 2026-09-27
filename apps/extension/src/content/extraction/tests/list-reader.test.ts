// T1 coverage of what the list reader decides before it touches the page: an
// `encrypt` field, a request whose every field is excluded, and a request with
// no field or no item are each refused first. Node has no `document`, so a
// reader that read anything before refusing would throw a ReferenceError
// instead of these refusals. Records, pagination, optional fields and the
// sensitive-control refusal are proven on real fixtures by
// `e2e/content/tests/extract-list.spec.ts`.

import assert from "node:assert/strict";
import test from "node:test";
import { extractList } from "../list-reader";
import type { ExtractionCheckpoint } from "../../../shared/extraction-continuation";
import type { WebAutomationExtractListRequest } from "../../types";

test("an encrypt field refuses the read as not implemented before the page is read", async () => {
  await assert.rejects(
    extractList({ item: ".row", fields: { name: ".name", card: { kind: "value", selector: ".card", handling: "encrypt" } } }),
    (error: unknown) => {
      assert.ok(error instanceof Error, String(error));
      assert.equal((error as { failure?: { code?: unknown } }).failure?.code, "web.action.not_implemented", error.message);
      return true;
    }
  );
});

test("a request whose every field is excluded would read nothing, so it is refused", async () => {
  await assert.rejects(
    extractList({ item: ".row", fields: { password: { kind: "value", selector: "input", handling: "exclude" } } }),
    /every field it names is excluded/u
  );
});

test("a request naming no field, or no item, is refused", async () => {
  await assert.rejects(extractList({ item: ".row", fields: {} }), /names no fields/u);
  await assert.rejects(extractList({ item: "   ", fields: { name: ".name" } }), /needs an item selector/u);
});

// And T1 coverage of the one count that cannot be read off the records: how many
// items the `item` selector named. A read that outlives its document is still one
// read -- `recordCount` and `pagesRead` are what the whole of it did -- so the item
// count has to be the whole read's too, or a reader comparing the three concludes
// the selector matched fewer items than it did, which is the signature of the
// entirely different failure "every field was read off the wrong element". Until
// 2026-09-26 the count was simply omitted for a continued read for want of a place
// to carry it; it travels in the checkpoint now.
//
// These rows need a page, so one is stood up here as the three things the reader
// asks of it: a `querySelectorAll` naming items, a `querySelector` for a
// pagination control, and elements that answer `getAttribute`. Nothing about
// reading a real list is claimed from it -- `e2e/content/tests/extract-list.spec.ts`
// does that on live fixtures -- only the arithmetic across a boundary.

/** One item of the fake list: it answers `getAttribute` and has no ancestor. */
function fakeItem(value: string): Element {
  return { getAttribute: (name: string) => (name === "data-name" ? value : null), parentElement: null } as unknown as Element;
}

type FakeList = {
  /** Appends items to the list the selector names. */
  add(...values: string[]): void;
  restore(): void;
};

/**
 * Stands a page up under `globalThis` for the length of one test: `items` under
 * `.row`, and, when `control` is given, a `loadMore` control under it whose click
 * runs `onClick`.
 */
function fakeList(items: string[], control?: { selector: string; onClick(): void }): FakeList {
  const saved = {
    document: (globalThis as Record<string, unknown>).document,
    element: (globalThis as Record<string, unknown>).HTMLElement,
    input: (globalThis as Record<string, unknown>).HTMLInputElement
  };
  const shown = items.map(fakeItem);
  // `pagination.ts` refuses a control that is not an `HTMLElement`, and the
  // sensitivity rule every field read goes through asks `instanceof
  // HTMLInputElement`, so both names have to exist for the reader to run at all.
  class FakeElement {}
  (globalThis as Record<string, unknown>).HTMLElement = FakeElement;
  (globalThis as Record<string, unknown>).HTMLInputElement = class {};
  const button = control === undefined ? undefined : Object.assign(new FakeElement(), {
    matches: () => false,
    getAttribute: () => null,
    isConnected: true,
    click: control.onClick
  });
  (globalThis as Record<string, unknown>).document = {
    readyState: "complete",
    querySelectorAll: (selector: string) => (selector === ".row" ? shown : []),
    querySelector: (selector: string) => (control !== undefined && selector === control.selector ? button : null)
  };
  return {
    add: (...values: string[]) => { shown.push(...values.map(fakeItem)); },
    restore: () => {
      (globalThis as Record<string, unknown>).document = saved.document;
      (globalThis as Record<string, unknown>).HTMLElement = saved.element;
      (globalThis as Record<string, unknown>).HTMLInputElement = saved.input;
    }
  };
}

/** A read of one attribute, which is the least a record can be built from without a text reader. */
const READ: WebAutomationExtractListRequest = {
  item: ".row",
  fields: { name: { kind: "attribute", attribute: "data-name" } },
  paginate: { mode: "next", next: ".next", maxPages: 5 }
};

/** What a predecessor document handed over: four records, two pages, and the items it named. */
function handedOver(itemsSeen: number | undefined): ExtractionCheckpoint {
  return {
    records: ["A", "B", "C", "D"].map((name) => ({ name })),
    pagesRead: 2,
    scrolls: 0,
    missingFields: [],
    ...(itemsSeen === undefined ? {} : { itemsSeen })
  };
}

test("a continued read adds its own document's items to the count it was handed, so the read never understates its selector", async () => {
  const page = fakeList(["E", "F", "G"]);
  try {
    const outcome = await extractList(READ, { resume: handedOver(4) });
    // Seven items named across three pages, seven records, and the three the
    // last document held are not the answer: they would read as a selector that
    // matched three where the records say seven, which is what a read whose
    // fields were all read off the wrong element looks like.
    assert.equal(outcome.itemsSeen, 7);
    assert.notEqual(outcome.itemsSeen, 3);
    assert.equal(outcome.records.length, 7);
    assert.equal(outcome.pagesRead, 3);
  } finally {
    page.restore();
  }
});

test("a checkpoint that counted no items leaves the count absent rather than reporting one document's as the read's", async () => {
  const page = fakeList(["E", "F", "G"]);
  try {
    const outcome = await extractList(READ, { resume: handedOver(undefined) });
    // Absent is the honest answer: there is no beginning to add to, and a wrong
    // count is worse than none. Three would be a lie about the whole read.
    assert.equal(outcome.itemsSeen, undefined);
    assert.equal("itemsSeen" in outcome, false);
    assert.equal(outcome.records.length, 7);
  } finally {
    page.restore();
  }
});

test("a read that began here counts its own items, and the checkpoint it hands on carries the whole read's count", async () => {
  // The handover, end to end: the count arrives, this document adds to it, the
  // checkpoint written before the control is followed carries the total, and the
  // read's own answer carries the total again. A count that restarted at each
  // document would show up here as 2 in the checkpoint and 4 in the answer.
  const taken: ExtractionCheckpoint[] = [];
  const page = fakeList(["E", "F"], { selector: ".more", onClick: () => page.add("G", "H") });
  try {
    const outcome = await extractList(
      { ...READ, paginate: { mode: "loadMore", control: ".more", maxPages: 3 } },
      {
        resume: { records: ["A", "B", "C", "D"].map((name) => ({ name })), pagesRead: 1, scrolls: 0, missingFields: [], itemsSeen: 4 },
        checkpoint: async (progress) => { taken.push(progress); }
      }
    );
    assert.equal(taken.length, 1);
    assert.equal(taken[0]?.itemsSeen, 6, "the checkpoint carries four handed over plus the two this document had named");
    assert.equal(taken[0]?.pagesRead, 2);
    assert.equal(outcome.itemsSeen, 8);
    assert.equal(outcome.records.length, 8);
  } finally {
    page.restore();
  }
});

test("a read that counted items and then handed the count on leaves it absent when it never had one", async () => {
  // The absence travels rather than becoming a zero: a document that could not
  // know the count must not tell the next one it was nothing, or the
  // understatement simply moves one document along.
  const taken: ExtractionCheckpoint[] = [];
  const page = fakeList(["E", "F"], { selector: ".more", onClick: () => page.add("G") });
  try {
    await extractList(
      { ...READ, paginate: { mode: "loadMore", control: ".more", maxPages: 3 } },
      {
        resume: { records: [{ name: "A" }], pagesRead: 1, scrolls: 0, missingFields: [] },
        checkpoint: async (progress) => { taken.push(progress); }
      }
    );
    assert.equal(taken.length, 1);
    assert.equal(taken[0]?.itemsSeen, undefined);
    assert.equal("itemsSeen" in (taken[0] ?? {}), false);
  } finally {
    page.restore();
  }
});
