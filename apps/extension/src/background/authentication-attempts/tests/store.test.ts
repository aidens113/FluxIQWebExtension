import assert from "node:assert/strict";
import test from "node:test";
import { browserSessionPkceAttemptStore } from "..";
import { HostedPkceFailure, type HostedPkceStoredAttempt } from "../../connect/pkce";
import { attempt, deferred, fixture, KEY } from "./fixture";

const code = (expected: string) => (error: unknown) => error instanceof HostedPkceFailure && error.code === expected;

test("empty state is durably scoped to the authoritative browser session", async () => {
  const h = fixture();
  const value = await h.store.load();
  assert.deepEqual(value, { browserSessionId: h.state.session, revision: 0, attempt: null });
  assert.deepEqual(h.state.values[KEY], value);
  assert.deepEqual(h.state.access, ["TRUSTED_CONTEXTS"]);
  assert.equal(h.state.writes, 1);
});

test("competing adapters on the same area permit one CAS winner and retain revision after restart", async () => {
  const h = fixture();
  const empty = await h.store.load();
  const second = browserSessionPkceAttemptStore({ authenticationTabs: h.authenticationTabs, area: h.area });
  const results = await Promise.all([h.store.compareAndSwap(empty, attempt()), second.compareAndSwap(empty, attempt())]);
  assert.deepEqual(results, [true, false]);
  assert.equal((await second.load()).revision, 1);
  assert.equal((await second.load()).attempt?.attemptId, "attempt.fixture");
});

test("CAS does not resolve before durable persistence completes", async () => {
  const h = fixture();
  const empty = await h.store.load();
  const gate = deferred();
  const entered = deferred();
  h.hooks.beforeSet = async () => {
    entered.resolve();
    await gate.promise;
  };
  let resolved = false;
  const pending = h.store.compareAndSwap(empty, attempt()).then(value => {
    resolved = true;
    return value;
  });
  await entered.promise;
  assert.equal(resolved, false);
  assert.equal(h.state.writes, 1);
  gate.resolve();
  assert.equal(await pending, true);
  assert.equal(h.state.writes, 2);
});

test("CAS detaches proposed records before waiting and load returns immutable snapshots", async () => {
  const h = fixture();
  const empty = await h.store.load();
  const proposed = structuredClone(attempt());
  const gate = deferred();
  h.hooks.beforeGet = () => gate.promise;
  const pending = h.store.compareAndSwap(empty, proposed);
  Object.assign(proposed.binding, { origin: "https://changed.example.test" });
  gate.resolve();
  assert.equal(await pending, true);
  delete h.hooks.beforeGet;
  const loaded = await h.store.load();
  assert.equal(loaded.attempt?.binding.origin, "https://cloud.example.test");
  assert.ok(Object.isFrozen(loaded) && Object.isFrozen(loaded.attempt) && Object.isFrozen(loaded.attempt?.binding));
});

test("an old expected session cannot write and valid old-session persisted state is cleared", async () => {
  const h = fixture();
  const empty = await h.store.load();
  assert.equal(await h.store.compareAndSwap(empty, attempt()), true);
  h.state.session = "browser-session.2";
  assert.equal(await h.store.compareAndSwap(empty, null), false);
  assert.deepEqual(await h.store.load(), { browserSessionId: "browser-session.2", revision: 0, attempt: null });
  assert.deepEqual(h.state.values[KEY], { browserSessionId: "browser-session.2", revision: 0, attempt: null });
});

for (const phase of ["access", "read", "write"] as const) {
  test("session changes during " + phase + " refuse rather than adopting stale state", async () => {
    const h = fixture();
    const empty = await h.store.load();
    const change = async () => { h.state.session = "browser-session.2"; };
    if (phase === "access") h.hooks.access = change;
    if (phase === "read") h.hooks.beforeGet = change;
    if (phase === "write") h.hooks.afterSet = change;
    await assert.rejects(h.store.compareAndSwap(empty, attempt()), code("session_changed"));
    if (phase !== "write") assert.equal(h.state.writes, 1);
  });
}

test("unavailable or failed ownership never touches session storage", async () => {
  const h = fixture();
  h.state.unavailable = true;
  await assert.rejects(h.store.load(), code("ownership_unavailable"));
  h.state.unavailable = false;
  h.state.session = null;
  await assert.rejects(h.store.load(), code("ownership_unavailable"));
  assert.equal(h.state.reads + h.state.writes, 0);
});

for (const phase of ["access", "read", "write"] as const) {
  test("private " + phase + " failures are sanitized and no memory fallback wins", async () => {
    const h = fixture();
    const empty = await h.store.load();
    const fail = async () => { throw new Error("private-verifier-path"); };
    if (phase === "access") h.hooks.access = fail;
    if (phase === "read") h.hooks.beforeGet = fail;
    if (phase === "write") h.hooks.beforeSet = fail;
    await assert.rejects(h.store.compareAndSwap(empty, attempt()), error => code("attempt_store_unavailable")(error) && !(error as Error).message.includes("private-verifier"));
    assert.equal(h.state.writes, 1);
  });
}

test("an ambiguous completed write is not retried or reported successful", async () => {
  const h = fixture();
  const empty = await h.store.load();
  h.hooks.afterSet = async () => { throw new Error("lost acknowledgement"); };
  await assert.rejects(h.store.compareAndSwap(empty, attempt()), code("attempt_store_unavailable"));
  delete h.hooks.afterSet;
  assert.equal((await h.store.load()).revision, 1);
  assert.equal(await h.store.compareAndSwap(empty, attempt()), false);
  assert.equal(h.state.writes, 2);
});

test("malformed and secret-bearing completed state is rejected without erasing it", async () => {
  const h = fixture();
  const invalid = { browserSessionId: h.state.session, revision: 0, attempt: null, verifier: "private-invalid" };
  h.state.values[KEY] = invalid;
  await assert.rejects(h.store.load(), code("attempt_invalid"));
  assert.equal(h.state.writes, 0);
  assert.deepEqual(h.state.values[KEY], invalid);
});

test("new malformed or cross-session attempts and revision overflow cannot be persisted", async () => {
  const h = fixture();
  const empty = await h.store.load();
  await assert.rejects(h.store.compareAndSwap(empty, { ...attempt(), unknown: "private" } as unknown as HostedPkceStoredAttempt), code("attempt_invalid"));
  await assert.rejects(h.store.compareAndSwap(empty, attempt("browser-session.2")), code("attempt_invalid"));
  h.state.values[KEY] = { ...empty, revision: Number.MAX_SAFE_INTEGER };
  await assert.rejects(h.store.compareAndSwap({ ...empty, revision: Number.MAX_SAFE_INTEGER }, null), code("attempt_invalid"));
  assert.equal(h.state.writes, 1);
});

test("missing session area never substitutes local or sync storage", async () => {
  const prior = Object.getOwnPropertyDescriptor(globalThis, "chrome");
  let otherWrites = 0;
  Object.defineProperty(globalThis, "chrome", { configurable: true, value: { storage: { local: { set: () => { otherWrites += 1; } }, sync: { set: () => { otherWrites += 1; } } } } });
  try {
    const h = fixture();
    await assert.rejects(browserSessionPkceAttemptStore({ authenticationTabs: h.authenticationTabs }).load(), code("attempt_store_unavailable"));
    assert.equal(otherWrites, 0);
  } finally {
    if (prior) Object.defineProperty(globalThis, "chrome", prior);
    else Reflect.deleteProperty(globalThis, "chrome");
  }
});
