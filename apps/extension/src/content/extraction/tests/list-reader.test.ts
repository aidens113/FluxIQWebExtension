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

// And T1 coverage of `dedupe` and `sort` inside the read (`../order-rows.ts`):
// the order is `where`, then dedupe, then sort, then `maxItems`, and the read
// says what the middle two took. The page is the same stand-in as above, its
// items carrying several attributes; a continued read is used so the reader goes
// straight to the rows rather than through the first page's waits, which need a
// real document.

/** One item of a fake list whose attributes are `data-<key>` for each key given. */
function fakeRow(values: Record<string, string>): Element {
  return { getAttribute: (name: string) => (name.startsWith("data-") ? values[name.slice(5)] ?? null : null), parentElement: null } as unknown as Element;
}

/** Stands the rows up under `.row`, as `fakeList` does, for the length of one test. */
function fakeRows(rows: Array<Record<string, string>>): { restore(): void } {
  const saved = {
    document: (globalThis as Record<string, unknown>).document,
    element: (globalThis as Record<string, unknown>).HTMLElement,
    input: (globalThis as Record<string, unknown>).HTMLInputElement
  };
  const shown = rows.map(fakeRow);
  (globalThis as Record<string, unknown>).HTMLElement = class {};
  (globalThis as Record<string, unknown>).HTMLInputElement = class {};
  (globalThis as Record<string, unknown>).document = {
    readyState: "complete",
    querySelectorAll: (selector: string) => (selector === ".row" ? shown : []),
    querySelector: () => null
  };
  return {
    restore: () => {
      (globalThis as Record<string, unknown>).document = saved.document;
      (globalThis as Record<string, unknown>).HTMLElement = saved.element;
      (globalThis as Record<string, unknown>).HTMLInputElement = saved.input;
    }
  };
}

const attribute = (name: string) => ({ kind: "attribute" as const, attribute: `data-${name}` });

/** The job-board read of `run-mulwm2dc-0bd95f22`, in small: roles, not sponsored, each once, newest first. */
const JOBS: WebAutomationExtractListRequest = {
  item: ".row",
  fields: { title: attribute("title"), posted: attribute("posted"), url: attribute("url") },
  where: [{ read: attribute("sponsored"), is: "absent" }],
  paginate: { mode: "next", next: ".next", maxPages: 5 }
};

const START: ExtractionCheckpoint = { records: [], pagesRead: 0, scrolls: 0, missingFields: [], itemsSeen: 0 };

test("where, then dedupe, then sort, then maxItems: the newest distinct roles, and what each step took", async () => {
  const page = fakeRows([
    { title: "Sponsored", posted: "1 hour ago", url: "/ad", sponsored: "yes" },
    { title: "A", posted: "3 days ago", url: "/a" },
    { title: "B", posted: "1 day ago", url: "/b" },
    // A repeat of /a, newer than everything: kept, it would be the first row.
    { title: "A again", posted: "2 hours ago", url: "/a" },
    { title: "C", posted: "5 days ago", url: "/c" },
    { title: "D", posted: "recently", url: "/d" }
  ]);
  try {
    const outcome = await extractList(
      { ...JOBS, dedupe: { by: ["url"] }, sort: [{ field: "posted", order: "desc" }], maxItems: 2 },
      { resume: START }
    );
    // The sponsored row is left out by `where`, the repeat by `dedupe`, and the
    // two newest of the four distinct roles are the answer -- not the first two read.
    assert.deepEqual(outcome.records.map((record) => record.title), ["B", "A"]);
    assert.equal(outcome.filtered, 1);
    assert.deepEqual(outcome.order, { duplicates: 1, unsortable: 1 });
    assert.equal(outcome.truncated, true, "two of four rows were answered, so the answer is cut");
    assert.equal(outcome.itemsSeen, 6);
  } finally {
    page.restore();
  }
});

test("without a sort, a duplicate takes no place under maxItems and the read goes on to the next distinct row", async () => {
  const page = fakeRows([
    { title: "A", posted: "", url: "/a" },
    { title: "A again", posted: "", url: "/a" },
    { title: "B", posted: "", url: "/b" },
    { title: "C", posted: "", url: "/c" }
  ]);
  try {
    const outcome = await extractList({ ...JOBS, where: undefined, dedupe: { by: ["url"] }, maxItems: 2 }, { resume: START });
    assert.deepEqual(outcome.records.map((record) => record.title), ["A", "B"]);
    assert.deepEqual(outcome.order, { duplicates: 1, unsortable: 0 });
    assert.equal(outcome.truncated, true);
  } finally {
    page.restore();
  }
});

test("a dedupe reaches the rows a continued read carried, so a later document never repeats them", async () => {
  const page = fakeRows([{ title: "A later", posted: "", url: "/a" }, { title: "C", posted: "", url: "/c" }]);
  try {
    const outcome = await extractList(
      { ...JOBS, where: undefined, dedupe: { by: ["url"] } },
      { resume: { ...START, records: [{ title: "A", posted: "", url: "/a" }, { title: "B", posted: "", url: "/b" }], pagesRead: 1, itemsSeen: 2 } }
    );
    assert.deepEqual(outcome.records.map((record) => record.title), ["A", "B", "C"]);
    assert.deepEqual(outcome.order, { duplicates: 1, unsortable: 0 });
  } finally {
    page.restore();
  }
});

test("a read that names neither dedupe nor sort carries no order report and answers in page order", async () => {
  const page = fakeRows([{ title: "Z", posted: "", url: "/z" }, { title: "A", posted: "", url: "/z" }]);
  try {
    const outcome = await extractList({ ...JOBS, where: undefined }, { resume: START });
    assert.deepEqual(outcome.records.map((record) => record.title), ["Z", "A"]);
    assert.equal("order" in outcome, false);
  } finally {
    page.restore();
  }
});

// And the condition report across a document boundary. Live run
// `run-munnhi5q-4867dabe` read the everything store's results with two `where`
// conditions, ended on a document with no card on it (a rate-limit page), and
// reported `conditions: {applied: 0, kept: 0, rejected: [0, 0]}`: the counts
// restarted at each document, so the read answered with its last document's and
// a read that had filtered four pages looked like one whose filters did nothing.

/** What the four documents before the rate-limit page handed over: 56 cards asked about, 28 kept, the first condition rejecting 20 and the second 8. */
const FILTERED_SO_FAR: ExtractionCheckpoint = {
  ...START,
  records: Array.from({ length: 28 }, (_, index) => ({ title: `T${index}`, posted: "", url: `/t${index}` })),
  pagesRead: 4,
  itemsSeen: 56,
  filtered: 28,
  conditions: { applied: 56, kept: 28, rejected: [20, 8] }
};

/** JOBS with a second condition, so the report has two positions as the live read did. */
const TWO_CONDITIONS: WebAutomationExtractListRequest = {
  ...JOBS,
  where: [{ read: attribute("sponsored"), is: "absent" }, { field: "title", contains: ["ear tips", "charging case"], not: true }]
};

test("a continued read reports what its conditions did across the whole read, not only in its own document", async () => {
  const page = fakeRows([
    { title: "Earbuds", posted: "", url: "/e" },
    { title: "Sponsored earbuds", posted: "", url: "/ad", sponsored: "yes" },
    { title: "Foam ear tips", posted: "", url: "/tips" }
  ]);
  try {
    const outcome = await extractList(TWO_CONDITIONS, { resume: FILTERED_SO_FAR });
    // A predecessor that did not count alone rows hands over none; this document's two rows each failed one condition.
    assert.deepEqual(outcome.conditions, { applied: 59, kept: 29, rejected: [21, 9], unfiltered: false, seen: [null, null], alone: [1, 1] });
    assert.equal(outcome.filtered, 30);
    assert.equal(outcome.records.length, 29);
  } finally {
    page.restore();
  }
});

test("a read that ends on a page with none of the list keeps the counts it was handed, rather than reporting conditions that applied to nothing", async () => {
  // The rate-limit page: no item, no control. The read ends on it (here on its
  // deadline, which is the quickest way a stand-in page can end it), and what
  // its conditions did is still what they did on the four pages before it.
  const page = fakeRows([]);
  try {
    const outcome = await extractList(TWO_CONDITIONS, { resume: FILTERED_SO_FAR, timeoutMs: 100 });
    assert.equal(outcome.records.length, 28);
    assert.deepEqual(outcome.conditions, { applied: 56, kept: 28, rejected: [20, 8], unfiltered: false, seen: [null, null], alone: [0, 0] });
    assert.notDeepEqual(outcome.conditions?.rejected, [0, 0]);
  } finally {
    page.restore();
  }
});

test("the checkpoint a filtering read hands on carries its condition counts, its predecessor's included", async () => {
  const taken: ExtractionCheckpoint[] = [];
  const page = fakeList(["E", "F"], { selector: ".more", onClick: () => page.add("G") });
  try {
    const outcome = await extractList(
      { ...READ, where: [{ field: "name", equals: "F", not: true }], paginate: { mode: "loadMore", control: ".more", maxPages: 3 } },
      {
        resume: { records: [{ name: "A" }], pagesRead: 1, scrolls: 0, missingFields: [], itemsSeen: 2, filtered: 1, conditions: { applied: 2, kept: 1, rejected: [1], alone: [1] } },
        checkpoint: async (progress) => { taken.push(progress); }
      }
    );
    assert.equal(taken.length, 1);
    assert.deepEqual(taken[0]?.conditions, { applied: 4, kept: 2, rejected: [2], seen: [null], alone: [2] }, "two handed over plus E kept and F rejected");
    assert.deepEqual(outcome.conditions, { applied: 5, kept: 3, rejected: [2], unfiltered: false, seen: [null], alone: [2] });
  } finally {
    page.restore();
  }
});

test("counts that do not fit the request's conditions are not added to, and a read that began here starts from zero", async () => {
  const page = fakeRows([{ title: "Earbuds", posted: "", url: "/e" }]);
  try {
    const misfit = await extractList(TWO_CONDITIONS, { resume: { ...START, conditions: { applied: 9, kept: 9, rejected: [0] } } });
    assert.deepEqual(misfit.conditions, { applied: 1, kept: 1, rejected: [0, 0], unfiltered: false, seen: [null, null], alone: [0, 0] });
    const fresh = await extractList(TWO_CONDITIONS, { resume: START });
    assert.deepEqual(fresh.conditions, { applied: 1, kept: 1, rejected: [0, 0], unfiltered: false, seen: [null, null], alone: [0, 0] });
  } finally {
    page.restore();
  }
});
