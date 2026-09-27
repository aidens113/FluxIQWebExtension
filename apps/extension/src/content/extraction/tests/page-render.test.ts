// T1 coverage of what the wait for a list to appear costs, and of the one
// question the cost turns on: **what a page holding still actually proves.**
//
// A quiet, loaded document proves something about a list that is *part* drawn --
// the rest is not coming -- and nothing whatever about a list that is not drawn
// at all, because a page whose next change comes from a `setTimeout` is
// mutation-quiet and `readyState: "complete"` and is indistinguishable from a
// finished one. Between 2026-09-25 18:29 and this file's rewrite the wait did not
// keep those apart, and four live reads of
// `everything-store-plus-earbuds-under-50` ended at 2089, 2576, 2109 and 2082 ms
// with zero records on pages whose lists were four to eight seconds away, while
// every read that waited 4.6 s or longer found rows. The row named "a quiet,
// complete page whose list arrives on a timer" is that failure, reduced to a
// fake page and a timer; it fails against the source as it stood.
//
// So the rows below are the four ways `awaitListPresent` can end, each measured
// against what the page had drawn when it ended:
//
// - the list arrives, at once or late, and the wait ends there (`list_present`);
// - the page is still working, and the wait pays its bound in full;
// - the page has gone quiet holding *some* of the list, and the wait ends on
//   `PAGE_STILL_MS` -- the saving the early settle was written for, kept;
// - the page has gone quiet holding *none* of it, and the wait pays its bound in
//   full anyway -- the saving given up, deliberately, as the price of not
//   reporting a gate as an empty page.
//
// **What the wait costs is half of it; what it says is the other half.** A read
// whose selector named nothing answers `succeeded` with zero records, the same
// answer a page holding nothing gives, and the durations above were the only
// evidence of which had happened -- a day's work to establish. So the wait
// returns a `ListWait`: whether the list was ever there, how many items it was
// waiting for, how long it waited, and which of the four ended it. The rows at
// the bottom are that account.
//
// Node has no page, so `document` and `MutationObserver` are stood up here as
// the two things the wait actually asks of them: a `querySelectorAll` that
// counts, a `readyState`, and an observer whose callback the fake page calls
// when it changes. That is enough to measure the wait, and nothing about
// reading a real list is claimed from it -- `e2e/content/tests/extract-list.spec.ts`
// does that on live fixtures.

import assert from "node:assert/strict";
import test from "node:test";
import { awaitListPresent, type ListWait } from "../page-render";

/** The settle a part-drawn list's page may end the wait on, and the one an empty one may not. */
const PAGE_STILL_MS = 2_000;
/** The ceiling a wait pays when neither the list nor a shorter deadline ends it. */
const RENDER_WINDOW_MS = 10_000;

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

/** What `awaitListPresent` answered, and how long the caller measured it taking. */
async function runWait(item: string, required: number, settle: boolean, timeoutMs: number | undefined): Promise<ListWait & { took: number }> {
  const started = Date.now();
  const deadline = timeoutMs === undefined ? undefined : started + timeoutMs;
  const wait = await awaitListPresent(item, required, settle, { deadline, hasUnreadItem: () => false });
  return { ...wait, took: Date.now() - started };
}

test("a list that is already there is not waited for at all", async () => {
  const page = fakePage();
  page.draw(3);
  try {
    const wait = await runWait(".item", 1, false, 10_000);
    assert.ok(wait.took < 200, `expected an immediate read, waited ${wait.took}ms`);
    assert.equal(wait.stoppedOn, "list_present");
  } finally {
    page.restore();
  }
});

test("a quiet, complete page whose list arrives on a timer is waited for, not written off", async () => {
  // The regression, in one row. Nothing mutates and the document is loaded, so
  // the page looks finished by every signal the wait can read -- and it is not:
  // its gate lifts on a `setTimeout`, as the everything store's notification
  // prompt does at four seconds and its browser check at eight. Against the
  // source as it stood this ended at ~2 s with `never_appeared`, which is the
  // answer six live runs got.
  const page = fakePage();
  const gate = setTimeout(() => page.draw(6), 4_000);
  try {
    const wait = await runWait(".item", 1, false, 10_000);
    assert.equal(wait.presence, "appeared", `a list four seconds away is still a list; the wait stopped on ${wait.stoppedOn} after ${wait.took}ms`);
    assert.equal(wait.stoppedOn, "list_present");
    assert.ok(wait.took >= 3_900 && wait.took < 5_000, `expected the read at the list's arrival, waited ${wait.took}ms`);
  } finally {
    clearTimeout(gate);
    page.restore();
  }
});

test("a page that has drawn none of the list pays its deadline however still it is, because stillness is not emptiness", async () => {
  const page = fakePage();
  try {
    // A deadline well under `RENDER_WINDOW_MS`, so the row measures the
    // command's own bound rather than a ten-second test. Nothing stirs and the
    // document is complete: the settle is available and must not be taken.
    const wait = await runWait(".nothing-here", 1, false, 3_000);
    assert.ok(wait.took >= 2_900, `a page that has drawn nothing must be waited out, waited ${wait.took}ms`);
    assert.equal(wait.stoppedOn, "deadline_passed");
    assert.equal(wait.presence, "never_appeared");
  } finally {
    page.restore();
  }
});

test("a page that has drawn none of the list and has no shorter deadline pays the whole render window", async () => {
  // The cost the fix reinstates, measured rather than claimed: a page that never
  // had a list and never will costs the full ceiling. That is the price of not
  // reporting a gate as an empty page, and `window_elapsed` is the word for it.
  const page = fakePage();
  try {
    const wait = await runWait(".nothing-here", 1, false, undefined);
    assert.ok(wait.took >= RENDER_WINDOW_MS - 100, `expected the full window, waited ${wait.took}ms`);
    assert.equal(wait.stoppedOn, "window_elapsed");
    assert.equal(wait.presence, "never_appeared");
  } finally {
    page.restore();
  }
});

test("a page that is still working pays the ceiling, because nothing it has done says the list is not coming", async () => {
  const page = fakePage();
  const stirring = setInterval(() => page.stir(), 100);
  try {
    const wait = await runWait(".item", 1, false, 3_000);
    assert.ok(wait.took >= 2_900, `expected the full command deadline, waited ${wait.took}ms`);
    assert.equal(wait.stoppedOn, "deadline_passed");
  } finally {
    clearInterval(stirring);
    page.restore();
  }
});

test("a page that has gone quiet with the list part drawn ends the wait on the settle", async () => {
  // The saving the early settle was written for, and the half of it that was
  // sound: twelve items are there, the sixteenth is wanted, and a loaded
  // document that has not changed for `PAGE_STILL_MS` has said the sixteenth is
  // not coming. The deadline is far away, so only the stillness can end this.
  const page = fakePage();
  page.draw(12);
  try {
    const wait = await runWait(".item", 16, false, 30_000);
    assert.equal(wait.stoppedOn, "page_settled");
    assert.ok(wait.took >= PAGE_STILL_MS, `the page must be given ${PAGE_STILL_MS}ms of its own, waited ${wait.took}ms`);
    assert.ok(wait.took < PAGE_STILL_MS + 1_000, `expected the settle, waited ${wait.took}ms`);
    // Short of what was asked for is not the same fact as a selector that named
    // nothing, and only one of them is a selector to repair.
    assert.equal(wait.presence, "appeared");
  } finally {
    page.restore();
  }
});

test("the settle's clock starts when the list starts arriving, not when the wait did", async () => {
  // A page that draws its first items late and then stops has had two seconds of
  // its own *after* them, so a list arriving in parts is never cut off by quiet
  // that preceded it.
  const page = fakePage();
  const first = setTimeout(() => page.draw(12), 1_500);
  try {
    const wait = await runWait(".item", 16, false, 30_000);
    assert.equal(wait.stoppedOn, "page_settled");
    assert.ok(wait.took >= 1_500 + PAGE_STILL_MS, `expected the settle to start at the first items, waited ${wait.took}ms`);
    assert.ok(wait.took < 1_500 + PAGE_STILL_MS + 1_000, `expected the settle, waited ${wait.took}ms`);
  } finally {
    clearTimeout(first);
    page.restore();
  }
});

test("a document that has not finished loading is never still, however quiet", async () => {
  const page = fakePage({ readyState: "loading" });
  page.draw(12);
  try {
    const wait = await runWait(".item", 16, false, 3_000);
    assert.ok(wait.took >= 2_900, `a loading document must pay the deadline, waited ${wait.took}ms`);
    assert.equal(wait.stoppedOn, "deadline_passed");
  } finally {
    page.restore();
  }
});

test("a page with no observer to ask is never still either", async () => {
  const page = fakePage();
  page.draw(12);
  (globalThis as Record<string, unknown>).MutationObserver = undefined;
  try {
    const wait = await runWait(".item", 16, false, 3_000);
    assert.ok(wait.took >= 2_900, `an unobservable page must pay the deadline, waited ${wait.took}ms`);
    assert.equal(wait.stoppedOn, "deadline_passed");
  } finally {
    page.restore();
  }
});

test("a list that arrives while the page is still working is read the moment it does", async () => {
  const page = fakePage();
  const arrival = setTimeout(() => page.draw(5), 400);
  const stirring = setInterval(() => page.stir(), 100);
  try {
    const wait = await runWait(".item", 1, false, 10_000);
    assert.ok(wait.took >= 350 && wait.took < 900, `expected the read at the list's arrival, waited ${wait.took}ms`);
    assert.equal(wait.stoppedOn, "list_present");
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
    // The growth settle runs after the list is found and must not change the
    // answer -- and the time it takes is part of what the read waited.
    const settled = await runWait(".item", 1, true, 10_000);
    assert.equal(settled.presence, "appeared");
    assert.equal(settled.stoppedOn, "list_present");
    assert.ok(settled.took >= 850, `the settle still runs, waited ${settled.took}ms`);
    assert.ok(settled.waitedMs >= 850, `the account covers the settle, reported ${settled.waitedMs}ms`);
  } finally {
    page.restore();
  }
});

test("a selector that names nothing says so, and says what it waited for and what ended the wait", async () => {
  const page = fakePage();
  const stirring = setInterval(() => page.stir(), 100);
  try {
    // A page that never stops working: only the command's deadline ends this
    // one, and the account is what makes that readable without a stopwatch.
    const wait = await runWait(".nothing-here", 1, false, 3_000);
    assert.equal(wait.presence, "never_appeared", "the one thing a read of zero records cannot say for itself");
    assert.equal(wait.stoppedOn, "deadline_passed");
    assert.equal(wait.waitedFor, 1);
    assert.ok(wait.waitedMs >= 2_900, `the account's own duration, reported ${wait.waitedMs}ms`);
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
    // The wait for a required sixteenth item ends on the quiet page, which is a
    // read that came up short -- not a selector that names nothing, and not the
    // same repair.
    const wait = await runWait(".item", 16, false, 3_000);
    assert.equal(wait.presence, "appeared");
    assert.equal(wait.waitedFor, 16);
    assert.equal(wait.stoppedOn, "page_settled");
  } finally {
    page.restore();
  }
});

test("a read told an empty list is a valid answer is still waited for, held to one item", async () => {
  // `minItems: 0` is a post-condition, not an instruction to read early, and the
  // model wrote it on every extraction node of all ten live runs of this task.
  // The wait holds it to one, and says so.
  const page = fakePage();
  const gate = setTimeout(() => page.draw(4), 2_600);
  try {
    const wait = await runWait(".item", 0, false, 10_000);
    assert.equal(wait.waitedFor, 1);
    assert.equal(wait.presence, "appeared");
    assert.ok(wait.took >= 2_500, `expected the gate to be waited out, waited ${wait.took}ms`);
  } finally {
    clearTimeout(gate);
    page.restore();
  }
});
