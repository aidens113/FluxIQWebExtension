import assert from "node:assert/strict";
import test from "node:test";
import { AuthenticationTabs, type AuthenticationTabSessionStore } from "..";
import { deferred, memoryStore } from "./fixture";

test("ownership and session identity stay unavailable during hydration", async () => {
  const loading = deferred<{ browserSessionId: string; ownership: unknown }>();
  const registry = new AuthenticationTabs({ store: { load: () => loading.promise, save: async () => undefined }, routes: [] });
  assert.equal(registry.owns(12, "attempt.1"), false);
  assert.equal(registry.sessionIdentity(), null);
  loading.resolve({ browserSessionId: "browser-session.1", ownership: { version: 1, browserSessionId: "browser-session.1", owners: [{ tabId: 12, attemptId: "attempt.1" }] } });
  await registry.ready();
  assert.equal(registry.owns(12, "attempt.1"), true);
  assert.equal(registry.owns(12, "attempt.other"), false);
  assert.equal(registry.owns(13, "attempt.1"), false);
  assert.equal(registry.sessionIdentity(), "browser-session.1");
});

test("a pending exclusion reservation never supplies durable ownership", async () => {
  const saving = deferred<void>();
  const started = deferred<void>();
  const store: AuthenticationTabSessionStore = {
    load: async () => ({ browserSessionId: "browser-session.1", ownership: undefined }),
    save: async () => {
      started.resolve();
      await saving.promise;
    }
  };
  const registry = new AuthenticationTabs({ store, routes: [] });
  await registry.ready();
  const claimed = registry.own(12, "attempt.1");
  assert.equal(registry.eligible({ tabId: 12, url: "about:blank" }), false);
  assert.equal(registry.owns(12, "attempt.1"), false);
  await started.promise;
  assert.equal(registry.owns(12, "attempt.1"), false);
  saving.resolve();
  await claimed;
  assert.equal(registry.owns(12, "attempt.1"), true);
});

test("ownership remains committed during release and ends after its save", async () => {
  const inner = memoryStore();
  const release = deferred<void>();
  let writes = 0;
  const registry = new AuthenticationTabs({ store: { load: inner.store.load, save: async value => {
    writes += 1;
    if (writes === 2) await release.promise;
    await inner.store.save(value);
  } }, routes: [] });
  await registry.ready();
  await registry.own(12, "attempt.1");
  const released = registry.release(12, "attempt.1");
  assert.equal(registry.owns(12, "attempt.1"), true);
  release.resolve();
  await released;
  assert.equal(registry.owns(12, "attempt.1"), false);
});

test("storage failure removes ownership and session authority despite an older committed map", async () => {
  const inner = memoryStore();
  let fail = false;
  const registry = new AuthenticationTabs({ store: { load: inner.store.load, save: async value => {
    if (fail) throw new Error("synthetic private storage failure");
    await inner.store.save(value);
  } }, routes: [] });
  await registry.ready();
  await registry.own(12, "attempt.1");
  fail = true;
  await assert.rejects(registry.release(12, "attempt.1"));
  assert.equal(registry.owns(12, "attempt.1"), false);
  assert.equal(registry.sessionIdentity(), null);
});

test("same-session restart restores ownership, new session never reuses old authority", async () => {
  const inner = memoryStore();
  const first = new AuthenticationTabs({ store: inner.store, routes: [] });
  await first.ready();
  await first.own(12, "attempt.1");
  const same = new AuthenticationTabs({ store: inner.store, routes: [] });
  await same.ready();
  assert.equal(same.owns(12, "attempt.1"), true);
  const newer = memoryStore("browser-session.2", inner.snapshot());
  const next = new AuthenticationTabs({ store: newer.store, routes: [] });
  await next.ready();
  assert.equal(next.sessionIdentity(), "browser-session.2");
  assert.equal(next.owns(12, "attempt.1"), false);
});

test("invalid tab or attempt values cannot resemble a missing map entry", async () => {
  const inner = memoryStore();
  const registry = new AuthenticationTabs({ store: inner.store, routes: [] });
  await registry.ready();
  assert.equal(registry.owns(-1, "attempt.1"), false);
  assert.equal(registry.owns(Number.NaN, "attempt.1"), false);
  assert.equal(registry.owns(12, ""), false);
  assert.equal(registry.owns(12, undefined as unknown as string), false);
});
