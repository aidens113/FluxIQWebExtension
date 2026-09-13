// Coverage of automation-tab.ts's memory of driven tabs: the automation tab is
// the one set last, forgetting it returns to the tab driven before it, and the
// most recent tab still open is found past tabs that have since closed.

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { currentAutomationTabId, forgetAutomationTab, latestOpenAutomationTab, setAutomationTab } from "../automation-tab";

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
