import assert from "node:assert/strict";
import test from "node:test";
import { AuthenticationTabs } from "..";
import { deferred, memoryStore } from "./fixture";

test("ID-only ownership and capture observations cover hydration and pending reservations", async () => {
  const loading = deferred<{ browserSessionId: string; ownership: unknown }>();
  const writing = deferred<void>();
  const registry = new AuthenticationTabs({ routes: [], store: { load: () => loading.promise, save: () => writing.promise } });
  assert.equal(registry.ownership(2), "unavailable");
  assert.equal(registry.captureBlocked(), true);
  loading.resolve({ browserSessionId: "browser-session.1", ownership: undefined });
  await registry.ready();
  assert.equal(registry.ownership(2), "unowned");
  assert.equal(registry.captureBlocked(), false);
  const claim = registry.own(2, "attempt.1");
  assert.equal(registry.ownership(2), "excluded");
  assert.equal(registry.captureBlocked(), true);
  writing.resolve();
  await claim;
  assert.equal(registry.ownership(2), "excluded");
});

test("a pending URL cannot bypass the routes", async () => {
  const registry = new AuthenticationTabs({ store: memoryStore().store, routes: [{ origin: "https://core.example.test", pathname: "/connect", includeDescendants: true }] });
  await registry.ready();
  // The routes are the sign-in pages: a tab on one is not eligible, and neither is a tab about to load one.
  assert.equal(registry.eligible({ tabId: 1, url: "https://ordinary.example.test/" }), true);
  assert.equal(registry.eligible({ tabId: 1, url: "https://ordinary.example.test/", pendingUrl: "https://ordinary.example.test/next" }), true);
  assert.equal(registry.eligible({ tabId: 1, url: "https://ordinary.example.test/", pendingUrl: "https://core.example.test/connect/authorize" }), false);
  assert.equal(registry.eligible({ tabId: 1, url: "https://core.example.test/connect/start" }), false);
});

test("inheritance uses the registry's committed opener owner", async () => {
  const registry = new AuthenticationTabs({ store: memoryStore().store, routes: [] });
  await registry.ready();
  assert.equal(await registry.inherit(3, 2), false);
  await registry.own(2, "attempt.1");
  const child = registry.inherit(3, 2);
  assert.equal(registry.ownership(3), "excluded");
  assert.equal(await child, true);
  assert.equal(registry.owns(3, "attempt.1"), true);
  await assert.rejects(registry.inherit(4, -1));
});
