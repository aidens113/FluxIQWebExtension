// A tab's navigation epoch (task speed S3): every top-frame navigation event
// the browser reports moves it, a child frame's never does, and nothing is
// listened to until an epoch is first read.

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { tabNavigationEpochs } from "..";

type Listener = (...args: never[]) => void;

function stubEvents(t: TestContext): Record<string, Listener[]> {
  const listeners: Record<string, Listener[]> = {};
  const event = (name: string) => ({ addListener: (listener: Listener) => { (listeners[name] ??= []).push(listener); } });
  const holder = globalThis as { chrome?: unknown };
  const previous = holder.chrome;
  holder.chrome = {
    webNavigation: { onBeforeNavigate: event("beforeNavigate"), onCommitted: event("committed"), onCompleted: event("completed"), onErrorOccurred: event("error"), onHistoryStateUpdated: event("historyState"), onReferenceFragmentUpdated: event("fragment") },
    tabs: { onUpdated: event("updated"), onReplaced: event("replaced"), onRemoved: event("removed") }
  };
  tabNavigationEpochs.resetForTest();
  t.after(() => {
    holder.chrome = previous;
    tabNavigationEpochs.resetForTest();
  });
  return listeners;
}

function fire(listeners: Record<string, Listener[]>, name: string, ...args: unknown[]): void {
  for (const listener of listeners[name] ?? []) (listener as (...values: unknown[]) => void)(...args);
}

test("listens only once an epoch is read, and then counts every top-frame navigation event of the tab", (t) => {
  const listeners = stubEvents(t);
  assert.deepEqual(Object.keys(listeners), [], "nothing is added on import");
  assert.equal(tabNavigationEpochs.of(7), 0);
  fire(listeners, "beforeNavigate", { tabId: 7, frameId: 0 });
  fire(listeners, "committed", { tabId: 7, frameId: 0 });
  fire(listeners, "historyState", { tabId: 7, frameId: 0 });
  fire(listeners, "fragment", { tabId: 7, frameId: 0 });
  assert.equal(tabNavigationEpochs.of(7), 4);
  assert.equal(tabNavigationEpochs.of(8), 0, "another tab's events are its own");
});

test("a child frame's navigation, or a tab update (a child frame loading, a title) does not move the epoch", (t) => {
  const listeners = stubEvents(t);
  tabNavigationEpochs.of(7);
  fire(listeners, "beforeNavigate", { tabId: 7, frameId: 4 });
  fire(listeners, "committed", { tabId: 7, frameId: 4 });
  fire(listeners, "updated", 7, { status: "loading" });
  fire(listeners, "updated", 7, { title: "Cart (2)" });
  assert.equal(tabNavigationEpochs.of(7), 0);
});

test("a replaced tab moves both ids, and a closed tab is forgotten", (t) => {
  const listeners = stubEvents(t);
  tabNavigationEpochs.of(7);
  fire(listeners, "replaced", 9, 7);
  assert.equal(tabNavigationEpochs.of(7), 1);
  assert.equal(tabNavigationEpochs.of(9), 1);
  fire(listeners, "removed", 9);
  assert.equal(tabNavigationEpochs.of(9), 0);
  assert.equal((listeners.beforeNavigate ?? []).length, 1, "listeners are added once");
});

// Task speed S10: whether a tab's page is still moving, by the same events.
test("a top-frame navigation is in flight from its beginning until it loads or ends without a document", (t) => {
  const listeners = stubEvents(t);
  assert.equal(tabNavigationEpochs.inFlight(7), false);
  fire(listeners, "beforeNavigate", { tabId: 7, frameId: 0 });
  fire(listeners, "beforeNavigate", { tabId: 8, frameId: 3 });
  assert.equal(tabNavigationEpochs.inFlight(7), true);
  assert.equal(tabNavigationEpochs.inFlight(8), false, "a child frame's navigation is not the page's");
  fire(listeners, "completed", { tabId: 7, frameId: 0 });
  assert.equal(tabNavigationEpochs.inFlight(7), false);
  fire(listeners, "beforeNavigate", { tabId: 7, frameId: 0 });
  fire(listeners, "error", { tabId: 7, frameId: 0 });
  assert.equal(tabNavigationEpochs.inFlight(7), false, "a download or an abort ends it too");
});

// Task speed S10 (t893): a readiness proof follows its document across a move that stays in it.
test("the document epoch moves when the top document is replaced, and not when the address moves within it", (t) => {
  const listeners = stubEvents(t);
  assert.equal(tabNavigationEpochs.documentOf(7), 0);
  fire(listeners, "historyState", { tabId: 7, frameId: 0 });
  fire(listeners, "fragment", { tabId: 7, frameId: 0 });
  assert.equal(tabNavigationEpochs.documentOf(7), 0, "pushState and a fragment stay in the document");
  assert.equal(tabNavigationEpochs.of(7), 2, "though the navigation epoch counts them");
  fire(listeners, "beforeNavigate", { tabId: 7, frameId: 3 });
  fire(listeners, "committed", { tabId: 7, frameId: 3 });
  assert.equal(tabNavigationEpochs.documentOf(7), 0, "a child frame's document is not the page's");
  fire(listeners, "beforeNavigate", { tabId: 7, frameId: 0 });
  fire(listeners, "committed", { tabId: 7, frameId: 0 });
  assert.equal(tabNavigationEpochs.documentOf(7), 2);
  fire(listeners, "replaced", 9, 7);
  assert.equal(tabNavigationEpochs.documentOf(7), 3);
  assert.equal(tabNavigationEpochs.documentOf(9), 1);
  fire(listeners, "removed", 7);
  assert.equal(tabNavigationEpochs.documentOf(7), 0, "a closed tab is forgotten");
});
