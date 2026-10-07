// Coverage of `movePage`, the page's half of `web.dom.next_page` (contract
// C1): one step that moves a list to its next page, or says it has none, on
// the everything store's own pager (`../../tests/store-pager.ts`).
//
// What is proven here is the decision and the press: which control is
// pressed, what the answer says, and what is handed to the worker before a
// press or a reload. That a press that loads a new document is carried into
// it is the worker's half (`runtime/tests/next-page-continuation.test.ts`),
// and the whole chain against the store is the content spec
// (`e2e/content/tests/extraction/tests/everything-store-next-page.spec.ts`).

import assert from "node:assert/strict";
import test from "node:test";
import type { PageMoveMark } from "../../../../shared/extraction-continuation";
import { FakeElement, nthPagerLink, STORE_ITEM, storePage } from "../../tests/store-pager";
import { movePage, type PageMoveOptions, type RefusedPageHost } from "..";

/** Runs `body` on the store's results page `page`, collecting the marks handed to the worker. */
async function onStorePage<T>(page: number, body: (marks: PageMoveMark[], shown: ReturnType<typeof storePage>) => Promise<T>): Promise<T> {
  const shown = storePage(page);
  const marks: PageMoveMark[] = [];
  try {
    return await body(marks, shown);
  } finally {
    shown.restore();
  }
}

const marking = (marks: PageMoveMark[]): PageMoveOptions["mark"] => (mark) => {
  marks.push(structuredClone(mark));
  return Promise.resolve();
};

test("page two, whose Next leads back to page two, moves to page three by the pager's following page", async () => {
  await onStorePage(2, async (marks, shown) => {
    const answer = await movePage({ item: STORE_ITEM, pagination: { next: nthPagerLink(5) } }, { timeoutMs: 20_000, mark: marking(marks) });
    assert.deepEqual(answer, { outcome: "moved", by: "following", page: 3 });
    assert.deepEqual(shown.followed, [3], "not page two again, which its Next loads");
    assert.deepEqual(marks, [{ by: "following" }], "the worker is told before the press, and how the list moved");
  });
});

test("with no pagination named, the way forward is found from the list: page one's Next", async () => {
  await onStorePage(1, async (marks, shown) => {
    const answer = await movePage({ item: STORE_ITEM }, { timeoutMs: 20_000, mark: marking(marks) });
    assert.deepEqual(answer, { outcome: "moved", by: "next", page: 2 });
    assert.deepEqual(shown.followed, [2]);
  });
});

test("the last page, whose Next is a disabled span, ends on control_disabled and presses nothing", async () => {
  await onStorePage(5, async (marks, shown) => {
    const named = await movePage({ item: STORE_ITEM, pagination: { next: nthPagerLink(6) } }, { timeoutMs: 20_000, mark: marking(marks) });
    assert.deepEqual(named, { outcome: "ended", stop: "control_disabled" });
    const live = await movePage({ item: STORE_ITEM }, { timeoutMs: 20_000, mark: marking(marks) });
    assert.deepEqual(live, { outcome: "ended", stop: "control_disabled" });
    assert.deepEqual(shown.followed, []);
    assert.deepEqual(marks, [], "nothing was about to be pressed");
  });
});

test("a list that is not on the page is a failed move, not an ended one", async () => {
  await onStorePage(1, async (marks) => {
    const answer = await movePage({ item: "[data-nothing]" }, { timeoutMs: 20_000, mark: marking(marks) });
    assert.equal(answer.outcome, "failed");
    assert.equal(answer.outcome === "failed" ? answer.stop : undefined, "list_vanished");
    assert.deepEqual(marks, []);
  });
});

test("a Next whose click the page cancelled is followed by the link's own address", async () => {
  await onStorePage(1, async (marks, shown) => {
    const saved = { window: (globalThis as Record<string, unknown>).window, node: (globalThis as Record<string, unknown>).Node };
    const next = document.querySelector(nthPagerLink(4)) as unknown as FakeElement;
    const turn = next.onClick;
    const listeners: Array<(event: unknown) => void> = [];
    const assigned: string[] = [];
    // The job board's consent wall: every click is cancelled, so the link goes nowhere by itself.
    next.onClick = undefined;
    next.click = () => {
      const event = { target: next, defaultPrevented: true };
      for (const listener of listeners) listener(event);
    };
    (globalThis as Record<string, unknown>).Node = FakeElement;
    (globalThis as Record<string, unknown>).window = {
      addEventListener: (type: string, listener: (event: unknown) => void) => { if (type === "click") listeners.push(listener); },
      removeEventListener: (type: string, listener: (event: unknown) => void) => {
        if (type === "click") listeners.splice(listeners.indexOf(listener), 1);
      },
      location: { assign: (href: string) => { assigned.push(href); turn?.(); } }
    };
    try {
      const answer = await movePage({ item: STORE_ITEM, pagination: { next: nthPagerLink(4) } }, { timeoutMs: 20_000, mark: marking(marks) });
      assert.deepEqual(answer, { outcome: "moved", by: "next", page: 2 });
      assert.deepEqual(assigned, ["http://store.test/s?k=wireless+earbuds&page=2"]);
      assert.deepEqual(shown.followed, [2]);
      assert.deepEqual(marks, [{ by: "next" }]);
    } finally {
      (globalThis as Record<string, unknown>).window = saved.window;
      (globalThis as Record<string, unknown>).Node = saved.node;
    }
  });
});

/** A refused-page host that answers `status`, records its pauses and reloads, and whose reload leaves the document where it is. */
function host(status: number | undefined): RefusedPageHost & { pauses: number[]; reloads: number } {
  const made = {
    pauses: [] as number[],
    reloads: 0,
    status: () => status,
    pause: (ms: number) => { made.pauses.push(ms); return Promise.resolve(); },
    reload: () => { made.reloads += 1; return Promise.resolve(); }
  };
  return made;
}

test("the document a press loaded answers moved once the list is there, with the page the pager marks", async () => {
  await onStorePage(3, async (marks, shown) => {
    const served = host(200);
    const answer = await movePage({ item: STORE_ITEM }, { timeoutMs: 20_000, resume: { by: "following" }, mark: marking(marks), host: served });
    assert.deepEqual(answer, { outcome: "moved", by: "following", page: 3 });
    assert.deepEqual(shown.followed, [], "the document that arrived is not pressed again");
    assert.equal(served.reloads, 0);
  });
});

test("a 429 landing is waited out and reloaded once, and the refusal it spent travels to the next document", async () => {
  await onStorePage(3, async (marks) => {
    const refused = host(429);
    const answer = await movePage({ item: STORE_ITEM }, { timeoutMs: 60_000, resume: { by: "next" }, mark: marking(marks), host: refused });
    assert.deepEqual(refused.pauses, [8_500], "longer than the store's 8 s window");
    assert.equal(refused.reloads, 1);
    assert.deepEqual(marks, [{ by: "next", refusals: { retries: 1, rateLimits: 1 } }], "handed over before the reload took the script away");
    // The reload here leaves the document where it was, which a browser's never does.
    assert.deepEqual(answer.outcome === "failed" ? answer.stop : answer, "rate_limited");
    // The reloaded document, refused again: a second refusal as too fast is where a limiter flags a session, so it stops.
    const again = host(429);
    const second = await movePage({ item: STORE_ITEM }, { timeoutMs: 60_000, resume: { by: "next", refusals: { retries: 1, rateLimits: 1 } }, mark: marking(marks), host: again });
    assert.deepEqual(second.outcome === "failed" ? second.stop : second, "rate_limited");
    assert.equal(again.reloads, 0);
    assert.deepEqual(again.pauses, []);
  });
});

test("a 503 landing is reloaded at most twice across documents", async () => {
  await onStorePage(3, async (marks) => {
    const first = host(503);
    await movePage({ item: STORE_ITEM }, { timeoutMs: 120_000, resume: { by: "next" }, mark: marking(marks), host: first });
    const second = host(503);
    await movePage({ item: STORE_ITEM }, { timeoutMs: 120_000, resume: marks[0], mark: marking(marks), host: second });
    const third = host(503);
    const answer = await movePage({ item: STORE_ITEM }, { timeoutMs: 120_000, resume: marks[1], mark: marking(marks), host: third });
    assert.deepEqual([first.reloads, second.reloads, third.reloads], [1, 1, 0]);
    assert.deepEqual(marks.map((mark) => mark.refusals), [{ retries: 1, rateLimits: 0 }, { retries: 2, rateLimits: 0 }]);
    assert.deepEqual(answer.outcome === "failed" ? answer.stop : answer, "list_vanished");
  });
});
