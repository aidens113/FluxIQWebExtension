// The function the worker injects into a page, and the content script calls, to ask whether it has finished drawing
// what the next step will act on (task speed S10; t1094): no answer without a page world, at once when the page world
// says it is not busy, otherwise again a task after the drained event and every look in between -- work that changes
// nothing stops holding the page with time, not with an event -- and never past its bound. The page is a stand-in
// window and a stand-in page world answering its two questions.

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { pageSettledInPage } from "../scheduled-work-settled";

const WATCHED = "fluxiq:page-work-watched";
const BUSY = "fluxiq:page-work-busy";
const DRAINED = "fluxiq:page-work-drained";

function page(t: TestContext, options: { watched?: boolean; busy?: boolean } = {}) {
  const globals = globalThis as Record<string, unknown>;
  const previous = { window: globals.window };
  const view = new EventTarget();
  let busy = options.busy ?? false;
  let asked = 0;
  const listening = new Set<unknown>();
  const add = view.addEventListener.bind(view);
  const remove = view.removeEventListener.bind(view);
  view.addEventListener = (type: string, listener: EventListenerOrEventListenerObject | null, ...rest: unknown[]) => {
    if (type === DRAINED) listening.add(listener);
    add(type, listener, ...(rest as []));
  };
  view.removeEventListener = (type: string, listener: EventListenerOrEventListenerObject | null, ...rest: unknown[]) => {
    if (type === DRAINED) listening.delete(listener);
    remove(type, listener, ...(rest as []));
  };
  if (options.watched !== false) {
    add(WATCHED, (event) => event.preventDefault());
    add(BUSY, (event) => { asked += 1;
      if (busy) event.preventDefault(); });
  }
  Object.assign(globals, { window: view });
  t.after(() => { Object.assign(globals, previous); });
  return {
    drain: () => { busy = false;
      view.dispatchEvent(new Event(DRAINED)); },
    /** The page world stops holding the page with time: no drained event. */
    settleQuietly: () => { busy = false; },
    asked: () => asked,
    listening: () => listening.size
  };
}

const later = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("no page world counting answers false at once, and the worker keeps the old second", async (t) => {
  page(t, { watched: false });
  assert.equal(await pageSettledInPage(WATCHED, BUSY, DRAINED), false);
});

test("a page the page world calls settled is settled at once, with nothing left listening", async (t) => {
  const p = page(t);
  assert.equal(await pageSettledInPage(WATCHED, BUSY, DRAINED), true);
  assert.equal(p.asked(), 1);
  assert.equal(p.listening(), 0);
});

test("a busy page is asked again a task after its work drains, not inside the task that drained it", async (t) => {
  const p = page(t, { busy: true });
  let settled = false;
  const answer = pageSettledInPage(WATCHED, BUSY, DRAINED).then((value) => { settled = value; });
  await later(10);
  assert.equal(settled, false, "work is outstanding");
  const before = p.asked();
  p.drain();
  assert.equal(p.asked(), before, "not asked within the page's own task: what it awaited may begin the next piece");
  await answer;
  assert.equal(settled, true);
  assert.equal(p.listening(), 0, "nothing is left listening");
});

test("a page that stops being busy with time, with no drained event, is found settled by looking again (t1094)", async (t) => {
  const p = page(t, { busy: true });
  const answer = pageSettledInPage(WATCHED, BUSY, DRAINED, { withinMs: 2_000 });
  await later(20);
  p.settleQuietly();
  const startedAt = Date.now();
  assert.equal(await answer, true);
  assert.ok(Date.now() - startedAt < 500, `found within a look or two (${Date.now() - startedAt} ms)`);
});

test("a page that never settles is answered false at the bound, with nothing left listening or looking (t1094)", async (t) => {
  const p = page(t, { busy: true });
  const startedAt = Date.now();
  assert.equal(await pageSettledInPage(WATCHED, BUSY, DRAINED, { withinMs: 120 }), false);
  assert.ok(Date.now() - startedAt >= 100, `waited ${Date.now() - startedAt} ms`);
  assert.equal(p.listening(), 0);
  const asked = p.asked();
  await later(150);
  assert.equal(p.asked(), asked, "nothing asks the page after the bound");
});

test("an asker that stops waiting is answered false, and nothing is left listening (t893)", async (t) => {
  const p = page(t, { busy: true });
  const controller = new AbortController();
  const answer = pageSettledInPage(WATCHED, BUSY, DRAINED, { signal: controller.signal });
  await later(10);
  assert.equal(p.listening(), 1);
  controller.abort();
  assert.equal(await answer, false);
  assert.equal(p.listening(), 0);
  p.drain();
  await later(5);
});

test("an asker that has already stopped is answered false at once", async (t) => {
  const p = page(t);
  const controller = new AbortController();
  controller.abort();
  assert.equal(await pageSettledInPage(WATCHED, BUSY, DRAINED, { signal: controller.signal }), false);
  assert.equal(p.asked(), 0);
});
