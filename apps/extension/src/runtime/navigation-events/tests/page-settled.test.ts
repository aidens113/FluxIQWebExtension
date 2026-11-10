// The function injected into a page to ask whether it has finished the work it
// scheduled for itself (task speed S10): no answer without a page world, at
// once when nothing is outstanding, otherwise on the drained event, confirmed a
// task later with the document unchanged. The page is a stand-in window, a
// stand-in page world answering its two questions, and a stand-in observer.

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { pageSettledInPage } from "../page-settled";

const WATCHED = "fluxiq:page-work-watched";
const BUSY = "fluxiq:page-work-busy";
const DRAINED = "fluxiq:page-work-drained";

function page(t: TestContext, options: { watched?: boolean; busy?: boolean } = {}) {
  const globals = globalThis as Record<string, unknown>;
  const previous = { window: globals.window, document: globals.document, MutationObserver: globals.MutationObserver };
  const view = new EventTarget();
  let busy = options.busy ?? false;
  if (options.watched !== false) {
    view.addEventListener(WATCHED, (event) => event.preventDefault());
    view.addEventListener(BUSY, (event) => { if (busy) event.preventDefault(); });
  }
  const observers = new Set<() => void>();
  class ObserverStandin {
    constructor(private readonly callback: () => void) {}
    observe(): void { observers.add(this.callback); }
    disconnect(): void { observers.delete(this.callback); }
  }
  Object.assign(globals, { window: view, document: {}, MutationObserver: ObserverStandin });
  t.after(() => { Object.assign(globals, previous); });
  return {
    drain: () => { busy = false;
      view.dispatchEvent(new Event(DRAINED)); },
    mutate: () => { for (const observer of observers) observer(); },
    observing: () => observers.size
  };
}

const ask = () => pageSettledInPage(WATCHED, BUSY, DRAINED);

test("no page world counting answers false at once, and the worker keeps the old second", async (t) => {
  page(t, { watched: false });
  assert.equal(await ask(), false);
});

test("a page with nothing outstanding and nothing changing is settled a task later", async (t) => {
  const p = page(t);
  assert.equal(await ask(), true);
  assert.equal(p.observing(), 0, "the observer is let go");
});

test("a busy page is settled only after its work drains, and not while its document is still changing", async (t) => {
  const p = page(t, { busy: true });
  let settled = false;
  const answer = ask().then((value) => { settled = value; });
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(settled, false, "work is outstanding");
  p.drain();
  p.mutate();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(settled, false, "a document changed in the task it drained in is looked at again");
  await answer;
  assert.equal(settled, true);
});
