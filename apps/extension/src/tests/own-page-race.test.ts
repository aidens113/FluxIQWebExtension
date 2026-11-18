// The two cases the background's tab check cannot see, closed by the document
// that receives the command (`content/own-document/`) and carried back through
// the gate's send (`background/tab-gate/page-message.ts`) and the runtime:
// a tab that moved to FluxIQ's own page between the check and the send, and a
// FluxIQ page framed inside an ordinary tab. And the injected-read path, which
// re-checks the tab once its injection returns.
//
// Here because it spans all three of background/, content/ and runtime/.

import assert from "node:assert/strict";
import { test } from "node:test";
import { WEB_AUTOMATION_FAILURE_CODES } from "@fluxiq-web-extension/domain/client";
import { OwnPageRefusal, sendTabMessage } from "../background/tab-gate";
import { installFakeBrowser, PANEL_ORIGIN, PANEL_TAB, SHOP_TAB } from "../background/tab-gate/tests/fake-browser";
import { createOwnDocumentCheck, guardedCommandListener, type ContentRoute } from "../content/own-document";
import { forgetAutomationTab, runBrowserActionCommand, servedStatus } from "../runtime";
import { keptLooks } from "../runtime/look-reuse";

const ADDRESSES = [PANEL_ORIGIN, "ws://127.0.0.1:4777/client"];

/** A document at `origin` running the content script's guard over a route that records every page read. */
function documentAt(origin: string) {
  const reads: unknown[] = [];
  const route = (message: unknown): ContentRoute => ({
    answer: (reply) => {
      reads.push(message);
      const type = (message as { type?: string }).type;
      reply(type === "fluxiq.ping" ? { ok: true, active: true, version: 2 } : type === "fluxiq.pageChallenge" ? { challenge: null } : { commandId: "c", actionType: "web.dom.click", status: "succeeded", message: "done", validation: { status: "passed", expected: "x", actual: "x" }, startedAt: 1, finishedAt: 2 });
    },
    ...((message as { type?: string }).type === "fluxiq.ping" ? { liveness: true as const } : {})
  });
  const listener = guardedCommandListener(route, createOwnDocumentCheck({ origins: () => [origin], ask: async () => ({ ok: true, addresses: ADDRESSES }) }));
  const receive = (message: unknown): Promise<unknown> => new Promise((resolve) => void listener(message, {}, resolve));
  return { receive, reads };
}

async function withBrowser(options: Parameters<typeof installFakeBrowser>[1], run: () => Promise<void>): Promise<void> {
  forgetAutomationTab();
  keptLooks.forget(undefined);
  const browser = installFakeBrowser([PANEL_TAB, { ...SHOP_TAB, active: true }], options);
  try {
    await run();
  } finally {
    browser.uninstall();
    forgetAutomationTab();
  }
}

test("a tab that moved to FluxIQ's page after the check is refused by the document the command reaches", async () => {
  // The tab still reads as the shop when the gate checks it; the document the message lands in is the panel.
  const landed = documentAt(PANEL_ORIGIN);
  await withBrowser({ receive: (message) => landed.receive(message) }, async () => {
    await assert.rejects(sendTabMessage(SHOP_TAB.id, { type: "executeAction" }), (error: unknown) => error instanceof OwnPageRefusal);
    const { result } = await runBrowserActionCommand({ action: { commandId: "c-1", actionType: "web.dom.click", selector: "#delete-key", tabId: SHOP_TAB.id }, attachTabForRecording: () => Promise.resolve() });
    assert.equal(result.status, "failed");
    assert.equal(result.failure?.code, WEB_AUTOMATION_FAILURE_CODES.ACTION_REJECTED);
    assert.ok(result.message?.startsWith(OwnPageRefusal.MESSAGE), result.message);
  });
  assert.equal(landed.reads.filter((message) => (message as { type?: string }).type !== "fluxiq.ping").length, 0, "nothing but the ping was answered in the panel's document");
});

test("a FluxIQ page framed in an ordinary tab is refused while the tab's own document still answers", async () => {
  const top = documentAt("https://shop.example");
  const framed = documentAt(PANEL_ORIGIN);
  await withBrowser({ receive: (message, _tabId, frameId) => (frameId === 4 ? framed : top).receive(message) }, async () => {
    assert.equal((await sendTabMessage<{ status: string }>(SHOP_TAB.id, { type: "executeAction", frameId: 0 }, 0)).status, "succeeded");
    await assert.rejects(sendTabMessage(SHOP_TAB.id, { type: "executeAction", frameId: 4 }, 4), (error: unknown) => error instanceof OwnPageRefusal);
  });
  assert.equal(top.reads.length, 1);
  assert.equal(framed.reads.length, 0);
});

test("an injected read whose tab moved to FluxIQ's page while it ran is discarded and refused", async () => {
  await withBrowser({ duringScript: (move) => move(SHOP_TAB.id, `${PANEL_ORIGIN}/security/keys`) }, async () => {
    const status = await servedStatus(SHOP_TAB.id, undefined);
    assert.ok("unread" in status && status.unread.includes(OwnPageRefusal.MESSAGE), JSON.stringify(status));
  });
});
