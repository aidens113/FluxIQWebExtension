// T1 coverage of what the wait for a list to appear costs, which is the whole
// point of the wait having a stopping rule at all.
//
// The three rows below are the three outcomes `awaitListPresent` can have on a
// page that does not hold the list yet: the list arrives and the wait ends at
// once; the page is still working and the wait pays its ceiling, exactly as it
// did before this file existed; the page has stopped working and the wait ends
// on `PAGE_STILL_MS` instead of on the ceiling. The third is the one the run
// that prompted it paid six times over at 11.04 seconds a call
// (`run-muhnh0s5-98a27f42`).
//
// **What the wait costs is half of it; what it says is the other half.** Ending
// the wait early saves the seconds, and the read that follows still answers
// `succeeded` with zero records -- the same answer a page holding nothing
// gives. So the wait also reports whether the list was ever there, and the rows
// at the bottom are that report: appeared, and never appeared, on each of the
// ways the wait can end.
//
// Node has no page, so `document` and `MutationObserver` are stood up here as
// the two things the wait actually asks of them: a `querySelectorAll` that
// counts, a `readyState`, and an observer whose callback the fake page calls
// when it changes. That is enough to measure the wait, and nothing about
// reading a real list is claimed from it -- `e2e/content/tests/extract-list.spec.ts`
// does that on live fixtures.

import assert from "node:assert/strict";
import test from "node:test";
import { awaitListPresent, type ListPresence } from "../page-render";

/** The ceiling the wait pays when it cannot conclude anything, and the settle that lets it conclude. */
const PAGE_STILL_MS = 2_000;

type FakePage = {
  /** Sets how many elements the item selector names, and tells the observers the page changed. */
  draw(count: number): void;
  /** Says the page changed without changing what the selector names: a spinner, a class toggle. */
  stir(): void;
  restore(): void;
};

/** Stands a page up under `globalThis` for the length of one test. */
function fakePage(options: { readyState?: DocumentReadyState } = {}): FakePage {
  const previous = { document: (globalThis as Record<string, unknown>).document, observer: (globalThis as Record<string, unknown>).MutationObserver };
  let count = 0;
  const callbacks = new Set<() => void>();
  (globalThis as Record<string, unknown>).document = {
    readyState: options.readyState ?? "complete",
    querySelectorAll: () => ({ length: count })
  };
  (globalThis as Record<string, unknown>).MutationObserver = class {
    constructor(private readonly callback: () => void) {}
    observe(): void { callbacks.add(this.callback); }
    disconnect(): void { callbacks.delete(this.callback); }
  };
  const changed = (): void => { for (const callback of [...callbacks]) callback(); };
  return {
    draw: (drawn: number) => { count = drawn; changed(); },
    stir: changed,
    restore: () => {
      (globalThis as Record<string, unknown>).document = previous.document;
      (globalThis as Record<string, unknown>).MutationObserver = previous.observer;
    }
  };
}

/** What `awaitListPresent` answered, and how long it took to answer it. */
async function runWait(item: string, required: number, settle: boolean, timeoutMs: number): Promise<{ took: number; presence: ListPresence }> {
  const started = Date.now();
  const presence = await awaitListPresent(item, required, settle, { deadline: started + timeoutMs, hasUnreadItem: () => false });
  return { took: Date.now() - started, presence };
}

/** How long `awaitListPresent` took, in milliseconds. */
async function timeWait(item: string, required: number, settle: boolean, timeoutMs: number): Promise<number> {
  return (await runWait(item, required, settle, timeoutMs)).took;
}

test("a list that is already there is not waited for at all", async () => {
  const page = fakePage();
  page.draw(3);
  try {
    const took = await timeWait(".item", 1, false, 10_000);
    assert.ok(took < 200, `expected an immediate read, waited ${took}ms`);
  } finally {
    page.restore();
  }
});

test("a page that is still working pays the ceiling, because nothing it has done says the list is not coming", async () => {
  const page = fakePage();
  const stirring = setInterval(() => page.stir(), 100);
  try {
    // A deadline well under `RENDER_WINDOW_MS`, so the row measures the
    // command's own bound rather than a ten-second test.
    const took = await timeWait(".item", 1, false, 3_000);
    assert.ok(took >= 2_900, `expected the full command deadline, waited ${took}ms`);
  } finally {
    clearInterval(stirring);
    page.restore();
  }
});

test("a page that has stopped working ends the wait on the settle rather than on the command's deadline", async () => {
  const page = fakePage();
  try {
    // The deadline is far away; only the stillness can end this wait, and it is
    // the difference between 2 seconds and the 10 the live run paid.
    const took = await timeWait(".item", 1, false, 30_000);
    assert.ok(took >= PAGE_STILL_MS, `the page must be given ${PAGE_STILL_MS}ms of its own, waited ${took}ms`);
    assert.ok(took < PAGE_STILL_MS + 1_000, `expected the settle, waited ${took}ms`);
  } finally {
    page.restore();
  }
});

test("a document that has not finished loading is never still, however quiet", async () => {
  const page = fakePage({ readyState: "loading" });
  try {
    const took = await timeWait(".item", 1, false, 3_000);
    assert.ok(took >= 2_900, `a loading document must pay the deadline, waited ${took}ms`);
  } finally {
    page.restore();
  }
});

test("a page with no observer to ask is never still either", async () => {
  const page = fakePage();
  (globalThis as Record<string, unknown>).MutationObserver = undefined;
  try {
    const took = await timeWait(".item", 1, false, 3_000);
    assert.ok(took >= 2_900, `an unobservable page must pay the deadline, waited ${took}ms`);
  } finally {
    page.restore();
  }
});

test("a list that arrives while the page is still working is read the moment it does", async () => {
  const page = fakePage();
  const arrival = setTimeout(() => page.draw(5), 400);
  const stirring = setInterval(() => page.stir(), 100);
  try {
    const took = await timeWait(".item", 1, false, 10_000);
    assert.ok(took >= 350 && took < 900, `expected the read at the list's arrival, waited ${took}ms`);
  } finally {
    clearTimeout(arrival);
    clearInterval(stirring);
    page.restore();
  }
});

test("a list that is there is reported as having appeared, settle or no settle", async () => {
  const page = fakePage();
  page.draw(3);
  try {
    assert.equal((await runWait(".item", 1, false, 10_000)).presence, "appeared");
    // The growth settle runs after the list is found and must not change the answer.
    const settled = await runWait(".item", 1, true, 10_000);
    assert.equal(settled.presence, "appeared");
    assert.ok(settled.took >= 850, `the settle still runs, waited ${settled.took}ms`);
  } finally {
    page.restore();
  }
});

test("a selector that names nothing on a settled page is reported as never having appeared", async () => {
  const page = fakePage();
  try {
    const { took, presence } = await runWait(".nothing-here", 1, false, 30_000);
    assert.equal(presence, "never_appeared", "the one thing a read of zero records cannot say for itself");
    assert.ok(took < PAGE_STILL_MS + 1_000, `expected the settle, waited ${took}ms`);
  } finally {
    page.restore();
  }
});

test("a selector that names nothing is still never_appeared when the ceiling or the deadline ends the wait", async () => {
  const page = fakePage();
  const stirring = setInterval(() => page.stir(), 100);
  try {
    // A page that never stops working: only the command's deadline ends this
    // one, and the answer is the same fact arrived at the expensive way.
    const { took, presence } = await runWait(".nothing-here", 1, false, 3_000);
    assert.equal(presence, "never_appeared");
    assert.ok(took >= 2_900, `expected the full command deadline, waited ${took}ms`);
  } finally {
    clearInterval(stirring);
    page.restore();
  }
});

test("a list that arrives while the page works appeared, however late", async () => {
  const page = fakePage();
  const arrival = setTimeout(() => page.draw(5), 400);
  const stirring = setInterval(() => page.stir(), 100);
  try {
    assert.equal((await runWait(".item", 1, false, 10_000)).presence, "appeared");
  } finally {
    clearTimeout(arrival);
    clearInterval(stirring);
    page.restore();
  }
});

test("a list too short for the request still appeared: the selector names something", async () => {
  const page = fakePage();
  page.draw(2);
  try {
    // The wait for a required sixteenth item runs out, which is a read that came
    // up short -- not a selector that names nothing, and not the same repair.
    const { presence } = await runWait(".item", 16, false, 3_000);
    assert.equal(presence, "appeared");
  } finally {
    page.restore();
  }
});
