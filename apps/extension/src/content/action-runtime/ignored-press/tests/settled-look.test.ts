// T1 coverage of the settled look (`settled-look.ts`, t517): a press is
// certainly without effect only when the page settles exactly as it was before
// the press. The pinned case is social-network-feed's Post, which shows a
// spinner for a moment on its first press and turns back into Post with
// nothing posted: a busy state that comes and goes is no effect. A change that
// stays, a change anywhere outside the press's section, a field whose held
// value changed, and a request, navigation or focus move at any point are all
// answers. The page is faked at what the look reads: a composer dialog whose
// markup the test sets, the listener's signs, and a document observer.

import assert from "node:assert/strict";
import test from "node:test";
import { lookUntilSettled } from "../settled-look";
import type { PressSignal } from "../press-again";

type FakeElement = {
  tagName: string;
  parentElement: FakeElement | null;
  parentNode: FakeElement | null;
  getAttribute(name: string): string | null;
  outerHTML?: string;
  querySelectorAll?(selector: string): unknown[];
};

const IDLE = '<div role="dialog"><form><div contenteditable="true">Lunch at noon</div></form><div class="foot"><div role="button" aria-label="Post">Post</div></div></div>';
const BUSY = '<div role="dialog"><form><div contenteditable="true">Lunch at noon</div></form><div class="foot"><div role="button" aria-label="Post" aria-busy="true"><span class="spinner"></span></div></div></div>';
const POSTED = '<div role="dialog"><p>Your post was submitted.</p></div>';

/** A Create post dialog over a page: `html > body > dialog > foot > Post`, with the dialog's markup and its one field's value set by the test. */
function composer() {
  const state = { markup: IDLE, field: { value: "" } };
  const element = (tag: string, parent: FakeElement | null, role: string | null = null): FakeElement => ({ tagName: tag.toUpperCase(), parentElement: parent, parentNode: parent, getAttribute: (name) => (name === "role" ? role : null) });
  const html = element("html", null);
  const body = element("body", html);
  const dialog = element("div", body, "dialog");
  Object.defineProperty(dialog, "outerHTML", { get: () => state.markup });
  dialog.querySelectorAll = (selector: string) => (selector === "*" ? [] : [state.field]);
  const foot = element("div", dialog);
  const post = element("div", foot, "button");
  (post as unknown as { ownerDocument: unknown }).ownerDocument = { documentElement: html };

  let note: ((signal: PressSignal) => void) | undefined;
  const queued: PressSignal[] = [];
  const probe = (_pressed: Element, onSignal: (signal: PressSignal) => void) => {
    note = onSignal;
    return { flush: () => queued.splice(0).forEach((signal) => note?.(signal)), stop: () => undefined };
  };
  const pending: Array<{ target: unknown }> = [];
  const observed = new Set<unknown>();
  const shadow = { nodeType: 11, host: body, querySelectorAll: () => [] };
  const shadowHosts = [{ shadowRoot: shadow }];
  html.querySelectorAll = () => shadowHosts;
  class DocumentObserver {
    observe(target: unknown) { observed.add(target); }
    takeRecords() {
      return pending.splice(0);
    }
    disconnect() {}
  }
  return {
    post: post as unknown as Element,
    state,
    look: () => lookUntilSettled(post as unknown as Element, probe, { MutationObserver: DocumentObserver as unknown as typeof MutationObserver }),
    /** The dialog's markup becomes `markup`, as a change inside the press's section. */
    show(markup: string) {
      state.markup = markup;
      queued.push("change");
    },
    signal: (signal: PressSignal) => queued.push(signal),
    /** Something outside the dialog changed: a toast added to the body. */
    elsewhere: () => pending.push({ target: body }),
    inOtherShadowRoot: () => { if (observed.has(shadow)) pending.push({ target: shadow }); },
    attachOtherShadowRoot: () => shadowHosts.push({ shadowRoot: { nodeType: 11, host: body, querySelectorAll: () => [] } })
  };
}

test("a button that shows a brief busy state and then reverts, leaving the page as it was, certainly did nothing", async () => {
  const page = composer();
  const look = page.look();
  page.show(BUSY);
  setTimeout(() => page.show(IDLE), 120);
  const started = Date.now();
  assert.equal(await look.settle(1_500), true);
  assert.ok(Date.now() - started >= 300, "read only once the section had been quiet");
  assert.ok(Date.now() - started < 1_200, "read as soon as it was quiet, not at the end of the window");
});

test("a change in the section that stays is an answer, read once it has held still, before the window ends", async () => {
  const page = composer();
  const look = page.look();
  page.show(BUSY);
  setTimeout(() => page.show(POSTED), 120);
  const started = Date.now();
  assert.equal(await look.settle(5_000), false);
  assert.ok(Date.now() - started < 1_500, "a press that opened something waits for it to hold still, not for the whole window");
});

test("a busy state that holds still for a while before it reverts is still waited out", async () => {
  const page = composer();
  const look = page.look();
  page.show(BUSY);
  setTimeout(() => page.show(IDLE), 450);
  assert.equal(await look.settle(1_500), true);
});

test("a section still busy when the window ends is not certain", async () => {
  const page = composer();
  const look = page.look();
  page.show(BUSY);
  assert.equal(await look.settle(400), false);
});

test("a change anywhere outside the press's section is an answer, however the section settled", async () => {
  const page = composer();
  const look = page.look();
  page.show(BUSY);
  setTimeout(() => {
    page.elsewhere();
    page.show(IDLE);
  }, 120);
  assert.equal(await look.settle(1_500), false);
});

test("a request, a navigation or a focus move at any point is an answer, though the section came back", async () => {
  for (const signal of ["request", "navigation", "focus"] as PressSignal[]) {
    const page = composer();
    const look = page.look();
    page.show(BUSY);
    setTimeout(() => {
      page.signal(signal);
      page.show(IDLE);
    }, 120);
    assert.equal(await look.settle(1_500), false, signal);
  }
});

test("a field whose held value changed is an answer, though its markup did not", async () => {
  const page = composer();
  const look = page.look();
  page.show(BUSY);
  setTimeout(() => {
    page.state.field.value = "cleared";
    page.show(IDLE);
  }, 120);
  assert.equal(await look.settle(1_500), false);
});

test("a page the look cannot read -- no document -- is never certain", async () => {
  const look = lookUntilSettled({} as Element);
  assert.equal(await look.settle(1_500), false);
});

test("a look stopped before it settles is not certain", async () => {
  const page = composer();
  const look = page.look();
  look.stop();
  assert.equal(await look.settle(1_500), false);
});

test("a change in an unrelated shadow root prevents a certain-no-effect answer", async () => {
  const page = composer();
  const look = page.look();
  page.inOtherShadowRoot();
  assert.equal(await look.settle(1_500), false);
});

test("a look stopped during its settle cannot later claim certainty", async () => {
  const page = composer();
  const look = page.look();
  const settling = look.settle(1_500);
  look.stop();
  assert.equal(await settling, false);
});

test("a shadow root attached after observation starts invalidates certainty even without a document mutation", async () => {
  const page = composer();
  const look = page.look();
  page.attachOtherShadowRoot();
  assert.equal(await look.settle(1_500), false);
});
