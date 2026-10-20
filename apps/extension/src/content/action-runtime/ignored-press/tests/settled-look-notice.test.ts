// T1 coverage of the settled look's notice rule (`settled-look.ts`, t743): a
// press the page answered with nothing but a notice in one of its own notice
// regions is `"announced"`, the page reporting the press failed. The generic
// page is a library catalogue: a book card (`article`) holds a Reserve button,
// whose first press shows a busy state, reverts, and puts an error in a status
// region; the second reserves the book. A success is told apart by what comes
// with its notice -- a request, a lasting change in the control -- never by
// the notice's words, which no row here asks the look to read. The page is
// faked at what the look reads: the card's markup, the notice regions and their
// words, the listener's signs, and a document observer's records.

import assert from "node:assert/strict";
import test from "node:test";
import { lookUntilSettled } from "../settled-look";
import type { PressSignal } from "../press-again";

type FakeNode = {
  tagName: string;
  parentElement: FakeNode | null;
  parentNode: FakeNode | null;
  getAttribute(name: string): string | null;
  outerHTML?: string;
  textContent?: string;
  querySelectorAll?(selector: string): unknown[];
  ownerDocument?: unknown;
};

/** The selector the look searches notice regions by; every other search finds nothing on this page. */
const LIVE_CANDIDATES = "[role], [aria-live]";

type Options = {
  /** The Reserve button sits inside a status region itself. */
  controlInRegion?: boolean;
  /** A status region already showing words before the press. */
  standing?: string;
};

/** The library page: `html > body > main > article > Reserve`, with a toast region the page adds to the body and a line the card may write. */
function library(options: Options = {}) {
  const state = { busy: false, reserved: false, line: undefined as string | undefined };
  const element = (tag: string, parent: FakeNode | null, attributes: Record<string, string> = {}): FakeNode => ({
    tagName: tag.toUpperCase(),
    parentElement: parent,
    parentNode: parent,
    getAttribute: (name) => attributes[name] ?? null
  });
  const html = element("html", null);
  const body = element("body", html);
  const main = element("main", body);
  const card = element("article", main);
  const holder = options.controlInRegion ? element("div", card, { role: "status" }) : card;
  const reserve = element("button", holder);
  reserve.ownerDocument = { documentElement: html };
  /** The card's own line, written into it as a `role="alert"` paragraph. */
  const line = element("p", card, { role: "alert" });
  Object.defineProperty(line, "outerHTML", { get: () => `<p role="alert">${state.line ?? ""}</p>` });
  Object.defineProperty(line, "textContent", { get: () => state.line ?? "" });
  const button = (): string => `<button${state.busy ? ' aria-busy="true"' : ""}${state.reserved ? ' aria-pressed="true"' : ""}>Reserve</button>`;
  Object.defineProperty(card, "outerHTML", {
    get: () => `<article><h2>A book</h2>${options.controlInRegion ? `<div role="status">${button()}</div>` : button()}${state.line === undefined ? "" : `<p role="alert">${state.line}</p>`}</article>`
  });
  card.querySelectorAll = (selector) => (selector === LIVE_CANDIDATES && state.line !== undefined ? [line] : []);

  const toasts: FakeNode[] = [];
  const toast = (words: string, attributes: Record<string, string> = { role: "status" }): FakeNode => {
    const made = element("div", body, attributes);
    made.textContent = words;
    made.outerHTML = `<div>${words}</div>`;
    return made;
  };
  if (options.standing !== undefined) toasts.push(toast(options.standing));
  html.querySelectorAll = (selector) => {
    if (selector !== LIVE_CANDIDATES) return [];
    return [...(options.controlInRegion ? [holder] : []), ...(state.line !== undefined ? [line] : []), ...toasts];
  };

  let note: ((signal: PressSignal) => void) | undefined;
  const queued: PressSignal[] = [];
  const probe = (_pressed: Element, onSignal: (signal: PressSignal) => void) => {
    note = onSignal;
    return { flush: () => queued.splice(0).forEach((signal) => note?.(signal)), stop: () => undefined };
  };
  const pending: unknown[] = [];
  class DocumentObserver {
    observe() {}
    takeRecords() {
      return pending.splice(0);
    }
    disconnect() {}
  }
  return {
    state,
    look: () => lookUntilSettled(reserve as unknown as Element, probe, { MutationObserver: DocumentObserver as unknown as typeof MutationObserver }),
    /** The button turns busy, a change inside the card. */
    busy() {
      state.busy = true;
      queued.push("change");
    },
    /** The button comes back exactly as it was. */
    idle() {
      state.busy = false;
      queued.push("change");
    },
    /** The button stays changed: the act took. */
    reserved() {
      state.busy = false;
      state.reserved = true;
      queued.push("change");
    },
    /** The page adds a notice region to the body, with words in it. */
    notice(words: string, attributes?: Record<string, string>) {
      const made = toast(words, attributes);
      toasts.push(made);
      pending.push({ target: body, type: "childList", addedNodes: [made], removedNodes: [] });
    },
    /** The card writes a line into its own alert paragraph. */
    writeLine(words: string) {
      state.line = words;
      queued.push("change");
    },
    signal: (signal: PressSignal) => queued.push(signal),
    /** Something that is not a notice region appears outside the card. */
    elsewhere: () => pending.push({ target: body, type: "childList", addedNodes: [element("div", body)], removedNodes: [] })
  };
}

test("a Reserve press that shows a busy state, reverts, and leaves only a status notice outside its card is announced", async () => {
  const page = library();
  const look = page.look();
  page.busy();
  setTimeout(() => {
    page.idle();
    page.notice("notice words");
  }, 120);
  assert.equal(await look.settle(1_500), "announced");
});

test("a line the card writes into its own alert region, with nothing else changed, is announced", async () => {
  const page = library();
  const look = page.look();
  setTimeout(() => page.writeLine("line words"), 60);
  assert.equal(await look.settle(1_500), "announced");
});

test("a notice that came with a request is the page answering: a success notice is never read as failure", async () => {
  const page = library();
  const look = page.look();
  page.busy();
  setTimeout(() => {
    page.signal("request");
    page.idle();
    page.notice("notice words");
  }, 120);
  assert.equal(await look.settle(1_500), false);
});

test("a notice that came with a lasting change in the control is the page answering", async () => {
  const page = library();
  const look = page.look();
  page.busy();
  setTimeout(() => {
    page.reserved();
    page.notice("notice words");
  }, 120);
  assert.equal(await look.settle(1_500), false);
});

test("a notice beside any other change outside the card is the page answering", async () => {
  const page = library();
  const look = page.look();
  page.busy();
  setTimeout(() => {
    page.idle();
    page.notice("notice words");
    page.elsewhere();
  }, 120);
  assert.equal(await look.settle(1_500), false);
});

test("a polite live region is content, not a notice: its change answers the press", async () => {
  const page = library();
  const look = page.look();
  page.busy();
  setTimeout(() => {
    page.idle();
    page.notice("list words", { "aria-live": "polite" });
  }, 120);
  assert.equal(await look.settle(1_500), false);
});

test("a notice already standing before the press, with no new words, leaves the press certainly without effect, not announced", async () => {
  const page = library({ standing: "earlier words" });
  const look = page.look();
  page.busy();
  setTimeout(() => page.idle(), 120);
  assert.equal(await look.settle(1_500), true);
});

test("a control that itself sits in a status region is looked at as before: a notice elsewhere answers it", async () => {
  const page = library({ controlInRegion: true });
  const look = page.look();
  page.busy();
  setTimeout(() => {
    page.idle();
    page.notice("notice words");
  }, 120);
  assert.equal(await look.settle(1_500), false);
});

test("the second Reserve press, which reserves the book and says so, is not announced", async () => {
  const page = library({ standing: "notice words" });
  const look = page.look();
  page.busy();
  setTimeout(() => {
    page.signal("request");
    page.reserved();
    page.notice("other notice words");
  }, 120);
  assert.equal(await look.settle(1_500), false);
});
