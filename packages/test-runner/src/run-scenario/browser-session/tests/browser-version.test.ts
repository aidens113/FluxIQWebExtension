import assert from "node:assert/strict";
import test from "node:test";
import type { BrowserContext, Page } from "@playwright/test";
import { browserVersionFromCdp } from "../browser-version.js";

function contextWith(result: { product: string; userAgent: string } | Error) {
  const state = { detached: 0, sent: [] as string[] };
  const context = {
    newCDPSession: async () => ({
      send: async (method: string) => { state.sent.push(method); if (result instanceof Error) throw result; return result; },
      detach: async () => { state.detached += 1; },
    }),
  } as unknown as BrowserContext;
  return { context, state };
}

const page = {} as Page;

test("the running browser's own product string is the build a run records", async () => {
  const { context, state } = contextWith({ product: "HeadlessChrome/133.0.6943.16", userAgent: "Mozilla/5.0 ..." });
  assert.equal(await browserVersionFromCdp(context, page), "HeadlessChrome/133.0.6943.16");
  assert.deepEqual(state.sent, ["Browser.getVersion"]);
  assert.equal(state.detached, 1, "the session is closed, so a run does not leak one per version read");
});

test("a build reporting no product falls back to its user agent rather than to nothing", async () => {
  const { context } = contextWith({ product: "", userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/133.0.0.0" });
  assert.equal(await browserVersionFromCdp(context, page), "Mozilla/5.0 (Windows NT 10.0) Chrome/133.0.0.0");
});

test("a failed read propagates, and still closes the session it opened", async () => {
  const { context, state } = contextWith(new Error("target closed"));
  await assert.rejects(() => browserVersionFromCdp(context, page), /target closed/u);
  assert.equal(state.detached, 1);
});
