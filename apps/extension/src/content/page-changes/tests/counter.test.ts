// This frame's change count (task speed S4), on a stand-in document: a
// mutation between two looks moves it, so does typing, scrolling, focus or the
// document beginning to go, and a change to FluxIQ's own closed UI host alone
// does not. The live page proof is the provider-free Lab attempts on the
// realistic scenarios.

import assert from "node:assert/strict";
import { test } from "node:test";

type Record = { type: string; target: unknown; addedNodes: unknown[]; removedNodes: unknown[] };

const listeners: { [type: string]: Array<() => void> } = {};
let pending: Record[] = [];
let deliver: ((records: Record[]) => void) | undefined;
const observed: unknown[] = [];

class FakeElement {
  shadowRoot: unknown = null;
  firstChild: unknown = null;
  querySelectorAll(): FakeElement[] { return []; }
}

const holder = globalThis as unknown as { [key: string]: unknown };
const on = (type: string, listener: () => void) => { (listeners[type] ??= []).push(listener); };
const fakes: { [key: string]: unknown } = {
  Element: FakeElement,
  MutationObserver: class {
    constructor(callback: (records: Record[]) => void) { deliver = callback; }
    observe(target: unknown): void { observed.push(target); }
    takeRecords(): Record[] {
      const taken = pending;
      pending = [];
      return taken;
    }
  },
  document: { documentElement: new FakeElement(), addEventListener: on, fonts: { addEventListener: on } },
  window: { addEventListener: on }
};

/** `work` with the stand-in browser globals, put back as they were after: the extension's tests share one process. */
function withFakes(work: () => void): void {
  const previous = Object.fromEntries(Object.keys(fakes).map((key) => [key, holder[key]]));
  Object.assign(holder, fakes);
  try {
    work();
  } finally {
    Object.assign(holder, previous);
  }
}

const { pageChangeCounter } = await import("..");
const { ownedUiHosts } = await import("../../owned-ui");

/** The counter's mark, read with the stand-ins in place, as the counter reads them in a frame. */
function markOf(instance: string): { instance: string; changes: number } {
  let mark = { instance, changes: -1 };
  withFakes(() => { mark = pageChangeCounter.mark(instance); });
  return mark;
}

// Only the counter's own listeners are on the stand-ins, so firing one is the event reaching the counter alone.
const fire = (type: string) => { for (const listener of listeners[type] ?? []) listener(); };
const mutate = (record: Partial<Record> = {}) => { pending.push({ type: "childList", target: {}, addedNodes: [new FakeElement()], removedNodes: [], ...record }); };

test("a mutation between two looks moves the count, read even before the observer has delivered it", () => {
  withFakes(() => {
    pageChangeCounter.install();
    pageChangeCounter.install();
  });
  assert.equal(observed.length, 1, "installed once");
  const first = markOf("copy-1");
  assert.deepEqual(markOf("copy-1"), first, "nothing moved, the same mark");
  mutate();
  const second = markOf("copy-1");
  assert.equal(second.changes, first.changes + 1);
  // A batch the observer delivers on its own is counted too.
  withFakes(() => deliver?.([{ type: "attributes", target: new FakeElement(), addedNodes: [], removedNodes: [] }]));
  assert.equal(markOf("copy-1").changes, second.changes + 1);
});

const withMark = (): number => markOf("copy-1").changes;

test("typing, scrolling, focus, a resize and the document beginning to go each move the count", () => {
  for (const type of ["input", "change", "scroll", "focusin", "focusout", "toggle", "load", "transitionend", "pagehide", "beforeunload", "popstate", "hashchange", "resize", "loadingdone"]) {
    const before = markOf("copy-1").changes;
    fire(type);
    assert.equal(withMark(), before + 1, type);
  }
});

test("FluxIQ's own closed UI host changing alone does not move the count; the page beside it does", () => {
  const host = new FakeElement();
  ownedUiHosts.registerClosed(host as unknown as Element, { host: host as unknown as Element, mode: "closed" });
  const before = markOf("copy-1").changes;
  mutate({ type: "attributes", target: host, addedNodes: [] });
  mutate({ addedNodes: [host] });
  assert.equal(markOf("copy-1").changes, before);
  mutate({ addedNodes: [host, new FakeElement()] });
  assert.equal(markOf("copy-1").changes, before + 1);
});

test("the mark names the copy of the script that answers", () => {
  assert.equal(markOf("copy-2").instance, "copy-2");
});
