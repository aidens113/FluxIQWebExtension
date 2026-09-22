// Coverage of navigation-target.ts: which tab a navigation that names none
// drives. The page in front is driven when a navigation may take it over; a
// browser or extension page, FluxIQ's own panel, and a tab whose URL cannot be
// read are not, and the runner falls back to the tab it last drove.

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { navigationTargetTab } from "../navigation-target";

const PANEL = "http://127.0.0.1:3300";

function stubTabs(t: TestContext, urls: Readonly<Record<number, string | undefined>>): void {
  const holder = globalThis as { chrome?: unknown };
  const previous = holder.chrome;
  holder.chrome = {
    tabs: {
      get: async (tabId: number) => {
        if (!(tabId in urls)) throw new Error(`No tab with id: ${tabId}.`);
        return { id: tabId, url: urls[tabId] };
      }
    }
  };
  t.after(() => {
    holder.chrome = previous;
  });
}

test("the page in front is driven when it is an ordinary page", async (t) => {
  stubTabs(t, { 7: "http://127.0.0.1:64130/scenarios/everything-store/" });
  assert.equal(await navigationTargetTab(7, [PANEL]), 7);
});

test("nothing in front means the runner falls back", async (t) => {
  stubTabs(t, {});
  assert.equal(await navigationTargetTab(undefined, [PANEL]), undefined);
});

test("a browser or extension page in front is never taken over", async (t) => {
  stubTabs(t, { 1: "chrome://newtab/", 2: "chrome-extension://abc/popup.html", 3: "about:blank" });
  for (const tabId of [1, 2, 3]) assert.equal(await navigationTargetTab(tabId, [PANEL]), undefined, `tab ${tabId}`);
});

test("FluxIQ's own panel in front is never taken over, whatever its path", async (t) => {
  stubTabs(t, { 4: "http://127.0.0.1:3300/programs/automation-studio?project=p" });
  assert.equal(await navigationTargetTab(4, [PANEL]), undefined);
  // Another port on the same host is another origin: a site served beside the panel is still a page.
  stubTabs(t, { 5: "http://127.0.0.1:3301/" });
  assert.equal(await navigationTargetTab(5, [PANEL]), 5);
});

test("a tab that is gone, or whose URL cannot be read, is not taken over", async (t) => {
  stubTabs(t, { 6: undefined });
  assert.equal(await navigationTargetTab(6, [PANEL]), undefined);
  assert.equal(await navigationTargetTab(8, [PANEL]), undefined);
});
