// T1 coverage of what counts as the page answering a press
// (`page-press-listener.ts`). No DOM library is installed, so the page is faked
// at what the listener reads: the `MutationObserver`, `PerformanceObserver` and
// `performance` it is handed, the pressed element's window's events, and the
// document's address and `focusin`. Each row states what the page did and
// checks the sign reported. Whether a real browser delivers these the same way
// is for a live run on the realistic scenarios, not this file.

import assert from "node:assert/strict";
import test from "node:test";
import { listenForPressAnswer, type PressPage } from "../page-press-listener";
import type { PressSignal } from "../press-again";

type Listener = (event: { target?: unknown }) => void;

/** An event target that records its listeners and can fire them. */
function eventTarget() {
  const listeners = new Map<string, Set<Listener>>();
  return {
    listeners,
    addEventListener(type: string, listener: Listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    },
    removeEventListener(type: string, listener: Listener) {
      listeners.get(type)?.delete(listener);
    },
    fire(type: string, event: { target?: unknown } = {}) {
      for (const listener of listeners.get(type) ?? []) listener(event);
    },
    count: () => [...listeners.values()].reduce((sum, set) => sum + set.size, 0)
  };
}

type FakeNode = { name: string; nodeType: 1; tagName: string; parentElement: FakeNode | null; parentNode: FakeNode | null; ownerDocument: unknown; getAttribute(name: string): null };

type ResourceEntry = { startTime: number; initiatorType: string };

/** A page: body > section > row > button, plus a widget appended to the body, with fakes for every observer. */
function fakePage(options: { performanceObserver?: boolean } = {}) {
  const view = eventTarget();
  const navigation = eventTarget();
  const document = { ...eventTarget(), location: { href: "http://127.0.0.1:4000/ip/1" }, defaultView: undefined as unknown };
  const node = (name: string, tag: string, parent: FakeNode | null): FakeNode => ({
    name,
    nodeType: 1,
    tagName: tag.toUpperCase(),
    parentElement: parent,
    parentNode: parent,
    ownerDocument: document,
    getAttribute: () => null
  });
  const body = node("body", "body", null);
  const section = node("section", "section", body);
  const row = node("row", "div", section);
  const button = node("button", "button", row);
  const label = node("label", "span", button);
  const widget = node("widget", "div", body);

  const mutations = { observed: [] as Array<{ target: FakeNode; init: MutationObserverInit }>, pending: 0, notify: undefined as (() => void) | undefined, disconnected: 0 };
  class FakeMutationObserver {
    constructor(callback: (records: unknown[]) => void) {
      mutations.notify = () => callback([{}]);
    }
    observe(target: FakeNode, init: MutationObserverInit) {
      mutations.observed.push({ target, init });
    }
    takeRecords() {
      const records = Array.from({ length: mutations.pending }, () => ({}));
      mutations.pending = 0;
      return records;
    }
    disconnect() {
      mutations.disconnected += 1;
    }
  }

  let now = 1_000;
  const timeline: ResourceEntry[] = [];
  const resources = { pending: [] as ResourceEntry[], deliver: undefined as ((entries: ResourceEntry[]) => void) | undefined, disconnected: 0 };
  class FakePerformanceObserver {
    constructor(callback: (list: { getEntries(): ResourceEntry[] }) => void) {
      resources.deliver = (entries) => callback({ getEntries: () => entries });
    }
    observe() {}
    takeRecords() {
      return resources.pending.splice(0);
    }
    disconnect() {
      resources.disconnected += 1;
    }
  }

  Object.assign(view, { navigation });
  document.defaultView = view;
  const environment: PressPage = {
    MutationObserver: FakeMutationObserver as unknown as typeof MutationObserver,
    PerformanceObserver: options.performanceObserver === false ? undefined : (FakePerformanceObserver as unknown as typeof PerformanceObserver),
    performance: { now: () => now, getEntriesByType: () => [...timeline] } as unknown as Performance
  };

  const seen: PressSignal[] = [];
  const listener = listenForPressAnswer(label as unknown as Element, (signal) => seen.push(signal), environment);
  now = 1_010;
  return {
    seen,
    listener,
    view,
    navigation,
    document,
    elements: { body, section, row, button, label, widget },
    mutations,
    /** A request the page began `offsetMs` after (or, negative, before) the press, queued for the next flush. */
    request(initiatorType: string, offsetMs = 5) {
      const entry = { startTime: 1_000 + offsetMs, initiatorType };
      resources.pending.push(entry);
      timeline.push(entry);
    },
    resources
  };
}

test("a change inside the pressed control's section is an answer, whether delivered or still queued", () => {
  const page = fakePage();
  assert.equal(page.mutations.observed.length, 1);
  assert.equal(page.mutations.observed[0]?.target, page.elements.section, "the section around the control is what is observed, not the body");
  assert.deepEqual(page.mutations.observed[0]?.init, { childList: true, subtree: true, attributes: true, characterData: true });
  page.mutations.pending = 1;
  page.listener.flush();
  assert.deepEqual(page.seen, ["change"]);
  page.mutations.notify?.();
  assert.deepEqual(page.seen, ["change", "change"]);
});

test("a page that did nothing reports nothing", () => {
  const page = fakePage();
  page.listener.flush();
  assert.deepEqual(page.seen, []);
});

test("a fetch, an XMLHttpRequest or a beacon begun after the press is a request", () => {
  for (const initiator of ["fetch", "xmlhttprequest", "beacon"]) {
    const page = fakePage();
    page.request(initiator);
    page.listener.flush();
    assert.deepEqual(page.seen, ["request"], initiator);
  }
});

test("an image loading, or a request begun before the press, is no answer to it", () => {
  const page = fakePage();
  page.request("img");
  page.request("fetch", -200);
  page.listener.flush();
  assert.deepEqual(page.seen, []);
});

test("a request the observer delivers on its own is reported without a flush", () => {
  const page = fakePage();
  page.resources.deliver?.([{ startTime: 1_020, initiatorType: "fetch" }]);
  assert.deepEqual(page.seen, ["request"]);
});

test("without a PerformanceObserver the timeline itself is read", () => {
  const page = fakePage({ performanceObserver: false });
  page.listener.flush();
  assert.deepEqual(page.seen, []);
  page.request("xmlhttprequest");
  page.listener.flush();
  assert.deepEqual(page.seen, ["request"]);
});

test("the document starting to leave, a Navigation API navigate, or a moved address is a navigation", () => {
  for (const leave of ["beforeunload", "pagehide"]) {
    const page = fakePage();
    page.view.fire(leave);
    assert.deepEqual(page.seen, ["navigation"], leave);
  }
  const navigated = fakePage();
  navigated.navigation.fire("navigate");
  assert.deepEqual(navigated.seen, ["navigation"]);
  const moved = fakePage();
  moved.document.location.href = "http://127.0.0.1:4000/checkout";
  moved.listener.flush();
  assert.deepEqual(moved.seen, ["navigation"]);
});

test("the press's own focus move, onto the control or an ancestor holding it, is not counted", () => {
  const page = fakePage();
  page.document.fire("focusin", { target: page.elements.button });
  page.document.fire("focusin", { target: page.elements.label });
  page.document.fire("focusin", { target: page.elements.section });
  assert.deepEqual(page.seen, []);
});

test("focus moving to an element outside the pressed control is an answer", () => {
  const page = fakePage();
  page.document.fire("focusin", { target: page.elements.widget });
  assert.deepEqual(page.seen, ["focus"]);
});

test("stopping disconnects both observers and removes every listener", () => {
  const page = fakePage();
  page.listener.stop();
  page.listener.stop();
  assert.equal(page.mutations.disconnected, 1);
  assert.equal(page.resources.disconnected, 1);
  assert.equal(page.view.count(), 0);
  assert.equal(page.navigation.count(), 0);
  assert.equal(page.document.count(), 0);
  page.request("fetch");
  page.listener.flush();
  assert.deepEqual(page.seen, [], "a stopped listener reports nothing");
});
