// t968: before the side panel opens, the extension is told the run's own Core
// and gateway, and its worker is restarted on them, so the panel's first
// reachability probe never asks the product default the network guard refuses.

import assert from "node:assert/strict";
import test from "node:test";
import type { BrowserContext } from "@playwright/test";
import { preconfigureRunExtension } from "../preconfigure-run-extension.js";

const topology = { fluxiqOrigin: "http://127.0.0.1:41001", gatewayUrl: "ws://127.0.0.1:41002/client", scenarioOrigin: "http://127.0.0.1:41003" };

/** A context with one extension worker whose storage the run writes, a CDP session that lists no worker left to close, and a page that records where it went. */
function context() {
  const events: string[] = [];
  const stored: Record<string, unknown> = {};
  const worker = {
    url: () => "chrome-extension://unit/background/index.js",
    evaluate: async (run: (input: { key: string; value: unknown }) => Promise<string>, input: { key: string; value: unknown }) => {
      const chrome = { storage: { local: { set: async (items: Record<string, unknown>) => { Object.assign(stored, items); }, get: async (key: string) => ({ [key]: stored[key] }) } } };
      const previous = (globalThis as { chrome?: unknown }).chrome;
      (globalThis as { chrome?: unknown }).chrome = chrome;
      try {
        return await run(input);
      } finally {
        (globalThis as { chrome?: unknown }).chrome = previous;
      }
    }
  };
  const page = {
    goto: async (url: string) => { events.push(`goto ${url}`); },
    close: async () => { events.push("close"); }
  };
  const fake = {
    newPage: async () => {
      events.push("page");
      return page;
    },
    serviceWorkers: () => [worker],
    newCDPSession: async () => ({
      send: async (method: string) => {
        events.push(method);
        return { targetInfos: [] };
      },
      detach: async () => undefined
    })
  };
  return { context: fake as unknown as BrowserContext, events, stored };
}

test("the run's Core and gateway are stored, the worker restarted, and the waking page is the run's own Lab", async () => {
  const { context: browser, events, stored } = context();
  await preconfigureRunExtension(browser, topology);
  const settings = stored["fluxiq.settings"] as { coreApiUrl: string; gatewayUrl: string };
  assert.equal(settings.coreApiUrl, topology.fluxiqOrigin);
  assert.equal(settings.gatewayUrl, topology.gatewayUrl);
  assert.deepEqual(events, ["page", "Target.getTargets", "Target.getTargets", `goto ${topology.scenarioOrigin}/`, "close"]);
});

test("an installation the run attaches to, with no gateway of its own, is left as it is configured", async () => {
  const { context: browser, events, stored } = context();
  await preconfigureRunExtension(browser, { fluxiqOrigin: topology.fluxiqOrigin, scenarioOrigin: topology.scenarioOrigin });
  assert.deepEqual(events, []);
  assert.deepEqual(stored, {});
});
