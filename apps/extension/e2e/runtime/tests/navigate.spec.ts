// `web.browser.navigate`, in a real Chromium with the real extension loaded,
// against the Scenario Lab store whose created Flow this verb broke.
//
// The campaign's one created Flow opened with a navigate to the
// everything-store results page. It reported `succeeded`; the before and after
// screenshots had the same hash, Core's after-action location was still the
// start page, and the click after it failed on a page the Flow believed it had
// replaced (`docs/working/week2-exit-plan/reports/w2x-e2e-lane-b.md`, product
// gap 6). The post-condition could not have caught it: it compared the
// *requested* address with the *landed* one, and a navigation to the page a tab
// already shows satisfies that without the browser doing anything at all.
//
// These rows are the two halves of the answer. A navigation must reach the
// address asked for *and* have been some work -- a document the browser
// loaded, a tab it opened, or an address that moved -- and the result must
// carry enough for a reader to tell which.
//
// The no-op row injects one fault, and it is the exact one nothing verified:
// `chrome.tabs.reload` is replaced, on the harness page only, with a call that
// resolves without reloading. Chrome's own way of doing nothing -- ignoring a
// `tabs.update` to the address the tab already shows -- is already worked
// around by `automation-tab.ts`'s reload branch, and what was never checked is
// whether that reload happened. The row that follows it removes the override
// and shows the same navigation doing real work in the same browser.

import { randomBytes } from "node:crypto";
import { startScenarioLab, type RunningScenarioLab } from "../../../../scenario-lab/src/server.js";
import { expect, test } from "../../fixtures/extension-context.js";
import { installRuntimeHarness, resetRuntimeHarness, runWorkerAction } from "../harness.js";
import type { ExtensionSession } from "../../fixtures/extension-context.js";
import type { Page } from "@playwright/test";

const START = "/scenarios/everything-store/";
const RESULTS = "/scenarios/everything-store/s?k=wireless+earbuds";

/** A value on the page's own window: gone after any document the browser loads, kept when nothing happened. */
const MARKER = "__fluxiqNavigateMarker";

type Fixture = {
  lab: RunningScenarioLab;
  page: Page;
  tabId: number;
  close(): Promise<void>;
};

/** Opens the store in a tab of the extension's browser, with the runtime harness installed on the extension's page. */
async function openStore(session: ExtensionSession, path: string): Promise<Fixture> {
  const lab = await startScenarioLab({ runToken: randomBytes(24).toString("base64url"), seed: 4_242 });
  try {
    const page = await session.context.newPage();
    await page.goto(new URL(path, lab.origin).href);
    const tabId = await tabIdFor(session, page.url());
    await installRuntimeHarness(session.extensionPage);
    await resetRuntimeHarness(session.extensionPage, tabId);
    await stamp(page);
    return { lab, page, tabId, close: () => lab.close() };
  } catch (error) {
    await lab.close();
    throw error;
  }
}

/** Chrome's id for the tab showing `url`, read the way the panel reads it. */
function tabIdFor(session: ExtensionSession, url: string): Promise<number> {
  return session.extensionPage.evaluate(async (wanted) => {
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find((candidate) => candidate.url === wanted);
    if (typeof tab?.id !== "number") throw new Error(`No tab is showing ${wanted}`);
    return tab.id;
  }, url);
}

async function stamp(page: Page): Promise<void> {
  await page.evaluate((name) => { (globalThis as Record<string, unknown>)[name] = "before"; }, MARKER);
}

/** Whether the page the tab holds is still the one that was stamped: the oracle for "the browser loaded nothing". */
function stampSurvived(page: Page): Promise<boolean> {
  return page.evaluate((name) => (globalThis as Record<string, unknown>)[name] === "before", MARKER);
}

/** Replaces `chrome.tabs.reload` on the harness page with one that does nothing, or puts the browser's own back. */
function breakReload(session: ExtensionSession, broken: boolean): Promise<void> {
  return session.extensionPage.evaluate((off) => {
    const store = globalThis as unknown as { __fluxiqRealReload?: typeof chrome.tabs.reload };
    store.__fluxiqRealReload ??= chrome.tabs.reload;
    chrome.tabs.reload = off ? (() => Promise.resolve()) as typeof chrome.tabs.reload : store.__fluxiqRealReload;
  }, broken);
}

test("navigate: a navigation the browser did not act on is reported as a failure, not a success", async ({ extensionSession }) => {
  const store = await openStore(extensionSession, START);
  try {
    await breakReload(extensionSession, true);
    const target = new URL(START, store.lab.origin).href;
    const run = await runWorkerAction(extensionSession.extensionPage, {
      commandId: "nav-noop",
      actionType: "web.browser.navigate",
      url: target
    }, { activeTabId: store.tabId });

    // The page never moved: its window still holds what was stamped on it.
    expect(await stampSurvived(store.page), "the browser loaded no document").toBe(true);
    expect(run.tabId, "the navigation drove the tab the page is in").toBe(store.tabId);
    expect(run.result, run.result.message).toMatchObject({
      status: "failed",
      failure: { code: "web.navigation.unexpected", category: "navigation_unexpected" },
      url: target
    });
    expect(run.result.message).toContain("the page it was already showing");
  } finally {
    await breakReload(extensionSession, false);
    await store.close();
  }
});

test("navigate: the same navigation, with the browser acting on it, succeeds and says it loaded the page again", async ({ extensionSession }) => {
  const store = await openStore(extensionSession, START);
  try {
    const target = new URL(START, store.lab.origin).href;
    const run = await runWorkerAction(extensionSession.extensionPage, {
      commandId: "nav-reload",
      actionType: "web.browser.navigate",
      url: target
    }, { activeTabId: store.tabId });

    expect(await stampSurvived(store.page), "the document was replaced by the reload").toBe(false);
    expect(run.result, run.result.message).toMatchObject({
      status: "succeeded",
      validation: { status: "passed" },
      url: target,
      title: "Brightaisle.com. Spend less. Smile more."
    });
    expect(validationActual(run.result)).toContain("the browser loaded the page again");
  } finally {
    await store.close();
  }
});

test("navigate: a navigation to another page reports the page it left and the page it reached", async ({ extensionSession }) => {
  const store = await openStore(extensionSession, START);
  try {
    const target = new URL(RESULTS, store.lab.origin).href;
    const run = await runWorkerAction(extensionSession.extensionPage, {
      commandId: "nav-results",
      actionType: "web.browser.navigate",
      url: target
    }, { activeTabId: store.tabId });

    expect(run.result, run.result.message).toMatchObject({ status: "succeeded", url: target });
    expect(validationActual(run.result)).toContain(new URL(START, store.lab.origin).href);
    expect(run.result.title, "the result says which page it reached, not only its address").toBeTruthy();
    expect(store.page.url()).toBe(target);
  } finally {
    await store.close();
  }
});

test("navigate: a move within the same document is work, and is not failed as a no-op", async ({ extensionSession }) => {
  const store = await openStore(extensionSession, START);
  try {
    // A fragment moves the address and keeps the document, so the document
    // check alone would call it a no-op. The address is what answers it.
    const target = `${new URL(START, store.lab.origin).href}#footer`;
    const run = await runWorkerAction(extensionSession.extensionPage, {
      commandId: "nav-fragment",
      actionType: "web.browser.navigate",
      url: target
    }, { activeTabId: store.tabId });

    expect(run.result, run.result.message).toMatchObject({ status: "succeeded", validation: { status: "passed" } });
    expect(store.page.url()).toBe(target);
  } finally {
    await store.close();
  }
});

function validationActual(result: { validation: { status: string; actual?: string } }): string {
  if (result.validation.status === "none") throw new Error("the result reported no validation");
  return result.validation.actual ?? "";
}
