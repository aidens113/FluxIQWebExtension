// Coverage of automation-tab.ts's memory of driven tabs: the automation tab is
// the one set last, forgetting it returns to the tab driven before it, and the
// most recent tab still open is found past tabs that have since closed.
//
// And of what driving a tab reports about itself. A drive's record is the only
// evidence that a navigation was any work: the address reads the same whether
// the browser loaded the page again or ignored the request, so the rows below
// drive a stub that acts on what it is asked and one that does not, and hold
// the record to telling them apart.

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import {
  consumeSnapshotReadiness,
  currentAutomationTabId,
  forgetAutomationTab,
  latestOpenAutomationTab,
  noteSnapshotReadiness,
  resolveAutomationTab,
  setAutomationTab
} from "../automation-tab";

function stubOpenTabs(t: TestContext, open: ReadonlySet<number>): void {
  const holder = globalThis as { chrome?: unknown };
  const previous = holder.chrome;
  holder.chrome = {
    tabs: {
      get: async (tabId: number) => {
        if (!open.has(tabId)) throw new Error(`No tab with id: ${tabId}.`);
        return { id: tabId };
      }
    }
  };
  t.after(() => {
    holder.chrome = previous;
  });
}

test("the automation tab is the one set last, and forgetting it returns to the tab driven before it", () => {
  forgetAutomationTab();
  setAutomationTab(1);
  setAutomationTab(2);
  setAutomationTab(3);
  setAutomationTab(2);
  assert.equal(currentAutomationTabId(), 2, "setting a remembered tab again makes it current");
  forgetAutomationTab(2);
  assert.equal(currentAutomationTabId(), 3);
  forgetAutomationTab(1);
  assert.equal(currentAutomationTabId(), 3, "forgetting an earlier tab leaves the current one");
  forgetAutomationTab();
  assert.equal(currentAutomationTabId(), undefined);
});

test("only the eight most recently driven tabs are remembered", () => {
  forgetAutomationTab();
  for (let tabId = 1; tabId <= 10; tabId += 1) setAutomationTab(tabId);
  const remembered: number[] = [];
  for (let tabId = currentAutomationTabId(); tabId !== undefined; tabId = currentAutomationTabId()) {
    remembered.push(tabId);
    forgetAutomationTab(tabId);
  }
  assert.deepEqual(remembered, [10, 9, 8, 7, 6, 5, 4, 3]);
});

test("the latest open automation tab skips, and forgets, tabs that have closed", async (t) => {
  stubOpenTabs(t, new Set([4]));
  forgetAutomationTab();
  setAutomationTab(4);
  setAutomationTab(5);
  setAutomationTab(6);
  assert.equal(await latestOpenAutomationTab(), 4);
  assert.equal(currentAutomationTabId(), 4);

  forgetAutomationTab(4);
  assert.equal(await latestOpenAutomationTab(), undefined);
});

// Chrome ignores a `tabs.update` to the address the tab already shows. A Flow
// whose opening navigate names the page the tab is already on therefore did
// nothing at all, and inherited whatever the last thing to touch that tab had
// left on it -- which is how a dialog opened while the Flow was being authored
// was still up when the Flow ran, and blocked its first step. A navigation
// means "be on this page", not "be on this page unless you already are".
function stubDrivableTab(t: TestContext, tabId: number, url: string, options: { loads?: boolean } = {}): { updates: unknown[]; reloads: number[] } {
  const holder = globalThis as { chrome?: unknown };
  const previous = holder.chrome;
  const updates: unknown[] = [];
  const reloads: number[] = [];
  const loads = options.loads ?? true;
  let current = url;
  let documents = 0;
  holder.chrome = {
    tabs: {
      get: async (asked: number) => {
        if (asked !== tabId) throw new Error(`No tab with id: ${asked}.`);
        return { id: tabId, url: current, title: "Queue", status: "complete" };
      },
      update: async (_asked: number, properties: unknown) => {
        updates.push(properties);
        const asked = (properties as { url?: string }).url;
        // A browser that acts on the update replaces the document; one that
        // does not -- `loads: false` -- leaves the tab exactly as it was.
        if (asked !== undefined && loads) {
          current = asked;
          documents += 1;
        }
      },
      reload: async (asked: number) => {
        reloads.push(asked);
        if (loads) documents += 1;
      },
      onUpdated: { addListener: () => undefined, removeListener: () => undefined },
    },
    // The top frame's document UUID, which changes for every document the
    // browser loads. It is the only evidence that a reload happened.
    webNavigation: {
      getAllFrames: (_details: { tabId: number }, callback: (frames: unknown[]) => void) =>
        callback([{ frameId: 0, documentId: `document.${documents}` }])
    },
    runtime: {},
  };
  t.after(() => {
    holder.chrome = previous;
  });
  return { updates, reloads };
}

test("a navigation to the page the tab already shows reloads it, so nothing is inherited", async (t) => {
  const driven = stubDrivableTab(t, 7, "https://example.test/queue");
  forgetAutomationTab();
  setAutomationTab(7);

  const resolved = await resolveAutomationTab({ initialUrl: "https://example.test/queue" });

  assert.equal(resolved.tabId, 7);
  assert.deepEqual(driven.reloads, [7]);
  // Brought forward, but never asked to navigate to where it already is.
  assert.deepEqual(driven.updates, [{ active: true }]);
  // And the record says the reload was a reload, and that it happened: the
  // address alone reads the same either way.
  assert.equal(resolved.drive?.reloaded, true);
  assert.equal(resolved.drive?.urlBefore, "https://example.test/queue");
  assert.notEqual(resolved.drive?.documentBefore, resolved.drive?.documentAfter);
});

test("a reload the browser does not act on leaves a record that says so", async (t) => {
  const driven = stubDrivableTab(t, 7, "https://example.test/queue", { loads: false });
  forgetAutomationTab();
  setAutomationTab(7);

  const resolved = await resolveAutomationTab({ initialUrl: "https://example.test/queue" });

  assert.deepEqual(driven.reloads, [7], "the reload was asked for");
  assert.equal(resolved.drive?.documentBefore, resolved.drive?.documentAfter, "and the tab kept the document it had");
  assert.equal(resolved.drive?.urlBefore, resolved.drive?.urlAfter);
});

test("a navigation somewhere else drives the tab there, and does not reload", async (t) => {
  const driven = stubDrivableTab(t, 7, "https://example.test/queue");
  forgetAutomationTab();
  setAutomationTab(7);

  const resolved = await resolveAutomationTab({ initialUrl: "https://example.test/orders" });

  assert.equal(resolved.tabId, 7);
  assert.deepEqual(driven.reloads, []);
  assert.deepEqual(driven.updates, [{ url: "https://example.test/orders", active: true }]);
  assert.deepEqual(
    { before: resolved.drive?.urlBefore, after: resolved.drive?.urlAfter, reloaded: resolved.drive?.reloaded },
    { before: "https://example.test/queue", after: "https://example.test/orders", reloaded: false }
  );
});

function stubSnapshotDocument(t: TestContext): { replaceDocument(): void } {
  const holder = globalThis as { chrome?: unknown };
  const previous = holder.chrome;
  const stored: Record<string, unknown> = {};
  let documentId = "document.one";
  holder.chrome = {
    runtime: {},
    tabs: {
      get: async () => ({ id: 7, url: "https://example.test/form", status: "complete" })
    },
    webNavigation: {
      getAllFrames: (_details: unknown, callback: (frames: unknown[]) => void) => callback([{ frameId: 0, documentId }])
    },
    storage: {
      session: {
        set: async (values: Record<string, unknown>) => Object.assign(stored, values),
        get: async (key: string) => ({ [key]: stored[key] }),
        remove: async (key: string) => void delete stored[key]
      }
    }
  };
  t.after(() => {
    holder.chrome = previous;
  });
  return { replaceDocument: () => { documentId = "document.two"; } };
}

test("a successful snapshot proves only the immediately following action on the same document is ready", async (t) => {
  stubSnapshotDocument(t);
  await noteSnapshotReadiness(7, "https://example.test/form");

  assert.equal(await consumeSnapshotReadiness(7), true);
  assert.equal(await consumeSnapshotReadiness(7), false, "the proof is consumed once");
});

test("a same-URL replacement document cannot reuse the snapshot readiness proof", async (t) => {
  const page = stubSnapshotDocument(t);
  await noteSnapshotReadiness(7, "https://example.test/form");
  page.replaceDocument();

  assert.equal(await consumeSnapshotReadiness(7), false);
});
