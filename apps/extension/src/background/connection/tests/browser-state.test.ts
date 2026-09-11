// T1 coverage of the pure parts of browser-state.ts: which pages can be
// recorded, the action types a client advertises, a chrome tab reduced to the
// fields the domain reads, and the tab state update sent to the gateway.

import assert from "node:assert/strict";
import { test } from "node:test";
import { WEB_AUTOMATION_DOMAIN_ID, WEB_AUTOMATION_INPUT_IDS } from "@fluxiq-web-extension/domain/client";
import type { ClientGatewayCapability, TabDescriptor } from "../../../shared/protocol";
import { actionTypesFromCapabilities, browserStateFromTabs, describeActiveTabLike, unsupportedPageForUrl } from "../browser-state";

test("browser, extension and web store pages cannot be recorded", () => {
  const browserPages = [
    "chrome://extensions",
    "edge://settings",
    "brave://rewards",
    "opera://settings",
    "vivaldi://settings",
    "moz-extension://abc/popup.html",
    "chrome-extension://abc/sidepanel.html"
  ];
  for (const url of browserPages) {
    assert.deepEqual(unsupportedPageForUrl(url), { url, reason: "Browser and extension pages cannot be recorded." }, url);
  }
  const store = "https://chrome.google.com/webstore/detail/abc";
  assert.deepEqual(unsupportedPageForUrl(store), { url: store, reason: "Browser web store pages cannot be recorded." });
});

test("ordinary pages, and a missing URL, can be recorded", () => {
  for (const url of [undefined, "", "https://example.test/", "http://127.0.0.1:4800/scenarios/basic-form"]) {
    assert.equal(unsupportedPageForUrl(url), undefined, String(url));
  }
});

test("the advertised action types are the union of every capability's, without repeats", () => {
  const capabilities: ClientGatewayCapability[] = [
    { id: "web.state", kind: "state" },
    { id: "web.actions", kind: "action", actionTypes: ["web.dom.click", "web.dom.type"] },
    { id: "web.extra", kind: "custom", actionTypes: ["web.dom.type", "web.dom.scroll"] }
  ];
  assert.deepEqual(actionTypesFromCapabilities(capabilities), ["web.dom.click", "web.dom.type", "web.dom.scroll"]);
  assert.deepEqual(actionTypesFromCapabilities([]), []);
});

test("a chrome tab is reduced to the fields the domain reads, leaving absent ones out", () => {
  const tab = { id: 7, index: 0, windowId: 2, url: "https://example.test/", title: "Example", active: true, status: "complete", pinned: false } as chrome.tabs.Tab;
  assert.deepEqual(describeActiveTabLike(tab), { tabId: 7, windowId: 2, url: "https://example.test/", title: "Example", active: true, status: "complete" });
  assert.deepEqual(describeActiveTabLike({ index: 0 } as chrome.tabs.Tab), { tabId: -1 });
});

test("the tab state update names the active tab, every tab as a context, and the browser-state input", () => {
  const active: TabDescriptor = { tabId: 7, windowId: 2, url: "https://example.test/", title: "Example", active: true, status: "complete" };
  const other: TabDescriptor = { tabId: 8, url: "https://example.test/other" };
  const update = browserStateFromTabs(active, [active, other], "recording");
  assert.equal(update.activeContextId, "7");
  assert.equal(update.recording, true);
  assert.deepEqual(update.contexts, [
    { contextId: "7", url: "https://example.test/", title: "Example", active: true, metadata: { kind: "browser.tab", windowId: 2, status: "complete" } },
    { contextId: "8", url: "https://example.test/other", metadata: { kind: "browser.tab" } }
  ]);
  assert.deepEqual(update.metadata, { domainId: WEB_AUTOMATION_DOMAIN_ID, inputId: WEB_AUTOMATION_INPUT_IDS.browserState });
  assert.equal(typeof update.state, "object");
});

test("with no active tab the update names none, and an idle session is not recording", () => {
  const update = browserStateFromTabs(undefined, [], "idle");
  assert.equal("activeContextId" in update, false);
  assert.equal(update.recording, false);
  assert.deepEqual(update.contexts, []);
});
