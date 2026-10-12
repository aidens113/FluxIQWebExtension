import assert from "node:assert/strict";
import test from "node:test";
import { chromeWorkerTarget } from "../chrome-worker-target.js";

test("Chrome discovery requires one unambiguous extension service worker and releases its session", async () => {
  let detached = 0;
  const targets = [
    { type: "service_worker", url: "https://fixture.example/worker.js" },
    { type: "page", url: "chrome-extension://abcdefghijkl/sidepanel/index.html" },
    { type: "service_worker", url: "chrome-extension://abcdefghijkl/background.js" },
  ];
  const context = {
    pages: () => [{}],
    newCDPSession: async () => ({ send: async () => ({ targetInfos: targets }), detach: async () => { detached++; } }),
  };
  assert.equal((await chromeWorkerTarget(context))?.url(), targets[2]!.url);
  assert.equal(detached, 1);
  targets.push({ type: "service_worker", url: "chrome-extension://mnop/background.js" });
  assert.equal(await chromeWorkerTarget(context), undefined);
  assert.equal(detached, 2);
});

test("missing, malformed or unavailable Chrome evidence cannot replace worker readiness", async () => {
  for (const context of [null, {}, { pages: [], newCDPSession: async () => undefined }, { pages: () => [], newCDPSession: async () => undefined }]) {
    assert.equal(await chromeWorkerTarget(context), undefined);
  }
  for (const response of [{}, { targetInfos: null }, { targetInfos: [{ type: "service_worker", url: "invalid" }] }, { targetInfos: [{ type: "service_worker", url: "chrome-extension://abcdefghijkl/" }] }]) {
    let detached = false;
    const context = { pages: () => [{}], newCDPSession: async () => ({ send: async () => response, detach: async () => { detached = true; } }) };
    assert.equal(await chromeWorkerTarget(context), undefined);
    assert.equal(detached, true);
  }
  let detached = false;
  await assert.rejects(chromeWorkerTarget({ pages: () => [{}], newCDPSession: async () => ({ send: async () => { throw new Error("Unit CDP failure"); }, detach: async () => { detached = true; } }) }), /Chrome extension worker discovery was unavailable/u);
  assert.equal(detached, true);
});
