// Coverage of the tab gate (`../index.ts`): which pages are FluxIQ's own, and
// that every gated call refuses such a tab before anything reaches it -- no
// message, script, capture or act -- while an ordinary tab is served as before.

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  activateTab,
  captureWindow,
  closeTab,
  configureOwnPages,
  executeInTab,
  goBackInTab,
  isOwnPage,
  isOwnPageTab,
  navigateTab,
  openTab,
  openTabForPerson,
  OwnPageRefusal,
  ownPageRefusalFor,
  reloadTab,
  sendTabMessage,
  withoutOwnPages
} from "../index";
import { GATEWAY_URL, installFakeBrowser, PANEL_ORIGIN, PANEL_TAB, SHOP_TAB } from "./fake-browser";

async function withBrowser(run: (browser: ReturnType<typeof installFakeBrowser>) => Promise<void>, tabs?: Parameters<typeof installFakeBrowser>[0]): Promise<void> {
  const browser = installFakeBrowser(tabs);
  try {
    await run(browser);
  } finally {
    browser.uninstall();
  }
}

/** Asserts the call was refused with the gate's own words. */
async function refused(call: () => Promise<unknown>): Promise<void> {
  await assert.rejects(call, (error: unknown) => error instanceof OwnPageRefusal && error.message.startsWith(OwnPageRefusal.MESSAGE));
}

test("the panel's origin, under any path and any loopback name, is FluxIQ's own; other origins are not", () => {
  configureOwnPages(() => [PANEL_ORIGIN, GATEWAY_URL]);
  for (const own of [`${PANEL_ORIGIN}/`, `${PANEL_ORIGIN}/security/keys`, `${PANEL_ORIGIN}/connect/authorize?x=1`, "http://localhost:3000/welcome", "http://[::1]:3000/projects", "HTTP://127.0.0.1:3000/flows/f1"]) {
    assert.equal(isOwnPage(own), true, own);
  }
  for (const other of ["http://127.0.0.1:3001/", "https://127.0.0.1:3000/", "https://shop.example/", "about:blank", "data:text/html,x", "not a url", undefined, ""]) {
    assert.equal(isOwnPage(other), false, String(other));
  }
  // A tab still loading the panel is the panel already.
  assert.equal(isOwnPageTab({ url: "", pendingUrl: `${PANEL_ORIGIN}/` }), true);
  assert.deepEqual(withoutOwnPages([PANEL_TAB, SHOP_TAB]).map((tab) => tab.id), [SHOP_TAB.id]);
});

test("the configured address is read on every decision, so a settings change applies at once", () => {
  configureOwnPages(() => ["https://fluxiq.example.com"]);
  assert.equal(isOwnPage("https://fluxiq.example.com/security/keys"), true);
  assert.equal(isOwnPage(`${PANEL_ORIGIN}/security/keys`), false);
  configureOwnPages(() => [PANEL_ORIGIN]);
  assert.equal(isOwnPage("https://fluxiq.example.com/security/keys"), false);
});

test("a message to the panel's tab is refused before it is sent; one to an ordinary tab is delivered", async () => withBrowser(async (browser) => {
  await refused(() => sendTabMessage(PANEL_TAB.id, { type: "captureSnapshot" }));
  await refused(() => sendTabMessage(PANEL_TAB.id, { type: "executeAction" }, 3));
  assert.equal(browser.reaching.length, 0, JSON.stringify(browser.reaching));
  assert.deepEqual(await sendTabMessage(SHOP_TAB.id, { type: "fluxiq.ping" }), { ok: true, active: true, version: 2 });
  assert.deepEqual(browser.reaching.map((call) => [call.api, call.tabId]), [["tabs.sendMessage", SHOP_TAB.id]]);
}));

test("a script is never injected into the panel's tab; an ordinary tab is scripted", async () => withBrowser(async (browser) => {
  await refused(() => executeInTab({ target: { tabId: PANEL_TAB.id, frameIds: [0] }, func: () => document.title }));
  assert.equal(browser.reaching.length, 0, JSON.stringify(browser.reaching));
  await executeInTab({ target: { tabId: SHOP_TAB.id, frameIds: [0] }, files: ["content/index.js"] });
  assert.deepEqual(browser.reaching.map((call) => [call.api, call.tabId]), [["scripting.executeScript", SHOP_TAB.id]]);
}));

test("a window with the panel in front is never captured; one with an ordinary page is", async () => {
  await withBrowser(async (browser) => {
    await refused(() => captureWindow(1));
    assert.equal(browser.reaching.length, 0, JSON.stringify(browser.reaching));
  });
  await withBrowser(async (browser) => {
    assert.equal(await captureWindow(1), "data:image/png;base64,");
    assert.deepEqual(browser.reaching.map((call) => call.api), ["tabs.captureVisibleTab"]);
  }, [{ ...PANEL_TAB, active: false }, { ...SHOP_TAB, active: true }]);
});

test("no act reaches the panel's tab, and no tab is driven or opened to a FluxIQ page", async () => withBrowser(async (browser) => {
  await refused(() => activateTab(PANEL_TAB.id));
  await refused(() => navigateTab(PANEL_TAB.id, "https://shop.example/"));
  await refused(() => navigateTab(SHOP_TAB.id, `${PANEL_ORIGIN}/security/keys`));
  await refused(() => reloadTab(PANEL_TAB.id));
  await refused(() => goBackInTab(PANEL_TAB.id));
  await refused(() => closeTab(PANEL_TAB.id));
  await refused(() => openTab({ url: `${PANEL_ORIGIN}/projects`, active: true }));
  assert.equal(browser.reaching.length, 0, JSON.stringify(browser.reaching));
  assert.equal(await ownPageRefusalFor(PANEL_TAB.id) instanceof OwnPageRefusal, true);
  assert.equal(await ownPageRefusalFor(SHOP_TAB.id), undefined);
  assert.equal(await ownPageRefusalFor(999), undefined, "a tab the browser cannot read is left to the gated call");
}));

test("ordinary tabs are still acted on, and the person's own panel request may open a FluxIQ page", async () => withBrowser(async (browser) => {
  await activateTab(SHOP_TAB.id);
  await navigateTab(SHOP_TAB.id, "https://shop.example/cart");
  await reloadTab(SHOP_TAB.id);
  await goBackInTab(SHOP_TAB.id);
  await openTab({ url: "https://shop.example/help", active: false });
  await openTabForPerson(`${PANEL_ORIGIN}/security/keys`);
  await closeTab(SHOP_TAB.id);
  assert.deepEqual(browser.reaching.map((call) => call.api), ["tabs.update", "tabs.update", "tabs.reload", "tabs.goBack", "tabs.create", "tabs.create", "tabs.remove"]);
  await assert.rejects(() => sendTabMessage(999, { type: "fluxiq.ping" }), /No tab with id: 999/u, "a missing tab fails as the browser words it");
}));
