// A numbered step on a list whose pager is not on the page at all: a list that
// fits one page (a narrowing the model applied left a handful of items) has no
// page after it. The step said `page_fault`, which downstream reads as a press
// whose effect is uncertain, though nothing was pressed, and a saved Flow
// stopped (live run `run-mwaf6gnt-638d90a0`, step 0073). It now says `ended`,
// and only on a list that is settled: one still loading may not have drawn its
// pager yet.

import assert from "node:assert/strict";
import test from "node:test";
import type { PageMoveMark } from "../../../../shared/extraction-continuation";
import { FakeElement } from "../../tests/store-pager";
import { movePage } from "..";

const ITEM = "li[data-hit]";
const PAGES = "a[data-page]";

/** Stands up a list of `count` items with no pager, `busy` marking its container as still loading, until `restore`. */
function onListWithNoPager(count: number, busy: boolean): { restore(): void } {
  const results = new FakeElement("ol", busy ? { "aria-busy": "true" } : {}, "", Array.from({ length: count }, (_, index) => new FakeElement("li", { "data-hit": String(index) }, `Item ${index + 1}`)));
  const body = new FakeElement("body", {}, "", [new FakeElement("main", {}, "", [results])]);
  const globals = globalThis as Record<string, unknown>;
  const saved = ["document", "window", "HTMLElement", "HTMLInputElement"].map((name) => [name, globals[name]] as const);
  globals.HTMLElement = FakeElement;
  globals.HTMLInputElement = class {};
  globals.window = { addEventListener: () => {}, removeEventListener: () => {} };
  globals.document = {
    readyState: "complete",
    URL: "http://shop.test/results",
    querySelector: (selector: string) => body.querySelector(selector),
    querySelectorAll: (selector: string) => body.querySelectorAll(selector)
  };
  return {
    restore: () => {
      for (const [name, value] of saved) globals[name] = value;
    }
  };
}

test("a numbered way whose pages match nothing on a settled list ends on no_following_page and presses nothing", async () => {
  const shown = onListWithNoPager(4, false);
  const marks: PageMoveMark[] = [];
  try {
    const answer = await movePage({ item: ITEM, pagination: { mode: "numbered", pages: PAGES } }, { timeoutMs: 20_000, mark: (mark) => (marks.push(mark), Promise.resolve()) });
    assert.deepEqual(answer, { outcome: "ended", stop: "no_following_page" });
    assert.deepEqual(marks, [], "nothing was about to be pressed");
  } finally {
    shown.restore();
  }
});

test("the same list still loading is not read as having no pager: a fault that pressed nothing, carrying noEffect", async () => {
  const shown = onListWithNoPager(4, true);
  try {
    const answer = await movePage({ item: ITEM, pagination: { mode: "numbered", pages: PAGES } }, { timeoutMs: 20_000 });
    assert.equal(answer.outcome, "failed");
    if (answer.outcome === "failed") {
      assert.equal(answer.stop, "page_fault");
      assert.equal(answer.noEffect, true);
    }
  } finally {
    shown.restore();
  }
});
