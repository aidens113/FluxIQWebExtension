// How a `web.dom.next_page` step presses its control when the verb hands it a
// press above humanness 0 (`../pager-press.ts`, t908), on the everything store's
// own pager (`../../tests/store-pager.ts`) and on a load-more feed:
//
// - the press replaces `control.click()`, after its `prepare`, on every way a
//   step presses (next, following, numbered, load more);
// - a Next's press is marked again once its aim is known, and every mark made
//   through the continuation (`../continued-move.ts`) carries the press;
// - the document a press loaded hands the step's press the record its mark
//   brought, and its reload marks keep it;
// - with no press -- humanness 0 -- nothing here runs: `move-page.test.ts`
//   proves that path, mark for mark, as it was.

import assert from "node:assert/strict";
import test from "node:test";
import { PAGE_MOVE_MARK_MESSAGE, type PageMoveMark, type PageMovePress } from "../../../../shared/extraction-continuation";
import { nthPagerLink, STORE_ITEM, storePage } from "../../tests/store-pager";
import { movePage, pageMoveFor, type PagerPress, type PageMoveOptions, type RefusedPageHost } from "..";
import { pressLoadMore } from "../load-more";
import type { PaginationProgress } from "../types";

/** A press that logs each call, presses with `click()` as the store answers it, and says it was aimed once prepared. */
function loggingPress(log: string[]): PagerPress & { resumedWith: PageMovePress[] } {
  let prepared = false;
  const resumedWith: PageMovePress[] = [];
  return {
    resumedWith,
    prepare: async () => {
      log.push("prepare");
      prepared = true;
    },
    press: (control) => {
      log.push("press");
      control.click();
    },
    marked: () => (prepared ? { aimed: true, misclick: { x: 3, y: 4 } } : undefined),
    resumed: (press) => {
      log.push("resumed");
      resumedWith.push(press);
    }
  };
}

const marking = (log: string[], marks: PageMoveMark[]): PageMoveOptions["mark"] => (mark) => {
  log.push(`mark ${mark.by}`);
  marks.push(structuredClone(mark));
  return Promise.resolve();
};

test("a Next is prepared, marked again, then pressed by the step's press rather than control.click()", async () => {
  const shown = storePage(1);
  try {
    const log: string[] = [];
    const marks: PageMoveMark[] = [];
    const answer = await movePage({ item: STORE_ITEM }, { timeoutMs: 20_000, mark: marking(log, marks), press: loggingPress(log) });
    assert.deepEqual(answer, { outcome: "moved", by: "next", page: 2 });
    assert.deepEqual(shown.followed, [2]);
    assert.deepEqual(log, ["mark next", "prepare", "mark next", "press"], "the aim is known before the last mark, and the press follows it");
  } finally {
    shown.restore();
  }
});

test("the following page is pressed the same way", async () => {
  const shown = storePage(2);
  try {
    const log: string[] = [];
    const answer = await movePage({ item: STORE_ITEM, pagination: { next: nthPagerLink(5) } }, { timeoutMs: 20_000, mark: marking(log, []), press: loggingPress(log) });
    assert.deepEqual(answer, { outcome: "moved", by: "following", page: 3 });
    assert.deepEqual(shown.followed, [3]);
    assert.deepEqual(log, ["mark following", "prepare", "mark following", "press"]);
  } finally {
    shown.restore();
  }
});

test("a step with nothing to press neither prepares nor presses", async () => {
  const shown = storePage(5);
  try {
    const log: string[] = [];
    const answer = await movePage({ item: STORE_ITEM }, { timeoutMs: 20_000, mark: marking(log, []), press: loggingPress(log) });
    assert.equal(answer.outcome, "ended");
    assert.deepEqual(log, []);
  } finally {
    shown.restore();
  }
});

/** A chrome stub whose `sendMessage` records each mark message the page sends. */
function withMarkStub<T>(body: (sent: PageMoveMark[]) => Promise<T>): Promise<T> {
  const globals = globalThis as { chrome?: unknown };
  const saved = globals.chrome;
  const sent: PageMoveMark[] = [];
  // Only the marks: the page-load pace asks the worker too.
  globals.chrome = { runtime: { sendMessage: (message: { type?: string; mark?: PageMoveMark }) => {
    if (message.type === PAGE_MOVE_MARK_MESSAGE && message.mark !== undefined) sent.push(structuredClone(message.mark));
    return Promise.resolve({ ok: true });
  } } };
  return body(sent).finally(() => {
    globals.chrome = saved;
  });
}

test("across documents: the marks a pressing document sends carry its press once prepared", async () => {
  const shown = storePage(1);
  try {
    await withMarkStub(async (sent) => {
      const log: string[] = [];
      const move = pageMoveFor({ token: "token.one" });
      const answer = await move({ item: STORE_ITEM }, { timeoutMs: 20_000, press: loggingPress(log) });
      assert.equal(answer.outcome, "moved");
      assert.deepEqual(sent, [{ by: "next" }, { by: "next", press: { aimed: true, misclick: { x: 3, y: 4 } } }], "the worker keeps the last mark, which carries the aim");
    });
  } finally {
    shown.restore();
  }
});

/** A refused-page host answering `status`, whose reload leaves the document where it is. */
function host(status: number | undefined): RefusedPageHost {
  return { status: () => status, pause: () => Promise.resolve(), reload: () => Promise.resolve() };
}

test("across documents: the document a Next loaded hands the step's press the record its mark brought", async () => {
  const shown = storePage(2);
  try {
    await withMarkStub(async () => {
      const log: string[] = [];
      const press = loggingPress(log);
      const move = pageMoveFor({ token: "token.one", resume: { by: "next", press: { aimed: true } } });
      const answer = await move({ item: STORE_ITEM }, { timeoutMs: 20_000, press, host: host(200) });
      assert.deepEqual(answer, { outcome: "moved", by: "next", page: 2 });
      assert.deepEqual(shown.followed, [], "the document that arrived is not pressed again");
      assert.deepEqual(press.resumedWith, [{ aimed: true }]);
      assert.deepEqual(log, ["resumed"]);
    });
  } finally {
    shown.restore();
  }
});

test("across documents: a refused landing's reload mark keeps the press its mark brought", async () => {
  const shown = storePage(2);
  try {
    await withMarkStub(async (sent) => {
      const move = pageMoveFor({ token: "token.one", resume: { by: "next", press: { aimed: true, misclick: { x: 3, y: 4 } } } });
      await move({ item: STORE_ITEM }, { timeoutMs: 60_000, press: loggingPress([]), host: host(503) });
      assert.deepEqual(sent, [{ by: "next", refusals: { retries: 1, rateLimits: 0 }, press: { aimed: true, misclick: { x: 3, y: 4 } } }]);
    });
  } finally {
    shown.restore();
  }
});

test("a load-more press is prepared before its mark, and every press of it is the step's press", async () => {
  const globals = globalThis as Record<string, unknown>;
  const saved = { document: globals.document, element: globals.HTMLElement, input: globals.HTMLInputElement };
  class FakeElement {}
  globals.HTMLElement = FakeElement;
  globals.HTMLInputElement = class {};
  const items: Element[] = [];
  const append = (count: number) => {
    for (let index = 0; index < count; index += 1) {
      const name = `Feed item ${items.length + 1}`;
      items.push({ getAttribute: (attribute: string) => (attribute === "data-name" ? name : null), parentElement: null, textContent: name } as unknown as Element);
    }
  };
  append(3);
  const control = Object.assign(new FakeElement(), { isConnected: true, matches: () => false, getAttribute: () => null, click: () => append(2) });
  globals.document = {
    readyState: "complete",
    querySelectorAll: (selector: string) => (selector === ".row" ? items : []),
    querySelector: (selector: string) => (selector === ".more" ? control : null)
  };
  try {
    const log: string[] = [];
    const shown = [...items];
    const progress: PaginationProgress = {
      item: ".row",
      shown,
      pagesRead: 1,
      scrolls: 0,
      deadline: Date.now() + 20_000,
      hasUnreadItem: () => items.length > shown.length,
      beforeFollow: async (by) => {
        log.push(`mark ${by}`);
      },
      press: loggingPress(log)
    };
    const step = await pressLoadMore({ mode: "loadMore", control: ".more" }, progress, undefined);
    assert.deepEqual(step, { outcome: "advanced", by: "loadMore" });
    assert.equal(items.length, 5);
    assert.deepEqual(log, ["prepare", "mark loadMore", "press"]);
  } finally {
    globals.document = saved.document;
    globals.HTMLElement = saved.element;
    globals.HTMLInputElement = saved.input;
  }
});
