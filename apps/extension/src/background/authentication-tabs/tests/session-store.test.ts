import assert from "node:assert/strict";
import test from "node:test";
import {
  AuthenticationTabs,
  AuthenticationTabsError,
  browserSessionAuthenticationTabStore,
  type AuthenticationTabOwnership
} from "..";
import { deferred, memoryArea } from "./fixture";

const SESSION_KEY = "fluxiq.authenticationTabs.browserSession";
const OWNERS_KEY = "fluxiq.authenticationTabs.ownership";
const routes = [{ origin: "https://core.example", pathname: "/connect", includeDescendants: true }];

test("session adapter awaits trusted-context access before reading or writing ownership", async () => {
  const { area, calls } = memoryArea();
  const trusted = deferred<void>();
  area.setAccessLevel = async (options) => {
    calls.push(options.accessLevel);
    await trusted.promise;
  };
  const store = browserSessionAuthenticationTabStore(area, () => "browser-session.1");
  const reading = store.load();
  await Promise.resolve();
  assert.deepEqual(calls, ["TRUSTED_CONTEXTS"]);
  trusted.resolve();
  assert.deepEqual(await reading, { browserSessionId: "browser-session.1", ownership: undefined });
  assert.deepEqual(calls, ["TRUSTED_CONTEXTS", "get", "set"]);
});

test("new adapters share one browser-session marker and serialize initialization", async () => {
  const { area } = memoryArea();
  let minted = 0;
  const first = browserSessionAuthenticationTabStore(area, () => `browser-session.${++minted}`);
  const second = browserSessionAuthenticationTabStore(area, () => `browser-session.${++minted}`);
  const observations = await Promise.all([first.load(), second.load()]);
  assert.equal(minted, 1);
  assert.equal(observations[0]!.browserSessionId, observations[1]!.browserSessionId);
});

test("same-session restart restores ownership without local storage or a new session identity", async () => {
  const { area, values } = memoryArea();
  const first = new AuthenticationTabs({ store: browserSessionAuthenticationTabStore(area, () => "browser-session.1"), routes });
  await first.ready();
  await first.own(12, "attempt.1");
  const restarted = new AuthenticationTabs({ store: browserSessionAuthenticationTabStore(area, () => "browser-session.should-not-mint"), routes });
  await restarted.ready();
  assert.equal(restarted.eligible({ tabId: 12, url: "https://ordinary.example" }), false);
  assert.equal(values[SESSION_KEY], "browser-session.1");
  assert.deepEqual(Object.keys(values).sort(), [SESSION_KEY, OWNERS_KEY].sort());
});

test("session-marker change discards old ids and refuses a stale registry write", async () => {
  const { area, values } = memoryArea();
  const old = new AuthenticationTabs({ store: browserSessionAuthenticationTabStore(area, () => "browser-session.old"), routes });
  await old.ready();
  await old.own(12, "attempt.old");
  // Real browser restart clears both keys. Retain the old envelope here to
  // prove even an accidentally supplied old record cannot claim a reused id.
  delete values[SESSION_KEY];
  const current = new AuthenticationTabs({ store: browserSessionAuthenticationTabStore(area, () => "browser-session.new"), routes });
  await current.ready();
  assert.equal(current.eligible({ tabId: 12, url: "https://ordinary.example" }), true);
  assert.deepEqual(values[OWNERS_KEY], { version: 1, browserSessionId: "browser-session.new", owners: [] });
  await assert.rejects(old.release(12, "attempt.old"), { code: "storage_unavailable" });
  assert.deepEqual(values[OWNERS_KEY], { version: 1, browserSessionId: "browser-session.new", owners: [] });
  assert.equal(current.eligible({ tabId: 12, url: "https://core.example/connect/done" }), false);
});

test("a browser without access-level mutation still uses its real session area, never a different lifetime", async () => {
  const { area } = memoryArea();
  delete area.setAccessLevel;
  const store = browserSessionAuthenticationTabStore(area, () => "browser-session.1");
  assert.equal((await store.load()).browserSessionId, "browser-session.1");
});

test("missing browser session API fails closed without touching local or sync fallbacks", async () => {
  const global = globalThis as { chrome?: unknown };
  const previous = global.chrome;
  let fallbackCalls = 0;
  const fallback = { get: async () => {
    fallbackCalls += 1;
    return {};
  } };
  global.chrome = { storage: { local: fallback, sync: fallback } };
  try {
    const registry = new AuthenticationTabs({ store: browserSessionAuthenticationTabStore(), routes });
    await assert.rejects(registry.ready(), { code: "storage_unavailable" });
    assert.equal(fallbackCalls, 0);
    assert.equal(registry.eligible({ tabId: 12, url: "about:blank" }), false);
  } finally {
    if (previous === undefined) delete global.chrome;
    else global.chrome = previous;
  }
});

for (const failure of ["access", "read", "write"] as const) test(`session ${failure} rejection is sanitized and never admits a tab`, async () => {
  const { area } = memoryArea();
  const reject = async () => { throw Object.assign(new Error("synthetic.private.storage"), { cause: "synthetic.verifier" }); };
  if (failure === "access") area.setAccessLevel = reject;
  if (failure === "read") area.get = reject;
  if (failure === "write") area.set = reject;
  const registry = new AuthenticationTabs({ store: browserSessionAuthenticationTabStore(area, () => "browser-session.1"), routes });
  await assert.rejects(registry.ready(), (error: unknown) => {
    assert.ok(error instanceof AuthenticationTabsError);
    assert.equal(error.message, "Authentication-tab session storage is unavailable.");
    assert.equal(error.cause, undefined);
    return true;
  });
  assert.equal(registry.eligible({ tabId: 12, url: "https://ordinary.example" }), false);
});

test("adapter refuses extra authentication secrets rather than copying whole records", async () => {
  const { area, values } = memoryArea();
  const store = browserSessionAuthenticationTabStore(area, () => "browser-session.1");
  await store.load();
  const unsafe = { version: 1, browserSessionId: "browser-session.1", owners: [], verifier: "synthetic.secret" };
  await assert.rejects(store.save(unsafe as AuthenticationTabOwnership), { code: "storage_unavailable" });
  assert.equal(values[OWNERS_KEY], undefined);
  assert.equal(JSON.stringify(values).includes("synthetic.secret"), false);
});
