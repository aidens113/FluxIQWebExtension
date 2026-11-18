// What the extension reports about the browser leaves FluxIQ's own pages out
// (`tab-gate/`): the tab list `tabs.ts` hands every reporter, the browser state
// `connection/active-page.ts` sends Core, and its per-tab update. The panel's
// tab is still tracked, so an action aimed at it is refused out loud.

import assert from "node:assert/strict";
import { test } from "node:test";
import { ActivePage, type ActivePageDeps } from "../connection/index";
import { installFakeBrowser, PANEL_TAB, SHOP_TAB } from "../tab-gate/tests/fake-browser";
import { activeTab, allTabs } from "../tabs";

function harness() {
  const sent: Array<{ type: string; payload: unknown }> = [];
  const noted: Array<number | undefined> = [];
  const attached: number[] = [];
  const deps: ActivePageDeps = {
    send: (async (type: string, payload: unknown) => {
      sent.push({ type, payload });
    }) as ActivePageDeps["send"],
    gatewayState: () => "connected",
    clientId: () => "client-1",
    recordingState: () => "recording",
    attachTabForRecording: async (tabId) => void attached.push(tabId),
    activeTab,
    allTabs,
    onActivity: () => undefined,
    emitStatus: () => undefined,
    updateTab: async () => undefined,
    noteTabChange: async (tab) => void noted.push(tab.id),
    noteTabRemoved: async () => undefined
  };
  return { page: new ActivePage(deps), sent, noted, attached };
}

async function withBrowser(run: () => Promise<void>, tabs?: Parameters<typeof installFakeBrowser>[0]): Promise<void> {
  const browser = installFakeBrowser(tabs);
  try {
    await run();
  } finally {
    browser.uninstall();
  }
}

/** Whether anything sent names the panel: its tab id as a context, its address or its title. */
function namesPanel(sent: unknown): boolean {
  const text = JSON.stringify(sent);
  return text.includes("127.0.0.1:3000") || text.includes(PANEL_TAB.title) || text.includes(`"contextId":"${PANEL_TAB.id}"`) || text.includes(`"activeContextId":"${PANEL_TAB.id}"`);
}

test("the tab list every reporter reads omits the panel's tab", async () => withBrowser(async () => {
  assert.deepEqual((await allTabs()).map((tab) => tab.tabId), [SHOP_TAB.id]);
  // The tab in front is still known as the panel, so the run can refuse it rather than act somewhere else.
  assert.equal((await activeTab())?.tabId, PANEL_TAB.id);
}));

test("with the panel in front, the browser state sent to Core names neither the panel nor its tab", async () => withBrowser(async () => {
  const { page, sent } = harness();
  await page.sendBrowserState();
  assert.equal(sent.length, 1);
  assert.equal(namesPanel(sent), false, JSON.stringify(sent));
  assert.ok(JSON.stringify(sent).includes(SHOP_TAB.url), "the ordinary tab is still reported");
}));

test("an update of the panel's tab is tracked but never recorded, attached or reported", async () => withBrowser(async () => {
  const { page, sent, noted, attached } = harness();
  await page.handleTabUpdate({ ...PANEL_TAB, index: 0, pinned: false, highlighted: true, incognito: false, selected: true, discarded: false, autoDiscardable: true, groupId: -1, frozen: false } as chrome.tabs.Tab);
  assert.equal(page.tabId(), PANEL_TAB.id);
  assert.deepEqual([sent, noted, attached], [[], [], []]);
  await page.handleTabUpdate({ ...SHOP_TAB, active: true, index: 1, pinned: false, highlighted: true, incognito: false, selected: true, discarded: false, autoDiscardable: true, groupId: -1, frozen: false } as chrome.tabs.Tab);
  assert.deepEqual(noted, [SHOP_TAB.id]);
  assert.ok(sent.length > 0 && !namesPanel(sent), JSON.stringify(sent));
}));
