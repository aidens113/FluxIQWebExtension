import assert from "node:assert/strict";
import test from "node:test";
import { readBuildIdentity } from "../build-identity";
test("build diagnostics require the exact extension control page and address only frame zero", async () => {
  const previous = globalThis.chrome;
  const calls: unknown[] = [];
  globalThis.chrome = {
    runtime: { id: "test-extension", getURL: (page: string) => `chrome-extension://test-extension/${page}` },
    // Sent through the tab gate, which reads the tab first and sends with a callback (`../../tab-gate/`).
    tabs: {
      get: async (tabId: number) => ({ id: tabId, url: "https://example.test/" }),
      sendMessage: (...args: unknown[]) => { calls.push(args.slice(0, 3)); (args[3] as (reply: unknown) => void)({ identity: "test" }); }
    },
  } as unknown as typeof chrome;
  try {
    for (const sender of [{ id: "test-extension", url: "https://example.test/" }, { id: "other", url: "chrome-extension://test-extension/sidepanel/index.html" }, { id: "test-extension", url: "chrome-extension://test-extension/sidepanel/index.html.evil" }]) assert.deepEqual(await readBuildIdentity({ tabId: 3 }, sender), { ok: false, code: "forbidden" });
    assert.deepEqual(calls, []);
    const sender = { id: "test-extension", url: "chrome-extension://test-extension/sidepanel/index.html" };
    assert.deepEqual(await readBuildIdentity({ tabId: "3" }, sender), { ok: false, code: "invalid_tab" });
    assert.deepEqual(await readBuildIdentity({ tabId: 3 }, sender), { ok: true, background: null, content: { identity: "test" } });
    assert.deepEqual(calls, [[3, { type: "fluxiq.buildIdentity" }, { frameId: 0 }]]);
  } finally { globalThis.chrome = previous; }
});
