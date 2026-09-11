import assert from "node:assert/strict";
import test from "node:test";
import type { BrowserContext, Page } from "@playwright/test";
import { RunnerFailure } from "../../failure.js";
import { ScenarioTabs } from "../scenario-tabs.js";

type FakeTab = Page & { fronted: number; closed: boolean };

function fakeTab(url: string): FakeTab {
  const tab = {
    fronted: 0,
    closed: false,
    url: () => url,
    isClosed: () => tab.closed,
    waitForLoadState: async () => undefined,
    bringToFront: async () => { tab.fronted += 1; },
    close: async () => { tab.closed = true; },
  };
  return tab as unknown as FakeTab;
}

const origin = "http://127.0.0.1:4100";
const isScenarioUrl = (url: string) => url.startsWith(`${origin}/`);

test("switches to the open scenario tab with the exact path, then closes back to the tab before it", async () => {
  const list = fakeTab(`${origin}/scenarios/multi-tab/`);
  const extension = fakeTab("chrome-extension://id/scenarios/multi-tab/details");
  const details = fakeTab(`${origin}/scenarios/multi-tab/details?item=3`);
  const pages: Page[] = [list, extension, details];
  const tabs = new ScenarioTabs({ pages: () => pages } as unknown as BrowserContext, list, isScenarioUrl);
  assert.equal(await tabs.switchTo("/scenarios/multi-tab/details", 1_000), details);
  assert.equal(tabs.active(), details);
  assert.equal(details.fronted, 1);
  assert.equal(await tabs.closeActive(), list);
  assert.equal(details.closed, true);
  assert.equal(list.fronted, 1);
});

test("waits for a tab still opening, and reports the open paths when none matches", async () => {
  const list = fakeTab(`${origin}/scenarios/multi-tab/`);
  const pages: Page[] = [list];
  const tabs = new ScenarioTabs({ pages: () => pages } as unknown as BrowserContext, list, isScenarioUrl);
  setTimeout(() => pages.push(fakeTab(`${origin}/scenarios/multi-tab/popup`)), 20);
  assert.equal((await tabs.switchTo("/scenarios/multi-tab/popup", 2_000)).url(), `${origin}/scenarios/multi-tab/popup`);
  await assert.rejects(tabs.switchTo("/scenarios/multi-tab/missing", 0), (error: unknown) => error instanceof RunnerFailure && JSON.stringify(error.details).includes("/scenarios/multi-tab/popup"));
});

test("never closes the scenario's first tab", async () => {
  const list = fakeTab(`${origin}/scenarios/multi-tab/`);
  const tabs = new ScenarioTabs({ pages: () => [list] } as unknown as BrowserContext, list, isScenarioUrl);
  await assert.rejects(tabs.closeActive(), (error: unknown) => error instanceof RunnerFailure && error.category === "fixture.invalid");
  await tabs.switchTo("/scenarios/multi-tab/", 0);
  await assert.rejects(tabs.closeActive(), /never the scenario's first tab/);
  assert.equal(list.closed, false);
});
