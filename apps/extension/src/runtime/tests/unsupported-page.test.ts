// T1 coverage of unsupported-page.ts: which pages the extension refuses to
// automate. The cases that matter most are the ones the recording-side rule in
// background/connection/browser-state.ts misses, because its pattern requires
// "://": `about:blank`, `view-source:` and `data:` URLs, and the current Chrome
// and Edge store hosts.

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  UNSUPPORTED_BROWSER_PAGE_REASON,
  UNSUPPORTED_STORE_PAGE_REASON,
  unsupportedAutomationPageReason
} from "../unsupported-page";

test("browser and extension pages cannot be automated", () => {
  const pages = [
    "chrome://extensions",
    "edge://settings",
    "brave://rewards",
    "opera://settings",
    "vivaldi://settings",
    "devtools://devtools/bundled/inspector.html",
    "moz-extension://abc/popup.html",
    "chrome-extension://abc/sidepanel.html"
  ];
  for (const url of pages) {
    assert.equal(unsupportedAutomationPageReason(url), UNSUPPORTED_BROWSER_PAGE_REASON, url);
  }
});

test("a scheme with no authority is caught, which the recording rule's \"://\" pattern misses", () => {
  for (const url of [
    "about:blank",
    "about:newtab",
    "view-source:https://example.test/",
    "data:text/html,<p>hello</p>",
    "javascript:void(0)"
  ]) {
    assert.equal(unsupportedAutomationPageReason(url), UNSUPPORTED_BROWSER_PAGE_REASON, url);
  }
});

test("every extension gallery host is refused, including the ones that replaced the old web store", () => {
  for (const url of [
    "https://chrome.google.com/webstore/detail/abc",
    "https://chromewebstore.google.com/detail/abc",
    "https://microsoftedge.microsoft.com/addons/detail/abc",
    "https://addons.mozilla.org/en-US/firefox/addon/fluxiq/"
  ]) {
    assert.equal(unsupportedAutomationPageReason(url), UNSUPPORTED_STORE_PAGE_REASON, url);
  }
});

test("ordinary pages, and an unknown URL, are not refused", () => {
  for (const url of [undefined, "", "   ", "https://example.test/", "http://127.0.0.1:4800/scenarios/basic-form"]) {
    assert.equal(unsupportedAutomationPageReason(url), undefined, String(url));
  }
});

test("a page that merely mentions a privileged scheme is still automatable", () => {
  // The rule anchors at the start of the URL: a query parameter naming another
  // scheme describes where a page will go next, not what the page is.
  assert.equal(unsupportedAutomationPageReason("https://example.test/?next=about:blank"), undefined);
  assert.equal(unsupportedAutomationPageReason("https://example.test/chrome://settings"), undefined);
});
