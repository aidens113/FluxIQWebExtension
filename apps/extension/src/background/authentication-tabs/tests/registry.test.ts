import assert from "node:assert/strict";
import test from "node:test";
import { AuthenticationTabs, AuthenticationTabsError, type AuthenticationTabSessionStore } from "..";
import { deferred, memoryStore } from "./fixture";

const ordinary = { tabId: 12, url: "https://ordinary.example/page" };
const routes = [{ origin: "https://core.example", pathname: "/connect", includeDescendants: true }];

test("hydration is an awaited admission barrier, including ordinary blank tabs", async () => {
  const loading = deferred<{ browserSessionId: string; ownership: unknown }>();
  const registry = new AuthenticationTabs({ store: { load: () => loading.promise, save: async () => undefined }, routes });
  assert.equal(registry.status(), "loading");
  assert.equal(registry.eligible(ordinary), false);
  assert.equal(registry.eligible({ tabId: 13, url: "about:blank" }), false);
  loading.resolve({ browserSessionId: "browser-session.1", ownership: undefined });
  await registry.ready();
  assert.equal(registry.status(), "ready");
  assert.equal(registry.eligible(ordinary), true);
  assert.equal(registry.eligible({ tabId: 13, url: "about:blank" }), true);
});

test("owned authentication tab stays excluded on blank, Core, signup and off-origin navigation", async () => {
  const { store, snapshot } = memoryStore();
  const registry = new AuthenticationTabs({ store, routes });
  await registry.ready();
  await registry.own(12, "attempt.1");
  for (const url of ["about:blank", "https://core.example/connect/authorize#synthetic.fragment", "https://signup.example/form", "https://ordinary.example/page"]) {
    assert.equal(registry.eligible({ tabId: 12, url }), false);
  }
  assert.equal(registry.eligible({ tabId: 13, url: ordinary.url }), true);
  assert.equal(JSON.stringify(snapshot()).includes("synthetic.fragment"), false);
  assert.deepEqual(snapshot(), { version: 1, browserSessionId: "browser-session.1", owners: [{ tabId: 12, attemptId: "attempt.1" }] });
});

test("same-browser-session worker restart restores exact owners", async () => {
  const { store } = memoryStore();
  const first = new AuthenticationTabs({ store, routes });
  await first.ready();
  await first.own(12, "attempt.1");
  const restarted = new AuthenticationTabs({ store, routes });
  assert.equal(restarted.eligible(ordinary), false);
  await restarted.ready();
  assert.equal(restarted.eligible(ordinary), false);
  assert.equal(await restarted.release(12, "attempt.other"), false);
  assert.equal(await restarted.release(12, "attempt.1"), true);
  assert.equal(restarted.eligible(ordinary), true);
});

test("a new browser session discards old ownership instead of claiming reused tab ids", async () => {
  const { store, snapshot } = memoryStore("browser-session.new", { version: 1, browserSessionId: "browser-session.old", owners: [{ tabId: 12, attemptId: "attempt.old" }] });
  const registry = new AuthenticationTabs({ store, routes });
  await registry.ready();
  assert.equal(registry.eligible(ordinary), true);
  assert.equal(await registry.release(12, "attempt.old"), false);
  assert.deepEqual(snapshot(), { version: 1, browserSessionId: "browser-session.new", owners: [] });
  assert.equal(registry.eligible({ tabId: 12, url: "https://core.example/connect/done#synthetic.code" }), false);
});

test("only the exact attempt can release an id, and another attempt cannot overwrite it", async () => {
  const { store, saved } = memoryStore();
  const registry = new AuthenticationTabs({ store, routes });
  await registry.ready();
  await registry.own(12, "attempt.1");
  await registry.own(12, "attempt.1");
  assert.equal(saved.length, 1);
  await assert.rejects(registry.own(12, "attempt.2"), { code: "ownership_conflict" });
  assert.equal(await registry.release(12, "attempt.2"), false);
  assert.equal(registry.eligible(ordinary), false);
  assert.equal(await registry.release(12, "attempt.1"), true);
  await registry.own(12, "attempt.2");
  assert.equal(await registry.release(12, "attempt.1"), false);
  assert.equal(registry.eligible(ordinary), false);
});

test("own reserves exclusion immediately and resolves only after commit; release waits for commit", async () => {
  const pendingOwn = deferred<void>();
  const pendingRelease = deferred<void>();
  const started = deferred<void>();
  let writes = 0;
  const store: AuthenticationTabSessionStore = {
    load: async () => ({ browserSessionId: "browser-session.1", ownership: undefined }),
    save: async () => {
      writes += 1;
      if (writes === 1) {
        started.resolve();
        await pendingOwn.promise;
      } else await pendingRelease.promise;
    }
  };
  const registry = new AuthenticationTabs({ store, routes });
  await registry.ready();
  const owned = registry.own(12, "attempt.1");
  assert.equal(registry.eligible(ordinary), false);
  assert.equal(registry.eligible({ tabId: 13, url: "about:blank" }), true);
  await started.promise;
  pendingOwn.resolve();
  await owned;
  const released = registry.release(12, "attempt.1");
  assert.equal(registry.eligible(ordinary), false);
  pendingRelease.resolve();
  assert.equal(await released, true);
  assert.equal(registry.eligible(ordinary), true);
});

test("concurrent mutations retain every owner and stale queued release cannot clear its replacement", async () => {
  const { store, snapshot } = memoryStore();
  const registry = new AuthenticationTabs({ store, routes });
  await registry.ready();
  await Promise.all([registry.own(12, "attempt.1"), registry.own(13, "attempt.2")]);
  const released = registry.release(12, "attempt.1");
  const replaced = registry.own(12, "attempt.3");
  const stale = registry.release(12, "attempt.1");
  assert.equal(await released, true);
  await replaced;
  assert.equal(await stale, false);
  assert.deepEqual(snapshot(), { version: 1, browserSessionId: "browser-session.1", owners: [{ tabId: 13, attemptId: "attempt.2" }, { tabId: 12, attemptId: "attempt.3" }] });
});

test("storage read failure rejects readiness safely and never admits automation", async () => {
  const registry = new AuthenticationTabs({ store: {
    load: async () => { throw Object.assign(new Error("synthetic.private.error"), { cause: "synthetic.credential" }); },
    save: async () => undefined
  }, routes });
  await assert.rejects(registry.ready(), (error: unknown) => {
    assert.ok(error instanceof AuthenticationTabsError);
    assert.equal(error.message.includes("synthetic."), false);
    assert.equal(error.cause, undefined);
    return true;
  });
  assert.equal(registry.status(), "failed");
  assert.equal(registry.eligible(ordinary), false);
  await assert.rejects(registry.own(12, "attempt.1"));
});

for (const operation of ["own", "release"] as const) test(`storage ${operation} failure keeps all admission closed`, async () => {
  let failWrites = false;
  const inner = memoryStore();
  const registry = new AuthenticationTabs({ store: { load: inner.store.load, save: async (value) => {
    if (failWrites) throw new Error("synthetic.private.write");
    await inner.store.save(value);
  } }, routes });
  await registry.ready();
  if (operation === "release") await registry.own(12, "attempt.1");
  failWrites = true;
  await assert.rejects(registry[operation](12, "attempt.1"), { code: "storage_unavailable" });
  assert.equal(registry.status(), "failed");
  assert.equal(registry.eligible(ordinary), false);
  assert.equal(registry.eligible({ tabId: 13, url: "https://ordinary.example/other" }), false);
  await assert.rejects(registry.ready(), { code: "storage_unavailable" });
});

for (const ownership of [null, {}, { version: 2, browserSessionId: "browser-session.1", owners: [] },
  { version: 1, browserSessionId: "browser-session.1", owners: [{ tabId: 12, attemptId: "attempt.1" }, { tabId: 12, attemptId: "attempt.2" }] },
  { version: 1, browserSessionId: "browser-session.1", owners: [{ tabId: 12, attemptId: "attempt.1", verifier: "synthetic.private" }] }
]) test("malformed ownership fails closed without copying unsafe state", async () => {
  const { store, saved } = memoryStore("browser-session.1", ownership);
  const registry = new AuthenticationTabs({ store, routes });
  await assert.rejects(registry.ready(), { code: "invalid_state" });
  assert.equal(registry.eligible(ordinary), false);
  assert.deepEqual(saved, []);
});

test("invalid ownership requests and missing tab evidence do not admit or mutate state", async () => {
  const { store, saved } = memoryStore();
  const registry = new AuthenticationTabs({ store, routes });
  await registry.ready();
  assert.throws(() => registry.own(-1, "attempt.1"), { code: "invalid_owner" });
  assert.throws(() => registry.own(12, "#synthetic.secret"), { code: "invalid_owner" });
  assert.equal(registry.eligible({ tabId: -1, url: ordinary.url }), false);
  assert.equal(registry.eligible({ tabId: 12 }), false);
  assert.deepEqual(saved, []);
});
