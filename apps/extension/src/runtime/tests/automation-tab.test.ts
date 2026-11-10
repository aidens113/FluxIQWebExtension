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
  currentAutomationTabId,
  forgetAutomationTab,
  latestOpenAutomationTab,
  noteSnapshotReadiness,
  readyFromSnapshot,
  resolveAutomationTab,
  setAutomationTab,
  waitForTabReady
} from "../automation-tab";
import { tabNavigationEpochs } from "../navigation-events";

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

function stubSnapshotDocument(t: TestContext): { replaceDocument(): void; navigationBegins(tabId: number, frameId?: number): void; storeProof(proof: Record<string, unknown>): Promise<void> } {
  const holder = globalThis as { chrome?: unknown };
  const previous = holder.chrome;
  const stored: Record<string, unknown> = {};
  let documentId = "document.one";
  const beforeNavigate: Array<(details: { tabId: number; frameId: number }) => void> = [];
  const quiet = { addListener: () => undefined, removeListener: () => undefined };
  holder.chrome = {
    runtime: {},
    tabs: {
      get: async () => ({ id: 7, url: "https://example.test/form", status: "complete" }),
      onUpdated: quiet, onReplaced: quiet, onRemoved: quiet
    },
    webNavigation: {
      getAllFrames: (_details: unknown, callback: (frames: unknown[]) => void) => callback([{ frameId: 0, documentId }]),
      onBeforeNavigate: { addListener: (listener: (details: { tabId: number; frameId: number }) => void) => beforeNavigate.push(listener) },
      onCommitted: quiet, onHistoryStateUpdated: quiet, onReferenceFragmentUpdated: quiet
    },
    storage: {
      session: {
        set: async (values: Record<string, unknown>) => Object.assign(stored, values),
        get: async (key: string) => ({ [key]: stored[key] }),
        remove: async (key: string) => void delete stored[key]
      }
    }
  };
  // Each test counts navigation events against its own stub, and starts with no proof.
  tabNavigationEpochs.resetForTest();
  forgetAutomationTab();
  t.after(() => {
    holder.chrome = previous;
    tabNavigationEpochs.resetForTest();
  });
  return {
    replaceDocument: () => { documentId = "document.two"; },
    navigationBegins: (tabId, frameId = 0) => { for (const listener of beforeNavigate) listener({ tabId, frameId }); },
    storeProof: async (proof) => {
      forgetAutomationTab();
      await Promise.resolve();
      stored.runtimeSnapshotReadinessProof = proof;
    }
  };
}

// Task speed S3: a look's proof stands across the act it precedes, so the look
// after the act needs no wait, until the browser reports the page moving.
test("a successful snapshot proves every following action on the same document ready, the look after an act included", async (t) => {
  stubSnapshotDocument(t);
  await noteSnapshotReadiness(7, "https://example.test/form");

  assert.equal(await readyFromSnapshot(7), true, "the act after the look");
  assert.equal(await readyFromSnapshot(7), true, "the look after the act: the proof survives the act");
  assert.equal(await readyFromSnapshot(8), false, "another tab is not proven by this one's look");
});

test("a page that navigates late ends the proof at the navigation event, and every action after it waits", async (t) => {
  const page = stubSnapshotDocument(t);
  await noteSnapshotReadiness(7, "https://example.test/form");
  assert.equal(await readyFromSnapshot(7), true, "nothing has navigated yet");
  // The press's own navigation begins after its look was taken: the document and address still read the same.
  page.navigationBegins(7);
  assert.equal(await readyFromSnapshot(7), false);
  assert.equal(await readyFromSnapshot(7), false, "the proof is forgotten, not merely refused once");
  // A look on the new document proves it in turn.
  await noteSnapshotReadiness(7, "https://example.test/form");
  assert.equal(await readyFromSnapshot(7), true);
});

// Task speed S10: a saved Flow's replay takes no look, so the wait itself must
// leave the proof, or every act of the replay waits its second again.
test("a tab found settled by waiting proves the following actions ready, until the page moves", async (t) => {
  const page = stubSnapshotDocument(t);
  assert.equal(await readyFromSnapshot(7), false, "nothing has proven the tab yet");
  await waitForTabReady(7);
  assert.equal(await readyFromSnapshot(7), true, "the act after the wait");
  assert.equal(await readyFromSnapshot(7), true, "and the one after it, on the same document");
  page.navigationBegins(7);
  assert.equal(await readyFromSnapshot(7), false, "a navigation event ends it");
});

test("another tab's or a child frame's navigation leaves the proof standing", async (t) => {
  const page = stubSnapshotDocument(t);
  await noteSnapshotReadiness(7, "https://example.test/form");
  page.navigationBegins(9);
  page.navigationBegins(7, 3);
  assert.equal(await readyFromSnapshot(7), true);
});

test("a same-URL replacement document cannot reuse the snapshot readiness proof", async (t) => {
  const page = stubSnapshotDocument(t);
  await noteSnapshotReadiness(7, "https://example.test/form");
  page.replaceDocument();

  assert.equal(await readyFromSnapshot(7), false);
});

test("a proof a worker kept before it restarted is used once, and only while it is fresh", async (t) => {
  const page = stubSnapshotDocument(t);
  await page.storeProof({ tabId: 7, url: "https://example.test/form", documentId: "document.one", capturedAt: Date.now(), epoch: 0, watcher: "a.worker.before" });
  assert.equal(await readyFromSnapshot(7), true);
  assert.equal(await readyFromSnapshot(7), false, "another worker's proof is consumed once");
  await page.storeProof({ tabId: 7, url: "https://example.test/form", documentId: "document.one", capturedAt: Date.now() - 60_000 });
  assert.equal(await readyFromSnapshot(7), false, "and refused once stale");
});
