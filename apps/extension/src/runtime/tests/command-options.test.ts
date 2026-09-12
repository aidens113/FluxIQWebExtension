// T1 coverage of command-options.ts: the browser-level parameters an action
// carries. The gateway mapping copies unmapped parameters into `options`
// verbatim, so these readers are the only thing standing between a raw
// parameter and the tab or frame an action is aimed at.

import assert from "node:assert/strict";
import { test } from "node:test";
import type { BrowserActionCommand } from "../../shared/protocol";
import {
  downloadRequestForAction,
  frameIdForAction,
  opensNewTab,
  tabIdForAction,
  tabRequestForAction
} from "../command-options";

function command(overrides: Partial<BrowserActionCommand> = {}): BrowserActionCommand {
  return { commandId: "cmd-1", actionType: "web.browser.tab", ...overrides };
}

test("the frame an action names is read from the typed field first, then from browserFrameId", () => {
  assert.equal(frameIdForAction(command({ frameId: 3 })), 3);
  assert.equal(frameIdForAction(command({ options: { browserFrameId: 7 } })), 7);
  assert.equal(frameIdForAction(command({ frameId: 3, options: { browserFrameId: 7 } })), 3);
  // 0 is the top frame and must survive; undefined means "top frame only".
  assert.equal(frameIdForAction(command({ options: { browserFrameId: 0 } })), 0);
  assert.equal(frameIdForAction(command()), undefined);
});

test("a malformed frame or tab id is refused rather than coerced", () => {
  for (const browserFrameId of [-1, 1.5, "2", null, true]) {
    assert.equal(frameIdForAction(command({ options: { browserFrameId } as never })), undefined, String(browserFrameId));
  }
  for (const browserTabId of [-1, 1.5, "2", null]) {
    assert.equal(tabIdForAction(command({ options: { browserTabId } as never })), undefined, String(browserTabId));
  }
});

test("the tab an action names is read from the typed field first, then from browserTabId", () => {
  assert.equal(tabIdForAction(command({ tabId: 4 })), 4);
  assert.equal(tabIdForAction(command({ options: { browserTabId: 9 } })), 9);
  assert.equal(tabIdForAction(command({ tabId: 4, options: { browserTabId: 9 } })), 4);
  assert.equal(tabIdForAction(command()), undefined);
});

test("navigate opens a new tab only when it was asked to", () => {
  assert.equal(opensNewTab(command({ newTab: true })), true);
  assert.equal(opensNewTab(command({ options: { newTab: true } })), true);
  assert.equal(opensNewTab(command({ newTab: false, options: { newTab: true } })), false);
  assert.equal(opensNewTab(command({ options: { newTab: "yes" } as never })), false);
  assert.equal(opensNewTab(command()), false);
});

test("a tab request is taken from the typed field when the domain supplies one", () => {
  const tab = { operation: "switch", tabId: 11 } as const;
  assert.deepEqual(tabRequestForAction(command({ tab, options: { operation: "close" } })), tab);
});

test("each tab operation is read from the raw parameters the gateway passed through", () => {
  assert.deepEqual(
    tabRequestForAction(command({ url: "https://example.test/", options: { operation: "open", active: false } })),
    { operation: "open", url: "https://example.test/", active: false }
  );
  assert.deepEqual(
    tabRequestForAction(command({ options: { operation: "switch", urlPattern: "checkout" } })),
    { operation: "switch", urlPattern: "checkout" }
  );
  assert.deepEqual(
    tabRequestForAction(command({ options: { operation: "close", tabId: 5 } })),
    { operation: "close", tabId: 5 }
  );
  assert.deepEqual(tabRequestForAction(command({ options: { operation: "open" } })), { operation: "open" });
});

test("an unknown or missing operation yields no tab request, so the action fails instead of guessing", () => {
  assert.equal(tabRequestForAction(command({ options: { operation: "reload" } })), undefined);
  assert.equal(tabRequestForAction(command({ options: {} })), undefined);
  assert.equal(tabRequestForAction(command()), undefined);
});

test("a download request takes its file name and timeout from wherever they arrived", () => {
  assert.deepEqual(
    downloadRequestForAction(command({ download: { filename: "report.pdf", timeoutMs: 5_000 } })),
    { filename: "report.pdf", timeoutMs: 5_000 }
  );
  assert.deepEqual(
    downloadRequestForAction(command({ options: { filename: "invoice.csv", timeoutMs: 2_000 } })),
    { filename: "invoice.csv", timeoutMs: 2_000 }
  );
  // The command's own timeout applies when the request carries none.
  assert.deepEqual(downloadRequestForAction(command({ timeoutMs: 8_000 })), { timeoutMs: 8_000 });
  // Waiting for any download to finish is a legitimate request.
  assert.deepEqual(downloadRequestForAction(command()), {});
});
