// T1 coverage of a dry run's reset closing the tabs FluxIQ opened
// (`fluxiq-opened-tabs.ts`, `action-runner.ts`), t174-w104.
//
// Live run `run-musp8nz1-dbd3905a` ended with the home tab and three item
// tabs, one each from exploration, the build test and playback: each reset
// navigated whichever tab was in front -- the last click's item tab -- and the
// replayed click opened one more. The reset now carries `closeOpenedTabs`, and
// the runner closes only the tabs FluxIQ's own clicks and tab opens created,
// then drives the tab they were opened from. A person's tab is never closed.
//
// The chrome API is stubbed at what the runner reads, as in
// `navigate-action.test.ts`. What this cannot prove is a real browser's order
// of tab events, which only a loaded extension shows.

import assert from "node:assert/strict";
import { test } from "node:test";
import { WEB_AUTOMATION_CLOSE_OPENED_TABS_PARAMETER } from "@fluxiq-web-extension/domain/client";
import { runBrowserActionCommand } from "../action-runner";
import { currentAutomationTabId, forgetAutomationTab, setAutomationTab } from "../automation-tab";
import { fluxiqOpenedTabs } from "../fluxiq-opened-tabs";

const RESULTS = "http://127.0.0.1:64130/scenarios/crossborder-marketplace/search?q=hub";
const ITEM = "http://127.0.0.1:64130/scenarios/crossborder-marketplace/item/1005008123450";
const OTHER = "http://127.0.0.1:64130/scenarios/everything-store/";
const HOME = "http://127.0.0.1:64130/scenarios/crossborder-marketplace/";

const PERSON_TAB = 41;
const OPENED_TAB = 77;
const PERSONS_OWN_TAB = 55;

type Calls = { updated: number[]; removed: number[]; created: string[] };

/** Tabs at `urls`, each load completing at once; every update, removal and creation recorded. */
function installBrowser(urls: Record<number, string>): Calls {
  const calls: Calls = { updated: [], removed: [], created: [] };
  let document = 0;
  (globalThis as { chrome?: unknown }).chrome = {
    runtime: {},
    tabs: {
      get: (tabId: number) => urls[tabId] !== undefined
        ? Promise.resolve({ id: tabId, url: urls[tabId], status: "complete" })
        : Promise.reject(new Error(`No tab with id: ${tabId}.`)),
      update: (tabId: number, properties: { url?: string }) => {
        calls.updated.push(tabId);
        if (properties.url !== undefined) urls[tabId] = properties.url;
        document += 1;
        return Promise.resolve({ id: tabId, url: urls[tabId] });
      },
      reload: () => Promise.resolve(),
      remove: (tabId: number) => {
        if (urls[tabId] === undefined) return Promise.reject(new Error(`No tab with id: ${tabId}.`));
        calls.removed.push(tabId);
        delete urls[tabId];
        return Promise.resolve();
      },
      create: (properties: { url: string }) => {
        calls.created.push(properties.url);
        urls[900] = properties.url;
        return Promise.resolve({ id: 900, url: properties.url });
      },
      onUpdated: { addListener: () => undefined, removeListener: () => undefined },
      sendMessage: (_tabId: number, _message: unknown, _options: unknown, callback: (response: unknown) => void) => callback({ challenge: null })
    },
    webNavigation: {
      getAllFrames: (_details: unknown, callback: (found: unknown[]) => void) => callback([{ frameId: 0, errorOccurred: false, documentId: `document.${document}` }])
    }
  };
  return calls;
}

async function navigate(url: string, activeTabId: number, closeOpenedTabs: boolean): Promise<Awaited<ReturnType<typeof runBrowserActionCommand>>> {
  try {
    return await runBrowserActionCommand({
      action: {
        commandId: "c-reset",
        actionType: "web.browser.navigate",
        url,
        ...(closeOpenedTabs ? { options: { url, [WEB_AUTOMATION_CLOSE_OPENED_TABS_PARAMETER]: true } } : {})
      },
      activeTabId,
      attachTabForRecording: () => Promise.resolve()
    });
  } finally {
    delete (globalThis as { chrome?: unknown }).chrome;
  }
}

/** Starts each row with nothing recorded and nothing driven. */
async function fresh(): Promise<void> {
  forgetAutomationTab();
  (globalThis as { chrome?: unknown }).chrome = { tabs: { remove: () => Promise.resolve(), get: () => Promise.reject(new Error("none")) } };
  await fluxiqOpenedTabs.closeAll();
  delete (globalThis as { chrome?: unknown }).chrome;
  forgetAutomationTab();
}

test("a reset's navigation closes the tabs FluxIQ's clicks opened and drives the tab they were opened from, never the person's", async () => {
  await fresh();
  const calls = installBrowser({ [PERSON_TAB]: RESULTS, [OPENED_TAB]: ITEM, [PERSONS_OWN_TAB]: OTHER });
  setAutomationTab(PERSON_TAB);
  setAutomationTab(OPENED_TAB);
  fluxiqOpenedTabs.note(OPENED_TAB, PERSON_TAB);
  // The opened tab is in front, as it is after the click that opened it.
  const run = await navigate(HOME, OPENED_TAB, true);
  assert.deepEqual(calls.removed, [OPENED_TAB], "only the tab FluxIQ opened is closed");
  assert.equal(run.tabId, PERSON_TAB, "the reset drives the tab the item was opened from");
  assert.ok(calls.updated.includes(PERSON_TAB));
  assert.equal(run.result.status, "succeeded");
  assert.equal(currentAutomationTabId(), PERSON_TAB);
  assert.deepEqual(fluxiqOpenedTabs.recorded(), [], "the record is cleared with the tabs");
});

test("a navigation that does not ask closes nothing, so a Flow's own navigate keeps the tab it is in", async () => {
  await fresh();
  const calls = installBrowser({ [PERSON_TAB]: RESULTS, [OPENED_TAB]: ITEM });
  setAutomationTab(OPENED_TAB);
  fluxiqOpenedTabs.note(OPENED_TAB, PERSON_TAB);
  const run = await navigate(HOME, OPENED_TAB, false);
  assert.deepEqual(calls.removed, []);
  assert.equal(run.tabId, OPENED_TAB);
  assert.deepEqual(fluxiqOpenedTabs.recorded(), [{ tabId: OPENED_TAB, sourceTabId: PERSON_TAB }]);
});

test("a reset with the person's own tab in front closes FluxIQ's tabs and drives the person's tab as before", async () => {
  await fresh();
  const calls = installBrowser({ [PERSON_TAB]: RESULTS, [OPENED_TAB]: ITEM });
  fluxiqOpenedTabs.note(OPENED_TAB, PERSON_TAB);
  const run = await navigate(HOME, PERSON_TAB, true);
  assert.deepEqual(calls.removed, [OPENED_TAB]);
  assert.equal(run.tabId, PERSON_TAB);
  assert.equal(run.result.status, "succeeded");
});

test("a tab opened from a tab FluxIQ opened goes too, and a recorded tab already closed is passed over", async () => {
  await fresh();
  const calls = installBrowser({ [PERSON_TAB]: RESULTS, [OPENED_TAB]: ITEM, 78: `${ITEM}?seller=1` });
  fluxiqOpenedTabs.note(OPENED_TAB, PERSON_TAB);
  fluxiqOpenedTabs.note(78, OPENED_TAB);
  fluxiqOpenedTabs.note(79, OPENED_TAB);
  const run = await navigate(HOME, 78, true);
  assert.deepEqual(calls.removed, [OPENED_TAB, 78]);
  assert.equal(run.tabId, PERSON_TAB);
  assert.equal(run.result.status, "succeeded");
});
