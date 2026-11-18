// The runtime's paths through the tab gate (`background/tab-gate/`): an action
// that names the panel's tab or meets it in front, a switch the panel would
// answer, a fact check standing on it and an injected page read are all refused
// before anything reaches the panel, in words the model reads. The same paths
// still drive an ordinary tab.

import assert from "node:assert/strict";
import { test } from "node:test";
import { WEB_AUTOMATION_FAILURE_CODES } from "@fluxiq-web-extension/domain/client";
import { OwnPageRefusal } from "../../background/tab-gate";
import { installFakeBrowser, PANEL_ORIGIN, PANEL_TAB, SHOP_TAB } from "../../background/tab-gate/tests/fake-browser";
import type { BrowserActionCommand, BrowserActionResult, ClientGatewayActionResult } from "../../shared/protocol";
import { runBrowserActionCommand } from "../action-runner";
import { forgetAutomationTab, setAutomationTab } from "../automation-tab";
import { ExtensionRuntimeCommandRouter } from "../command-router";
import { keptLooks } from "../look-reuse";
import { servedStatus } from "../served-status";
import { pageWorkSettled } from "../navigation-events";

async function withBrowser(run: (browser: ReturnType<typeof installFakeBrowser>) => Promise<void>, tabs?: Parameters<typeof installFakeBrowser>[0]): Promise<void> {
  forgetAutomationTab();
  keptLooks.forget(undefined);
  const browser = installFakeBrowser(tabs);
  try {
    await run(browser);
  } finally {
    browser.uninstall();
    forgetAutomationTab();
  }
}

async function run(action: BrowserActionCommand, activeTabId?: number) {
  return await runBrowserActionCommand({ action, ...(activeTabId === undefined ? {} : { activeTabId }), ownOrigins: [PANEL_ORIGIN], attachTabForRecording: () => Promise.resolve() });
}

function assertRefused(result: BrowserActionResult): void {
  assert.equal(result.status, "failed");
  assert.ok(result.message?.startsWith(OwnPageRefusal.MESSAGE), result.message);
  assert.equal(result.failure?.code, WEB_AUTOMATION_FAILURE_CODES.ACTION_REJECTED, "a refusal, not a browser fault a retry might clear");
}

test("a command naming the panel's tab is refused before anything is sent to it", async () => withBrowser(async (browser) => {
  const { result, tabId } = await run({ commandId: "c-1", actionType: "web.dom.click", selector: "#delete-key", tabId: PANEL_TAB.id }, SHOP_TAB.id);
  assertRefused(result);
  assert.equal(tabId, undefined, "the panel's tab is not reported as the tab the run is on");
  assert.equal(browser.reaching.length, 0, JSON.stringify(browser.reaching));
}));

test("with the panel in front, an action that names no tab is refused rather than run on it", async () => withBrowser(async (browser) => {
  for (const actionType of ["web.dom.click", "web.dom.capture_snapshot"] as const) {
    const { result } = await run({ commandId: "c-2", actionType, selector: "#delete-key" }, PANEL_TAB.id);
    assertRefused(result);
  }
  assert.equal(browser.reaching.length, 0, JSON.stringify(browser.reaching));
}));

test("a navigation to a FluxIQ page, or one that names the panel's tab, is refused before the tab is driven", async () => withBrowser(async (browser) => {
  assertRefused((await run({ commandId: "c-3", actionType: "web.browser.navigate", url: `${PANEL_ORIGIN}/security/keys` }, SHOP_TAB.id)).result);
  assertRefused((await run({ commandId: "c-4", actionType: "web.browser.navigate", url: "https://shop.example/cart", tabId: PANEL_TAB.id }, SHOP_TAB.id)).result);
  assert.equal(browser.reaching.length, 0, JSON.stringify(browser.reaching));
}));

test("an automation tab that is now the panel is refused, not driven", async () => withBrowser(async (browser) => {
  setAutomationTab(PANEL_TAB.id);
  const { result } = await run({ commandId: "c-5", actionType: "web.dom.click", selector: "#x" });
  assertRefused(result);
  assert.equal(browser.reaching.length, 0, JSON.stringify(browser.reaching));
}));

test("a switch whose only match is the panel's tab is refused, by pattern or by id, and nothing is fronted", async () => withBrowser(async (browser) => {
  for (const tab of [{ operation: "switch" as const, urlPattern: "security/keys" }, { operation: "switch" as const, tabId: PANEL_TAB.id }]) {
    const { result } = await run({ commandId: "c-6", actionType: "web.browser.tab", tab });
    assertRefused(result);
  }
  assertRefused((await run({ commandId: "c-7", actionType: "web.browser.tab", tab: { operation: "close", tabId: PANEL_TAB.id } })).result);
  assertRefused((await run({ commandId: "c-8", actionType: "web.browser.tab", tab: { operation: "open", url: `${PANEL_ORIGIN}/data` } })).result);
  assert.equal(browser.reaching.length, 0, JSON.stringify(browser.reaching));
}));

test("a switch that both the panel and an ordinary tab answer takes the ordinary one", async () => withBrowser(async (browser) => {
  const { result } = await run({ commandId: "c-9", actionType: "web.browser.tab", tab: { operation: "switch", urlPattern: "127.0.0.1" } });
  assert.equal(result.status, "succeeded", result.message);
  assert.deepEqual(browser.reaching.map((call) => [call.api, call.tabId]), [["tabs.update", 42]]);
}, [PANEL_TAB, { ...SHOP_TAB, id: 42, url: "http://127.0.0.1:5173/shop" }]));

test("a fact check standing on the panel's tab is refused out loud, and nothing is sent to it", async () => withBrowser(async (browser) => {
  const results: ClientGatewayActionResult[] = [];
  const router = new ExtensionRuntimeCommandRouter({
    activeTabId: () => PANEL_TAB.id,
    unsupportedPageReason: () => undefined,
    attachTabForRecording: () => Promise.resolve(),
    captureActiveSnapshot: () => Promise.resolve(),
    sendActionResult: () => Promise.resolve(),
    sendGatewayResult: async (result) => void results.push(result)
  });
  await router.evaluateFacts({ commandId: "f-1", request: { queries: [{ kind: "dialog", expected: true }], documentTimeOrigin: 0 } } as Parameters<typeof router.evaluateFacts>[0]);
  assert.equal(results.length, 1);
  assert.equal(results[0]?.status, "failed");
  assert.ok(results[0]?.error?.startsWith(OwnPageRefusal.MESSAGE), results[0]?.error);
  assert.equal(browser.reaching.length, 0, JSON.stringify(browser.reaching));
}));

test("an injected page read of the panel's tab is never made; the same read of an ordinary tab is", async () => withBrowser(async (browser) => {
  const panel = await servedStatus(PANEL_TAB.id, undefined);
  assert.ok("unread" in panel && panel.unread.includes(OwnPageRefusal.MESSAGE), JSON.stringify(panel));
  assert.equal(await pageWorkSettled(PANEL_TAB.id), false);
  assert.equal(browser.reaching.length, 0, JSON.stringify(browser.reaching));
  assert.deepEqual(await servedStatus(SHOP_TAB.id, undefined), { status: 200 });
  assert.deepEqual(browser.reaching.map((call) => [call.api, call.tabId]), [["scripting.executeScript", SHOP_TAB.id]]);
}));

test("ordinary automation is unaffected: a click on the shop tab reaches it, and a fact check there is answered", async () => withBrowser(async (browser) => {
  const { result, tabId } = await run({ commandId: "c-10", actionType: "web.dom.click", selector: "#buy", tabId: SHOP_TAB.id }, PANEL_TAB.id);
  assert.equal(result.status, "succeeded", result.message);
  assert.equal(tabId, SHOP_TAB.id);
  assert.ok(browser.reaching.some((call) => call.api === "tabs.sendMessage" && call.tabId === SHOP_TAB.id && (call.detail as { type?: string }).type === "executeAction"));
  assert.ok(browser.reaching.every((call) => call.tabId !== PANEL_TAB.id));
  const results: ClientGatewayActionResult[] = [];
  const router = new ExtensionRuntimeCommandRouter({
    activeTabId: () => SHOP_TAB.id,
    unsupportedPageReason: () => undefined,
    attachTabForRecording: () => Promise.resolve(),
    captureActiveSnapshot: () => Promise.resolve(),
    sendActionResult: () => Promise.resolve(),
    sendGatewayResult: async (sent) => void results.push(sent)
  });
  forgetAutomationTab();
  await router.evaluateFacts({ commandId: "f-2", request: { queries: [{ kind: "dialog", expected: true }], documentTimeOrigin: 0 } } as Parameters<typeof router.evaluateFacts>[0]);
  assert.equal(results[0]?.status, "succeeded");
}, [PANEL_TAB, { ...SHOP_TAB, active: true }]));
