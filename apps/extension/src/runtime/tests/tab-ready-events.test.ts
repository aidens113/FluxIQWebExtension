// A tab is ready when the browser's events say it has finished moving and the
// page says it has finished drawing itself (task speed S10,
// `../automation-tab.ts` `waitForTabReady`): its load complete, no address
// pending, no top-frame navigation in flight, the drive heard beginning, and
// the page's own work drained (`page-world/page-work/`, asked through
// `../navigation-events/page-work.ts`). The stable-address second it used to
// wait is kept only where nothing can speak for the page: no page world, or a
// refresh the page declares due within it. A move the page makes by itself
// later is a navigation event, which the next action waits out -- except a
// move inside the same document (`history.pushState`), which the proof follows
// and the content script waits out instead (t893).
//
// The browser is a stub that reports a navigation as Chrome does, and answers
// the two injected questions -- the page's own work, a declared refresh -- as
// each test says.

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { forgetAutomationTab, readyFromSnapshot, resolveAutomationTab, setAutomationTab, waitForTabReady } from "../automation-tab";
import { tabNavigationEpochs } from "../navigation-events";

const TAB = 7;
type Details = { tabId: number; frameId: number; url?: string };
type Listener = (details: Details) => void;

/** `pageWork`: how long the page's own work takes to drain once asked, or "no page world". */
function browser(t: TestContext, options: { pageWork?: number | "no page world"; refresh?: string; loadMs?: number } = {}) {
  const holder = globalThis as { chrome?: unknown };
  const previous = holder.chrome;
  const listeners: Record<string, Set<Listener>> = {};
  const event = (name: string) => {
    listeners[name] ??= new Set();
    return { addListener: (listener: Listener) => void listeners[name]!.add(listener), removeListener: (listener: Listener) => void listeners[name]!.delete(listener) };
  };
  const updated = new Set<(tabId: number, change: { status?: string }) => void>();
  const stored: Record<string, unknown> = {};
  const tab = { id: TAB, url: "https://kerbfind.test/", status: "complete", pendingUrl: undefined as string | undefined };
  let documents = 0;
  const fire = (name: string, details: Partial<Details> = {}) => { for (const listener of [...(listeners[name] ?? [])]) listener({ tabId: TAB, frameId: 0, ...details }); };
  const navigate = (url: string): Promise<void> => {
    tab.status = "loading";
    tab.pendingUrl = url;
    fire("onBeforeNavigate", { url });
    return new Promise((resolve) => setTimeout(() => {
      documents += 1;
      tab.url = url;
      tab.pendingUrl = undefined;
      fire("onCommitted", { url });
      tab.status = "complete";
      fire("onCompleted", { url });
      for (const listener of [...updated]) listener(TAB, { status: "complete" });
      resolve();
    }, options.loadMs ?? 30));
  };
  const pageWork = options.pageWork ?? 0;
  const quiet = { addListener: () => undefined, removeListener: () => undefined };
  holder.chrome = {
    runtime: {},
    tabs: {
      get: async (asked: number) => {
        if (asked !== TAB) throw new Error(`No tab with id: ${asked}.`);
        return { ...tab };
      },
      update: async (_asked: number, properties: { url?: string }) => {
        if (properties.url !== undefined) void navigate(properties.url);
      },
      reload: async () => void navigate(tab.url),
      onUpdated: { addListener: (listener: (tabId: number, change: object) => void) => void updated.add(listener), removeListener: (listener: (tabId: number, change: object) => void) => void updated.delete(listener) },
      onReplaced: quiet,
      onRemoved: quiet
    },
    webNavigation: {
      getAllFrames: (_details: unknown, callback: (frames: unknown[]) => void) => callback([{ frameId: 0, documentId: `document.${documents}` }]),
      onBeforeNavigate: event("onBeforeNavigate"),
      onCommitted: event("onCommitted"),
      onCompleted: event("onCompleted"),
      onErrorOccurred: event("onErrorOccurred"),
      onHistoryStateUpdated: event("onHistoryStateUpdated"),
      onReferenceFragmentUpdated: event("onReferenceFragmentUpdated")
    },
    scripting: {
      executeScript: async (details: { func: { name: string } }) => {
        if (details.func.name !== "pageSettledInPage") return [{ frameId: 0, result: options.refresh ?? null }];
        if (pageWork === "no page world") return [{ frameId: 0, result: false }];
        await new Promise((resolve) => setTimeout(resolve, pageWork));
        return [{ frameId: 0, result: true }];
      }
    },
    storage: { session: { set: async (values: Record<string, unknown>) => void Object.assign(stored, values), get: async (key: string) => ({ [key]: stored[key] }), remove: async (key: string) => void delete stored[key] } }
  };
  tabNavigationEpochs.resetForTest();
  tabNavigationEpochs.of(TAB);
  forgetAutomationTab();
  setAutomationTab(TAB);
  t.after(() => {
    holder.chrome = previous;
    tabNavigationEpochs.resetForTest();
    forgetAutomationTab();
  });
  return {
    navigate,
    /** The page rewrites its own address, as local-classifieds' sort does before it requests its results. */
    pushState: (url: string) => { tab.url = url;
      fire("onHistoryStateUpdated", { url }); }
  };
}

test("a driven navigation is ready once its load ends and its page has drained, with no second of standing still", async (t) => {
  browser(t);
  const startedAt = Date.now();
  const resolved = await resolveAutomationTab({ initialUrl: "https://kerbfind.test/search/?query=dining+table" });
  const waited = Date.now() - startedAt;
  t.diagnostic(`ready after ${waited} ms`);
  assert.equal(resolved.drive?.urlAfter, "https://kerbfind.test/search/?query=dining+table");
  assert.ok(waited < 500, `waited ${waited} ms`);
  assert.equal(await readyFromSnapshot(TAB), true, "the wait proves the landed document ready for the next action");
});

test("the listing: a page still drawing its panel after its load is ready only once that work drains", async (t) => {
  browser(t, { pageWork: 600 });
  const startedAt = Date.now();
  await resolveAutomationTab({ initialUrl: "https://kerbfind.test/item/table-1/" });
  assert.ok(Date.now() - startedAt >= 600, `waited ${Date.now() - startedAt} ms`);
});

test("the sort: an address rewritten in place leaves the proof standing, at the new address, for the content script to wait in (t893)", async (t) => {
  const page = browser(t, { pageWork: 400 });
  await resolveAutomationTab({ initialUrl: "https://kerbfind.test/search/?query=dining+table" });
  page.pushState("https://kerbfind.test/search/?query=dining+table&sortBy=price_ascend");
  // The same document: the worker does not wait for it. The page's redraw is
  // waited for by the first action on it, in the page
  // (`content/action-runtime/page-work/address-settle.ts`).
  const startedAt = Date.now();
  assert.equal(await readyFromSnapshot(TAB), true, "the document it proved is still the one there");
  assert.ok(Date.now() - startedAt < 400, `the worker asked the page nothing (${Date.now() - startedAt} ms)`);
  page.pushState("https://kerbfind.test/search/?query=dining+table&sortBy=price_ascend#top");
  assert.equal(await readyFromSnapshot(TAB), true, "it follows each move in the document");
});

test("a proof does not follow a document that was replaced, even back at the address it proved", async (t) => {
  const page = browser(t, { loadMs: 20 });
  await resolveAutomationTab({ initialUrl: "https://kerbfind.test/search/" });
  assert.equal(await readyFromSnapshot(TAB), true);
  await page.navigate("https://kerbfind.test/search/");
  assert.equal(await readyFromSnapshot(TAB), false, "a new document is not the one the look proved");
  assert.equal(await readyFromSnapshot(TAB), false, "and the proof, once failed, is forgotten");
});

test("with no page world to ask, or a refresh declared within the second, the old second is kept", async (t) => {
  browser(t, { pageWork: "no page world" });
  const startedAt = Date.now();
  await resolveAutomationTab({ initialUrl: "https://kerbfind.test/search/" });
  assert.ok(Date.now() - startedAt >= 950, `waited ${Date.now() - startedAt} ms`);
});

test("a page that declares a refresh due within the second keeps it, so its move begins before anything acts", async (t) => {
  browser(t, { refresh: "0; url=https://kerbfind.test/elsewhere" });
  const startedAt = Date.now();
  await resolveAutomationTab({ initialUrl: "https://kerbfind.test/leaving" });
  assert.ok(Date.now() - startedAt >= 950, `waited ${Date.now() - startedAt} ms`);
});

test("a script that sends the page on after it settled is caught: the next action waits for the new page", async (t) => {
  const page = browser(t, { loadMs: 150 });
  await resolveAutomationTab({ initialUrl: "https://kerbfind.test/checkout" });
  assert.equal(await readyFromSnapshot(TAB), true);
  const moved = page.navigate("https://kerbfind.test/thank-you?order=1");
  assert.equal(await readyFromSnapshot(TAB), false, "the page is moving: the proof is gone");
  const startedAt = Date.now();
  let ready = false;
  const waiting = waitForTabReady(TAB).then(() => { ready = true; });
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(ready, false, "nothing acts while the navigation is in flight");
  await moved;
  await waiting;
  assert.ok(Date.now() - startedAt >= 140, "it waited for the new page's load");
});
