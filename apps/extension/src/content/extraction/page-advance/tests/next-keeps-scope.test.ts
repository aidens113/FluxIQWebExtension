// Coverage of a next-page step whose Next leads out of the narrowed list
// (`../follow-next.ts`, `../dropped-state.ts`), on a library catalog narrowed
// by format and language (`./catalog-pager.ts`): a Next that drops the
// narrowing is swapped for the following page number that keeps it; where no
// control keeps it, the step fails rather than answering `moved` on the wrong
// list; and a Next that keeps everything is followed as before.

import assert from "node:assert/strict";
import test from "node:test";
import { movePage, type PageMoveOptions } from "..";
import type { PageMoveMark } from "../../../../shared/extraction-continuation";
import { CATALOG_HIT, CATALOG_NEXT, catalogAddress, catalogPage, withSearchIn, type CatalogPage, type CatalogPagerStyle } from "./catalog-pager";

async function onCatalog<T>(page: number, style: CatalogPagerStyle, body: (shown: CatalogPage, marks: PageMoveMark[]) => Promise<T>): Promise<T> {
  const shown = catalogPage(page, style);
  const marks: PageMoveMark[] = [];
  try {
    return await body(shown, marks);
  } finally {
    shown.restore();
  }
}

const marking = (marks: PageMoveMark[]): PageMoveOptions["mark"] => (mark) => {
  marks.push(structuredClone(mark));
  return Promise.resolve();
};

for (const way of [{ named: "the way names Next", pagination: { next: CATALOG_NEXT } }, { named: "the way is found from the list", pagination: undefined }]) {
  test(`a Next that drops the narrowing is swapped for the following page number that keeps it (${way.named})`, async () => {
    await onCatalog(1, { next: "drops", numbers: "keep" }, async (shown, marks) => {
      const answer = await movePage({ item: CATALOG_HIT, ...(way.pagination === undefined ? {} : { pagination: way.pagination }) }, { timeoutMs: 20_000, mark: marking(marks) });
      assert.deepEqual(answer, { outcome: "moved", by: "following", page: 2 });
      assert.deepEqual(shown.followed, [catalogAddress(2, true)], "page two of the narrowed list, not of the whole catalog");
      assert.deepEqual(marks, [{ by: "following" }]);
    });
  });
}

test("from page two, the swap goes on to page three of the narrowed list", async () => {
  await onCatalog(2, { next: "drops", numbers: "keep" }, async (shown) => {
    const answer = await movePage({ item: CATALOG_HIT, pagination: { next: CATALOG_NEXT } }, { timeoutMs: 20_000 });
    assert.deepEqual(answer, { outcome: "moved", by: "following", page: 3 });
    assert.deepEqual(shown.followed, [catalogAddress(3, true)]);
  });
});

for (const numbers of ["none", "drop"] as const) {
  test(`a Next that drops the narrowing with no control that keeps it fails page_fault and presses nothing (numbers: ${numbers})`, async () => {
    await onCatalog(1, { next: "drops", numbers }, async (shown, marks) => {
      const answer = await movePage({ item: CATALOG_HIT, pagination: { next: CATALOG_NEXT } }, { timeoutMs: 20_000, mark: marking(marks) });
      assert.equal(answer.outcome, "failed", "not moved: the page Next leads to is not this list's next page");
      assert.equal(answer.outcome === "failed" ? answer.stop : undefined, "page_fault");
      assert.match(answer.outcome === "failed" ? answer.reason : "", /leaves out 2 query parameters/u);
      assert.equal(answer.outcome === "failed" ? answer.filtersDropped : undefined, 2, "the count travels as a field of the answer");
      assert.doesNotMatch(answer.outcome === "failed" ? answer.reason : "", /format|lang|ebook/u, "no word of the address leaves the page");
      assert.deepEqual(shown.followed, []);
      assert.deepEqual(marks, [], "nothing was about to be pressed");
      assert.equal(shown.url(), `http://library.test${catalogAddress(1, true)}`);
    });
  });
}

for (const page of [1, 2]) {
  test(`a Next that keeps every parameter is followed as it is (page ${page})`, async () => {
    await onCatalog(page, { next: "keeps", numbers: "keep" }, async (shown, marks) => {
      const answer = await movePage({ item: CATALOG_HIT, pagination: { next: CATALOG_NEXT } }, { timeoutMs: 20_000, mark: marking(marks) });
      assert.deepEqual(answer, { outcome: "moved", by: "next", page: page + 1 });
      assert.deepEqual(shown.followed, [catalogAddress(page + 1, true)]);
      assert.deepEqual(marks, [{ by: "next" }]);
    });
  });
}

test("a Next that keeps every parameter is followed as it is on a pager with no numbers", async () => {
  await onCatalog(1, { next: "keeps", numbers: "none" }, async (shown) => {
    const answer = await movePage({ item: CATALOG_HIT, pagination: { next: CATALOG_NEXT } }, { timeoutMs: 20_000 });
    assert.equal(answer.outcome, "moved");
    assert.equal(answer.outcome === "moved" ? answer.by : undefined, "next");
    assert.deepEqual(shown.followed, [catalogAddress(2, true)]);
  });
});

// A dropped parameter counts only when the page shows it applied (t623 follow-up).

test("a Next that drops a tracking tag the page arrived with, which nothing on the page shows, is followed as it is", async () => {
  await onCatalog(1, { next: "keeps", numbers: "keep", arrivedWith: "ref=newsletter" }, async (shown, marks) => {
    const answer = await movePage({ item: CATALOG_HIT, pagination: { next: CATALOG_NEXT } }, { timeoutMs: 20_000, mark: marking(marks) });
    assert.deepEqual(answer, { outcome: "moved", by: "next", page: 2 });
    assert.deepEqual(shown.followed, [catalogAddress(2, true)]);
    assert.deepEqual(marks, [{ by: "next" }]);
  });
});

test("a Next that drops parameters no control shows applied is followed as before, even with no numbers to swap for", async () => {
  await onCatalog(1, { next: "drops", numbers: "none", shown: "nothing" }, async (shown) => {
    const answer = await movePage({ item: CATALOG_HIT, pagination: { next: CATALOG_NEXT } }, { timeoutMs: 20_000 });
    assert.equal(answer.outcome, "moved");
    assert.equal(answer.outcome === "moved" ? answer.by : undefined, "next");
    assert.deepEqual(shown.followed, [catalogAddress(2, false)]);
  });
});

// A search box's select on its first option is no narrowing (t626): a Next
// that leaves it out of the address is the list's Next.

for (const numbers of ["drop", "none"] as const) {
  test(`a Next that drops the search box's select on its first option is followed as it is (numbers: ${numbers})`, async () => {
    await onCatalog(1, { next: "keeps", numbers, searchIn: "everything" }, async (shown, marks) => {
      const answer = await movePage({ item: CATALOG_HIT, pagination: { next: CATALOG_NEXT } }, { timeoutMs: 20_000, mark: marking(marks) });
      // A pager with no numbers marks no page current, so the answer names none.
      assert.deepEqual(answer, { outcome: "moved", by: "next", ...(numbers === "none" ? {} : { page: 2 }) });
      assert.deepEqual(shown.followed, [catalogAddress(2, true)]);
      assert.deepEqual(marks, [{ by: "next" }]);
    });
  });
}

test("a Next that drops the search box's chosen later option is swapped for the following number that keeps it", async () => {
  await onCatalog(1, { next: "keeps", numbers: "keep", searchIn: "titles" }, async (shown) => {
    const answer = await movePage({ item: CATALOG_HIT, pagination: { next: CATALOG_NEXT } }, { timeoutMs: 20_000 });
    assert.deepEqual(answer, { outcome: "moved", by: "following", page: 2 });
    assert.deepEqual(shown.followed, [withSearchIn(catalogAddress(2, true), "titles")]);
  });
});

test("a Next that drops the search box's chosen later option with nothing that keeps it fails page_fault", async () => {
  await onCatalog(1, { next: "keeps", numbers: "none", searchIn: "titles" }, async (shown) => {
    const answer = await movePage({ item: CATALOG_HIT, pagination: { next: CATALOG_NEXT } }, { timeoutMs: 20_000 });
    assert.equal(answer.outcome === "failed" ? answer.stop : answer.outcome, "page_fault");
    assert.match(answer.outcome === "failed" ? answer.reason : "", /leaves out 1 query parameter /u);
    assert.equal(answer.outcome === "failed" ? answer.filtersDropped : undefined, 1);
    assert.doesNotMatch(answer.outcome === "failed" ? answer.reason : "", /titles|in=/u);
    assert.deepEqual(shown.followed, []);
  });
});
