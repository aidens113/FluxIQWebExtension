import assert from "node:assert/strict";
import test from "node:test";

import { handleScriptedNavigationControl } from "../scripted-navigation-control";
import { FluxIQConnection } from "../connection";

function installChrome() {
  const runtime = {
    id: "extension-id",
    getURL: (path: string) => `chrome-extension://extension-id/${path}`
  };
  Object.defineProperty(globalThis, "chrome", { configurable: true, value: { runtime } });
}

function manager() {
  const calls: Array<[string, unknown]> = [];
  return {
    calls,
    value: {
      armScriptedNavigation: (url: unknown) => { calls.push(["arm", url]); return { ok: true, intentId: "intent-1" }; },
      awaitScriptedNavigation: async (id: unknown) => { calls.push(["await", id]); return { ok: true, intentId: "intent-1" }; },
      cancelScriptedNavigation: (id: unknown) => { calls.push(["cancel", id]); return id === "intent-1"; }
    } as unknown as FluxIQConnection
  };
}

const sidepanel = { id: "extension-id", url: "chrome-extension://extension-id/sidepanel/index.html" } as chrome.runtime.MessageSender;
const popup = { id: "extension-id", url: "chrome-extension://extension-id/popup/index.html" } as chrome.runtime.MessageSender;

test("the runner's tab-hosted exact sidepanel page may arm scripted navigation", async () => {
  installChrome();
  const h = manager();
  const runnerSidepanel = { ...sidepanel, tab: { id: 7 } } as chrome.runtime.MessageSender;
  assert.deepEqual(await handleScriptedNavigationControl({
    type: "fluxiq.test.armScriptedNavigation",
    url: "http://localhost/final"
  }, runnerSidepanel, h.value), {
    handled: true, response: { ok: true, intentId: "intent-1" }
  });
  assert.deepEqual(h.calls, [["arm", "http://localhost/final"]]);
});

test("the two extension control pages may arm, await, and idempotently cancel", async () => {
  installChrome();
  const h = manager();
  assert.deepEqual(await handleScriptedNavigationControl({ type: "fluxiq.test.armScriptedNavigation", url: "http://localhost/final" }, sidepanel, h.value), {
    handled: true, response: { ok: true, intentId: "intent-1" }
  });
  assert.deepEqual(await handleScriptedNavigationControl({ type: "fluxiq.test.awaitScriptedNavigation", intentId: "intent-1" }, popup, h.value), {
    handled: true, response: { ok: true, intentId: "intent-1" }
  });
  assert.deepEqual(await handleScriptedNavigationControl({ type: "fluxiq.test.cancelScriptedNavigation", intentId: "intent-1" }, sidepanel, h.value), {
    handled: true, response: { ok: true, cancelled: true }
  });
  assert.deepEqual(await handleScriptedNavigationControl({ type: "fluxiq.test.cancelScriptedNavigation", intentId: "missing" }, sidepanel, h.value), {
    handled: true, response: { ok: true, cancelled: false }
  });
});

test("content, wrong-extension, and unrecognised messages cannot reach the manager", async () => {
  installChrome();
  for (const sender of [
    { id: "extension-id", url: "http://127.0.0.1/scenario", tab: { id: 7 } },
    { ...sidepanel, id: "other-extension" },
    { ...sidepanel, url: "chrome-extension://extension-id/other.html" }
  ] as chrome.runtime.MessageSender[]) {
    const h = manager();
    assert.deepEqual(await handleScriptedNavigationControl({ type: "fluxiq.test.armScriptedNavigation", url: "http://localhost/final" }, sender, h.value), {
      handled: true, response: { ok: false, code: "forbidden" }
    });
    assert.deepEqual(await handleScriptedNavigationControl({ type: "fluxiq.test.cancelScriptedNavigation", intentId: "intent-1" }, sender, h.value), {
      handled: true, response: { ok: true, cancelled: false }
    });
    assert.deepEqual(h.calls, []);
  }
  const h = manager();
  assert.deepEqual(await handleScriptedNavigationControl({ type: "fluxiq.getStatus" }, sidepanel, h.value), { handled: false });
});

test("unauthorized await and senders without an exact control-page URL are fixed forbidden responses", async () => {
  installChrome();
  for (const sender of [{ id: "extension-id" }, { id: "extension-id", url: "" }] as chrome.runtime.MessageSender[]) {
    const h = manager();
    assert.deepEqual(await handleScriptedNavigationControl({ type: "fluxiq.test.awaitScriptedNavigation", intentId: "intent-1" }, sender, h.value), {
      handled: true, response: { ok: false, code: "forbidden" }
    });
    assert.deepEqual(h.calls, []);
  }
});

test("connection disconnect and tab removal cancel intents before their existing lifecycle work", async () => {
  const calls: string[] = [];
  const connection = Object.create(FluxIQConnection.prototype) as FluxIQConnection;
  Object.assign(connection as unknown as Record<string, unknown>, {
    scriptedNavigation: { cancelAll: () => calls.push("intents.disconnect"), cancelTab: (tabId: number) => calls.push(`intents.tab.${tabId}`) },
    gateway: { stopReconnecting: () => calls.push("gateway.stop"), closeClient: () => calls.push("gateway.close"), markDisconnected: () => calls.push("gateway.disconnected") },
    recording: { cancelStart: () => calls.push("recording.cancel"), state: () => "idle" },
    page: { handleTabRemoved: async (tabId: number) => { calls.push(`page.tab.${tabId}`); } }
  });
  connection.disconnect();
  await connection.handleTabRemoved(7);
  assert.deepEqual(calls, ["intents.disconnect", "gateway.stop", "recording.cancel", "gateway.close", "gateway.disconnected", "intents.tab.7", "page.tab.7"]);
});
