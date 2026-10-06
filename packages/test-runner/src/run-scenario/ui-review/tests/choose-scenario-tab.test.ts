import assert from "node:assert/strict";
import test from "node:test";
import type { BrowserContext, Page } from "@playwright/test";
import { captureScenarioTab, chooseScenarioTab } from "../index.js";

type BrowserTab = { url: string; active: boolean };

// Only what the review calls on a page: its location, whether it closed, one `evaluate`, and a screenshot.
function fakePage(url: string, evaluated: unknown = "visible"): Page {
  return { url: () => url, isClosed: () => false, evaluate: async () => evaluated, screenshot: async () => Buffer.from("") } as unknown as Page;
}
const fakeContext = (pages: Page[]) => ({ pages: () => pages }) as unknown as BrowserContext;

test("every open tab is recorded with which one is in front, not only the tab in front (R7)", async () => {
  const home = fakePage("http://127.0.0.1:58504/scenarios/crossborder-marketplace/");
  const item = fakePage("http://127.0.0.1:58504/scenarios/crossborder-marketplace/item/1005008123450");
  // What `chrome.tabs.query({})` reports: the blank tab, the extension's own page, and two fixture tabs, the item one in front.
  const tabs: BrowserTab[] = [
    { url: "about:blank", active: false },
    { url: "chrome-extension://abcdefghijklmnop/panel.html", active: false },
    { url: home.url(), active: false },
    { url: item.url(), active: true },
  ];
  const chosen = await chooseScenarioTab(fakeContext([home, item]), home, fakePage("chrome-extension://abcdefghijklmnop/control.html", tabs));
  assert.equal(chosen.page, item, "the tab in front is the one photographed");
  assert.deepEqual(chosen.openTabs, [
    { url: "about:blank", inFront: false },
    { url: "chrome-extension://abcdefghijklmnop/panel.html", inFront: false },
    { url: home.url(), inFront: false },
    { url: item.url(), inFront: true },
  ]);
  assert.deepEqual(chosen.frontTabs, [item.url()], "the tabs in front are still listed as before");
});

test("when the browser's tabs cannot be read, the open pages the run holds are listed with front unknown", async () => {
  const home = fakePage("http://127.0.0.1:58504/scenarios/crossborder-marketplace/");
  const control = { url: () => "chrome-extension://x/control.html", isClosed: () => false, evaluate: async () => { throw new Error("Target closed"); } } as unknown as Page;
  const chosen = await chooseScenarioTab(fakeContext([fakePage("about:blank"), home]), home, control);
  assert.deepEqual(chosen.openTabs, [{ url: "about:blank", inFront: "unknown" }, { url: home.url(), inFront: "unknown" }]);
});

test("the scenario picture keeps every open tab, each screened to origin and path", async () => {
  const page = fakePage("http://127.0.0.1:58504/scenarios/crossborder-marketplace/item/1", "page text");
  const capture = await captureScenarioTab({
    page, inFront: true, frontTabs: [page.url()], path: "unused.png", file: "x/unused.png", secrets: ["s3cret"], timeoutMs: 1_000,
    openTabs: [
      { url: "http://127.0.0.1:58504/scenarios/crossborder-marketplace/?token=abc#top", inFront: false },
      { url: "http://127.0.0.1:58504/scenarios/s3cret/item/1", inFront: true },
      { url: "chrome-extension://abcdefghijklmnop/panel.html", inFront: false },
    ],
  });
  assert.deepEqual(capture.openTabs, [
    { location: "http://127.0.0.1:58504/scenarios/crossborder-marketplace/", inFront: false },
    { location: "http://127.0.0.1:58504/scenarios/[REDACTED]/item/1", inFront: true },
    { location: "chrome-extension://<extension>/panel.html", inFront: false },
  ]);
});
