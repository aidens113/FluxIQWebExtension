// T1 coverage of how a `loadMore` read ends on a control the page leaves in
// place but turns off (`page-advance/load-more.ts`, `isDisabled` from
// `pager-reading`): a control that ends up `disabled` or `aria-disabled="true"`
// is the list ending, reported as `control_disabled` and not as truncation,
// even when it ends on the page the bound would also have stopped at.
//
// This was a basic-form row in
// `e2e/content/tests/extraction/tests/extract-list-pagination.spec.ts` that
// injected an appending feed whose button ended disabled. Browser specs open
// only the ten realistic scenarios, and none of them disables a load-more
// control at the end of its list -- the realistic ones hide it, which that
// spec's Sent invitations row proves -- so the decision is proven here on a page
// stood up as `list-reader.test.ts` stands one up: items under `.row`, and a
// control under `.more` whose press appends items.

import assert from "node:assert/strict";
import test from "node:test";
import { extractList } from "../../list-reader";
import type { WebAutomationExtractListRequest } from "../../../types";

/** One item of the fake list: it answers `getAttribute` and has no ancestor. */
function fakeItem(value: string): Element {
  return { getAttribute: (name: string) => (name === "data-name" ? value : null), parentElement: null } as unknown as Element;
}

type Ending = "disabled" | "aria-disabled";

/**
 * Three items and a control that appends two on each press; its second press
 * also turns the control off the way `ends` says, in the same tick as that
 * append, so a read sees pages of 3, 5 and 7 items and then no way forward.
 */
async function withFeed<T>(ends: Ending, body: (presses: () => number) => Promise<T>): Promise<T> {
  const globals = globalThis as Record<string, unknown>;
  const saved = { document: globals.document, element: globals.HTMLElement, input: globals.HTMLInputElement };
  class FakeElement {}
  globals.HTMLElement = FakeElement;
  globals.HTMLInputElement = class {};
  const items: Element[] = [];
  const append = (count: number) => {
    for (let index = 0; index < count; index += 1) items.push(fakeItem(`Feed item ${items.length + 1}`));
  };
  append(3);
  const state = { presses: 0, off: false };
  const control = Object.assign(new FakeElement(), {
    isConnected: true,
    matches: (selector: string) => selector === ":disabled" && ends === "disabled" && state.off,
    getAttribute: (name: string) => (name === "aria-disabled" && ends === "aria-disabled" && state.off ? "true" : null),
    click: () => {
      // A control marked aria-disabled is still clickable; the page, like a
      // real one, ignores the press rather than loading again.
      if (state.off) return;
      state.presses += 1;
      append(2);
      if (state.presses >= 2) state.off = true;
    }
  });
  globals.document = {
    readyState: "complete",
    querySelectorAll: (selector: string) => (selector === ".row" ? items : []),
    querySelector: (selector: string) => (selector === ".more" ? control : null)
  };
  try {
    return await body(() => state.presses);
  } finally {
    globals.document = saved.document;
    globals.HTMLElement = saved.element;
    globals.HTMLInputElement = saved.input;
  }
}

const READ: WebAutomationExtractListRequest = {
  item: ".row",
  fields: { name: { kind: "attribute", attribute: "data-name" } },
  paginate: { mode: "loadMore", control: ".more", maxPages: 3 }
};

/** A read that begins in this document with nothing handed over. */
const FRESH = { resume: { records: [], pagesRead: 0, scrolls: 0, missingFields: [] } };

const feedItems = (count: number) => Array.from({ length: count }, (_, index) => ({ name: `Feed item ${index + 1}` }));

for (const ends of ["disabled", "aria-disabled"] as const) {
  test(`a load-more control that ends up ${ends} ends the list rather than truncating it`, async () => {
    await withFeed(ends, async (presses) => {
      const outcome = await extractList(READ, FRESH);
      // Three pages read and the control no longer usable: the list ended on
      // the page the bound would also have stopped at, and ending wins.
      assert.deepEqual(outcome.records, feedItems(7));
      assert.equal(outcome.pagesRead, 3);
      assert.equal(outcome.truncated, false);
      assert.equal(outcome.paginationStop, "control_disabled");
      assert.equal(presses(), 2, "the turned-off control is not pressed again");
    });
  });
}

test("the same control still on after the bound is reached is truncation, not the end", async () => {
  await withFeed("disabled", async (presses) => {
    const outcome = await extractList({ ...READ, paginate: { mode: "loadMore", control: ".more", maxPages: 2 } }, FRESH);
    assert.deepEqual(outcome.records, feedItems(5));
    assert.equal(outcome.pagesRead, 2);
    assert.equal(outcome.truncated, true);
    assert.equal(outcome.paginationStop, "page_limit");
    assert.equal(presses(), 1);
  });
});
